// rasterOps.js — pure grid transforms behind the lazy Dataset ops ds.clip, ds.mask and
// ds.reclassify (docs/PACKAGE_ROADMAP.md §2). No DOM and no GDAL, so they run under node. Each takes
// a decoded RasterGrid and returns a new one, never mutating the source. The GDAL equivalents,
// gdalwarp -cutline and gdal_calc, are a later optimization for large rasters. These cover the FIM
// analysis needs today and run anywhere.
//
// A masked or unmatched pixel becomes NaN in a Float64Array copy. colorizeGrid (rasterImage.js)
// already draws NaN as transparent and Stats already excludes it, so cutting a grid needs no new
// sentinel value.

import { RasterGrid } from "./materialize.js";
import { SpatialFilter } from "./filter.js";
import { resampleGrid } from "../geo/resample.js";

const asFilter = (p) => (p instanceof SpatialFilter ? p : new SpatialFilter(p));
/**
 * Converts a RasterGrid to the `{bw,bs,be,bn,width,height}` meta that resample, pixelBbox and
 * Stats.raster read. Exported because every headless user needs it: a RasterGrid carries
 * `bounds.west`, those readers want `bw`, and rewriting the conversion by hand is the only
 * alternative.
 * @param {import('./materialize.js').RasterGrid} g
 * @returns {{bw: number, bs: number, be: number, bn: number, width: number, height: number, noData: number|string|null, unit: string|null}}
 */
export const gridMeta = (g) => ({
  bw: g.bounds.west, bs: g.bounds.south, be: g.bounds.east, bn: g.bounds.north,
  width: g.width, height: g.height, noData: g.noData ?? null, unit: g.meta?.unit ?? null,
});

/**
 * Masks a grid by a polygon. Pixels outside it become NaN, or inside it with `invert`. The bounds
 * do not change. Scans only the polygon's pixel bbox rather than the whole grid.
 * @param {RasterGrid} grid
 * @param {SpatialFilter|Array} polygon - a SpatialFilter, or a ring/multi-ring of {lat,lng}|[lat,lng]
 * @param {{ invert?: boolean }} [opts]
 * @returns {RasterGrid}
 */
export function maskGrid(grid, polygon, { invert = false } = {}) {
  const filter = asFilter(polygon);
  const { pixels, width, height, bounds } = grid;
  const { north, south, east, west } = bounds;
  const out = new Float64Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) out[i] = pixels[i];
  const { x0, x1, y0, y1 } = filter.pixelBbox({ bw: west, bs: south, be: east, bn: north, width, height });
  for (let r = 0; r < height; r++) {
    const lat = north - ((r + 0.5) / height) * (north - south);
    const inBandY = r >= y0 && r <= y1;
    for (let c = 0; c < width; c++) {
      let inside = false;
      if (inBandY && c >= x0 && c <= x1) {
        const lng = west + ((c + 0.5) / width) * (east - west);
        inside = filter.contains(lat, lng);
      }
      if ((invert ? inside : !inside)) out[r * width + c] = NaN;
    }
  }
  return new RasterGrid({ ...grid, pixels: out });
}

/**
 * Crops a grid to a bbox, intersected with the grid's own footprint and snapped to pixel edges,
 * giving a smaller grid with new bounds. Keeps the pixel array's type.
 * @param {RasterGrid} grid
 * @param {{north:number,south:number,east:number,west:number}} bbox
 * @returns {RasterGrid}
 */
export function clipGrid(grid, bbox) {
  const { pixels, width, height, bounds } = grid;
  const { north, south, east, west } = bounds;
  const n = Math.min(north, bbox.north), s = Math.max(south, bbox.south);
  const e = Math.min(east, bbox.east), w = Math.max(west, bbox.west);
  if (n <= s || e <= w) throw new Error("clip: the bbox does not overlap the raster footprint");
  const pxW = (east - west) / width, pxH = (north - south) / height;
  const c0 = Math.max(0, Math.floor((w - west) / pxW));
  const c1 = Math.min(width, Math.ceil((e - west) / pxW));
  const r0 = Math.max(0, Math.floor((north - n) / pxH));
  const r1 = Math.min(height, Math.ceil((north - s) / pxH));
  const nw = c1 - c0, nh = r1 - r0;
  const out = new pixels.constructor(nw * nh);
  for (let r = 0; r < nh; r++) {
    for (let c = 0; c < nw; c++) out[r * nw + c] = pixels[(r0 + r) * width + (c0 + c)];
  }
  const newBounds = { west: west + c0 * pxW, east: west + c1 * pxW, north: north - r0 * pxH, south: north - r1 * pxH };
  return new RasterGrid({ ...grid, pixels: out, width: nw, height: nh, bounds: newBounds });
}

/**
 * Remaps pixel values. `rules` takes one of two forms.
 *
 * An array of `{ min?, max?, value? }` range rules: a pixel v matches the first rule where
 * `(min==null||v>=min) && (max==null||v<max)`, and the output is that rule's `value`, or v itself
 * when it has none, which keeps the band unchanged.
 *
 * A callback `(value, index) => number|null`: it runs once per valid pixel with the raw value and
 * the flat row-major index `row*width+col`, and returns the new value directly. It skips rule
 * matching, so it is not limited to a contiguous range and index-dependent logic works.
 *
 * Either form returning `null` or `undefined` marks the pixel unmatched, which becomes NaN under
 * the default `unmatched:'nodata'` or keeps v under `'keep'`. A pixel already NaN or noData stays
 * transparent and reaches neither a rule nor the callback.
 *
 * A callback does not survive Dataset.toRecord(), because structured clone cannot carry a function.
 * That call throws and names the op rather than dropping it, so use range rules for a
 * chain that has to persist and reload.
 * @param {RasterGrid} grid
 * @param {Array<{min?:number,max?:number,value?:number}>|((value:number,index:number)=>number|null|undefined)} rules
 * @param {{ unmatched?: 'nodata'|'keep' }} [opts]
 * @returns {RasterGrid} - carries `meta.unmatchedCount` when the default `unmatched: 'nodata'`
 *   turned previously valid pixels into holes, meaning the rules did not cover this raster's value
 *   range. Omitted at 0. Dataset's reclassify op reads it to warn.
 */
export function reclassifyGrid(grid, rules, { unmatched = "nodata" } = {}) {
  const { pixels, noData } = grid;
  const out = new Float64Array(pixels.length);
  const isFn = typeof rules === "function";
  let unmatchedCount = 0;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (Number.isNaN(v) || (noData != null && v === noData)) { out[i] = NaN; continue; }
    let result;
    if (isFn) {
      result = rules(v, i);
    } else {
      result = undefined;
      for (let k = 0; k < rules.length; k++) {
        const rule = rules[k];
        if ((rule.min == null || v >= rule.min) && (rule.max == null || v < rule.max)) {
          result = "value" in rule ? rule.value : v;
          break;
        }
      }
    }
    if (result == null) {
      out[i] = unmatched === "keep" ? v : NaN;
      if (unmatched !== "keep") unmatchedCount++;   // a hole this call actually created, not pre-existing noData
    } else {
      out[i] = result;
    }
  }
  return new RasterGrid({
    ...grid, pixels: out,
    meta: unmatchedCount > 0 ? { ...grid.meta, unmatchedCount } : grid.meta,
  });
}

// Per-pixel reducers over the aligned input values. NaN means that input is absent at that pixel.
const REDUCERS = {
  difference: (v) => (v.length >= 2 && !Number.isNaN(v[0]) && !Number.isNaN(v[1])) ? v[0] - v[1] : NaN,
  ratio:      (v) => (v.length >= 2 && !Number.isNaN(v[0]) && !Number.isNaN(v[1]) && v[1] !== 0) ? v[0] / v[1] : NaN,
  sum:  (v) => { const f = v.filter((x) => !Number.isNaN(x)); return f.length ? f.reduce((a, b) => a + b, 0) : NaN; },
  mean: (v) => { const f = v.filter((x) => !Number.isNaN(x)); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : NaN; },
  min:  (v) => { const f = v.filter((x) => !Number.isNaN(x)); return f.length ? Math.min(...f) : NaN; },
  max:  (v) => { const f = v.filter((x) => !Number.isNaN(x)); return f.length ? Math.max(...f) : NaN; },
};

/**
 * Combines N aligned rasters pixel by pixel. Resamples the other grids onto grids[0]'s exact grid
 * in memory, then reduces with `op`. `difference` and `ratio` take two grids; `sum`, `mean`, `min`
 * and `max` take any number and skip absent inputs. The result carries grids[0]'s bounds and dims.
 * @param {RasterGrid[]} grids
 * @param {{ op?: 'difference'|'ratio'|'sum'|'mean'|'min'|'max', method?: string }} [opts]
 * @returns {RasterGrid}
 */
export function combineGrids(grids, { op = "difference", method = "nearest" } = {}) {
  if (!grids?.length) throw new Error("combine: no input grids");
  const reducer = REDUCERS[op];
  if (!reducer) throw new Error(`combine: unknown op "${op}" (${Object.keys(REDUCERS).join(", ")})`);
  const base = grids[0];
  const baseMeta = gridMeta(base);
  const arrays = grids.map((g, i) => (i === 0 ? g.pixels : resampleGrid(g.pixels, gridMeta(g), baseMeta, { method, noData: g.noData })));
  const nds = grids.map((g) => g.noData);
  const n = base.width * base.height;
  const out = new Float64Array(n);
  const vals = new Array(arrays.length);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < arrays.length; k++) {
      const v = arrays[k][i];
      vals[k] = (Number.isNaN(v) || (nds[k] != null && v === nds[k])) ? NaN : v;
    }
    out[i] = reducer(vals);
  }
  return new RasterGrid({ ...base, pixels: out, noData: null });
}

/**
 * Groups a raster's pixels by another raster's values and reduces each group. It is the third kind
 * of reduction here: `reduce()` collapses a selection axis, `zonalStats()` collapses space by
 * geometry, and this collapses space by value. That gives mean depth per land-use class, rainfall
 * binned by elevation, or a rating curve of one variable against another.
 *
 * It is neither `select`/`reduce` nor an overload of `zonalStats`, because the grouping key comes
 * from data rather than from the axis model or from geometry.
 *
 * `by` is resampled onto `grid`'s cells the same way `combineGrids` conforms its inputs, using the
 * same rule and resampler, so both agree on what aligned means.
 *
 * Two grouping modes. Discrete, the default, makes each distinct value of `by` a class, which suits
 * a classification raster such as land use where the values are already the categories. Binned takes
 * `bins: [0, 100, 500]` as explicit edges, or `bins: 5` to cut `by`'s finite range into five
 * equal-width bands, which suits a continuous `by` such as elevation where distinct values are
 * useless.
 *
 * A pixel is skipped when either raster is absent there, so the result covers only cells where both
 * hold a value.
 *
 * @param {RasterGrid} grid - the values being reduced
 * @param {RasterGrid} by - the values that define the groups
 * @param {{ bins?: number|number[], method?: string, noData?: number, byNoData?: number }} [opts]
 * @returns {Array<{class: number|string, range?: [number, number], count: number, sum: number,
 *   min: number|null, max: number|null, mean: number|null, area: number}>} one row per non-empty
 *   group, ordered by class/bin
 */
export function groupByGrid(grid, by, { bins, method = "nearest", noData, byNoData } = {}) {
  if (!grid?.pixels || !by?.pixels) throw new Error("groupBy: two grids are required");
  const meta = gridMeta(grid);
  const byPixels = (by.width === grid.width && by.height === grid.height
    && by.bounds.west === grid.bounds.west && by.bounds.north === grid.bounds.north
    && by.bounds.east === grid.bounds.east && by.bounds.south === grid.bounds.south)
    ? by.pixels
    : resampleGrid(by.pixels, gridMeta(by), meta, { method, noData: by.noData });

  const nd = noData ?? grid.noData;
  const bnd = byNoData ?? by.noData;
  const absent = (v, sentinel) => Number.isNaN(v) || (sentinel != null && v === sentinel);
  const { north, south, east, west } = grid.bounds;
  const pxArea = ((east - west) / grid.width) * ((north - south) / grid.height);

  // Bin edges. A count cuts `by`'s own finite range; an explicit array is taken as given.
  let edges = null;
  if (Array.isArray(bins)) {
    edges = [...bins].sort((a, b) => a - b);
  } else if (Number.isFinite(bins) && bins > 0) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < byPixels.length; i++) {
      const b = byPixels[i];
      if (absent(b, bnd)) continue;
      if (b < lo) lo = b;
      if (b > hi) hi = b;
    }
    if (!Number.isFinite(lo)) return [];
    const step = (hi - lo) / bins || 1;
    edges = Array.from({ length: bins + 1 }, (_, i) => lo + i * step);
  }
  // The last bin is closed at the top, so the maximum value falls inside it rather than out.
  const binOf = (b) => {
    for (let i = 0; i < edges.length - 1; i++) {
      if (b >= edges[i] && (b < edges[i + 1] || i === edges.length - 2)) return i;
    }
    return null;
  };

  const acc = new Map();
  for (let i = 0; i < grid.pixels.length; i++) {
    const v = grid.pixels[i], b = byPixels[i];
    if (absent(v, nd) || absent(b, bnd)) continue;
    const key = edges ? binOf(b) : b;
    if (key == null) continue;
    let a = acc.get(key);
    if (!a) acc.set(key, (a = { count: 0, sum: 0, min: Infinity, max: -Infinity }));
    a.count++; a.sum += v;
    if (v < a.min) a.min = v;
    if (v > a.max) a.max = v;
  }

  return [...acc.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([key, a]) => ({
      class: edges ? key : key,
      ...(edges ? { range: [edges[key], edges[key + 1]] } : {}),
      count: a.count, sum: a.sum,
      min: a.count ? a.min : null, max: a.count ? a.max : null,
      mean: a.count ? a.sum / a.count : null,
      area: a.count * pxArea,
    }));
}

/**
 * Per-zone min, max, mean, sum, count and area over a raster. Each zone is
 * `{ id?, polygon | filter }`, where polygon is a ring or multi-ring of {lat,lng} or [lat,lng].
 * Absent pixels are excluded. `area` is in the square of the bounds' units, so WGS84 gives degrees
 * squared and the user scales it to meters.
 * @param {RasterGrid} grid
 * @param {Array<{id?: any, polygon?: Array, filter?: SpatialFilter}>} zones
 * @param {{ noData?: number }} [opts]
 * @returns {Array<{id: any, count: number, sum: number, min: number|null, max: number|null, mean: number|null, area: number}>}
 */
export function zonalStats(grid, zones, { noData } = {}) {
  const { pixels, width, height, bounds } = grid;
  const nd = noData ?? grid.noData;
  const { north, south, east, west } = bounds;
  const pxArea = ((east - west) / width) * ((north - south) / height);
  const meta = { bw: west, bs: south, be: east, bn: north, width, height };
  return zones.map((z) => {
    const filter = z.filter instanceof SpatialFilter ? z.filter : new SpatialFilter(z.polygon || z.filter);
    const { x0, x1, y0, y1 } = filter.pixelBbox(meta);
    let count = 0, sum = 0, min = Infinity, max = -Infinity;
    for (let r = y0; r <= y1; r++) {
      const lat = north - ((r + 0.5) / height) * (north - south);
      for (let c = x0; c <= x1; c++) {
        const v = pixels[r * width + c];
        if (Number.isNaN(v) || (nd != null && v === nd)) continue;
        const lng = west + ((c + 0.5) / width) * (east - west);
        if (!filter.contains(lat, lng)) continue;
        count++; sum += v; if (v < min) min = v; if (v > max) max = v;
      }
    }
    return { id: z.id ?? null, count, sum, min: count ? min : null, max: count ? max : null, mean: count ? sum / count : null, area: count * pxArea };
  });
}

// ---- terrain: Horn's 1981 3x3-window gradient, what gdaldem slope, aspect and hillshade use ----
// Pure JS over the decoded grid, with no GDAL. `cellsizeX` and `cellsizeY` default to the grid's own
// pixel size in the bounds' units, so WGS84 gives degrees; pass explicit meters for a true-scale
// result, as zonalStats' `area` also requires. An edge pixel clamps to the nearest interior row or
// column, leaving the footprint unchanged, unlike clipGrid. An absent neighbor makes the result NaN,
// since a terrain pixel needs its full 3x3 window.

function terrainCellSize(grid, cellsizeX, cellsizeY) {
  const { width, height, bounds } = grid;
  return {
    cx: cellsizeX ?? (bounds ? (bounds.east - bounds.west) / width : 1),
    cy: cellsizeY ?? (bounds ? (bounds.north - bounds.south) / height : 1),
  };
}

// The 3x3 window a..i, row-major, around (r,c), with edges clamped to the grid. Absent gives NaN.
function windowAt(pixels, width, height, r, c, noData) {
  const at = (rr, cc) => {
    const v = pixels[Math.min(height - 1, Math.max(0, rr)) * width + Math.min(width - 1, Math.max(0, cc))];
    return (Number.isNaN(v) || (noData != null && v === noData)) ? NaN : v;
  };
  return [at(r - 1, c - 1), at(r - 1, c), at(r - 1, c + 1),
          at(r, c - 1),                   at(r, c + 1),
          at(r + 1, c - 1), at(r + 1, c), at(r + 1, c + 1)];
}

/**
 * Per-pixel terrain steepness by Horn's method, the algorithm gdaldem slope uses, in pure JS over
 * the decoded grid. `unit` is 'degrees' or 'percent'. `zFactor` scales elevation before the
 * gradient, for vertical exaggeration or a unit conversion such as feet to meters.
 * @param {RasterGrid} grid
 * @param {{ zFactor?: number, cellsizeX?: number, cellsizeY?: number, unit?: 'degrees'|'percent' }} [opts]
 * @returns {RasterGrid}
 */
export function slopeGrid(grid, { zFactor = 1, cellsizeX, cellsizeY, unit = "degrees" } = {}) {
  const { pixels, width, height, noData } = grid;
  const { cx, cy } = terrainCellSize(grid, cellsizeX, cellsizeY);
  const out = new Float64Array(pixels.length);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const [a, b, cc, d, f, g, h, i] = windowAt(pixels, width, height, r, c, noData);
      const idx = r * width + c;
      if ([a, b, cc, d, f, g, h, i].some(Number.isNaN)) { out[idx] = NaN; continue; }
      const dzdx = ((cc + 2 * f + i) - (a + 2 * d + g)) / (8 * cx);
      const dzdy = ((g + 2 * h + i) - (a + 2 * b + cc)) / (8 * cy);
      const rise = zFactor * Math.sqrt(dzdx * dzdx + dzdy * dzdy);
      out[idx] = unit === "percent" ? rise * 100 : Math.atan(rise) * (180 / Math.PI);
    }
  }
  return new RasterGrid({ ...grid, pixels: out, noData: null });
}

/**
 * The downslope compass bearing by Horn's method, the algorithm gdaldem aspect uses. Runs from 0 at
 * north through 90 at east, clockwise. It needs no cellsize, assuming square pixels as GDAL's does.
 * A flat pixel, having no gradient, returns -1, which is gdaldem's flat sentinel.
 * @param {RasterGrid} grid
 * @returns {RasterGrid}
 */
export function aspectGrid(grid) {
  const { pixels, width, height, noData } = grid;
  const out = new Float64Array(pixels.length);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const [a, b, cc, d, f, g, h, i] = windowAt(pixels, width, height, r, c, noData);
      const idx = r * width + c;
      if ([a, b, cc, d, f, g, h, i].some(Number.isNaN)) { out[idx] = NaN; continue; }
      const dx = (cc + 2 * f + i) - (a + 2 * d + g);
      const dy = (g + 2 * h + i) - (a + 2 * b + cc);
      if (dx === 0 && dy === 0) { out[idx] = -1; continue; }
      const deg = Math.atan2(dy, -dx) * (180 / Math.PI);
      out[idx] = deg <= 90 ? 90 - deg : 360 - deg + 90;
    }
  }
  return new RasterGrid({ ...grid, pixels: out, noData: null });
}

/**
 * A shaded-relief illumination raster by Horn's method, the algorithm gdaldem hillshade uses by
 * default. Values run from 0, dark, to 255, bright. `altitude` and `azimuth` give the light
 * source's elevation and compass bearing in degrees, defaulting to gdaldem's own 45-degree sun from
 * the northwest.
 * @param {RasterGrid} grid
 * @param {{ altitude?: number, azimuth?: number, zFactor?: number, cellsizeX?: number, cellsizeY?: number }} [opts]
 * @returns {RasterGrid}
 */
export function hillshadeGrid(grid, { altitude = 45, azimuth = 315, zFactor = 1, cellsizeX, cellsizeY } = {}) {
  const { pixels, width, height, noData } = grid;
  const { cx, cy } = terrainCellSize(grid, cellsizeX, cellsizeY);
  const zenith = (90 - altitude) * (Math.PI / 180);
  const az = (360 - azimuth + 90) * (Math.PI / 180);
  const out = new Float64Array(pixels.length);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const [a, b, cc, d, f, g, h, i] = windowAt(pixels, width, height, r, c, noData);
      const idx = r * width + c;
      if ([a, b, cc, d, f, g, h, i].some(Number.isNaN)) { out[idx] = NaN; continue; }
      const dzdx = ((cc + 2 * f + i) - (a + 2 * d + g)) / (8 * cx);
      const dzdy = ((g + 2 * h + i) - (a + 2 * b + cc)) / (8 * cy);
      const slopeRad = Math.atan(zFactor * Math.sqrt(dzdx * dzdx + dzdy * dzdy));
      const aspectRad = (dzdx === 0 && dzdy === 0) ? 0 : Math.atan2(dzdy, -dzdx);
      const shade = 255 * (Math.cos(zenith) * Math.cos(slopeRad) +
        Math.sin(zenith) * Math.sin(slopeRad) * Math.cos(az - aspectRad));
      out[idx] = Math.max(0, Math.min(255, shade));
    }
  }
  return new RasterGrid({ ...grid, pixels: out, noData: null });
}

// Converts a GeoJSON Polygon or MultiPolygon into the exterior {lat,lng} rings SpatialFilter takes.
// Holes are ignored, since this is a quick pure-JS burn rather than a full even-odd fill.
// SpatialFilter's multi-ring input makes the same simplification: rings union, never subtract.
function geometryToRings(geom) {
  if (!geom) return [];
  const toPts = (ring) => ring.map(([lng, lat]) => ({ lat, lng }));
  if (geom.type === "Polygon") return geom.coordinates.length ? [toPts(geom.coordinates[0])] : [];
  if (geom.type === "MultiPolygon") return geom.coordinates.filter((p) => p.length).map((poly) => toPts(poly[0]));
  return [];
}

/**
 * Rasterizes vector features onto a new grid, the one op that changes a Dataset's kind. Each pixel
 * center is point-tested against the features' polygons. `field` burns that feature property's
 * value; omit it to burn a constant `burnValue`. Where features overlap, the later one in the
 * collection wins, so burn order follows draw order. Reads Polygon and MultiPolygon geometry only,
 * ignoring point and line features.
 * @param {Object} featureCollection - a GeoJSON FeatureCollection (VectorFeatures.features)
 * @param {{north:number,south:number,east:number,west:number}} bounds - the OUTPUT grid's footprint
 * @param {{ width: number, height: number, field?: string, burnValue?: number }} opts
 * @returns {RasterGrid}
 */
export function rasterizeFeatures(featureCollection, bounds, { width, height, field, burnValue = 1 } = {}) {
  if (!width || !height) throw new Error("rasterize: { width, height } are required");
  const list = featureCollection?.features || featureCollection || [];
  const feats = list
    .map((f) => ({ value: field ? f.properties?.[field] : burnValue, filter: new SpatialFilter(geometryToRings(f.geometry)) }))
    .filter((f) => f.value != null && !f.filter.isEmpty());
  const { north, south, east, west } = bounds;
  const out = new Float64Array(width * height).fill(NaN);
  for (let r = 0; r < height; r++) {
    const lat = north - ((r + 0.5) / height) * (north - south);
    for (let c = 0; c < width; c++) {
      const lng = west + ((c + 0.5) / width) * (east - west);
      for (const f of feats) if (f.filter.contains(lat, lng)) out[r * width + c] = f.value;
    }
  }
  return new RasterGrid({ pixels: out, width, height, bounds, noData: null });
}
