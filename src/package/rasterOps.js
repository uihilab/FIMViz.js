// rasterOps.js — pure raster-grid transforms backing the lazy Dataset ops clip / mask / reclassify
// (docs/PACKAGE_ROADMAP.md §2). PURE + node-testable: no DOM, no GDAL. Each takes a decoded
// RasterGrid and returns a NEW RasterGrid (the source is never mutated). The heavy GDAL variants
// (gdalwarp -cutline, gdal_calc) are a later optimisation for large rasters — these decoded-grid
// transforms cover the immediate FIM analysis needs and run anywhere.
//
// Masked / unmatched pixels become NaN in a Float64Array copy, which colorizeGrid (rasterImage.js)
// and Stats already treat as transparent / excluded — so "reduce to the cut" needs no new sentinel.

import { RasterGrid } from "./materialize.js";
import { SpatialFilter } from "./filter.js";
import { resampleGrid } from "../geo/resample.js";

const asFilter = (p) => (p instanceof SpatialFilter ? p : new SpatialFilter(p));
// RasterGrid.bounds{north,south,east,west} → the {bw,bs,be,bn,width,height} meta resample/pixelBbox use.
const gridMeta = (g) => ({ bw: g.bounds.west, bs: g.bounds.south, be: g.bounds.east, bn: g.bounds.north, width: g.width, height: g.height });

/**
 * Mask a grid by a polygon: pixels OUTSIDE the polygon become NaN (or inside, with `invert`). The
 * footprint/bounds are unchanged. Restricts the point-in-polygon scan to the polygon's pixel bbox.
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
 * Crop a grid to a bbox (intersected with the grid footprint), snapped to pixel edges → a smaller
 * grid with new bounds. Preserves the pixel array's type.
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
 * Value remap. `rules` is EITHER an array of `{ min?, max?, value? }` range rules (a pixel v matches
 * the first rule whose `(min==null||v>=min) && (max==null||v<max)`; the output is `value` when
 * present, else v — a "keep in range" band) OR a single CALLBACK `(value, index) => number|null` —
 * called once per valid pixel with its raw value and its flat row-major index (`row*width+col`),
 * returning the new value directly (bypassing rule-matching entirely, so it isn't limited to a
 * contiguous range — any per-pixel logic, including index-dependent logic, works). Either form:
 * `null`/`undefined` means "unmatched" → NaN (`unmatched:'nodata'`, default) or v (`'keep'`).
 * Existing NaN/noData pixels stay transparent, never passed to a rule or the callback. NOTE: a
 * callback does NOT survive Dataset.toRecord() (structured-clone can't carry functions) — that call
 * throws naming the op rather than silently dropping it; use range rules for a chain that needs to
 * persist/reload.
 * @param {RasterGrid} grid
 * @param {Array<{min?:number,max?:number,value?:number}>|((value:number,index:number)=>number|null|undefined)} rules
 * @param {{ unmatched?: 'nodata'|'keep' }} [opts]
 * @returns {RasterGrid} - carries `meta.unmatchedCount` (omitted when 0) when `unmatched: 'nodata'`
 *   (the default) actually turned some previously-VALID pixels into holes — i.e. the rules/callback
 *   didn't cover this raster's value range. Dataset's reclassify op reads this to warn.
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

// Per-pixel reducers over the aligned input values (NaN = a noData/absent input at that pixel).
const REDUCERS = {
  difference: (v) => (v.length >= 2 && !Number.isNaN(v[0]) && !Number.isNaN(v[1])) ? v[0] - v[1] : NaN,
  ratio:      (v) => (v.length >= 2 && !Number.isNaN(v[0]) && !Number.isNaN(v[1]) && v[1] !== 0) ? v[0] / v[1] : NaN,
  sum:  (v) => { const f = v.filter((x) => !Number.isNaN(x)); return f.length ? f.reduce((a, b) => a + b, 0) : NaN; },
  mean: (v) => { const f = v.filter((x) => !Number.isNaN(x)); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : NaN; },
  min:  (v) => { const f = v.filter((x) => !Number.isNaN(x)); return f.length ? Math.min(...f) : NaN; },
  max:  (v) => { const f = v.filter((x) => !Number.isNaN(x)); return f.length ? Math.max(...f) : NaN; },
};

/**
 * Combine N aligned rasters per pixel (band math). LHS-conform: every other grid is resampled onto
 * grids[0]'s exact grid in memory, then reduced by `op`. `difference`/`ratio` are binary; `sum`/`mean`/
 * `min`/`max` are N-ary and skip noData/NaN inputs. Result carries grids[0]'s bounds/dims.
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
 * Zonal statistics: per-zone min/max/mean/sum/count/area over a raster. `zones` = [{ id?, polygon | filter }]
 * (a ring/multi-ring of {lat,lng}|[lat,lng], or a SpatialFilter). noData/NaN pixels are excluded; `area`
 * is in the bounds' units² (WGS84 → deg²; scale to metres in the caller if needed).
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

// ---- terrain (Horn's 1981 3×3-window gradient — the algorithm gdaldem slope/aspect/hillshade use).
// Pure JS on the decoded grid, no GDAL: `cellsizeX/Y` default to the grid's own pixel size in the
// bounds' units (degrees for WGS84 — pass an explicit metres value for a true-scale result, the same
// "caller scales the units" contract zonalStats' `area` already makes). Edge pixels clamp to the
// nearest interior row/column (footprint unchanged, unlike clipGrid); a NaN/noData neighbour
// propagates NaN (a terrain pixel needs its full 3×3 window).

function terrainCellSize(grid, cellsizeX, cellsizeY) {
  const { width, height, bounds } = grid;
  return {
    cx: cellsizeX ?? (bounds ? (bounds.east - bounds.west) / width : 1),
    cy: cellsizeY ?? (bounds ? (bounds.north - bounds.south) / height : 1),
  };
}

// The 3×3 window (a..i, row-major) around (r,c), edges clamped to the grid. NaN/noData → NaN.
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
 * Slope — per-pixel terrain steepness via Horn's method (gdaldem's slope algorithm), computed in pure
 * JS on the decoded grid. `unit:'degrees'|'percent'`; `zFactor` scales elevation before the gradient
 * (vertical exaggeration / unit conversion, e.g. feet→metres).
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
 * Aspect — the downslope compass bearing via Horn's method (gdaldem's aspect algorithm, cellsize-free
 * like GDAL's own — it assumes square pixels): 0=north, 90=east, clockwise. Flat pixels (no gradient)
 * → -1 (gdaldem's flat sentinel).
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
 * Hillshade — a shaded-relief illumination raster via Horn's method (gdaldem's default hillshade
 * algorithm): 0 (dark) – 255 (bright). `altitude`/`azimuth` are the light source's elevation/compass
 * bearing in degrees (defaults: gdaldem's own — a 45°-high sun from the NW).
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

// A GeoJSON Polygon/MultiPolygon → the exterior ring(s) SpatialFilter expects ({lat,lng} rings).
// Holes are ignored (a quick pure-JS burn, not a full even-odd fill) — the same simplification
// SpatialFilter's multi-ring input already makes elsewhere (rings union, not subtract).
function geometryToRings(geom) {
  if (!geom) return [];
  const toPts = (ring) => ring.map(([lng, lat]) => ({ lat, lng }));
  if (geom.type === "Polygon") return geom.coordinates.length ? [toPts(geom.coordinates[0])] : [];
  if (geom.type === "MultiPolygon") return geom.coordinates.filter((p) => p.length).map((poly) => toPts(poly[0]));
  return [];
}

/**
 * Rasterize vector features onto a new grid (vector→raster, the kind-changing op). Each pixel
 * centre is point-tested against every feature's polygon; `field` burns the feature's property value,
 * omit for a constant `burnValue`. Later features in the collection win where they overlap (burn order
 * = draw order). Polygon/MultiPolygon geometry only — point/line features are ignored.
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
