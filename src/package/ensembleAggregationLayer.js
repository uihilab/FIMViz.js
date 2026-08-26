// ensembleAggregationLayer.js — a Layer that aggregates N member extent rasters into an agreement map.
//
// Aligns N rasters onto one grid and reduces them, the way ComparisonLayer does, but with a
// different reduction. Comparison asks which members are wet, giving 2^N-1 subset colors. This asks
// how many are wet, giving a per-pixel count of 0..N over an N-color ramp
// (comparisonMetrics.ensembleAgreementRgba). Headless: pixels and meta in, data out. Emits
// `computed`, which reaches the map bus as `ensembleAgreement:computed`, for a ui/*Tools binder.
//
// Not the same as layers/ensemble.js, which renders one pre-baked ensemble GeoTIFF. This aggregates
// several members, which the single-file path never did.

import { Layer, registerLayerType } from "./layer.js";
import { alignRasters, GRID_POLICY, RESAMPLE_METHODS } from "../geo/resample.js";
import { ensembleAgreementRgba, DRY_DEFAULT } from "./comparisonMetrics.js";
import { gridToRaster } from "./comparisonLayer.js";
import { Legend } from "./legend.js";

const DEFAULT_POLICY = GRID_POLICY.HIGH;
const DEFAULT_METHOD = "nearest";

// A source is a plain { pixels, meta }, a RasterLayer carrying rasterData and meta, or a RasterGrid
// from a forced Dataset. A raw Dataset needs `await layer.prepare()` first, since forcing is async.
function toRaster(src) {
  if (!src) throw new Error("EnsembleAggregationLayer: a source is missing");
  // RasterGrid first: its opaque `.meta` would otherwise match the {pixels,meta} branch.
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
   * @param {Object} [opts] - as `Layer`, except `sources` take `{pixels, meta}` or a `RasterLayer`
   */
  constructor(opts = {}) {
    super({ ...opts, type: opts.type || "ensembleAgreement" });
    this.result = null;
    this._aligned = null;
    this._grid = null;
    this._colors = null;   // the agreement ramp the last compute() drew with
  }

  /**
   * Aligns the members, counts agreement per pixel, and maps the count onto an N-color ramp.
   * Emits `computed` with the returned object.
   *
   * An omitted or unknown `policy` or `method` falls back to high and nearest, each with a warning.
   * An omitted `colors` falls back to a viridis ramp, also with a warning. Resampling and color
   * warnings arrive merged in one list.
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
    const { rgba, perPixel, histogram, nLayers, warnings: colorWarnings, colors: ramp } =
      ensembleAgreementRgba(pixelArrays, { colors, dryValue });

    this._aligned = pixelArrays;
    this._grid = grid;
    this._colors = ramp;
    this.visible = true;
    this.result = { grid, rgba, perPixel, histogram, nLayers, policy, method,
      warnings: [...warnings, ...colorWarnings] };
    this.emit("computed", this.result);
    return this.result;
  }

  /**
   * Forces any Dataset members into RasterGrids so the synchronous compute() can read them:
   * `await layer.prepare(); layer.compute(opts)`. Other members pass through untouched.
   * @returns {Promise<EnsembleAggregationLayer>}
   */
  async prepare() {
    this.sources = await Promise.all(
      this.sources.map((s) => (typeof s?.grid === "function" ? s.grid() : s)));
    return this;
  }

  /** Per-member pixel arrays from the last compute(), all on `result.grid`. @returns {Array|null} */
  getAligned() { return this._aligned; }

  /**
   * A Legend for the agreement ramp the last compute() drew, or null before one has run.
   *
   * One row per agreement level, 1 through N. Count 0 means every member is dry, which draws
   * transparent, so it gets no row. `value` on each stop is the count, so a UI can match a row
   * against `result.histogram`.
   * @returns {import('./legend.js').Legend|null}
   */
  getLegend() {
    if (!this._colors || !this.result) return null;
    const n = this.result.nLayers;
    const stops = this._colors.map((c, i) => ({
      value: i + 1,
      color: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(c[3] ?? 255) / 255})`,
      label: `${i + 1} of ${n} wet`,
    }));
    return new Legend({ kind: "classed", source: "custom", stops });
  }
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
