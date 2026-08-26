// comparisonLayer.js — a Layer that compares N aligned extent rasters.
//
// Holds the source rasters, aligns them onto one grid (geo/resample.js), classifies and colors them
// (comparisonMetrics.combineExtentRgba), and scores them when there are exactly two
// (compareExtentMetrics). Names no map SDK and no UI: it emits `computed` carrying data, and a
// ui/*Tools binder renders it, as velocity and ensemble do. The controller keeps only the
// google.maps overlay, built from `result.rgba` over `result.grid`.
//
// Sources are parsed pixels and a grid rather than google objects, so this stays headless and
// testable: sources: [{ pixels, meta }], or RasterLayer instances, whose rasterData and meta it uses.
//
// Classification and coloring take 2 to 8 layers. The confusion-matrix metrics take exactly 2 (see
// comparisonMetrics.js). Aligning first means the inputs need not share a resolution, which retires
// the controller's old "images must have the same dimension" guard.

import { Layer, registerLayerType } from "./layer.js";
import { alignRasters, GRID_POLICY, RESAMPLE_METHODS } from "../geo/resample.js";
import { combineExtentRgba, compareExtentMetrics, DRY_DEFAULT } from "./comparisonMetrics.js";
import { Legend } from "./legend.js";

const DEFAULT_POLICY = GRID_POLICY.HIGH;
const DEFAULT_METHOD = "nearest";

/**
 * Converts a RasterGrid, which carries bounds and dimensions but no resample meta, into the
 * `{ pixels, meta }` form alignRasters() and toRaster() read.
 * @internal @param {import('./materialize.js').RasterGrid} grid @returns {{pixels: ArrayBufferView, meta: Object}}
 */
export function gridToRaster(grid) {
  return {
    pixels: grid.pixels,
    meta: { bw: grid.bounds.west, bs: grid.bounds.south, be: grid.bounds.east, bn: grid.bounds.north,
      width: grid.width, height: grid.height, noData: grid.noData },
  };
}

// A source is a plain { pixels, meta }, a RasterLayer carrying rasterData and meta, or a RasterGrid
// from a forced Dataset. A raw Dataset is rejected because forcing it is async; call
// `await layer.prepare()` first, which replaces Dataset sources with grids.
function toRaster(src) {
  if (!src) throw new Error("ComparisonLayer: a source is missing");
  // RasterGrid first: it also has an opaque `.meta`, so the {pixels,meta} branch would claim it and
  // supply an empty resample meta. A `bounds` object plus `width` tells the two apart.
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
   * Source order decides the metrics. With two sources, `sources[0]` is scored as the prediction
   * and `sources[1]` as the observation, so `metrics.fp` counts wet-in-[0]-only and `metrics.fn`
   * counts wet-in-[1]-only. Swapping them inverts `b`, `h`, `fp` and `fn` while leaving `pc` and
   * `f` unchanged, which is a wrong answer that still looks reasonable. The engine cannot tell
   * which raster is the benchmark, so it uses the order given.
   *
   * `{ prediction, observation }` names the two instead of ordering them, and builds the same
   * `sources` array. Use whichever reads better:
   *
   *   new ComparisonLayer({ sources: [pred, obs] });
   *   new ComparisonLayer({ prediction: pred, observation: obs });
   *
   * `sources` wins when both are given. The named pair covers two sources only, since
   * classification takes 2 to 8 and neither name means anything at three.
   *
   * Classification and coloring do not care about order.
   *
   * @param {Object} [opts] - as `Layer`, except `sources` take `{pixels, meta}` or a `RasterLayer`
   * @param {*} [opts.prediction] - scored as `sources[0]`. Ignored when `sources` is given.
   * @param {*} [opts.observation] - scored as `sources[1]`. Ignored when `sources` is given.
   */
  constructor(opts = {}) {
    const { prediction, observation } = opts;
    const sources = opts.sources
      ?? (prediction || observation ? [prediction, observation].filter(Boolean) : undefined);
    super({ ...opts, sources, type: opts.type || "comparison" });
    this.result = null;        // last compute() output
    this._aligned = null;      // aligned pixel arrays, kept so metricsForMask() can reuse them
    this._grid = null;         // the common grid the compare ran on
    this._palette = null;      // the category -> [r,g,b,a] map the last compute() drew with
    this._dryValue = DRY_DEFAULT;
  }

  /**
   * Aligns the sources, classifies and colors them, and scores them when there are two. Emits
   * `computed` with the returned object, which reaches the map bus as `comparison:computed`. The
   * payload carries `aligned` and `dryValue` so ui/comparisonTools.js can recompute the metrics
   * under a draw mask without reaching back into the layer.
   *
   * An omitted or unknown `policy` or `method` falls back to high and nearest, and records a message
   * in `result.warnings`. A silent default would hide that no resampling choice was made.
   *
   * `metrics` is non-null only with exactly two sources, and it reads `sources[0]` as the
   * prediction and `sources[1]` as the observation (see the constructor).
   *
   * `categories` is the per-pixel answer that `counts` totals: `categories[i]` is the bitmask of
   * which layers are wet at pixel i, on `grid`, matching a `value` in getLegend()'s stops.
   *
   * @param {object} [o]
   * @param {'low'|'high'|'average'} [o.policy]  target resolution; high is finest
   * @param {string} [o.method]                  sentinel-safe resampling method
   * @param {Array}  [o.colors]                  2^n-1 colors, see combineExtentRgba
   * @param {number} [o.dryValue]                the "dry" sentinel, -99999 by default
   * @param {Array}  [o.mask]                     draw polygon scoping the metrics
   * @returns {{grid: Object, rgba: Uint8ClampedArray, categories: Uint8Array, counts: Object, nLayers: number, metrics: Object|null, policy: string, method: string, warnings: string[], aligned: Array, dryValue: number}}
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
    const { rgba, categories, counts, nLayers, palette } = combineExtentRgba(pixelArrays, { colors, dryValue });
    const metrics = nLayers === 2
      ? compareExtentMetrics(pixelArrays[0], pixelArrays[1], grid, { mask, dryValue })
      : null;

    this._aligned = pixelArrays;
    this._grid = grid;
    this._palette = palette;
    this._dryValue = dryValue;
    this.visible = true;
    this.result = { grid, rgba, categories, counts, nLayers, metrics, policy, method, warnings,
      aligned: pixelArrays, dryValue };
    this.emit("computed", this.result);
    return this.result;
  }

  /**
   * Forces any Dataset sources into RasterGrids so the synchronous compute() can read them:
   * `await layer.prepare(); layer.compute(opts)`. This async pre-step is what lets a Dataset reach
   * the compare without compute() becoming async. Other sources pass through untouched.
   * @returns {Promise<ComparisonLayer>}
   */
  async prepare() {
    this.sources = await Promise.all(
      this.sources.map((s) => (typeof s?.grid === "function" ? s.grid() : s)));
    return this;
  }

  /** Per-layer pixel arrays from the last compute(), all on `result.grid`. @returns {Array|null} */
  getAligned() { return this._aligned; }

  /**
   * A Legend for the colors the last compute() drew, or null before one has run.
   *
   * One row per non-empty category, in bitmask order. Category 0 is every layer dry, which draws
   * transparent, so it gets no row. A label names the 1-based source indices whose bit is set:
   * "layer 1 only" for 0b01, "layers 1 + 2" for 0b11.
   *
   * `value` on each stop is the bitmask itself, so a UI can match a row against `result.counts`.
   * @returns {import('./legend.js').Legend|null}
   */
  getLegend() {
    if (!this._palette || !this.result) return null;
    const n = this.result.nLayers;
    const stops = [];
    for (let cat = 1; cat < (1 << n); cat++) {
      const c = this._palette[cat];
      if (!c) continue;
      const members = [];
      for (let L = 0; L < n; L++) if (cat & (1 << L)) members.push(L + 1);
      stops.push({
        value: cat,
        color: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(c[3] ?? 255) / 255})`,
        label: members.length === 1 ? `layer ${members[0]} only` : `layers ${members.join(" + ")}`,
      });
    }
    return new Legend({ kind: "classed", source: "custom", stops });
  }

  /**
   * Recomputes the metrics alone under a new draw `mask`, reusing the aligned pixels. The Metrics
   * tab calls this when the user draws a region. Returns null unless there are exactly two layers.
   * @param {Array} mask - draw polygon
   * @returns {Object|null}
   */
  metricsForMask(mask) {
    if (!this._aligned || this._aligned.length !== 2) return null;
    return compareExtentMetrics(this._aligned[0], this._aligned[1], this._grid,
      { mask, dryValue: this._dryValue });
  }
}

// addLayer('comparison', { sources: [{pixels,meta}, …], policy?, method?, colors? }) computes at
// construction unless given { compute:false }. Registered like the other Layer types so
// FimMap.addLayer dispatches by name without importing this module.
registerLayerType("comparison", (fim, opts = {}) => {
  const layer = new ComparisonLayer({
    map: fim,
    sources: opts.sources || (opts.source ? [opts.source] : undefined),
    prediction: opts.prediction,
    observation: opts.observation,
  });
  if (opts.compute !== false) layer.compute(opts);
  return layer;
});
