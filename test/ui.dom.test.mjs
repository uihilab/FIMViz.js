// fimviz/ui — BLACK-BOX tests for all 14 exports and every option each one takes.
//
// Black box means: call the exported function exactly as a host would, then assert on what a host can
// observe — the returned handle, the DOM it produced, the callbacks it fired, the layer state it
// changed. Nothing here reaches into module internals, and nothing asserts on private fields. Where a
// test needs a Layer or a FimMap it uses the real classes, not a mock, so a change in their contract
// shows up here too.
//
// Runs in jsdom. This is the first coverage `src/ui/` has had.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom, UI, RasterLayer, VectorLayer, Dataset, ColorScale, Legend, Stats, SpatialFilter;

beforeEach(async () => {
  // pretendToBeVisual gives jsdom requestAnimationFrame, which the toast uses for its fade-in.
  dom = new JSDOM("<!doctype html><body><div id='host'></div></body>",
    { url: "http://localhost/", pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.Node = dom.window.Node;                       // infoWindow does `html instanceof Node`
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.navigator ??= dom.window.navigator;
  UI = await import("../src/ui/index.js");
  ({ RasterLayer, VectorLayer } = await import("../src/package/layer.js"));
  ({ Dataset } = await import("../src/package/dataset.js"));
  ({ ColorScale } = await import("../src/package/colorScale.js"));
  ({ Legend } = await import("../src/package/legend.js"));
  ({ Stats } = await import("../src/package/stats.js"));
  ({ SpatialFilter } = await import("../src/package/filter.js"));
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.Node;
  delete globalThis.requestAnimationFrame;
  dom.window.close();
});

/** A tiny event bus with the FimMap surface these bindings actually use. */
function fakeFim(root) {
  const subs = new Map();
  return {
    root,
    on(evt, fn) { (subs.get(evt) ?? subs.set(evt, []).get(evt)).push(fn); return this; },
    off(evt, fn) { subs.set(evt, (subs.get(evt) || []).filter((f) => f !== fn)); return this; },
    emit(evt, payload) { for (const fn of subs.get(evt) || []) fn(payload); return this; },
    count(evt) { return (subs.get(evt) || []).length; },
  };
}

const host = () => document.getElementById("host");

/** A raster Layer with a real ColorScale, built the way a host would. */
function rasterLayer() {
  const l = new RasterLayer({ id: "r1" });
  l._setColorScale(new ColorScale({ palette: "viridis", min: 0, max: 10 }));
  return l;
}

// ── 1 · createToolsPanel ────────────────────────────────────────────────────────────────

describe("ui: createToolsPanel", () => {
  test("mounts into an element and into a selector string alike", () => {
    const a = UI.createToolsPanel(host(), { layer: rasterLayer() });
    const b = UI.createToolsPanel("#host", { layer: rasterLayer() });
    for (const p of [a, b]) {
      assert.equal(p.el.getAttribute("data-fim-ui"), "tools-panel");
      assert.equal(p.el.parentElement, host());
    }
  });

  test("rejects a missing layer and a target that does not exist", () => {
    assert.throws(() => UI.createToolsPanel(host(), {}), /\{ layer \} is required/);
    assert.throws(() => UI.createToolsPanel("#nope", { layer: rasterLayer() }), /not found/);
  });

  test("the raster preset renders every ColorScale knob, plus opacity and hover", () => {
    const { el } = UI.createToolsPanel(host(), { layer: rasterLayer() });
    const labels = [...el.querySelectorAll("label>span, .fim-stops>span.hd")].map((s) => s.textContent);
    assert.deepEqual(labels,
      ["Palette", "Continuous", "Min", "Max", "Unit", "Bands", "Gradient", "Opacity", "Hover value"]);
    assert.equal(el.querySelector("select").tagName, "SELECT");
    assert.equal(el.querySelectorAll("input[type=checkbox]").length, 2);
    assert.equal(el.querySelector("input[type=range]").max, "1");
    assert.equal(el.querySelectorAll("input[type=number][data-control]").length, 2, "min and max");
    assert.equal(el.querySelector("input[type=text][data-control=unit]").tagName, "INPUT");
  });

  test("the vector preset offers a colour picker when no scale is attached", () => {
    const { el } = UI.createToolsPanel(host(), { layer: new VectorLayer({ id: "v1" }) });
    const labels = [...el.querySelectorAll("span")].map((s) => s.textContent);
    assert.deepEqual(labels, ["Colour", "Fill opacity"]);
    assert.equal(el.querySelector("input[type=color]").value, "#3388ff");
  });

  test("rasterControls/vectorControls are usable standalone — they return plain specs", () => {
    const spec = UI.rasterControls(rasterLayer());
    assert.ok(Array.isArray(spec));
    assert.deepEqual(spec.map((c) => c.type),
      ["select", "checkbox", "number", "number", "text", "bands", "gradient", "range", "checkbox"]);
    assert.ok(UI.rasterControls(spec[0].options ? rasterLayer() : rasterLayer())[0].options.length > 1,
      "the palette select is populated from the real palette registry");
    assert.deepEqual(UI.vectorControls(new VectorLayer({ id: "v" })).map((c) => c.key),
      ["color", "opacity"]);
  });

  // The load-bearing behaviour: a control is not decoration, it drives layer.set().
  test("changing a control commits to the layer", () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer });

    const sel = el.querySelector("select");
    sel.value = "plasma";
    sel.dispatchEvent(new dom.window.Event("change"));
    assert.equal(layer.colorScale.palette, "plasma", "palette reached the ColorScale");

    const range = el.querySelector("input[type=range]");
    range.value = "0.25";
    range.dispatchEvent(new dom.window.Event("input"));
    assert.equal(layer.settings.get("opacity"), 0.25);

    const hover = el.querySelectorAll("input[type=checkbox]")[1];
    hover.checked = false;
    hover.dispatchEvent(new dom.window.Event("change"));
    assert.equal(layer.settings.get("hover"), false);
  });

  // ── the ColorScale knobs beyond palette (PACKAGE_ROADMAP §5) ─────────────────────────
  //
  // These all route through layer.settings.set(), which coalesces the ColorScale-bound keys into one
  // colorScale.set(patch) — so what is asserted is the SCALE's state, not the panel's.
  const change = (node) => node.dispatchEvent(new dom.window.Event("change"));
  const ctl = (el, key) => el.querySelector(`[data-control="${key}"]`);
  const stopRows = (el, key) => [...ctl(el, key).querySelectorAll(".fim-stop")];
  const field = (row, name) => row.querySelector(`[data-field="${name}"]`);

  test("min / max / unit reach the ColorScale", () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer });
    const min = ctl(el, "min"), max = ctl(el, "max"), unit = ctl(el, "unit");
    assert.equal(min.value, "0", "seeded from the live scale");
    min.value = "2"; change(min);
    max.value = "46"; change(max);
    unit.value = "m"; change(unit);
    const cs = layer.colorScale.toJSON();
    assert.equal(cs.min, 2);
    assert.equal(cs.max, 46);
    assert.equal(cs.unit, "m");
  });

  // Blanking a number field to retype it must not be read as zero — that would silently rescale the
  // colours between two keystrokes.
  test("an emptied number field commits nothing", () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer });
    const max = ctl(el, "max");
    max.value = ""; change(max);
    assert.equal(layer.colorScale.toJSON().max, 10, "unchanged");
  });

  test("adding a band switches the scale into discrete mode", () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer });
    assert.equal(stopRows(el, "stops").length, 0, "a palette scale starts with no bands");

    ctl(el, "stops").querySelector(".fim-stops-add").click();
    const rows = stopRows(el, "stops");
    assert.equal(rows.length, 1);
    const cs = layer.colorScale.toJSON();
    assert.equal(cs.stops.length, 1, "one band reached the scale");
    assert.equal(layer.colorScale.isExplicit, true, "…and the scale left palette mode");

    const to = field(rows[0], "max");
    to.value = "5"; change(to);
    const label = field(rows[0], "label");
    label.value = "shallow"; change(label);
    const after = layer.colorScale.toJSON().stops[0];
    assert.equal(after.max, 5);
    assert.equal(after.label, "shallow");
  });

  test("removing a band rewrites the whole array", () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer });
    const add = ctl(el, "stops").querySelector(".fim-stops-add");
    add.click(); add.click();
    assert.equal(layer.colorScale.toJSON().stops.length, 2);
    stopRows(el, "stops")[0].querySelector("button").click();
    assert.equal(layer.colorScale.toJSON().stops.length, 1);
    assert.equal(stopRows(el, "stops").length, 1, "and the editor redrew");
  });

  // setColorStops throws below two points, so one is an incomplete edit — shown, not committed.
  test("a gradient commits only once it has two control points", () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer });
    const add = ctl(el, "colorStops").querySelector(".fim-stops-add");

    add.click();
    assert.equal(layer.colorScale.toJSON().colorStops, null, "one point is not a gradient");
    assert.equal(stopRows(el, "colorStops").length, 1, "but it is on screen, mid-edit");

    add.click();
    const cs = layer.colorScale.toJSON();
    assert.equal(cs.colorStops.values.length, 2);
    assert.equal(cs.colorStops.colors.length, 2);
  });

  test("switching to a gradient clears the bands, and picking a palette clears both", () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer });
    ctl(el, "stops").querySelector(".fim-stops-add").click();
    assert.ok(layer.colorScale.toJSON().stops.length);

    const grad = ctl(el, "colorStops").querySelector(".fim-stops-add");
    grad.click(); grad.click();
    assert.equal(layer.colorScale.toJSON().stops, null, "the three modes are mutually exclusive");

    const sel = el.querySelector("select");
    sel.value = "plasma"; change(sel);
    const cs = layer.colorScale.toJSON();
    assert.equal(cs.colorStops, null);
    assert.equal(cs.palette, "plasma", "picking a palette is how you leave the other two modes");
  });

  test("the editors are seeded from a scale that already has bands", () => {
    const layer = rasterLayer();
    layer.colorScale.setStops([
      { min: 0, max: 1, color: "#001122", label: "low" },
      { min: 1, max: 2, color: "#334455", label: "high" },
    ]);
    const { el } = UI.createToolsPanel(host(), { layer });
    const rows = stopRows(el, "stops");
    assert.equal(rows.length, 2);
    assert.equal(field(rows[0], "color").value, "#001122");
    assert.equal(field(rows[1], "label").value, "high");
  });

  // A colour input rejects anything that is not #rrggbb, so a stop carrying a CSS name would render
  // as an empty swatch and then write that empty value straight back into the scale.
  test("a non-hex stop colour degrades to a valid swatch instead of blanking", () => {
    const layer = rasterLayer();
    layer.colorScale.setStops([{ min: 0, max: 1, color: "rebeccapurple" }]);
    const { el } = UI.createToolsPanel(host(), { layer });
    assert.match(field(stopRows(el, "stops")[0], "color").value, /^#[0-9a-f]{6}$/i);
  });

  test("a control's note is rendered with it", () => {
    const { el } = UI.createToolsPanel(host(), { layer: rasterLayer() });
    const notes = [...el.querySelectorAll(".fim-note")].map((n) => n.textContent);
    assert.equal(notes.length, 2, "bands and gradient each explain themselves");
    assert.match(notes[0], /discrete/);
  });

  // ── reactive mode ────────────────────────────────────────────────────────────────────
  //
  // Opt-in, and the focus rule is why: unlike a legend, this panel is made of LIVE INPUTS, and a
  // restyle arrives on every keystroke-driven commit. Rebuilding blindly would rip the field out from
  // under the cursor.
  test("reactive:true follows a change made somewhere else", async () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer, reactive: true });
    assert.equal(el.querySelector("select").value, "viridis");
    layer.set({ palette: "plasma" });                 // e.g. another panel, or host code
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(el.querySelector("select").value, "plasma", "the panel re-read the layer");
  });

  test("reactive:false (the default) does not", async () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer });
    layer.set({ palette: "plasma" });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(el.querySelector("select").value, "viridis");
  });

  test("a redraw is DEFERRED while focus is inside, then happens when focus leaves", async () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), { layer, reactive: true });
    const unit = el.querySelector('input[data-control="unit"]');
    unit.focus();
    assert.equal(document.activeElement, unit);

    layer.set({ palette: "plasma" });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(document.activeElement, unit, "the field the user is in must survive");
    assert.equal(el.querySelector("select").value, "viridis", "…so the redraw waited");

    unit.blur();
    el.dispatchEvent(new dom.window.Event("focusout"));
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(el.querySelector("select").value, "plasma", "and landed once the field was released");
  });

  test("destroy() releases the subscription", async () => {
    const layer = rasterLayer();
    const p = UI.createToolsPanel(host(), { layer, reactive: true });
    p.destroy();
    layer.set({ palette: "plasma" });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(host().querySelectorAll("[data-fim-ui=tools-panel]").length, 0);
  });

  test("a custom controls ARRAY replaces the preset", () => {
    const layer = rasterLayer();
    const { el } = UI.createToolsPanel(host(), {
      layer, controls: [{ type: "range", key: "opacity", label: "Alpha", min: 0, max: 1, step: 0.1, value: 1 }],
    });
    assert.equal(el.children.length, 1);
    assert.equal(el.querySelector("span").textContent, "Alpha");
  });

  test("a custom controls FUNCTION is called with the layer, and re-called by update()", () => {
    const layer = rasterLayer();
    const seen = [];
    const { el, update } = UI.createToolsPanel(host(), {
      layer,
      controls: (l) => { seen.push(l); return [{ type: "text", key: "k", label: `n=${seen.length}`, value: "" }]; },
    });
    assert.equal(seen[0], layer, "the spec function receives the layer itself");
    assert.equal(el.querySelector("span").textContent, "n=1");
    update();
    assert.equal(el.querySelector("span").textContent, "n=2", "update() re-renders from the spec");
    assert.equal(el.children.length, 1, "and replaces rather than appends");
  });

  test("every control type renders an input, including the unknown-type fallback", () => {
    const { el } = UI.createToolsPanel(host(), {
      layer: rasterLayer(),
      controls: [
        { type: "select", key: "a", label: "A", options: [{ value: 1, label: "one" }], value: 1 },
        { type: "checkbox", key: "b", label: "B", value: true },
        { type: "range", key: "c", label: "C", min: 0, max: 2, step: 1, value: 1 },
        { type: "color", key: "d", label: "D", value: "#ff0000" },
        { type: "wat", key: "e", label: "E", value: "free" },
      ],
    });
    assert.equal(el.children.length, 5);
    assert.equal(el.querySelectorAll("select").length, 1);
    assert.equal(el.querySelector("input[type=color]").value, "#ff0000");
    assert.equal([...el.querySelectorAll("input")].at(-1).value, "free", "unknown type → a text input");
  });

  test("pretty injects exactly one stylesheet however many panels are mounted", () => {
    UI.createToolsPanel(host(), { layer: rasterLayer(), pretty: true });
    UI.createToolsPanel(host(), { layer: rasterLayer(), pretty: true });
    assert.equal(document.querySelectorAll("#fim-tools-panel-css").length, 1);
    assert.ok(!UI.createToolsPanel(host(), { layer: rasterLayer() }).el.className.includes("fim-pretty"));
  });

  test("destroy() removes the panel from the document", () => {
    const p = UI.createToolsPanel(host(), { layer: rasterLayer() });
    p.destroy();
    assert.equal(host().querySelector("[data-fim-ui=tools-panel]"), null);
  });
});

// ── 2 · createOperationsPanel ───────────────────────────────────────────────────────────

describe("ui: createOperationsPanel", () => {
  // A layer whose source is a real inline raster Dataset, so the ops actually run.
  function opsLayer() {
    // A materializer for this test's own format: the panel is being tested, not the decoders, but the
    // ops must really run so the assertions are about pixels rather than about call bookkeeping.
    Dataset.registerMaterializer("test-grid", async (root) => {
      const { RasterGrid } = await import("../src/package/materialize.js");
      return new RasterGrid({ ...root.data, crs: "EPSG:4326", noData: null });
    });
    const pixels = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bounds = { north: 3, south: 0, east: 3, west: 0 };
    const ds = new Dataset({
      name: "grid", kind: "raster", format: "test-grid", crs: "EPSG:4326", bounds,
      data: { pixels, width: 3, height: 3, bounds },
    });
    const layer = new RasterLayer({ id: "ops" });
    layer.sources = [ds];
    // _draw needs a provider+map; the panel is tested for what it DERIVES, so rendering is stubbed.
    layer._draw = () => {};
    layer._checkProviderCRS = () => {};
    return { layer, ds };
  }

  /** A vector layer, for the ops that only exist on the other side of the kind split. */
  function vectorOpsLayer() {
    const bounds = { north: 3, south: 0, east: 3, west: 0 };
    const ds = new Dataset({
      name: "shapes", kind: "vector", format: "geojson", crs: "EPSG:4326", bounds,
      data: { type: "FeatureCollection", features: [] },
    });
    const layer = new VectorLayer({ id: "vops" });
    layer.sources = [ds];
    layer._draw = () => {};
    layer._checkProviderCRS = () => {};
    return { layer, ds };
  }

  const buttons = (el) => [...el.querySelectorAll("button")];
  const byText = (el, t) => buttons(el).find((b) => b.textContent === t);
  // Ops are addressed by id, not by position: the panel now has a dozen of them, and an index-based
  // selector would silently retarget the moment one is added above another.
  const opEl = (el, id) => el.querySelector(`[data-op="${id}"]`);
  const fieldEl = (el, id, k) => opEl(el, id).querySelector(`[data-field="${k}"]`);
  const setField = (el, id, k, v) => { fieldEl(el, id, k).value = v; };
  const apply = (el, id) => opEl(el, id).querySelector("button").click();
  const settle = () => new Promise((r) => setTimeout(r, 0));

  test("offers the raster ops, grouped, plus reset", () => {
    const { layer } = opsLayer();
    const { el, ops } = UI.createOperationsPanel(host(), { layer });
    assert.equal(el.getAttribute("data-fim-ui"), "operations-panel");
    assert.deepEqual(ops, ["clip", "mask", "reclassify", "slope", "aspect", "hillshade",
      "resample", "reproject", "combine", "reduce", "zonalStats", "groupBy"]);
    assert.deepEqual([...el.querySelectorAll("[data-group]")].map((g) => g.getAttribute("data-group")),
      ["Extent", "Values", "Terrain", "Grid", "Multi-layer", "Axis", "Analysis"]);
    assert.ok(opEl(el, "reset"), "and a reset");
  });

  test("a VECTOR layer is offered rasterize and NONE of the raster ops", () => {
    const { layer } = vectorOpsLayer();
    const { ops } = UI.createOperationsPanel(host(), { layer });
    assert.deepEqual(ops, ["rasterize"], "offering clip on a vector would only ever throw");
  });

  test("rejects a missing layer and a bad target", () => {
    assert.throws(() => UI.createOperationsPanel(host(), {}), /\{ layer \} is required/);
    assert.throws(() => UI.createOperationsPanel("#nope", { layer: opsLayer().layer }), /not found/);
  });

  test("Reclassify derives from the range and calls onApply", async () => {
    const { layer, ds } = opsLayer();
    let applied = null;
    const { el } = UI.createOperationsPanel(host(), { layer, onApply: (l, e) => { applied = { l, e }; } });
    setField(el, "reclassify", "min", "3");
    setField(el, "reclassify", "max", "7");
    apply(el, "reclassify");
    await settle();

    assert.equal(applied?.e, undefined, "no error");
    assert.notEqual(layer.sources[0], ds, "the layer points at a DERIVED dataset");
    const g = await layer.sources[0].grid();
    const kept = [...g.pixels].filter((v) => !Number.isNaN(v));
    assert.deepEqual(kept, [3, 4, 5, 6], "values in [3,7) survive; the rest became NaN");
  });

  // Leaving `value` blank is the engine's "keep the matched pixel's value" band — which is what makes
  // one op cover both a threshold and a remap.
  test("Reclassify with a value REPLACES the matched pixels", async () => {
    const { layer } = opsLayer();
    const { el } = UI.createOperationsPanel(host(), { layer });
    setField(el, "reclassify", "min", "3");
    setField(el, "reclassify", "max", "7");
    setField(el, "reclassify", "value", "99");
    apply(el, "reclassify");
    await settle();
    const g = await layer.sources[0].grid();
    assert.deepEqual([...g.pixels].filter((v) => !Number.isNaN(v)), [99, 99, 99, 99]);
  });

  test("Reclassify with unmatched=keep leaves the rest alone", async () => {
    const { layer } = opsLayer();
    const { el } = UI.createOperationsPanel(host(), { layer });
    setField(el, "reclassify", "min", "3");
    setField(el, "reclassify", "max", "7");
    setField(el, "reclassify", "value", "0");
    fieldEl(el, "reclassify", "unmatched").value = "keep";
    apply(el, "reclassify");
    await settle();
    const g = await layer.sources[0].grid();
    assert.deepEqual([...g.pixels], [1, 2, 0, 0, 0, 0, 7, 8, 9]);
  });

  test("Reclassify with both range fields empty is a no-op, not an error", async () => {
    const { layer, ds } = opsLayer();
    const { el } = UI.createOperationsPanel(host(), { layer });
    apply(el, "reclassify");
    await settle();
    assert.equal(layer.sources[0], ds, "nothing was derived");
  });

  test("Reclassify accepts an open-ended range (min only, max only)", async () => {
    for (const [minV, maxV, expect] of [["6", "", [6, 7, 8, 9]], ["", "4", [1, 2, 3]]]) {
      const { layer } = opsLayer();
      const { el } = UI.createOperationsPanel(host(), { layer });
      setField(el, "reclassify", "min", minV);
      setField(el, "reclassify", "max", maxV);
      apply(el, "reclassify");
      await settle();
      const g = await layer.sources[0].grid();
      assert.deepEqual([...g.pixels].filter((v) => !Number.isNaN(v)), expect);
    }
  });

  test("Clip prefills from the layer's own footprint and crops to what you type", async () => {
    const { layer } = opsLayer();
    const { el } = UI.createOperationsPanel(host(), { layer });
    assert.equal(fieldEl(el, "clip", "north").value, "3", "four empty boxes would be a guessing game");
    assert.equal(fieldEl(el, "clip", "west").value, "0");
    setField(el, "clip", "north", "2");
    apply(el, "clip");
    await settle();
    const g = await layer.sources[0].grid();
    assert.equal(g.height, 2, "the top row was cropped away");
    assert.equal(g.bounds.north, 2);
  });

  test("Mask uses the region callback, and does nothing when it returns null", async () => {
    const { layer, ds } = opsLayer();
    let current = null;
    const { el } = UI.createOperationsPanel(host(), { layer, region: () => current });

    apply(el, "mask");
    await settle();
    assert.equal(layer.sources[0], ds, "no region drawn yet → no-op");

    current = new SpatialFilter([{ lat: 0, lng: 0 }, { lat: 0, lng: 1.5 }, { lat: 1.5, lng: 1.5 }, { lat: 1.5, lng: 0 }]);
    apply(el, "mask");
    await settle();
    assert.notEqual(layer.sources[0], ds, "a region was applied");
    const g = await layer.sources[0].grid();
    assert.ok([...g.pixels].some((v) => Number.isNaN(v)), "pixels outside the polygon became NaN");
    assert.ok([...g.pixels].some((v) => !Number.isNaN(v)), "and pixels inside survived");
  });

  test("Mask invert keeps the OTHER side", async () => {
    const ring = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1.5 }, { lat: 1.5, lng: 1.5 }, { lat: 1.5, lng: 0 }];
    const survivors = async (invert) => {
      const { layer } = opsLayer();
      const { el } = UI.createOperationsPanel(host(), { layer, region: () => new SpatialFilter(ring) });
      if (invert) fieldEl(el, "mask", "invert").checked = true;
      apply(el, "mask");
      await settle();
      const g = await layer.sources[0].grid();
      return [...g.pixels].filter((v) => !Number.isNaN(v));
    };
    const inside = await survivors(false), outside = await survivors(true);
    assert.ok(inside.length && outside.length);
    assert.deepEqual(inside.filter((v) => outside.includes(v)), [], "the two halves must not overlap");
  });

  test("an op with no fields still runs — Aspect derives a new dataset", async () => {
    const { layer, ds } = opsLayer();
    const { el } = UI.createOperationsPanel(host(), { layer });
    apply(el, "aspect");
    await settle();
    assert.notEqual(layer.sources[0], ds);
    const g = await layer.sources[0].grid();
    assert.equal(g.width, 3, "same footprint, new values");
  });

  test("Resample rewrites the pixel grid at the same footprint", async () => {
    const { layer } = opsLayer();
    const { el } = UI.createOperationsPanel(host(), { layer });
    setField(el, "resample", "width", "6");
    setField(el, "resample", "height", "6");
    apply(el, "resample");
    await settle();
    const g = await layer.sources[0].grid();
    assert.equal(g.width, 6);
    assert.equal(g.height, 6);
    assert.equal(g.bounds.north, 3, "resample is not reprojection — the footprint is untouched");
  });

  test("Reproject validates eagerly, and the failure reaches onApply", async () => {
    const { layer } = opsLayer();
    let err = null;
    const { el } = UI.createOperationsPanel(host(), { layer, onApply: (_l, e) => { err = e; } });
    setField(el, "reproject", "crs", "not-a-crs");
    apply(el, "reproject");
    await settle();
    assert.match(err?.message ?? "", /not a recognized CRS/);
  });

  // Ops that need something the host did not supply say so, rather than failing when pressed.
  test("ops with an unmet requirement are disabled and explain why", () => {
    const { layer } = opsLayer();
    const { el } = UI.createOperationsPanel(host(), { layer });          // no region, no layers, no fim
    for (const id of ["mask", "combine", "zonalStats", "groupBy", "reduce"]) {
      assert.equal(opEl(el, id).querySelector("button").disabled, true, `${id} should be disabled`);
      assert.ok(opEl(el, id).querySelector(".op-note")?.textContent, `${id} should explain itself`);
    }
    assert.equal(opEl(el, "clip").querySelector("button").disabled, false, "…but the rest are usable");
  });

  test("Combine offers the OTHER raster layers and applies band math", async () => {
    const { layer, ds } = opsLayer();
    const other = opsLayer().layer;
    other.id = "other";
    const { el } = UI.createOperationsPanel(host(), { layer, layers: () => [layer, other] });
    const select = fieldEl(el, "combine", "other");
    assert.deepEqual([...select.options].map((o) => o.value), ["other"], "never itself");
    apply(el, "combine");
    await settle();
    assert.notEqual(layer.sources[0], ds);
    const g = await layer.sources[0].grid();
    assert.deepEqual([...g.pixels], [0, 0, 0, 0, 0, 0, 0, 0, 0], "identical grids differenced to zero");
  });

  test("Reduce is offered only when the dataset actually has an axis", () => {
    const { layer } = opsLayer();
    const withAxis = opsLayer().layer;
    withAxis.sources[0].axes = [{ name: "time", entries: [] }];
    assert.equal(UI.createOperationsPanel(host(), { layer })
      .el.querySelector('[data-op=reduce] button').disabled, true);
    assert.equal(UI.createOperationsPanel(host(), { layer: withAxis })
      .el.querySelector('[data-op=reduce] button').disabled, false);
  });

  test("a terminal reports through onResult and leaves the layer's sources alone", async () => {
    const { layer, ds } = opsLayer();
    let result = null;
    const region = new SpatialFilter([{ lat: 0, lng: 0 }, { lat: 0, lng: 3 }, { lat: 3, lng: 3 }, { lat: 3, lng: 0 }]);
    const { el } = UI.createOperationsPanel(host(), {
      layer, region: () => region, onResult: (id, data) => { result = { id, data }; },
    });
    apply(el, "zonalStats");
    await settle();
    assert.equal(result?.id, "zonalStats");
    assert.ok(Array.isArray(result.data), "zonal stats are a table, not a layer");
    assert.equal(layer.sources[0], ds, "a terminal reads; it must not rewrite the layer");
  });

  test("Rasterize needs a map, because it cannot replace the layer it came from", async () => {
    const { layer } = vectorOpsLayer();
    const noFim = UI.createOperationsPanel(host(), { layer });
    assert.equal(noFim.el.querySelector("[data-op=rasterize] button").disabled, true);
    assert.match(noFim.el.querySelector("[data-op=rasterize] .op-note").textContent, /adds a new layer/);

    const added = [];
    const { el } = UI.createOperationsPanel(host(), { layer, fim: { addLayer: (d) => added.push(d) } });
    apply(el, "rasterize");
    await settle();
    assert.equal(added.length, 1);
    assert.equal(added[0].kind, "raster", "vector in, raster out — a NEW layer, not this one");
    assert.equal(layer.sources[0].kind, "vector", "and the vector layer is untouched");
  });

  test("Reset points the layer back at the ORIGINAL dataset", async () => {
    const { layer, ds } = opsLayer();
    const { el } = UI.createOperationsPanel(host(), { layer });
    setField(el, "reclassify", "min", "5");
    apply(el, "reclassify");
    await settle();
    assert.notEqual(layer.sources[0], ds);

    byText(el, "Reset to original").click();
    await settle();
    assert.equal(layer.sources[0], ds, "back to the pristine source");
  });

  test("a failing op reports through onApply instead of throwing", async () => {
    const { layer } = opsLayer();
    let err = null;
    const { el } = UI.createOperationsPanel(host(), { layer, onApply: (_l, e) => { err = e; } });
    layer.deriveSources = () => { throw new Error("boom"); };
    setField(el, "reclassify", "min", "1");
    apply(el, "reclassify");
    await settle();
    assert.match(err?.message ?? "", /boom/);
  });

  test("pretty injects one stylesheet; destroy() removes the panel", () => {
    const { layer } = opsLayer();
    UI.createOperationsPanel(host(), { layer, pretty: true });
    const p = UI.createOperationsPanel(host(), { layer, pretty: true });
    assert.equal(document.querySelectorAll("#fim-ops-panel-css").length, 1);
    p.destroy();
    assert.equal(host().querySelectorAll("[data-fim-ui=operations-panel]").length, 1);
  });
});

// ── 3 · createRegionDraw ────────────────────────────────────────────────────────────────

describe("ui: createRegionDraw", () => {
  /** A minimal FimMap stand-in exposing only what the tool uses: captureInteraction. */
  function fakeMap() {
    let handler = null;
    return {
      captureInteraction(fn) { handler = fn; return () => { handler = null; }; },
      click(lat, lng) { handler?.({ type: "click", lat, lng }); },
      hover(lat, lng) { handler?.({ type: "hover", lat, lng }); },
      get captured() { return handler !== null; },
    };
  }

  test("starts inactive; start() captures interaction", () => {
    const map = fakeMap();
    const rd = UI.createRegionDraw(map);
    assert.equal(rd.active, false);
    assert.equal(map.captured, false);
    rd.start();
    assert.equal(rd.active, true);
    assert.equal(map.captured, true);
  });

  // The open defect (DECISIONS: "region draw drops its first vertex") is reported against the
  // EXAMPLE PAGE. At this level every click must be recorded, which is what pins where the bug is not.
  test("every click becomes a vertex — including the first", () => {
    const map = fakeMap();
    const seen = [];
    const rd = UI.createRegionDraw(map, { onPoint: (pts) => seen.push(pts.length) });
    rd.start();
    map.click(1, 1); map.click(2, 2); map.click(3, 3); map.click(4, 4);
    assert.deepEqual(seen, [1, 2, 3, 4], "onPoint fires once per click, cumulatively");
    assert.deepEqual(rd.points, [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }, { lat: 4, lng: 4 }]);
  });

  test("hover events are ignored — only clicks add vertices", () => {
    const map = fakeMap();
    const rd = UI.createRegionDraw(map);
    rd.start();
    map.hover(9, 9); map.click(1, 1); map.hover(8, 8);
    assert.deepEqual(rd.points, [{ lat: 1, lng: 1 }]);
  });

  test("points is a COPY — a caller cannot mutate the tool's state", () => {
    const map = fakeMap();
    const rd = UI.createRegionDraw(map);
    rd.start();
    map.click(1, 1);
    rd.points.push({ lat: 99, lng: 99 });
    assert.equal(rd.points.length, 1);
  });

  test("finish() with 3+ points yields a SpatialFilter and releases the capture", () => {
    const map = fakeMap();
    let completed;
    const rd = UI.createRegionDraw(map, { onComplete: (f, p) => { completed = { f, p }; } });
    rd.start();
    map.click(0, 0); map.click(0, 2); map.click(2, 1);
    const filter = rd.finish();
    assert.ok(filter instanceof SpatialFilter);
    assert.equal(completed.f, filter);
    assert.equal(completed.p.length, 3);
    assert.equal(rd.active, false);
    assert.equal(map.captured, false, "the modal capture must be released or the map stays stuck");
  });

  test("finish() with fewer than 3 points yields null, and still releases", () => {
    const map = fakeMap();
    let completed = "unset";
    const rd = UI.createRegionDraw(map, { onComplete: (f) => { completed = f; } });
    rd.start();
    map.click(0, 0); map.click(1, 1);
    assert.equal(rd.finish(), null);
    assert.equal(completed, null, "onComplete still fires, with null");
    assert.equal(map.captured, false);
  });

  test("finish() before start() is null and fires nothing", () => {
    let fired = false;
    const rd = UI.createRegionDraw(fakeMap(), { onComplete: () => { fired = true; } });
    assert.equal(rd.finish(), null);
    assert.equal(fired, false);
  });

  test("cancel() discards the points, releases, and fires onCancel", () => {
    const map = fakeMap();
    let cancelled = false;
    const rd = UI.createRegionDraw(map, { onCancel: () => { cancelled = true; } });
    rd.start();
    map.click(1, 1); map.click(2, 2);
    rd.cancel();
    assert.equal(cancelled, true);
    assert.deepEqual(rd.points, []);
    assert.equal(rd.active, false);
    assert.equal(map.captured, false);
  });

  test("cancel() before start() is a no-op", () => {
    let cancelled = false;
    UI.createRegionDraw(fakeMap(), { onCancel: () => { cancelled = true; } }).cancel();
    assert.equal(cancelled, false);
  });

  test("start() twice does not re-capture or clear points mid-draw", () => {
    const map = fakeMap();
    const rd = UI.createRegionDraw(map);
    rd.start();
    map.click(1, 1);
    rd.start();
    assert.deepEqual(rd.points, [{ lat: 1, lng: 1 }], "a second start() must not wipe the ring");
  });

  test("a fresh start() after finish() begins an empty ring", () => {
    const map = fakeMap();
    const rd = UI.createRegionDraw(map);
    rd.start(); map.click(0, 0); map.click(0, 2); map.click(2, 1); rd.finish();
    rd.start();
    assert.deepEqual(rd.points, []);
  });

  test("the produced filter actually contains points inside the ring", () => {
    const map = fakeMap();
    const rd = UI.createRegionDraw(map);
    rd.start();
    map.click(0, 0); map.click(0, 10); map.click(10, 10); map.click(10, 0);
    const f = rd.finish();
    assert.equal(f.contains(5, 5), true);
    assert.equal(f.contains(50, 50), false);
  });
});

// ── 4 · read-models, toast, tooltip, info window ────────────────────────────────────────

describe("ui: renderLegend / renderStats", () => {
  test("renderLegend returns JSON by default and HTML on request", () => {
    const legend = Legend.fromColorScale(new ColorScale({ palette: "viridis", min: 0, max: 10 }));
    const json = UI.renderLegend(legend);
    assert.equal(typeof json, "object");
    assert.ok(Array.isArray(json.stops));
    const html = UI.renderLegend(legend, { html: true });
    assert.ok(html.length > 0 && html.includes("<"), "markup came back");
    // renderLegend delegates to Legend#toHtml when the object has one — a host's own Legend-shaped
    // object without that method takes the built-in fallback instead. Both must produce swatches.
    const fallback = UI.renderLegend({ stops: [{ color: "#ff0000", label: "hot" }] }, { html: true });
    assert.match(fallback, /class="fim-legend"/);
    assert.ok(fallback.includes("#ff0000") && fallback.includes("hot"));
  });

  test("renderLegend degrades on null — empty string for html, null otherwise", () => {
    assert.equal(UI.renderLegend(null), null);
    assert.equal(UI.renderLegend(null, { html: true }), "");
  });

  test("renderStats returns JSON by default and an HTML table on request", () => {
    const stats = Stats.raster(Float64Array.from([1, 2, 3, 4]),
      { bw: 0, bs: 0, be: 2, bn: 2, width: 2, height: 2, unit: "m" });
    const json = UI.renderStats(stats);
    assert.equal(json.count, 4);
    const html = UI.renderStats(stats, { html: true });
    assert.match(html, /<table class="fim-stats"/);
    assert.ok(html.includes("count"), "scalar fields become rows");
  });

  test("renderStats degrades on null", () => {
    assert.equal(UI.renderStats(null), null);
    assert.equal(UI.renderStats(null, { html: true }), "");
  });

  test("HTML output escapes its input — these build markup from data", () => {
    const html = UI.renderLegend({ stops: [{ color: "\"><script>x</script>", label: "<b>hi</b>" }] },
      { html: true });
    assert.ok(!html.includes("<script>"), "a colour string must not be able to inject markup");
    assert.ok(!html.includes("<b>hi</b>"), "nor a label");
  });
});

// ── the LIVE half: bindLegend / bindStats ───────────────────────────────────────────────
//
// The point of these is that a host never has to remember to re-read after a change. So what is
// asserted is that a change made ANYWHERE — layer.set(), another panel, a preset — reaches the DOM
// without anyone calling update().
describe("ui: bindLegend / bindStats", () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));

  /** A raster layer with real pixels, so getStats() has something to count. */
  function statsLayer() {
    const l = rasterLayer();
    l.rasterData = Float64Array.from([1, 2, 3, 4]);
    l.meta = { bw: 0, bs: 0, be: 2, bn: 2, width: 2, height: 2, unit: "m" };
    return l;
  }

  test("bindLegend mounts, paints, and repaints when the scale changes", async () => {
    const layer = rasterLayer();
    const b = UI.bindLegend(layer, { root: host() });
    await tick();
    assert.equal(b.el.getAttribute("data-fim-ui"), "legend");
    assert.ok(b.el.innerHTML.length > 0, "painted on mount, without an explicit update()");

    const before = b.el.innerHTML;
    layer.set({ palette: "plasma" });
    await tick();
    assert.notEqual(b.el.innerHTML, before, "a restyle anywhere reaches the panel");
  });

  test("bindStats reads the layer's statistics and follows a recompute", async () => {
    const layer = statsLayer();
    const b = UI.bindStats(layer, { root: host() });
    await tick();
    assert.match(b.el.innerHTML, /count/);
    assert.ok(b.el.innerHTML.includes("4"), "four pixels");

    layer.rasterData = Float64Array.from([1, 2]);
    layer.meta = { ...layer.meta, width: 2, height: 1 };
    layer.emit("recomputed", {});
    await tick();
    assert.ok(b.el.innerHTML.includes("2"), "the panel re-read after the pixels changed");
  });

  test("a filter getter is re-read on update() — a drawn region the layer knows nothing about", async () => {
    const layer = statsLayer();
    let region = null;
    const b = UI.bindStats(layer, { root: host(), filter: () => region });
    await tick();
    const all = b.el.innerHTML;

    region = new SpatialFilter([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }, { lat: 1, lng: 0 }]);
    b.update();
    await tick();
    assert.notEqual(b.el.innerHTML, all, "the scoped count differs from the total");
  });

  // One logical change can emit two of the subscribed events; the panel must not read twice.
  test("several events in one tick coalesce into ONE read", async () => {
    const layer = statsLayer();
    let reads = 0;
    const real = layer.getStats.bind(layer);
    layer.getStats = (o) => { reads++; return real(o); };
    const b = UI.bindStats(layer, { root: host() });
    await tick();
    assert.equal(reads, 1, "the mount paint");

    layer.emit("restyle", {}); layer.emit("recomputed", {}); layer.emit("rendered", {});
    await tick();
    assert.equal(reads, 2, "three events, one re-read");
    b.off();
  });

  // getStats is async: a fast sequence can resolve out of order, and painting a stale result over a
  // newer one is worse than lagging — the panel would be simply wrong, with nothing to trigger a fix.
  test("a slow read that resolves late is DROPPED, not painted over a newer one", async () => {
    const layer = statsLayer();
    const delays = [40, 0];
    layer.getStats = () => new Promise((res) => {
      const d = delays.shift() ?? 0;
      const value = d ? { toJSON: () => ({ count: 111 }) } : { toJSON: () => ({ count: 222 }) };
      setTimeout(() => res(value), d);
    });
    const b = UI.bindStats(layer, { root: host() });
    await tick();
    layer.emit("restyle", {});              // the second, fast read overtakes the first
    await new Promise((r) => setTimeout(r, 80));
    assert.ok(b.el.innerHTML.includes("222"), "the newer result won");
    assert.ok(!b.el.innerHTML.includes("111"), "and the stale one never landed");
  });

  test("empty text stands in for a layer with nothing to show", async () => {
    const layer = new RasterLayer({ id: "bare" });      // no colour scale, no pixels
    const b = UI.bindLegend(layer, { root: host(), empty: "no colour scale" });
    await tick();
    assert.equal(b.el.textContent, "no colour scale");
  });

  test("off() unsubscribes; destroy() also takes the element away", async () => {
    const layer = rasterLayer();
    const b = UI.bindLegend(layer, { root: host() });
    await tick();
    const painted = b.el.innerHTML;
    b.off();
    layer.set({ palette: "plasma" });
    await tick();
    assert.equal(b.el.innerHTML, painted, "a released binding must stop repainting");

    const c = UI.bindStats(statsLayer(), { root: host() });
    await tick();
    c.destroy();
    assert.equal(host().querySelectorAll("[data-fim-ui=stats]").length, 0);
  });

  test("a removed layer clears its panel and releases the subscription", async () => {
    const layer = rasterLayer();
    const b = UI.bindLegend(layer, { root: host(), empty: "—" });
    await tick();
    assert.ok(b.el.innerHTML.length > 1);
    layer.emit("removed", {});
    await tick();
    assert.equal(b.el.textContent, "—", "a stale legend for a layer that is gone is worse than none");
  });

  test("a read that throws is reported, not left half-painted", async () => {
    const layer = statsLayer();
    layer.getStats = () => { throw new Error("boom"); };
    const b = UI.bindLegend(layer, { root: host() });   // legend still fine
    const s = UI.bindStats(layer, { root: host(), empty: "—" });
    await tick();
    assert.equal(s.el.textContent, "—");
    assert.ok(b.el.innerHTML.length > 0, "one panel failing must not take the other down");
  });

  test("a custom render function replaces the built-in", async () => {
    const layer = rasterLayer();
    const b = UI.bindLegend(layer, { root: host(), render: (l) => `<b>${l ? "yes" : "no"}</b>` });
    await tick();
    assert.equal(b.el.innerHTML, "<b>yes</b>");
  });

  test("without a root the element is detached, for a host that places it itself", async () => {
    const b = UI.bindLegend(rasterLayer());
    await tick();
    assert.equal(b.el.parentElement, null);
    assert.ok(b.el.innerHTML.length > 0);
  });

  test("no layer is a clear error, not a silent empty panel", () => {
    assert.throws(() => UI.bindLegend(null), /a layer is required/);
    assert.throws(() => UI.bindStats(undefined), /a layer is required/);
  });
});

describe("ui: createToast", () => {
  test("mounts a container into the given root and shows a message", () => {
    const toast = UI.createToast(host());
    assert.equal(toast.el.getAttribute("data-fim-ui"), "toast");
    assert.equal(toast.el.parentElement, host());
    const t = toast.show("hello");
    assert.equal(t.textContent, "hello");
    assert.ok(host().textContent.includes("hello"));
  });

  test("defaults to document.body when no root is given", () => {
    const toast = UI.createToast();
    assert.equal(toast.el.parentElement, document.body);
    toast.destroy();
  });

  test("every level renders and is distinguishable by class", () => {
    const toast = UI.createToast(host());
    for (const level of ["info", "success", "warn", "error"]) {
      const t = toast.show(`msg-${level}`, { level, timeout: 0 });
      assert.equal(t.className, `fim-toast fim-toast-${level}`);
      assert.ok(t.style.background, `${level} got a colour`);
    }
    assert.equal(toast.el.children.length, 4, "timeout:0 means they persist");
  });

  test("all four corners position the container", () => {
    for (const [corner, side] of [["br", "bottom"], ["bl", "bottom"], ["tr", "top"], ["tl", "top"]]) {
      const t = UI.createToast(host(), { corner });
      assert.equal(t.el.style[side], "16px", `${corner} anchored to ${side}`);
      assert.equal(t.el.style[corner[1] === "l" ? "left" : "right"], "16px");
      t.destroy();
    }
  });

  test("clear() empties the container; destroy() removes it", () => {
    const toast = UI.createToast(host());
    toast.show("a", { timeout: 0 }); toast.show("b", { timeout: 0 });
    assert.equal(toast.el.children.length, 2);
    toast.clear();
    assert.equal(toast.el.children.length, 0);
    toast.destroy();
    assert.equal(host().querySelector("[data-fim-ui=toast]"), null);
  });

  test("connectToast maps notify levels onto toast levels", () => {
    const toast = UI.createToast(host());
    const fim = fakeFim(host());
    assert.equal(UI.connectToast(fim, toast), toast, "it returns the toast it was given");
    for (const [notifyLevel, expected] of
      [["info", "info"], ["warn", "warn"], ["error", "error"], ["success", "success"], ["weird", "info"]]) {
      fim.emit("notify", { message: `m-${notifyLevel}`, level: notifyLevel });
      assert.equal(toast.el.lastElementChild.className, `fim-toast fim-toast-${expected}`);
    }
  });

  test("connectToast ignores a notify with no message", () => {
    const toast = UI.createToast(host());
    const fim = fakeFim(host());
    UI.connectToast(fim, toast);
    fim.emit("notify", {});
    fim.emit("notify", undefined);
    assert.equal(toast.el.children.length, 0);
  });

  // Both describe something visibly wrong with what was just drawn, and both previously reached only
  // console.warn — where nobody looking at the map would find them.
  test("connectToast surfaces the two layer warnings, naming the dataset", () => {
    const toast = UI.createToast(host());
    const fim = fakeFim(host());
    UI.connectToast(fim, toast);

    fim.emit("layer:raster-oversized", { datasetName: "big.tif", plan: { reason: "34000 x 17000 px" } });
    let t = toast.el.lastElementChild;
    assert.equal(t.className, "fim-toast fim-toast-warn");
    assert.match(t.textContent, /big\.tif/);
    assert.match(t.textContent, /downsampled/);
    assert.match(t.textContent, /34000 x 17000 px/, "the engine's own reason is carried through");

    fim.emit("layer:crs-unrenderable", { datasetName: "utm.tif", crs: "EPSG:26917", provider: "leaflet" });
    t = toast.el.lastElementChild;
    assert.equal(t.className, "fim-toast fim-toast-warn");
    assert.match(t.textContent, /EPSG:26917/);
    assert.match(t.textContent, /reproject/i, "a warning that does not say what to do is noise");
  });

  test("a warning with a sparse payload still reads as a sentence", () => {
    const toast = UI.createToast(host());
    const fim = fakeFim(host());
    UI.connectToast(fim, toast);
    fim.emit("layer:crs-unrenderable", {});
    assert.match(toast.el.lastElementChild.textContent, /^This layer is in a CRS/);
  });

  test("warnings:false keeps connectToast to notify alone", () => {
    const toast = UI.createToast(host());
    const fim = fakeFim(host());
    UI.connectToast(fim, toast, { warnings: false });
    fim.emit("layer:raster-oversized", { datasetName: "big.tif" });
    assert.equal(toast.el.children.length, 0);
    fim.emit("notify", { message: "still on" });
    assert.equal(toast.el.children.length, 1);
  });

  test("off() releases every subscription connectToast made", () => {
    const toast = UI.createToast(host());
    const fim = fakeFim(host());
    UI.connectToast(fim, toast);
    assert.equal(fim.count("notify"), 1);
    toast.off();
    assert.equal(fim.count("notify"), 0);
    fim.emit("notify", { message: "gone" });
    fim.emit("layer:raster-oversized", { datasetName: "x" });
    assert.equal(toast.el.children.length, 0);
  });
});

// ── the rest of the engine→host bus ─────────────────────────────────────────────────────

describe("ui: createBusyIndicator", () => {
  test("hidden until work starts, shown while it runs, hidden when it ends", () => {
    const fim = fakeFim(host());
    const b = UI.createBusyIndicator(fim, { root: host() });
    assert.equal(b.el.getAttribute("data-fim-ui"), "busy");
    assert.equal(b.active, false);
    assert.equal(b.el.hasAttribute("data-active"), false);

    fim.emit("busy", { active: true, source: "depth" });
    assert.equal(b.active, true);
    assert.ok(b.el.hasAttribute("data-active"));
    assert.equal(b.el.getAttribute("data-sources"), "depth");

    fim.emit("busy", { active: false, source: "depth" });
    assert.equal(b.active, false);
    assert.equal(b.el.hasAttribute("data-active"), false);
  });

  // The event carries a `source` precisely because work overlaps. A single boolean would let the
  // first job to finish hide an indicator two others still need.
  test("overlapping work is ref-counted per source", () => {
    const fim = fakeFim(host());
    const b = UI.createBusyIndicator(fim, { root: host() });
    fim.emit("busy", { active: true, source: "depth" });
    fim.emit("busy", { active: true, source: "ensemble" });
    assert.deepEqual(b.sources, ["depth", "ensemble"]);

    fim.emit("busy", { active: false, source: "depth" });
    assert.equal(b.active, true, "ensemble is still working");
    assert.deepEqual(b.sources, ["ensemble"]);

    fim.emit("busy", { active: false, source: "ensemble" });
    assert.equal(b.active, false);
  });

  test("the same source starting twice needs two finishes", () => {
    const fim = fakeFim(host());
    const b = UI.createBusyIndicator(fim, { root: host() });
    fim.emit("busy", { active: true, source: "parse" });
    fim.emit("busy", { active: true, source: "parse" });
    fim.emit("busy", { active: false, source: "parse" });
    assert.equal(b.active, true, "one of the two parses is still going");
    fim.emit("busy", { active: false, source: "parse" });
    assert.equal(b.active, false);
  });

  test("a stray finish from a source that never started is ignored", () => {
    const fim = fakeFim(host());
    const b = UI.createBusyIndicator(fim, { root: host() });
    fim.emit("busy", { active: true, source: "depth" });
    fim.emit("busy", { active: false, source: "who?" });
    assert.equal(b.active, true, "one stray event must not clear real work");
  });

  test("a payload with no source falls back to 'default'", () => {
    const fim = fakeFim(host());
    const b = UI.createBusyIndicator(fim, { root: host() });
    fim.emit("busy", { active: true });
    assert.deepEqual(b.sources, ["default"]);
  });

  test("the label may be a function of what is running", () => {
    const fim = fakeFim(host());
    const b = UI.createBusyIndicator(fim, { root: host(), label: (s) => `${s.length} job(s)` });
    fim.emit("busy", { active: true, source: "a" });
    fim.emit("busy", { active: true, source: "b" });
    assert.match(b.el.textContent, /2 job\(s\)/);
  });

  test("off() unsubscribes; destroy() also removes the element", () => {
    const fim = fakeFim(host());
    const b = UI.createBusyIndicator(fim, { root: host() });
    b.off();
    fim.emit("busy", { active: true, source: "x" });
    assert.equal(b.active, false);

    const c = UI.createBusyIndicator(fim, { root: host() });
    c.destroy();
    assert.equal(host().querySelectorAll("[data-fim-ui=busy]").length, 1);
  });

  test("no fim is a clear error", () => {
    assert.throws(() => UI.createBusyIndicator(null), /is required/);
  });
});

describe("ui: bindRasterMetadata", () => {
  const payload = {
    title: "flood.tif", name: "flood",
    rows: [["Dimensions", "10 × 10 px"], ["CRS", "EPSG:4326 (WGS84)"]],
    specRows: [{ k: "File", v: "flood" }, { k: "Dimensions", v: "10 × 10 px", num: true }],
  };

  test("hidden until the engine emits, then renders the payload", () => {
    const fim = fakeFim(host());
    const m = UI.bindRasterMetadata(fim, { root: host() });
    assert.equal(m.el.getAttribute("data-fim-ui"), "raster-metadata");
    assert.equal(m.shown, false);

    fim.emit("raster:metadata", payload);
    assert.equal(m.shown, true);
    assert.match(m.el.innerHTML, /Dimensions/);
    assert.match(m.el.innerHTML, /10 × 10 px/);
    assert.match(m.el.innerHTML, /<h4>flood<\/h4>/);
    assert.equal(m.payload, payload);
  });

  // The engine says "no longer current", not "clear" — so a host can still read the last values.
  test("the hidden event hides the panel but keeps what it had", () => {
    const fim = fakeFim(host());
    const m = UI.bindRasterMetadata(fim, { root: host() });
    fim.emit("raster:metadata", payload);
    fim.emit("raster:metadata-hidden", {});
    assert.equal(m.shown, false);
    assert.equal(m.payload, payload, "hidden is not forgotten");
  });

  test("specRows drive the numeric column when present, rows otherwise", () => {
    assert.match(UI.renderRasterMetadata(payload), /class="num"/);
    const flatOnly = UI.renderRasterMetadata({ rows: [["A", "1"]] });
    assert.match(flatOnly, /<td class="k">A<\/td>/);
    assert.ok(!flatOnly.includes('class="num"'), "the flat form carries no numeric flag");
  });

  test("the renderer escapes its input — this builds markup from file metadata", () => {
    const html = UI.renderRasterMetadata({ name: "<script>x</script>", rows: [["<b>k</b>", "&v"]] });
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<b>k</b>"));
    assert.match(html, /&amp;v/);
  });

  test("a custom render replaces the default", () => {
    const fim = fakeFim(host());
    const m = UI.bindRasterMetadata(fim, { root: host(), render: (p) => `<i>${p.name}</i>` });
    fim.emit("raster:metadata", payload);
    assert.equal(m.el.innerHTML, "<i>flood</i>");
  });

  test("renderRasterMetadata on nothing is an empty string, not a crash", () => {
    assert.equal(UI.renderRasterMetadata(null), "");
    assert.equal(UI.renderRasterMetadata({}), "<table></table>");
  });

  test("off() unsubscribes both events; destroy() removes the element", () => {
    const fim = fakeFim(host());
    const m = UI.bindRasterMetadata(fim, { root: host() });
    assert.equal(fim.count("raster:metadata"), 1);
    assert.equal(fim.count("raster:metadata-hidden"), 1);
    m.destroy();
    assert.equal(fim.count("raster:metadata"), 0);
    assert.equal(fim.count("raster:metadata-hidden"), 0);
    assert.equal(host().querySelectorAll("[data-fim-ui=raster-metadata]").length, 0);
  });
});

describe("ui: createTooltip / bindHoverValue", () => {
  const evt = (x, y) => ({ originalEvent: { clientX: x, clientY: y } });

  test("show/hide toggle display, and the tooltip follows the pointer", () => {
    const tip = UI.createTooltip({ root: host() });
    assert.equal(tip.el.getAttribute("data-fim-ui"), "tooltip");
    assert.equal(tip.el.style.display, "none", "hidden until shown");
    tip.show(evt(100, 200), "<b>42</b>");
    assert.equal(tip.el.style.display, "block");
    assert.equal(tip.el.innerHTML, "<b>42</b>");
    assert.equal(tip.el.style.left, "112px", "offset 12px from the pointer");
    assert.equal(tip.el.style.top, "212px");
    tip.hide();
    assert.equal(tip.el.style.display, "none");
  });

  test("a style override is merged over the defaults", () => {
    const tip = UI.createTooltip({ root: host() }, { style: { background: "rgb(255, 0, 0)" } });
    assert.equal(tip.el.style.background, "rgb(255, 0, 0)");
    assert.equal(tip.el.style.position, "fixed", "the defaults still apply");
  });

  test("bindHoverValue returns { tooltip, off } and shows the layer's value", () => {
    const fim = fakeFim(host());
    const layer = rasterLayer();
    layer._map = fim;
    layer.valueAt = (lat) => (lat > 0 ? 7.5 : null);

    const tip = UI.createTooltip({ root: host() });
    const h = UI.bindHoverValue(layer, { tooltip: tip });
    assert.equal(h.tooltip, tip);
    assert.equal(typeof h.off, "function");

    fim.emit("map:hover", { lat: 1, lng: 1, ...evt(10, 10) });
    assert.equal(tip.el.style.display, "block");
    assert.equal(tip.el.innerHTML, "7.500", "the default format is 3 decimal places");

    fim.emit("map:hover", { lat: -1, lng: 1, ...evt(10, 10) });
    assert.equal(tip.el.style.display, "none", "off the footprint → hidden");

    h.off();
    assert.equal(fim.count("map:hover"), 0, "off() really unsubscribes");
  });

  test("a custom format receives the raw value", () => {
    const fim = fakeFim(host());
    const layer = rasterLayer();
    layer._map = fim;
    layer.valueAt = () => 3;
    const seen = [];
    const { tooltip } = UI.bindHoverValue(layer,
      { tooltip: UI.createTooltip({ root: host() }), format: (v) => { seen.push(v); return `V=${v}`; } });
    fim.emit("map:hover", { lat: 1, lng: 1, ...evt(1, 1) });
    assert.deepEqual(seen, [3]);
    assert.equal(tooltip.el.innerHTML, "V=3");
  });

  test("the layer's own hover setting suppresses the tooltip", () => {
    const fim = fakeFim(host());
    const layer = rasterLayer();
    layer._map = fim;
    layer.valueAt = () => 5;
    layer.settings.set({ hover: false });
    const { tooltip } = UI.bindHoverValue(layer, { tooltip: UI.createTooltip({ root: host() }) });
    fim.emit("map:hover", { lat: 1, lng: 1, ...evt(1, 1) });
    assert.equal(tooltip.el.style.display, "none");
  });
});

describe("ui: createInfoWindow / propsTable / bindFeatureInfo", () => {
  const evt = (x, y) => ({ originalEvent: { clientX: x, clientY: y } });

  test("propsTable turns properties into an escaped HTML table", () => {
    const html = UI.propsTable({ name: "Cedar", depth: 3.5 });
    assert.match(html, /<table|<tr/);
    assert.ok(html.includes("Cedar") && html.includes("3.5"));
    assert.ok(!UI.propsTable({ x: "<script>bad</script>" }).includes("<script>"),
      "a feature property must not be able to inject markup");
  });

  test("propsTable handles empty and missing input", () => {
    assert.equal(typeof UI.propsTable({}), "string");
    assert.equal(typeof UI.propsTable(), "string");
  });

  test("open() accepts an HTML string or a Node, and positions at the pointer", () => {
    const iw = UI.createInfoWindow({ root: host() });
    assert.equal(iw.el.getAttribute("data-fim-ui"), "infowindow");
    assert.equal(iw.el.style.display, "none");

    iw.open(evt(50, 60), "<b>hi</b>");
    assert.equal(iw.el.style.display, "block");
    assert.ok(iw.el.innerHTML.includes("<b>hi</b>"));
    assert.equal(iw.el.style.left, "58px");
    assert.equal(iw.el.style.top, "68px");

    const node = document.createElement("span");
    node.textContent = "node-content";
    iw.open(evt(1, 1), node);
    assert.ok(iw.el.textContent.includes("node-content"));

    iw.close();
    assert.equal(iw.el.style.display, "none");
  });

  test("the close button dismisses it — the only affordance a user has", () => {
    const iw = UI.createInfoWindow({ root: host() });
    iw.open(evt(1, 1), "x");
    const btn = iw.el.querySelector("button[aria-label=Close]");
    assert.ok(btn, "there is a labelled close control");
    btn.click();
    assert.equal(iw.el.style.display, "none");
  });

  test("bindFeatureInfo opens on a hit feature and closes on a miss", () => {
    const layer = new VectorLayer({ id: "v" });
    layer.featureAt = (lat) => (lat > 0 ? { properties: { name: "Iowa" } } : null);
    const iw = UI.createInfoWindow({ root: host() });
    const h = UI.bindFeatureInfo(layer, { infoWindow: iw });
    assert.equal(h.infoWindow, iw);

    layer.emit("click", { lat: 1, lng: 1, ...evt(5, 5) });
    assert.equal(iw.el.style.display, "block");
    assert.ok(iw.el.textContent.includes("Iowa"), "the default render is propsTable");

    layer.emit("click", { lat: -1, lng: 1, ...evt(5, 5) });
    assert.equal(iw.el.style.display, "none");

    h.off();
    layer.emit("click", { lat: 1, lng: 1, ...evt(5, 5) });
    assert.equal(iw.el.style.display, "none", "off() really unsubscribes");
  });

  test("a custom render replaces propsTable", () => {
    const layer = new VectorLayer({ id: "v" });
    layer.featureAt = () => ({ properties: { name: "Iowa" } });
    const iw = UI.createInfoWindow({ root: host() });
    UI.bindFeatureInfo(layer, { infoWindow: iw, render: (f) => `<em>${f.properties.name}!</em>` });
    layer.emit("click", { lat: 1, lng: 1, ...evt(5, 5) });
    assert.ok(iw.el.innerHTML.includes("<em>Iowa!</em>"));
  });
});

// The handle members that are easy to leave untested because nothing else exercises them: the
// destroy()s and the passthrough properties. examples/ui-tools.html tracks the same list.
describe("ui: every handle member", () => {
  test("createTooltip and createInfoWindow both destroy()", () => {
    const tip = UI.createTooltip({ root: host() });
    const iw = UI.createInfoWindow({ root: host() });
    assert.ok(tip.el.parentElement && iw.el.parentElement);
    tip.destroy(); iw.destroy();
    assert.equal(tip.el.parentElement, null);
    assert.equal(iw.el.parentElement, null);
  });

  test("connectToast with no toast makes one on document.body", () => {
    const fim = fakeFim(host());
    const made = UI.connectToast(fim);
    assert.equal(made.el.getAttribute("data-fim-ui"), "toast");
    assert.equal(made.el.parentElement, document.body);
    fim.emit("notify", { message: "auto", level: "info" });
    assert.ok(made.el.textContent.includes("auto"));
    made.destroy();
  });

  test("bindHoverValue with no tooltip makes its own and returns it", () => {
    const fim = fakeFim(host());
    const layer = rasterLayer();
    layer._map = fim;
    layer.valueAt = () => 1;
    const h = UI.bindHoverValue(layer);
    assert.equal(h.tooltip.el.getAttribute("data-fim-ui"), "tooltip");
    h.off();
  });

  test("bindFeatureInfo with no infoWindow makes its own and returns it", () => {
    const layer = new VectorLayer({ id: "v" });
    layer._map = fakeFim(host());
    layer.featureAt = () => null;
    const h = UI.bindFeatureInfo(layer);
    assert.equal(h.infoWindow.el.getAttribute("data-fim-ui"), "infowindow");
    h.off();
  });

  test("every factory's handle exposes exactly the members the docs promise", () => {
    const layer = rasterLayer();
    const shapes = {
      toast: [UI.createToast(host()), ["show", "clear", "destroy", "el"]],
      tooltip: [UI.createTooltip({ root: host() }), ["show", "hide", "destroy", "el"]],
      infoWindow: [UI.createInfoWindow({ root: host() }), ["open", "close", "destroy", "el"]],
      toolsPanel: [UI.createToolsPanel(host(), { layer }), ["el", "update", "destroy"]],
      regionDraw: [UI.createRegionDraw({ captureInteraction: () => () => {} }),
        ["start", "finish", "cancel", "undo", "setMode", "mode", "points", "rings", "active"]],
    };
    for (const [name, [handle, members]] of Object.entries(shapes)) {
      for (const m of members) {
        assert.ok(m in handle, `${name} handle is missing ${m}`);
      }
    }
  });
});

describe("ui: the barrel", () => {
  test("exports exactly the documented names", () => {
    assert.deepEqual(Object.keys(UI).sort(), [
      "DROP_EXTENSIONS", "REGION_MODES", "axisEntryLabel", "axisOf", "bindFeatureInfo",
      "bindHoverValue", "bindLegend", "bindRasterMetadata", "bindStats", "connectToast",
      "createAxisSlider", "createBusyIndicator", "createDropzone", "createInfoWindow",
      "createLayerPanel", "createLayerSelect", "createOperationsPanel", "createRegionDraw",
      "createRegionOverlay", "createToast", "createToolsPanel", "createTooltip", "layerLabel",
      "propsTable", "rasterControls", "regionGeoJSON", "renderLegend", "renderRasterMetadata",
      "renderStats", "vectorControls",
    ]);
  });
});
