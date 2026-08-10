// The event-dispatch first slice + hit-testing + the tools-panel/read-model helpers.
//
// Pure parts only (the geometry, z-order dispatch, control specs, renderers). The provider
// onMapEvent wiring + the DOM widgets are browser-verified in examples/05-ui-toolkit.html. Headless.
// See docs/PACKAGE_ROADMAP.md §1/§5 and docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 "Settings vs. Operations".

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RasterLayer, VectorLayer, geomContains, dispatchMapEventToLayers } from "../src/package/layer.js";
import { FimMap } from "../src/package/fimMap.js";
import { ColorScale } from "../src/package/colorScale.js";
import { rasterControls, vectorControls } from "../src/ui/toolsPanel.js";
import { renderLegend, renderStats } from "../src/ui/readModels.js";
import { createRegionDraw } from "../src/ui/regionDraw.js";

const fakeApp = () => ({ emit() {}, on() {}, off() {}, config: { provider: "google" } });

describe("geomContains (vector hit-test geometry)", () => {
  const square = { type: "Polygon", coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]] };
  test("inside / outside a polygon", () => {
    assert.equal(geomContains(square, 5, 5), true);
    assert.equal(geomContains(square, 15, 5), false);
  });
  test("a hole is not contained", () => {
    const withHole = { type: "Polygon", coordinates: [
      [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]],
      [[3, 3], [3, 7], [7, 7], [7, 3], [3, 3]],
    ] };
    assert.equal(geomContains(withHole, 5, 5), false, "inside the hole → not contained");
    assert.equal(geomContains(withHole, 1, 1), true, "in the ring but outside the hole → contained");
  });
  test("MultiPolygon matches any part; Point within epsilon", () => {
    const mp = { type: "MultiPolygon", coordinates: [square.coordinates, [[[20, 20], [20, 22], [22, 22], [22, 20], [20, 20]]]] };
    assert.equal(geomContains(mp, 21, 21), true);
    assert.equal(geomContains({ type: "Point", coordinates: [5, 5] }, 5.0001, 5.0001), true);
    assert.equal(geomContains({ type: "Point", coordinates: [5, 5] }, 6, 6), false);
  });
  test("lines / null → false", () => {
    assert.equal(geomContains({ type: "LineString", coordinates: [[0, 0], [1, 1]] }, 0.5, 0.5), false);
    assert.equal(geomContains(null, 0, 0), false);
  });
});

describe("RasterLayer.hitTest / valueAt (hover read-model)", () => {
  function grid2x2() {
    const l = new RasterLayer({});
    l.meta = { bw: 0, bs: 0, be: 10, bn: 10, width: 2, height: 2, noData: -99999 };
    l.rasterData = [1, 2, 3, 4];   // row-major: NW=1 NE=2 SW=3 SE=4
    return l;
  }
  test("hitTest tracks the footprint", () => {
    const l = grid2x2();
    assert.equal(l.hitTest(5, 5), true);
    assert.equal(l.hitTest(11, 5), false);
    assert.equal(l.hitTest(5, -1), false);
  });
  test("valueAt maps lat/lng → nearest cell", () => {
    const l = grid2x2();
    assert.equal(l.valueAt(9, 1), 1, "NW");
    assert.equal(l.valueAt(9, 9), 2, "NE");
    assert.equal(l.valueAt(1, 1), 3, "SW");
    assert.equal(l.valueAt(1, 9), 4, "SE");
  });
  test("valueAt returns null outside, and for noData", () => {
    const l = grid2x2();
    assert.equal(l.valueAt(20, 5), null, "outside");
    l.rasterData = [-99999, 2, 3, 4];
    assert.equal(l.valueAt(9, 1), null, "noData → null");
  });
  test("hitTest is PIXEL-level: false over a noData pixel (falls through to layers below)", () => {
    const l = grid2x2();
    l.rasterData = [-99999, 2, 3, 4];      // NW pixel is noData
    assert.equal(l.hitTest(9, 1), false, "over the transparent NW pixel → no hit");
    assert.equal(l.hitTest(9, 9), true, "over a real pixel → hit");
  });
});

describe("VectorLayer.featureAt", () => {
  const fc = { type: "FeatureCollection", features: [
    { type: "Feature", properties: { id: "A" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]] } },
  ] };
  test("returns the containing feature, else null", () => {
    const l = new VectorLayer({ sources: [{ data: fc }] });
    assert.equal(l.featureAt(5, 5)?.properties.id, "A");
    assert.equal(l.featureAt(50, 50), null);
    assert.equal(l.hitTest(5, 5), true);
  });
});

describe("dispatchMapEventToLayers (z-order + absorption + gating)", () => {
  function fake(name, { visible = true, listens = true, hits = true, absorb = false } = {}) {
    return {
      name, visible, absorb, received: [],
      _hasListeners: () => listens,
      hitTest: () => hits,
      emit(type, evt) { this.received.push(type); if (this.absorb) evt.stopPropagation(); },
    };
  }
  test("dispatches top-down (last = top) and stops on absorption", () => {
    const bottom = fake("bottom");
    const top = fake("top", { absorb: true });
    dispatchMapEventToLayers([bottom, top], "click", { lat: 1, lng: 1 });
    assert.deepEqual(top.received, ["click"], "top received it");
    assert.deepEqual(bottom.received, [], "absorbed → bottom did not");
  });
  test("falls through when the top does not absorb", () => {
    const bottom = fake("bottom");
    const top = fake("top", { absorb: false });
    dispatchMapEventToLayers([bottom, top], "click", { lat: 1, lng: 1 });
    assert.deepEqual(top.received, ["click"]);
    assert.deepEqual(bottom.received, ["click"]);
  });
  test("skips layers that are hidden, uninterested, or miss the hit-test", () => {
    const hidden = fake("hidden", { visible: false });
    const deaf = fake("deaf", { listens: false });
    const missed = fake("missed", { hits: false });
    const hit = fake("hit");
    dispatchMapEventToLayers([hidden, deaf, missed, hit], "click", { lat: 1, lng: 1 });
    assert.deepEqual(hit.received, ["click"]);
    for (const l of [hidden, deaf, missed]) assert.deepEqual(l.received, []);
  });
  test("simultaneous mode: every hit layer receives it, absorption is inert", () => {
    const bottom = fake("bottom");
    const middle = fake("middle");
    const top = fake("top", { absorb: true });   // would normally stop propagation
    dispatchMapEventToLayers([bottom, middle, top], "click", { lat: 1, lng: 1 }, { simultaneous: true });
    assert.deepEqual(top.received, ["click"]);
    assert.deepEqual(middle.received, ["click"], "not vetoed by the top's stopPropagation");
    assert.deepEqual(bottom.received, ["click"]);
  });
  test("simultaneous still honors visible / listener / hit-test gating", () => {
    const missed = fake("missed", { hits: false });
    const deaf = fake("deaf", { listens: false });
    const hit = fake("hit");
    dispatchMapEventToLayers([missed, deaf, hit], "click", { lat: 1, lng: 1 }, { simultaneous: true });
    assert.deepEqual(hit.received, ["click"]);
    assert.deepEqual(missed.received, []);
    assert.deepEqual(deaf.received, []);
  });
  test("real RasterLayers: only the one under the point receives it", () => {
    const near = new RasterLayer({ type: "a" });
    near.meta = { bw: 0, bs: 0, be: 10, bn: 10, width: 1, height: 1 }; near.rasterData = [1]; near.visible = true;
    const far = new RasterLayer({ type: "b" });
    far.meta = { bw: 100, bs: 100, be: 110, bn: 110, width: 1, height: 1 }; far.rasterData = [2]; far.visible = true;
    let nearHit = false, farHit = false;
    near.on("click", () => { nearHit = true; });
    far.on("click", () => { farHit = true; });
    dispatchMapEventToLayers([far, near], "click", { lat: 5, lng: 5 });
    assert.equal(nearHit, true);
    assert.equal(farHit, false);
  });
});

describe("modal capture (region-draw interaction)", () => {
  function fakeLayer() {
    return { visible: true, _hasListeners: () => true, hitTest: () => true, received: [], emit(t) { this.received.push(t); } };
  }
  test("a captured interaction swallows layer dispatch; release restores it", () => {
    const fim = new FimMap({ app: fakeApp() });
    const layer = fakeLayer(); fim.layers.push(layer);
    const seen = [];
    const release = fim.captureInteraction((e) => seen.push(e));
    fim._dispatchMapEvent("click", { lat: 1, lng: 1 });
    assert.deepEqual(layer.received, [], "layer got nothing while captured");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].type, "click");
    assert.equal(fim.capturing, true);
    release();
    assert.equal(fim.capturing, false);
    fim._dispatchMapEvent("click", { lat: 1, lng: 1 });
    assert.deepEqual(layer.received, ["click"], "dispatch resumed after release");
  });

  test("createRegionDraw: clicks accumulate → a SpatialFilter; hover ignored", () => {
    let handler = null;
    const fim = { captureInteraction(h) { handler = h; return () => { handler = null; }; } };
    let done = null;
    const rd = createRegionDraw(fim, { onComplete: (f, pts) => { done = { f, pts }; } });
    rd.start();
    assert.equal(rd.active, true);
    handler({ type: "click", lat: 0, lng: 0 });
    handler({ type: "hover", lat: 5, lng: 5 });        // ignored
    handler({ type: "click", lat: 0, lng: 10 });
    handler({ type: "click", lat: 10, lng: 10 });
    handler({ type: "click", lat: 10, lng: 0 });
    assert.equal(rd.points.length, 4);
    const filter = rd.finish();
    assert.ok(filter, "4 vertices → a SpatialFilter");
    assert.equal(filter.contains(5, 5), true, "inside the drawn square");
    assert.equal(filter.contains(20, 20), false, "outside");
    assert.equal(done.pts.length, 4);
    assert.equal(rd.active, false);
  });

  test("fewer than 3 vertices → null filter", () => {
    let handler = null;
    const fim = { captureInteraction(h) { handler = h; return () => {}; } };
    const rd = createRegionDraw(fim);
    rd.start();
    handler({ type: "click", lat: 0, lng: 0 });
    handler({ type: "click", lat: 1, lng: 1 });
    assert.equal(rd.finish(), null);
  });
});

describe("tools-panel control specs (pure presets)", () => {
  // Every knob RasterSettings.SCALE_KEYS accepts, so the panel and the change-model cannot drift:
  // a knob the settings layer honours but the preset never offers is a knob nobody can reach.
  test("rasterControls with a scale: every SCALE_KEY, plus opacity + hover", () => {
    const l = new RasterLayer({});
    l.set({ colorScale: new ColorScale({ palette: "viridis", min: 0, max: 10 }) });
    const keys = rasterControls(l).map((c) => c.key);
    assert.deepEqual(keys,
      ["palette", "continuous", "min", "max", "unit", "stops", "colorStops", "opacity", "hover"]);
  });

  test("rasterControls reads the live scale, not defaults", () => {
    const l = new RasterLayer({});
    l.set({ colorScale: new ColorScale({ palette: "viridis", min: 2, max: 46, unit: "m", continuous: true }) });
    const by = Object.fromEntries(rasterControls(l).map((c) => [c.key, c.value]));
    assert.equal(by.min, 2);
    assert.equal(by.max, 46);
    assert.equal(by.unit, "m");
    assert.equal(by.continuous, true);
  });

  // `kind` reports 'classed' whenever stops exist, so reading it would show the box unticked while
  // the flag it writes was on — and toggling would then appear to do nothing.
  test("the continuous control reads the FLAG, not the derived kind", () => {
    const l = new RasterLayer({});
    const cs = new ColorScale({ palette: "viridis", continuous: true });
    cs.setStops([{ min: 0, max: 1, color: "#000000" }]);
    l.set({ colorScale: cs });
    assert.equal(cs.kind, "classed", "the derived kind says classed…");
    const by = Object.fromEntries(rasterControls(l).map((c) => [c.key, c.value]));
    assert.equal(by.continuous, true, "…but the checkbox must reflect the flag it writes");
  });

  test("the band and gradient controls carry the scale's current mode", () => {
    const l = new RasterLayer({});
    const cs = new ColorScale({ palette: "viridis" });
    cs.setStops([{ min: 0, max: 5, color: "#001122", label: "low" }]);
    l.set({ colorScale: cs });
    const by = Object.fromEntries(rasterControls(l).map((c) => [c.key, c.value]));
    assert.equal(by.stops.length, 1);
    assert.equal(by.stops[0].color, "#001122");
    assert.equal(by.colorStops, null, "the three modes are mutually exclusive");

    cs.setColorStops([0, 10], ["#000000", "#ffffff"]);
    const by2 = Object.fromEntries(rasterControls(l).map((c) => [c.key, c.value]));
    assert.equal(by2.stops, null, "setColorStops cleared the bands");
    assert.deepEqual(by2.colorStops, { values: [0, 10], colors: ["#000000", "#ffffff"] });
  });
  test("rasterControls without a scale: just opacity + hover", () => {
    const keys = rasterControls(new RasterLayer({})).map((c) => c.key);
    assert.deepEqual(keys, ["opacity", "hover"]);
  });
  test("vectorControls: colour + opacity", () => {
    const l = new VectorLayer({ sources: [{ data: { type: "FeatureCollection", features: [] } }] });
    assert.deepEqual(vectorControls(l).map((c) => c.key), ["color", "opacity"]);
  });
});

describe("read-model renderers", () => {
  test("renderLegend returns data by default, HTML (via toHtml) on request", () => {
    const legend = { toJSON: () => ({ stops: [{ color: "#f00", label: "hi" }] }), toHtml: () => "<div>L</div>" };
    assert.deepEqual(renderLegend(legend), { stops: [{ color: "#f00", label: "hi" }] });
    assert.equal(renderLegend(legend, { html: true }), "<div>L</div>");
    assert.equal(renderLegend(null), null);
  });
  test("renderStats HTML lists scalars and skips nested objects", () => {
    const stats = { toJSON: () => ({ min: 1, max: 9, mean: 4.5, histogram: { 0: 3 } }) };
    const html = renderStats(stats, { html: true });
    assert.match(html, /min/);
    assert.match(html, /max/);
    assert.ok(!/histogram/.test(html), "nested objects are omitted from the scalar table");
    assert.deepEqual(renderStats(stats).mean, 4.5);
  });
});
