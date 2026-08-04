// comparisonLayer.js — a Layer that compares N aligned extent rasters.
//
// The object form of a raster comparison: it holds the source
// rasters, brings them onto ONE grid (geo/resample.js), classifies + colours them
// (comparisonMetrics.combineExtentRgba), and — for the 2-layer case — scores them
// (compareExtentMetrics). It names no map SDK and no UI: it emits `computed` with pure DATA and a
// ui/*Tools binder renders it (event inversion), exactly like velocity/ensemble. The controller
// keeps only the google.maps overlay (building an image from `result.rgba` over `result.grid`).
//
// Sources are the parsed pixels + grid, NOT google objects, so this is fully headless/testable:
//   sources: [{ pixels, meta }]  — or RasterLayer instances (their rasterData + meta are used).
//
// Generalization: classification/visualization are N-ary (2–8 layers); the confusion-matrix metrics
// stay 2-ary (see comparisonMetrics.js). All grids are aligned first, so the inputs need NOT share a
// resolution — that is what retires the controller's old "images must have the same dimension" guard.

import { Layer, registerLayerType } from "./layer.js";
import { alignRasters, GRID_POLICY, RESAMPLE_METHODS } from "../geo/resample.js";
import { combineExtentRgba, compareExtentMetrics, DRY_DEFAULT } from "./comparisonMetrics.js";

const DEFAULT_POLICY = GRID_POLICY.HIGH;
const DEFAULT_METHOD = "nearest";

/**
 * Adapt a RasterGrid (a materialized Dataset) — which carries bounds+dims but not the resample meta
 * shape — into the `{ pixels, meta }` shape `alignRasters`/`toRaster` expect.
 * @internal @param {import('./materialize.js').RasterGrid} grid @returns {{pixels: ArrayBufferView, meta: Object}}
 */
export function gridToRaster(grid) {
  return {
    pixels: grid.pixels,
    meta: { bw: grid.bounds.west, bs: grid.bounds.south, be: grid.bounds.east, bn: grid.bounds.north,
      width: grid.width, height: grid.height, noData: grid.noData },
  };
}

// A source may be a plain { pixels, meta }, a RasterLayer (rasterData + meta), or a materialized
// RasterGrid (pixels + bounds + width — a forced Dataset). A raw Dataset is NOT accepted here because
// forcing it is async — call `await layer.prepare()` first (it replaces Dataset sources with grids).
function toRaster(src) {
  if (!src) throw new Error("ComparisonLayer: a source is missing");
  // RasterGrid FIRST: it has an opaque `.meta` too (so the {pixels,meta} branch would wrongly claim
  // it with an empty resample meta). Its discriminator is a `bounds` object + `width`.
  if (src.pixels && src.bounds && src.width) return gridToRaster(src);   // RasterGrid
  if (src.pixels && src.meta) return { pixels: src.pixels, meta: src.meta };
  if (src.rasterData && src.meta) return { pixels: src.rasterData, meta: src.meta };
  if (typeof src.grid === "function") {
    throw new Error("ComparisonLayer: a Dataset source must be materialized first — " +
      "call `await layer.prepare()` before compute() (forcing a Dataset is async).");
  }
  throw new Error("ComparisonLayer: each source needs { pixels, meta } (or a RasterLayer / RasterGrid).");
}

export class ComparisonLayer extends Layer {
  /**
   * @param {Object} [opts] - see `Layer`'s constructor; `sources` here are `{pixels, meta}` or `RasterLayer`
   */
  constructor(opts = {}) {
    super({ ...opts, type: opts.type || "comparison" });
    this.result = null;        // last compute() output
    this._aligned = null;      // aligned pixel arrays, kept for lazy mask-scoped metric recompute
    this._grid = null;         // the common grid the compare ran on
    this._dryValue = DRY_DEFAULT;
  }

  /**
   * Align → classify+colour → (2-ary) score. Emits `computed` (→ the map bus as
   * `comparison:computed`) with { grid, rgba, counts, nLayers, metrics, warnings, aligned, dryValue }
   * and returns it. `aligned` (the per-layer aligned pixel arrays) + `dryValue` ride along so a UI
   * binder can recompute the metrics under a draw mask itself — the metrics rendering is inverted out
   * to ui/comparisonTools.js, and this keeps the event self-contained (no reach back into the layer).
   *
   * `policy` and `method` are OPTIONAL: when a caller omits (or mis-names) them, the compute still
   * runs on a sensible default (high / nearest) but records a message in `result.warnings` so the
   * host can surface it — a silent default hides that a resampling choice was never made.
   *
   * @param {object} [o]
   * @param {'low'|'high'|'average'} [o.policy]  target resolution (default high = finest).
   * @param {string} [o.method]                  resampling method (default nearest; sentinel-safe).
   * @param {Array}  [o.colors]                  2^n-1 colour override (see combineExtentRgba).
   * @param {number} [o.dryValue]                the "dry" sentinel (default -99999).
   * @param {Array}  [o.mask]                     draw polygon scoping the metrics.
   * @returns {{grid: Object, rgba: Uint8ClampedArray, counts: Object, nLayers: number, metrics: Object|null, policy: string, method: string, warnings: string[], aligned: Array, dryValue: number}}
   */
  compute({ policy, method, colors = null, dryValue = DRY_DEFAULT, mask = null } = {}) {
    const warnings = [];
    if (policy == null) {
      warnings.push(`No grid policy provided; defaulting to "${DEFAULT_POLICY}".`);
      policy = DEFAULT_POLICY;
    }
    if (method == null) {
      warnings.push(`No resampling method provided; defaulting to "${DEFAULT_METHOD}".`);
      method = DEFAULT_METHOD;
    } else if (!RESAMPLE_METHODS.includes(method)) {
      warnings.push(`Unknown resampling method "${method}"; using "${DEFAULT_METHOD}".`);
      method = DEFAULT_METHOD;
    }

    const rasters = this.sources.map(toRaster);
    const { grid, rasters: aligned } = alignRasters(rasters, { policy, method, noData: dryValue });
    const pixelArrays = aligned.map((r) => r.pixels);
    const { rgba, counts, nLayers } = combineExtentRgba(pixelArrays, { colors, dryValue });
    const metrics = nLayers === 2
      ? compareExtentMetrics(pixelArrays[0], pixelArrays[1], grid, { mask, dryValue })
      : null;

    this._aligned = pixelArrays;
    this._grid = grid;
    this._dryValue = dryValue;
    this.visible = true;
    this.result = { grid, rgba, counts, nLayers, metrics, policy, method, warnings, aligned: pixelArrays, dryValue };
    this.emit("computed", this.result);
    return this.result;
  }

  /**
   * Materialize any Dataset sources into RasterGrids so the synchronous compute() can consume them.
   * This is the async pre-step that lets Dataset flow into the (sync) compare without changing
   * compute()'s signature — `await layer.prepare(); layer.compute(opts)`. Non-Dataset sources
   * ({pixels,meta} / RasterLayer) pass through untouched.
   * @returns {Promise<ComparisonLayer>}
   */
  async prepare() {
    this.sources = await Promise.all(
      this.sources.map((s) => (typeof s?.grid === "function" ? s.grid() : s)));
    return this;
  }

  /** The aligned per-layer pixel arrays from the last compute() (all on `result.grid`). @returns {Array|null} */
  getAligned() { return this._aligned; }

  /**
   * Recompute ONLY the metrics under a new draw `mask`, reusing the already-aligned pixels — this is
   * what the lazy Metrics tab calls when the user draws a region. 2-ary only; null otherwise.
   * @param {Array} mask - draw polygon
   * @returns {Object|null}
   */
  metricsForMask(mask) {
    if (!this._aligned || this._aligned.length !== 2) return null;
    return compareExtentMetrics(this._aligned[0], this._aligned[1], this._grid,
      { mask, dryValue: this._dryValue });
  }
}

// addLayer('comparison', { sources: [{pixels,meta}, …], policy?, method?, colors? }) → computes at
// construction unless { compute:false }. Registered like the other Layer types so FimMap.addLayer
// dispatches by name without importing this module.
registerLayerType("comparison", (fim, opts = {}) => {
  const layer = new ComparisonLayer({
    map: fim,
    sources: opts.sources || (opts.source ? [opts.source] : []),
  });
  if (opts.compute !== false) layer.compute(opts);
  return layer;
});
