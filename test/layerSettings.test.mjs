// LayerSettings — the declarative change-model (package/layerSettings.js + Layer.settings).
//
// Settings are render/compute PARAMETERS (not operations): mutating one classifies its effect and
// emits the matching event (restyle | recomputed) + a 'settings' summary. Headless — no DOM, no map
// (layers kept not-visible so no redraw is attempted). See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 "Settings vs. Operations".

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RasterLayer, VectorLayer } from "../src/package/layer.js";
import { ColorScale } from "../src/package/colorScale.js";

function recorder(layer) {
  const seen = [];
  for (const e of ["restyle", "recomputed", "settings"]) layer.on(e, (p) => seen.push([e, p]));
  return seen;
}

describe("RasterSettings: effect classification", () => {
  test("opacity is a restyle (no recompute), and is applied to the layer", async () => {
    const layer = new RasterLayer({});
    const seen = recorder(layer);
    await layer.settings.set({ opacity: 0.5 });
    assert.equal(layer.opacity, 0.5);
    const names = seen.map(([e]) => e);
    assert.ok(names.includes("restyle"), "opacity → restyle");
    assert.ok(!names.includes("recomputed"), "opacity is not a recompute");
    assert.ok(names.includes("settings"), "always emits a settings summary");
    assert.deepEqual(seen.at(-1)[1].changed, { opacity: 0.5 });
  });

  test("noData is a recompute (data axis), and is applied", async () => {
    const layer = new RasterLayer({});
    const seen = recorder(layer);
    await layer.settings.set({ noData: -99999 });
    assert.equal(layer.noData, -99999);
    assert.ok(seen.some(([e]) => e === "recomputed"), "noData → recomputed");
  });

  test("palette routes to the ColorScale (which owns the restyle emit)", async () => {
    const layer = new RasterLayer({});
    layer.set({ colorScale: new ColorScale({ palette: "viridis", min: 0, max: 10 }) });
    const seen = recorder(layer);
    await layer.settings.set({ palette: "plasma" });
    assert.equal(layer.colorScale.palette, "plasma", "the scale changed");
    assert.ok(seen.some(([e]) => e === "restyle"), "the scale's onChange emitted restyle");
  });

  test("hover is interaction-only: a settings summary, no map effect event", async () => {
    const layer = new RasterLayer({});
    const seen = recorder(layer);
    await layer.settings.set({ hover: false });
    assert.equal(layer.settings.get("hover"), false);
    const names = seen.map(([e]) => e);
    assert.deepEqual(names, ["settings"], "only the summary fires");
  });

  test("hover defaults on for a raster (so a bound tooltip works out of the box)", () => {
    assert.equal(new RasterLayer({}).settings.get("hover"), true);
  });

  test("unknown knobs are ignored; an all-unknown set emits nothing", async () => {
    const layer = new RasterLayer({});
    const seen = recorder(layer);
    await layer.settings.set({ nope: 1, alsoNope: 2 });
    assert.deepEqual(seen, []);
  });

  test("get() returns a copy of the whole state", () => {
    const layer = new RasterLayer({});
    const s = layer.settings.get();
    s.opacity = 999;
    assert.notEqual(layer.settings.get("opacity"), 999, "mutating the copy does not leak back");
  });
});

describe("VectorSettings", () => {
  const fc = { type: "FeatureCollection", features: [] };

  test("color re-styles (merged neutral style) and emits restyle", async () => {
    const layer = new VectorLayer({ sources: [{ data: fc, bounds: {} }] });
    const seen = recorder(layer);
    await layer.settings.set({ color: "#ff0000" });
    assert.deepEqual(layer._style, { fillColor: "#ff0000", strokeColor: "#ff0000" });
    assert.ok(seen.some(([e]) => e === "restyle"));
  });

  test("opacity merges into the existing style", async () => {
    const layer = new VectorLayer({ sources: [{ data: fc, bounds: {} }] });
    await layer.settings.set({ color: "#00ff00" });
    await layer.settings.set({ opacity: 0.3 });
    assert.equal(layer._style.fillOpacity, 0.3);
    assert.equal(layer._style.fillColor, "#00ff00", "previous style is preserved");
  });
});

// ── the consistency contract (the naming/shape audit) ────────────────────────────────────────
//
// One name means one thing; a concept has one name; the CATEGORY of a member is predictable from
// its shape — nouns are free, ops are sync and chainable, terminals are async. These lock in the
// four rules that the audit changed, so a future edit that reintroduces a second spelling fails
// here rather than in a user's console.

describe("consistency: set() is a sync, chainable OP (not a terminal)", () => {
  test("layer.set() returns the LAYER synchronously — no promise to await", () => {
    const layer = new RasterLayer({});
    const returned = layer.set({ opacity: 0.5 });
    assert.equal(returned, layer, "chainable: returns the layer itself");
    assert.ok(!(returned instanceof Promise), "an op is sync — it does not return a promise");
    assert.equal(layer.opacity, 0.5, "and it already took effect");
  });

  test("set() chains, and every knob is applied", () => {
    const layer = new RasterLayer({});
    layer.set({ opacity: 0.4 }).set({ hover: false });
    assert.equal(layer.opacity, 0.4);
    assert.equal(layer.settings.get("hover"), false);
  });

  test("settled() is the terminal for the one knob that redraws, and is safe when nothing is pending", async () => {
    const layer = new RasterLayer({});
    layer.set({ opacity: 0.5 });                 // no redraw scheduled
    assert.equal(await layer.settled(), layer, "resolves immediately, returns the layer");
  });

  test("a settings-triggered redraw still emits its effect events AFTER the render", async () => {
    // noData is the only redraw knob. visible+result make render() actually run, so this proves the
    // sequencing moved onto the internal promise rather than being dropped.
    const layer = new RasterLayer({});
    let renders = 0;
    layer.visible = true;
    layer.result = { pixels: new Float32Array([1]), width: 1, height: 1 };
    layer._draw = async () => { renders++; };
    const order = [];
    layer.on("recomputed", () => order.push("recomputed"));
    layer.set({ noData: -99999 });
    assert.equal(order.length, 0, "the effect event has NOT fired yet — the redraw is still in flight");
    await layer.settled();
    assert.equal(renders, 1, "the redraw ran");
    assert.deepEqual(order, ["recomputed"], "and the effect event fired after it");
  });

  test("a failing redraw surfaces on the layer's error event, not as an unhandled rejection", async () => {
    const layer = new RasterLayer({});
    layer.visible = true;
    layer.result = { pixels: new Float32Array([1]), width: 1, height: 1 };
    layer._draw = async () => { throw new Error("boom"); };
    const errors = [];
    layer.on("error", (p) => errors.push(p));
    layer.set({ noData: -1 });
    await layer.settled();
    assert.equal(errors.length, 1);
    assert.equal(errors[0].phase, "settings");
    assert.match(errors[0].error.message, /boom/);
  });
});

describe("consistency: ONE recolour path", () => {
  test("layer.set({ colorScale }) attaches — setColorScale is no longer public", () => {
    const layer = new RasterLayer({ map: { _unregisterLayer() {} } });
    assert.equal(layer.setColorScale, undefined, "the third path is gone from the public surface");
    const cs = new ColorScale({ palette: "viridis", min: 0, max: 10 });
    assert.equal(layer.set({ colorScale: cs }), layer);
    assert.equal(layer.colorScale, cs, "attached, and readable as a noun");
  });

  test("set({palette}) and the attached scale's own set() reach the same place, once each", () => {
    const layer = new RasterLayer({ map: { _unregisterLayer() {} }, type: "userRaster" });
    layer.set({ colorScale: new ColorScale({ palette: "blues", min: 0, max: 1 }) });
    let restyles = 0;
    layer.on("restyle", () => restyles++);
    layer.set({ palette: "viridis" });
    assert.equal(layer.colorScale.palette, "viridis");
    assert.equal(restyles, 1, "exactly one restyle — no double-fire between the two spellings");
    layer.colorScale.set({ palette: "reds" });
    assert.equal(restyles, 2, "the scale's own set() still works — it is a value type in its own right");
  });
});

describe("consistency: layer.set() and colorScale.set() behave IDENTICALLY for the same patch", () => {
  // Found by manual browser testing: layer.set({palette, continuous}) fired TWO restyles because
  // each key was routed to the scale separately, while colorScale.set({palette, continuous}) fired
  // ONE. Same patch, two behaviours depending on which object you handed it to.
  const attached = () => {
    const l = new RasterLayer({ map: { _unregisterLayer() {} }, type: "userRaster" });
    l.set({ colorScale: new ColorScale({ palette: "blues", min: 0, max: 1 }) });
    return l;
  };

  test("a multi-key scale patch fires exactly ONE restyle", () => {
    const l = attached();
    let restyles = 0; l.on("restyle", () => restyles++);
    l.set({ palette: "heat", min: 0, max: 6, continuous: true });
    assert.equal(restyles, 1, "one batch → one repaint, not one per key");
  });

  test("min/max/unit actually reach the scale (they were silently ignored)", () => {
    const l = attached();
    l.set({ palette: "viridis", min: 3, max: 9, unit: "m", continuous: true });
    const cs = l.colorScale;
    assert.equal(cs.palette, "viridis");
    assert.equal(cs.unit, "m");
    assert.equal(cs.continuous, true);
    assert.deepEqual([cs._min, cs._max], [3, 9], "min/max are no longer dropped on the floor");
  });

  test("N single-key calls still fire N restyles (no accidental coalescing across calls)", () => {
    const l = attached();
    let restyles = 0; l.on("restyle", () => restyles++);
    l.set({ palette: "plasma" });
    l.set({ palette: "terrain" });
    l.set({ continuous: false });
    assert.equal(restyles, 3);
  });

  test("a bad key in the group falls back to per-key so the others still apply", () => {
    const l = attached();
    assert.throws(() => l.set({ palette: "bogus", min: 2, max: 8 }), /unknown palette/);
    assert.deepEqual([l.colorScale._min, l.colorScale._max], [2, 8],
      "min/max survived even though palette failed — partial, best-effort");
    assert.equal(l.colorScale.palette, "blues", "the bad palette was NOT applied");
  });

  test("scale knobs with NO scale attached are inert but recorded", () => {
    const l = new RasterLayer({});
    assert.equal(l.colorScale, null, "no scale until one is attached or auto-resolved at render");
    l.set({ palette: "viridis", min: 0, max: 5 });
    assert.equal(l.settings.get("palette"), "viridis", "recorded for a later attach / a UI read-back");
  });
});
