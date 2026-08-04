// ensembleAggregationLayer.js — a Layer that aggregates N member extent rasters into an agreement map.
//
// The ensemble twin of ComparisonLayer: same "align N rasters onto one grid, then reduce" shape, a
// different reduction. Comparison asks WHICH members are wet (per-subset, 2^N-1 colours); the ensemble
// asks HOW MANY are wet — a per-pixel agreement count 0..N over an N-colour ramp
// (comparisonMetrics.ensembleAgreementRgba). Headless (pixels+meta in, data out); emits `computed`
// (→ map bus `ensembleAgreement:computed`) for a ui/*Tools binder to render (event inversion).
//
// NOTE this is DISTINCT from layers/ensemble.js, which renders a single PRE-BAKED ensemble GeoTIFF.
// This one is the multi-member aggregation the single-file path never did.

import { Layer, registerLayerType } from "./layer.js";
import { alignRasters, GRID_POLICY, RESAMPLE_METHODS } from "../geo/resample.js";
import { ensembleAgreementRgba, DRY_DEFAULT } from "./comparisonMetrics.js";
import { gridToRaster } from "./comparisonLayer.js";

const DEFAULT_POLICY = GRID_POLICY.HIGH;
const DEFAULT_METHOD = "nearest";

// A source may be a plain { pixels, meta }, a RasterLayer (rasterData + meta), or a materialized
// RasterGrid (a forced Dataset). A raw Dataset needs `await layer.prepare()` first (forcing is async).
function toRaster(src) {
  if (!src) throw new Error("EnsembleAggregationLayer: a source is missing");
  // RasterGrid FIRST — it carries an opaque `.meta` that would falsely match the {pixels,meta} branch.
  if (src.pixels && src.bounds && src.width) return gridToRaster(src);   // RasterGrid
  if (src.pixels && src.meta) return { pixels: src.pixels, meta: src.meta };
  if (src.rasterData && src.meta) return { pixels: src.rasterData, meta: src.meta };
  if (typeof src.grid === "function") {
    throw new Error("EnsembleAggregationLayer: a Dataset member must be materialized first — " +
      "call `await layer.prepare()` before compute() (forcing a Dataset is async).");
  }
  throw new Error("EnsembleAggregationLayer: each member needs { pixels, meta } (or a RasterLayer / RasterGrid).");
}

export class EnsembleAggregationLayer extends Layer {
  /**
   * @param {Object} [opts] - see `Layer`'s constructor; `sources` here are `{pixels, meta}` or `RasterLayer`
   */
  constructor(opts = {}) {
    super({ ...opts, type: opts.type || "ensembleAgreement" });
    this.result = null;
    this._aligned = null;
    this._grid = null;
  }

  /**
   * Align the members → agreement count → N-colour ramp. Emits `computed` with
   * { grid, rgba, perPixel, histogram, nLayers, policy, method, warnings } and returns it.
   *
   * `policy`/`method` default (high/nearest) with a warning when omitted/unknown; `colors` is the
   * N-colour agreement ramp (omitted → a viridis ramp + a warning, from the reducer). All warnings —
   * resampling + colour — are merged so the host surfaces one list.
   * @param {Object} [o]
   * @param {'low'|'high'|'average'} [o.policy]
   * @param {string} [o.method]
   * @param {string[]} [o.colors]
   * @param {number} [o.dryValue]
   * @returns {{grid: Object, rgba: Uint8ClampedArray, perPixel: Uint8Array, histogram: Uint32Array, nLayers: number, policy: string, method: string, warnings: string[]}}
   */
  compute({ policy, method, colors = null, dryValue = DRY_DEFAULT } = {}) {
    const warnings = [];
    if (policy == null) { warnings.push(`No grid policy provided; defaulting to "${DEFAULT_POLICY}".`); policy = DEFAULT_POLICY; }
    if (method == null) { warnings.push(`No resampling method provided; defaulting to "${DEFAULT_METHOD}".`); method = DEFAULT_METHOD; }
    else if (!RESAMPLE_METHODS.includes(method)) { warnings.push(`Unknown resampling method "${method}"; using "${DEFAULT_METHOD}".`); method = DEFAULT_METHOD; }

    const rasters = this.sources.map(toRaster);
    const { grid, rasters: aligned } = alignRasters(rasters, { policy, method, noData: dryValue });
    const pixelArrays = aligned.map((r) => r.pixels);
    const { rgba, perPixel, histogram, nLayers, warnings: colourWarnings } =
      ensembleAgreementRgba(pixelArrays, { colors, dryValue });

    this._aligned = pixelArrays;
    this._grid = grid;
    this.visible = true;
    this.result = { grid, rgba, perPixel, histogram, nLayers, policy, method,
      warnings: [...warnings, ...colourWarnings] };
    this.emit("computed", this.result);
    return this.result;
  }

  /**
   * Materialize any Dataset members into RasterGrids so the synchronous compute() can consume them
   * (`await layer.prepare(); layer.compute(opts)`). Non-Dataset members pass through untouched.
   * @returns {Promise<EnsembleAggregationLayer>}
   */
  async prepare() {
    this.sources = await Promise.all(
      this.sources.map((s) => (typeof s?.grid === "function" ? s.grid() : s)));
    return this;
  }

  /** The aligned per-member pixel arrays from the last compute() (all on `result.grid`). @returns {Array|null} */
  getAligned() { return this._aligned; }
}

// addLayer('ensembleAgreement', { sources: [{pixels,meta}, …], policy?, method?, colors? }).
registerLayerType("ensembleAgreement", (fim, opts = {}) => {
  const layer = new EnsembleAggregationLayer({
    map: fim,
    sources: opts.sources || (opts.source ? [opts.source] : []),
  });
  if (opts.compute !== false) layer.compute(opts);
  return layer;
});
