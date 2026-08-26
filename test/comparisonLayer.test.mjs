// comparisonLayer — the Layer that compares N extent rasters: align → classify+colour → (2-ary)
// score, emitting `computed`. Headless (pixels + meta in, data out), so it is fully unit-testable.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ComparisonLayer } from "../src/package/comparisonLayer.js";
import { createLayer } from "../src/package/layer.js";
import { classifyExtents } from "../src/package/comparisonMetrics.js";
import { Dataset } from "../src/package/dataset.js";
import { RasterGrid, registerMaterializer } from "../src/package/materialize.js";

const DRY = -99999;
// Same 0..4 footprint at two resolutions, so alignment has real work to do.
const coarse = { width: 2, height: 2, bw: 0, bs: 0, be: 4, bn: 4 };
const fine = { width: 4, height: 4, bw: 0, bs: 0, be: 4, bn: 4 };

describe("ComparisonLayer: Dataset sources via prepare() (DATASET_LAYER_ADT §6)", () => {
  // The one place the data model and the layer model were "one adapter-line apart": a ComparisonLayer
  // can now take Dataset sources. prepare() forces them into RasterGrids (async) so the SYNC compute()
  // is unchanged — the live comparison.js controller is untouched.
  const gridDs = (name, values) => {
    const fmt = `stub-cmp-${name}`;
    registerMaterializer(fmt, async () => new RasterGrid({
      pixels: Float32Array.from(values), width: 2, height: 2,
      bounds: { north: 4, south: 0, east: 4, west: 0 }, crs: "EPSG:4326", noData: DRY,
    }));
    return new Dataset({ name, kind: "raster", format: fmt, crs: "EPSG:4326", data: { s: 1 } });
  };

  test("prepare() materializes Dataset sources, then sync compute() consumes them", async () => {
    const layer = new ComparisonLayer({ sources: [gridDs("a", [1, DRY, DRY, 1]), gridDs("b", [1, 1, DRY, DRY])] });
    await layer.prepare();
    const r = layer.compute({ policy: "low", dryValue: DRY });
    assert.equal(r.nLayers, 2);
    assert.deepEqual([r.grid.width, r.grid.height], [2, 2]);
    assert.equal(r.metrics.tp, 1, "one pixel wet in both (index 0)");
  });

  test("compute() without prepare() on a raw Dataset source throws an actionable error", () => {
    const layer = new ComparisonLayer({ sources: [gridDs("c", [1, 1, 1, 1]), gridDs("d", [1, 1, 1, 1])] });
    assert.throws(() => layer.compute(), /materialized first.*await layer\.prepare\(\)/s);
  });
});

describe("ComparisonLayer.compute", () => {
  test("aligns differing grids to the finest (HIGH) and colours the result", () => {
    // coarse: everything wet; fine: everything wet → all pixels 'both' (red) on the 4x4 grid
    const a = { pixels: Float32Array.from([1, 1, 1, 1]), meta: coarse };
    const b = { pixels: Float32Array.from(new Array(16).fill(1)), meta: fine };
    const layer = new ComparisonLayer({ sources: [a, b] });
    const r = layer.compute();               // default policy HIGH, method nearest
    assert.deepEqual([r.grid.width, r.grid.height], [4, 4]);
    assert.equal(r.rgba.length, 16 * 4);
    assert.equal(r.nLayers, 2);
    assert.deepEqual([...r.rgba.slice(0, 4)], [214, 40, 40, 255]);   // both → red
    assert.equal(r.metrics.tp, 16);          // all 16 aligned pixels wet in both
  });

  test("emits `computed` with the result payload, forwarded to the map bus as comparison:computed", () => {
    const busEvents = [];
    const fakeFim = { emit: (e, p) => busEvents.push([e, p]), _unregisterLayer() {} };
    const a = { pixels: Float32Array.from([1, DRY, DRY, 1]), meta: coarse };
    const b = { pixels: Float32Array.from([1, 1, DRY, DRY]), meta: coarse };
    const layer = new ComparisonLayer({ map: fakeFim, sources: [a, b] });
    let local = null;
    layer.on("computed", (p) => { local = p; });
    const r = layer.compute({ policy: "low" });   // both already 2x2; LOW keeps 2x2
    assert.ok(local && local.rgba, "own emitter fired with data");
    const fwd = busEvents.find(([e]) => e === "comparison:computed");
    assert.ok(fwd, "forwarded to the map bus");
    assert.equal(fwd[1].nLayers, 2);
    assert.equal(r.grid.width, 2);
  });

  test("the computed payload carries the aligned pixels + dryValue (self-contained for the binder)", () => {
    // ui/comparisonTools.js recomputes mask-scoped metrics from the EVENT alone (no reach into the
    // layer), so the payload must ship the aligned per-layer arrays and the dry sentinel it used.
    const a = { pixels: Float32Array.from([1, DRY, DRY, 1]), meta: coarse };
    const b = { pixels: Float32Array.from([1, 1, DRY, DRY]), meta: coarse };
    const layer = new ComparisonLayer({ sources: [a, b] });
    const r = layer.compute({ policy: "low", dryValue: DRY });
    assert.ok(Array.isArray(r.aligned) && r.aligned.length === 2, "aligned per-layer arrays present");
    assert.equal(r.dryValue, DRY);
    assert.strictEqual(r.aligned, layer.getAligned(), "same arrays getAligned() exposes");
    // and they are the classification input, so a binder can score them under a mask
    assert.equal(r.aligned[0].length, r.grid.width * r.grid.height);
  });

  test("works across DIFFERING bounding boxes: union footprint, geo-correct overlap", () => {
    // A over lng[0,2]/lat[0,2], B over lng[1,3]/lat[1,3] — same resolution, offset bbox.
    const A = { pixels: Float32Array.from([1, 1, 1, 1]), meta: { width: 2, height: 2, bw: 0, bs: 0, be: 2, bn: 2 } };
    const B = { pixels: Float32Array.from([1, 1, 1, 1]), meta: { width: 2, height: 2, bw: 1, bs: 1, be: 3, bn: 3 } };
    const layer = new ComparisonLayer({ sources: [A, B] });
    const r = layer.compute({ policy: "high", method: "nearest" });
    // union grid is 3x3 over [0,3]
    assert.deepEqual([r.grid.width, r.grid.height, r.grid.bw, r.grid.be], [3, 3, 0, 3]);
    const cats = classifyExtents(layer.getAligned()).categories;
    // row-major, north row first: overlap (0b11) at centre, only-A (0b01) SW, only-B (0b10) NE, neither (0) corners
    assert.deepEqual([...cats], [0b00, 0b10, 0b10, 0b01, 0b11, 0b10, 0b01, 0b01, 0b00]);
    assert.equal(cats[4], 0b11, "centre pixel is in BOTH rasters' coverage");
    assert.equal(cats[0], 0b00, "NW corner is outside both");
  });

  test("colours override via `colors` reaches the pixels", () => {
    const a = { pixels: Float32Array.from([1, DRY]), meta: { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 } };
    const b = { pixels: Float32Array.from([1, 1]), meta: { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 } };
    const layer = new ComparisonLayer({ sources: [a, b] });
    const r = layer.compute({ colors: ["#101010", "#202020", "#303030"] });
    assert.deepEqual([...r.rgba.slice(0, 4)], [0x30, 0x30, 0x30, 255]);   // pixel0 both → 3rd colour
  });

  test("metricsForMask recomputes 2-ary stats from the aligned pixels", () => {
    const a = { pixels: Float32Array.from([1, 1, DRY, DRY]), meta: coarse };
    const b = { pixels: Float32Array.from([1, DRY, 1, DRY]), meta: coarse };
    const layer = new ComparisonLayer({ sources: [a, b] });
    layer.compute();
    const m = layer.metricsForMask(null);   // no mask → whole grid
    assert.deepEqual([m.tp, m.fp, m.fn, m.tn], [1, 1, 1, 1]);
  });

  test("a 3-layer comparison classifies but yields no confusion-matrix metrics", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const layer = new ComparisonLayer({
      sources: [
        { pixels: Float32Array.from([1, DRY]), meta: g },
        { pixels: Float32Array.from([DRY, 1]), meta: g },
        { pixels: Float32Array.from([1, 1]), meta: g },
      ],
    });
    const colors = ["#010101", "#020202", "#030303", "#040404", "#050505", "#060606", "#070707"];
    const r = layer.compute({ colors });
    assert.equal(r.nLayers, 3);
    assert.equal(r.metrics, null);
    assert.equal(r.rgba.length, 2 * 4);
  });

  test("omitted policy/method run on defaults but return warnings", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const layer = new ComparisonLayer({
      sources: [{ pixels: Float32Array.from([1, DRY]), meta: g }, { pixels: Float32Array.from([1, 1]), meta: g }],
    });
    const r = layer.compute();   // nothing supplied
    assert.equal(r.policy, "high");
    assert.equal(r.method, "nearest");
    assert.equal(r.warnings.length, 2);
    assert.match(r.warnings[0], /grid policy/);
    assert.match(r.warnings[1], /resampling method/);
  });

  test("an unknown method warns and falls back to nearest; valid options are quiet", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const layer = new ComparisonLayer({
      sources: [{ pixels: Float32Array.from([1, DRY]), meta: g }, { pixels: Float32Array.from([1, 1]), meta: g }],
    });
    const bad = layer.compute({ policy: "low", method: "sinc" });
    assert.equal(bad.method, "nearest");
    assert.match(bad.warnings[0], /Unknown resampling method "sinc"/);
    const good = layer.compute({ policy: "low", method: "bilinear" });
    assert.deepEqual(good.warnings, []);
  });

  // { prediction, observation } names the two sources instead of ordering them. Order decides the
  // metrics — sources[0] is the prediction — so the named form exists to make that unmissable.
  test("{ prediction, observation } builds the same sources as [pred, obs]", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const pred = { pixels: Float32Array.from([1, DRY]), meta: g };   // wet, dry
    const obs = { pixels: Float32Array.from([1, 1]), meta: g };      // wet, wet

    const named = new ComparisonLayer({ prediction: pred, observation: obs }).compute();
    const positional = new ComparisonLayer({ sources: [pred, obs] }).compute();
    assert.deepEqual(named.metrics, positional.metrics);
    assert.equal(named.metrics.tp, 1);
    assert.equal(named.metrics.fn, 1, "wet in the observation only");
    assert.equal(named.metrics.fp, 0);
  });

  test("swapping the two names inverts fp and fn, as swapping the array does", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const pred = { pixels: Float32Array.from([1, DRY]), meta: g };
    const obs = { pixels: Float32Array.from([1, 1]), meta: g };
    const m = new ComparisonLayer({ prediction: obs, observation: pred }).compute().metrics;
    assert.equal(m.fp, 1, "the roles swap with the names");
    assert.equal(m.fn, 0);
  });

  test("`sources` wins when both forms are given", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const a = { pixels: Float32Array.from([1, 1]), meta: g };
    const b = { pixels: Float32Array.from([DRY, DRY]), meta: g };
    const layer = new ComparisonLayer({ sources: [a, b], prediction: b, observation: a });
    assert.equal(layer.sources[0], a);
  });

  test("no sources at all still yields an empty array, not undefined", () => {
    assert.deepEqual(new ComparisonLayer().sources, []);
  });

  test("addLayer('comparison', { prediction, observation }) reaches the constructor", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const layer = createLayer({ emit() {}, _unregisterLayer() {} }, "comparison", {
      prediction: { pixels: Float32Array.from([1, DRY]), meta: g },
      observation: { pixels: Float32Array.from([1, 1]), meta: g },
    });
    assert.equal(layer.sources.length, 2);
    assert.equal(layer.result.metrics.fn, 1);
  });

  // `counts` totals the categories; `categories` is the per-pixel answer behind that total.
  // combineExtentRgba always computed it and compute() used to drop it on the floor.
  test("result.categories is the per-pixel bitmask, and counts totals it", () => {
    const g = { width: 4, height: 1, bw: 0, bs: 0, be: 4, bn: 1 };
    // per pixel: both wet, only-1, only-2, neither
    const layer = new ComparisonLayer({
      sources: [
        { pixels: Float32Array.from([1, 1, DRY, DRY]), meta: g },
        { pixels: Float32Array.from([1, DRY, 1, DRY]), meta: g },
      ],
    });
    const r = layer.compute({ policy: "low", method: "nearest" });
    assert.deepEqual([...r.categories], [0b11, 0b01, 0b10, 0b00]);
    assert.equal(r.categories.length, r.grid.width * r.grid.height, "one entry per pixel");
    for (let cat = 0; cat < 4; cat++) {
      const tally = [...r.categories].filter((c) => c === cat).length;
      assert.equal(r.counts[cat], tally, `counts[${cat}] totals the categories`);
    }
  });

  test("a categories value matches the `value` on the legend stop that drew it", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const layer = new ComparisonLayer({
      sources: [
        { pixels: Float32Array.from([1, DRY]), meta: g },
        { pixels: Float32Array.from([1, 1]), meta: g },
      ],
    });
    const r = layer.compute({ policy: "low", method: "nearest" });
    const stop = layer.getLegend().stops.find((x) => x.value === r.categories[0]);
    assert.equal(stop.label, "layers 1 + 2");
  });

  // A comparison overlay was drawable but not labelable: both layers inherit Layer.getLegend(),
  // which returns null, and the palettes are not exported. These give them a real legend.
  test("getLegend() is null before compute(), and one row per non-empty category after", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const layer = new ComparisonLayer({
      sources: [
        { pixels: Float32Array.from([1, DRY]), meta: g },
        { pixels: Float32Array.from([1, 1]), meta: g },
      ],
    });
    assert.equal(layer.getLegend(), null, "nothing drawn yet");
    layer.compute({ policy: "low", method: "nearest" });

    const legend = layer.getLegend();
    assert.equal(legend.stops.length, 3, "2 layers -> 2^2-1 categories, 0 excluded");
    assert.deepEqual(legend.stops.map((x) => x.value), [1, 2, 3], "bitmask order");
    assert.deepEqual(legend.stops.map((x) => x.label),
      ["layer 1 only", "layer 2 only", "layers 1 + 2"]);
    // the built-in 2-layer palette: only-1 orange, only-2 yellow, both red
    assert.equal(legend.stops[0].color, "rgba(247, 127, 0, 1)");
    assert.equal(legend.stops[2].color, "rgba(214, 40, 40, 1)");
  });

  test("getLegend() reports the `colors` override that was actually drawn", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const layer = new ComparisonLayer({
      sources: [
        { pixels: Float32Array.from([1, DRY]), meta: g },
        { pixels: Float32Array.from([1, 1]), meta: g },
      ],
    });
    layer.compute({ policy: "low", method: "nearest", colors: ["#111111", "#222222", "#333333"] });
    assert.deepEqual(layer.getLegend().stops.map((x) => x.color),
      ["rgba(17, 17, 17, 1)", "rgba(34, 34, 34, 1)", "rgba(51, 51, 51, 1)"]);
  });

  test("a 3-layer comparison labels the subsets", () => {
    const g = { width: 1, height: 1, bw: 0, bs: 0, be: 1, bn: 1 };
    const px = () => ({ pixels: Float32Array.from([1]), meta: g });
    const layer = new ComparisonLayer({ sources: [px(), px(), px()] });
    layer.compute({ policy: "low", method: "nearest", colors: Array(7).fill("#123456") });
    assert.deepEqual(layer.getLegend().stops.map((x) => x.label), [
      "layer 1 only", "layer 2 only", "layers 1 + 2",
      "layer 3 only", "layers 1 + 3", "layers 2 + 3", "layers 1 + 2 + 3",
    ]);
  });

  test("registered as a Layer type: createLayer('comparison', …) computes at construction", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const layer = createLayer({ emit() {}, _unregisterLayer() {} }, "comparison", {
      sources: [
        { pixels: Float32Array.from([1, DRY]), meta: g },
        { pixels: Float32Array.from([1, 1]), meta: g },
      ],
    });
    assert.ok(layer instanceof ComparisonLayer);
    assert.ok(layer.result && layer.result.rgba, "computed on construction");
  });
});
