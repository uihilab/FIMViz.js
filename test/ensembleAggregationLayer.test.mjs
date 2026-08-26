// ensembleAggregationLayer — the Layer that aggregates N member extent rasters into an agreement
// map (align → agreement count → N-colour ramp), emitting `computed`. Headless, unit-testable.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EnsembleAggregationLayer } from "../src/package/ensembleAggregationLayer.js";
import { createLayer } from "../src/package/layer.js";

const DRY = -99999;
const coarse = { width: 2, height: 2, bw: 0, bs: 0, be: 4, bn: 4 };
const fine = { width: 4, height: 4, bw: 0, bs: 0, be: 4, bn: 4 };

describe("EnsembleAggregationLayer.compute", () => {
  test("aligns members and produces a per-pixel agreement map + histogram", () => {
    // 3 members on the same 2x2 grid; counts per pixel: p0=3, p1=2, p2=1, p3=0
    const m = (a) => ({ pixels: Float32Array.from(a), meta: coarse });
    const layer = new EnsembleAggregationLayer({
      sources: [m([1, 1, 1, DRY]), m([1, 1, DRY, DRY]), m([1, DRY, DRY, DRY])],
    });
    const r = layer.compute({ colors: ["#111111", "#222222", "#333333"] });
    assert.equal(r.nLayers, 3);
    assert.deepEqual([...r.perPixel], [3, 2, 1, 0]);
    assert.deepEqual([...r.histogram], [1, 1, 1, 1]);
    assert.deepEqual([...r.rgba.slice(0, 4)], [0x33, 0x33, 0x33, 255]);   // count 3 → colours[2]
    assert.deepEqual([...r.rgba.slice(12, 16)], [0, 0, 0, 0]);            // count 0 → transparent
  });

  test("resamples members of DIFFERENT resolutions onto one grid before counting", () => {
    const a = { pixels: Float32Array.from([1, 1, 1, 1]), meta: coarse };          // 2x2 all wet
    const b = { pixels: Float32Array.from(new Array(16).fill(1)), meta: fine };   // 4x4 all wet
    const layer = new EnsembleAggregationLayer({ sources: [a, b] });
    const r = layer.compute({ policy: "high", colors: ["#0a0a0a", "#141414"] });
    assert.deepEqual([r.grid.width, r.grid.height], [4, 4]);                       // finest grid
    assert.equal(r.perPixel.length, 16);
    assert.ok([...r.perPixel].every((c) => c === 2), "both members wet everywhere → agreement 2");
  });

  test("emits `computed` on its own emitter AND the map bus as ensembleAgreement:computed", () => {
    const seen = [];
    const fim = { emit: (e, p) => seen.push([e, p]), _unregisterLayer() {} };
    const m = (a) => ({ pixels: Float32Array.from(a), meta: coarse });
    const layer = new EnsembleAggregationLayer({ map: fim, sources: [m([1, DRY, 1, 1]), m([1, 1, DRY, 1])] });
    let local = null;
    layer.on("computed", (p) => { local = p; });
    layer.compute({ colors: ["#010101", "#020202"] });
    assert.ok(local && local.perPixel, "own emitter fired");
    assert.ok(seen.some(([e]) => e === "ensembleAgreement:computed"), "forwarded to the map bus");
  });

  test("merges resampling + colour warnings (defaults surfaced, not silent)", () => {
    const m = (a) => ({ pixels: Float32Array.from(a), meta: coarse });
    const layer = new EnsembleAggregationLayer({ sources: [m([1, DRY, DRY, DRY]), m([1, 1, DRY, DRY])] });
    const r = layer.compute();   // no policy/method/colours
    assert.ok(r.warnings.some((w) => /grid policy/.test(w)));
    assert.ok(r.warnings.some((w) => /resampling method/.test(w)));
    assert.ok(r.warnings.some((w) => /ensemble colors/.test(w)));
  });

  test("registered type: createLayer('ensembleAgreement', …) computes at construction", () => {
    const g = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const layer = createLayer({ emit() {}, _unregisterLayer() {} }, "ensembleAgreement", {
      sources: [{ pixels: Float32Array.from([1, DRY]), meta: g }, { pixels: Float32Array.from([1, 1]), meta: g }],
      colors: ["#111", "#222"],
    });
    assert.ok(layer instanceof EnsembleAggregationLayer);
    assert.ok(layer.result && layer.result.perPixel, "computed on construction");
  });
});

describe("EnsembleAggregationLayer.getLegend", () => {
  const g = { width: 1, height: 1, bw: 0, bs: 0, be: 1, bn: 1 };
  const wet = () => ({ pixels: Float32Array.from([1]), meta: g });

  test("null before compute(); one row per agreement level after, count 0 excluded", () => {
    const layer = new EnsembleAggregationLayer({ sources: [wet(), wet(), wet()] });
    assert.equal(layer.getLegend(), null);
    layer.compute({ policy: "low", method: "nearest" });
    const legend = layer.getLegend();
    assert.equal(legend.stops.length, 3, "3 members -> levels 1..3");
    assert.deepEqual(legend.stops.map((x) => x.value), [1, 2, 3]);
    assert.deepEqual(legend.stops.map((x) => x.label), ["1 of 3 wet", "2 of 3 wet", "3 of 3 wet"]);
  });

  test("reports the explicit ramp that was drawn", () => {
    const layer = new EnsembleAggregationLayer({ sources: [wet(), wet()] });
    layer.compute({ policy: "low", method: "nearest", colors: ["#111111", "#222222"] });
    assert.deepEqual(layer.getLegend().stops.map((x) => x.color),
      ["rgba(17, 17, 17, 1)", "rgba(34, 34, 34, 1)"]);
  });
});
