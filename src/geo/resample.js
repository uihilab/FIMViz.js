// resample.js — bring several raster grids onto ONE common grid before a pixel-wise op
// (comparison today; ensemble later). Pure JS, headless: no GDAL, no DOM.
//
// Two orthogonal choices, mirroring the design agreed for comparison:
//   • GRID POLICY — which target RESOLUTION to land on:
//       low     → the coarsest input's pixel size (downsample the finer rasters)
//       high    → the finest input's pixel size   (upsample the coarser rasters)
//       average → the mean pixel size across inputs (resample everything)
//   • METHOD — HOW to interpolate a source grid onto the target. We speak GDAL's `gdalwarp -r`
//     vocabulary (RESAMPLE_METHODS) so callers name one thing. The sentinel-safe pure-JS kernels
//     (`nearest`, `bilinear`, `average`) are implemented here and run headlessly. The richer GDAL
//     methods (cubic/cubicspline/lanczos/mode/min/max/med/q1/q3) are done at the BUFFER level by
//     geo/gdal.js `warpToGrid` (GDAL is async + buffer-oriented) — the caller resamples the source
//     GeoTIFFs onto the common grid there, then runs the aligned pixels through the headless compute.
//     `registerResampler` remains a generic SYNCHRONOUS pixel-level escape hatch for a host that has
//     one; with none registered, a non-JS method here throws rather than silently degrading.
//
// META shape is the engine's raster meta: { width, height, bw, bs, be, bn } (west/south/east/north),
// matching comparisonMetrics / the comparison controller. Sampling is by GEOGRAPHIC coordinate, so
// inputs need not share bounds — non-overlap resolves to `noData`.

export const GRID_POLICY = { LOW: "low", HIGH: "high", AVERAGE: "average" };

// gdalwarp -r method names, in one place so callers use one vocabulary across the JS and GDAL paths.
export const RESAMPLE_METHODS = [
  "nearest", "bilinear", "average",                       // implemented headlessly below
  "cubic", "cubicspline", "lanczos", "mode",              // GDAL-only (need a registered resampler)
  "min", "max", "med", "q1", "q3",
];
const JS_METHODS = new Set(["nearest", "bilinear", "average"]);

// Host-registered resampler for the GDAL-only methods: (pixels, srcMeta, dstMeta, {method, noData}) → pixels.
let _resampler = null;
export function registerResampler(fn) { _resampler = typeof fn === "function" ? fn : null; }

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Degrees-per-pixel of a grid: { x, y }. */
export function pixelSize(meta) {
  return { x: (meta.be - meta.bw) / meta.width, y: (meta.bn - meta.bs) / meta.height };
}

function sameGrid(a, b) {
  return a.width === b.width && a.height === b.height &&
    a.bw === b.bw && a.bs === b.bs && a.be === b.be && a.bn === b.bn;
}

/**
 * The common target grid for a set of source grids under `policy`. Footprint is the UNION of all
 * bounds; resolution is the coarsest / finest / mean pixel size per the policy.
 */
export function resolveTargetGrid(metas, policy = GRID_POLICY.HIGH) {
  if (!metas?.length) throw new Error("resolveTargetGrid: need at least one meta");
  const bw = Math.min(...metas.map((m) => m.bw));
  const be = Math.max(...metas.map((m) => m.be));
  const bs = Math.min(...metas.map((m) => m.bs));
  const bn = Math.max(...metas.map((m) => m.bn));
  const sizes = metas.map(pixelSize);
  let psx, psy;
  if (policy === GRID_POLICY.LOW) { psx = Math.max(...sizes.map((s) => s.x)); psy = Math.max(...sizes.map((s) => s.y)); }
  else if (policy === GRID_POLICY.HIGH) { psx = Math.min(...sizes.map((s) => s.x)); psy = Math.min(...sizes.map((s) => s.y)); }
  else if (policy === GRID_POLICY.AVERAGE) { psx = mean(sizes.map((s) => s.x)); psy = mean(sizes.map((s) => s.y)); }
  else throw new Error(`resolveTargetGrid: unknown policy "${policy}" (use low | high | average)`);
  return {
    width: Math.max(1, Math.round((be - bw) / psx)),
    height: Math.max(1, Math.round((bn - bs) / psy)),
    bw, bs, be, bn,
  };
}

// fractional source-pixel coords (pixel CENTERS at integer+0.5) for a geographic point.
function srcFrac(m, lng, lat) {
  return {
    fx: ((lng - m.bw) / (m.be - m.bw)) * m.width - 0.5,
    fy: ((m.bn - lat) / (m.bn - m.bs)) * m.height - 0.5,
  };
}

function nearestAt(pixels, m, lng, lat, noData) {
  const { fx, fy } = srcFrac(m, lng, lat);
  const sx = Math.round(fx), sy = Math.round(fy);
  if (sx < 0 || sy < 0 || sx >= m.width || sy >= m.height) return noData;
  return pixels[sy * m.width + sx];
}

function bilinearAt(pixels, m, lng, lat, noData) {
  const { fx, fy } = srcFrac(m, lng, lat);
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const at = (x, y) => {
    const cx = Math.min(m.width - 1, Math.max(0, x));
    const cy = Math.min(m.height - 1, Math.max(0, y));
    return pixels[cy * m.width + cx];
  };
  const v00 = at(x0, y0), v10 = at(x0 + 1, y0), v01 = at(x0, y0 + 1), v11 = at(x0 + 1, y0 + 1);
  // A nodata neighbour makes interpolation meaningless — fall back to nearest for that target pixel.
  if (noData != null && (v00 === noData || v10 === noData || v01 === noData || v11 === noData)) {
    return nearestAt(pixels, m, lng, lat, noData);
  }
  const top = v00 * (1 - tx) + v10 * tx;
  const bot = v01 * (1 - tx) + v11 * tx;
  return top * (1 - ty) + bot * ty;
}

// Box-average of the source pixels a target cell covers (a true downsample). Upsampling (the target
// cell is smaller than one source pixel) collapses to nearest.
function averageBox(pixels, src, dst, dx, dy, noData) {
  const lng0 = dst.bw + (dx / dst.width) * (dst.be - dst.bw);
  const lng1 = dst.bw + ((dx + 1) / dst.width) * (dst.be - dst.bw);
  const latN = dst.bn - (dy / dst.height) * (dst.bn - dst.bs);
  const latS = dst.bn - ((dy + 1) / dst.height) * (dst.bn - dst.bs);
  let sx0 = Math.floor(((lng0 - src.bw) / (src.be - src.bw)) * src.width);
  let sx1 = Math.ceil(((lng1 - src.bw) / (src.be - src.bw)) * src.width);
  let sy0 = Math.floor(((src.bn - latN) / (src.bn - src.bs)) * src.height);
  let sy1 = Math.ceil(((src.bn - latS) / (src.bn - src.bs)) * src.height);
  sx0 = Math.max(0, sx0); sy0 = Math.max(0, sy0);
  sx1 = Math.min(src.width, sx1); sy1 = Math.min(src.height, sy1);
  if (sx1 <= sx0 || sy1 <= sy0) {                              // sub-pixel target → nearest
    return nearestAt(pixels, src, (lng0 + lng1) / 2, (latN + latS) / 2, noData);
  }
  let sum = 0, k = 0;
  for (let sy = sy0; sy < sy1; sy++) {
    for (let sx = sx0; sx < sx1; sx++) {
      const v = pixels[sy * src.width + sx];
      if (noData != null && v === noData) continue;
      sum += v; k++;
    }
  }
  return k ? sum / k : noData;
}

/**
 * Resample `pixels` from `srcMeta` onto `dstMeta`. Same-grid is a no-op (returns the input). Output
 * is a typed array of the SAME constructor as the input.
 */
export function resampleGrid(pixels, srcMeta, dstMeta, { method = "nearest", noData = null } = {}) {
  if (sameGrid(srcMeta, dstMeta)) return pixels;
  if (!JS_METHODS.has(method)) {
    if (_resampler) return _resampler(pixels, srcMeta, dstMeta, { method, noData });
    if (!RESAMPLE_METHODS.includes(method)) throw new Error(`resampleGrid: unknown method "${method}"`);
    throw new Error(`resampleGrid: method "${method}" needs a registered resampler ` +
      "(registerResampler) — the GDAL-backed methods run only in the browser. " +
      "Headless methods: nearest, bilinear, average.");
  }
  const out = new pixels.constructor(dstMeta.width * dstMeta.height);
  const fill = noData == null ? 0 : noData;
  for (let dy = 0; dy < dstMeta.height; dy++) {
    for (let dx = 0; dx < dstMeta.width; dx++) {
      const lng = dstMeta.bw + ((dx + 0.5) / dstMeta.width) * (dstMeta.be - dstMeta.bw);
      const lat = dstMeta.bn - ((dy + 0.5) / dstMeta.height) * (dstMeta.bn - dstMeta.bs);
      let v;
      if (method === "average") v = averageBox(pixels, srcMeta, dstMeta, dx, dy, noData);
      else if (method === "bilinear") v = bilinearAt(pixels, srcMeta, lng, lat, noData);
      else v = nearestAt(pixels, srcMeta, lng, lat, noData);
      out[dy * dstMeta.width + dx] = v == null ? fill : v;
    }
  }
  return out;
}

/**
 * Bring a set of rasters onto one common grid. `rasters` = [{ pixels, meta }].
 * Returns `{ grid, rasters: [{ pixels, meta: grid }] }` — every layer now on `grid`, ready for a
 * pixel-aligned op (classifyExtents, etc.).
 *
 * `method` is the interpolation for every layer (default `nearest`, the sentinel-safe choice for
 * categorical extent rasters); `noData` is the value to treat as empty and to fill gaps with.
 */
export function alignRasters(rasters, { policy = GRID_POLICY.HIGH, method = "nearest", noData = null } = {}) {
  if (!rasters?.length) throw new Error("alignRasters: no rasters");
  const grid = resolveTargetGrid(rasters.map((r) => r.meta), policy);
  return {
    grid,
    rasters: rasters.map((r) => ({ pixels: resampleGrid(r.pixels, r.meta, grid, { method, noData }), meta: grid })),
  };
}
