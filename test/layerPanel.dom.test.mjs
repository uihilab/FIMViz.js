// ui/layerPanel.js — createLayerPanel + createLayerSelect, black box.
//
// The interesting behaviour here is ORDER: the panel shows layers top-first while `fim.layers` is
// bottom-first, and reordering has to move the array AND push it to the map. Getting that backwards
// looks fine in a screenshot and is wrong in every interaction, so it is pinned explicitly.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom, UI;

beforeEach(async () => {
  dom = new JSDOM("<!doctype html><body><div id='host'></div></body>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.navigator ??= dom.window.navigator;
  UI = await import("../src/ui/index.js");
});
afterEach(() => { delete globalThis.window; delete globalThis.document; dom.window.close(); });

const host = () => document.getElementById("host");

/** A layer stand-in exposing exactly what the panel and the selector use. */
function fakeLayer(id, { type = "raster", visible = true, hits = () => false, name = null } = {}) {
  return {
    id, type, visible, _name: name,
    fits: 0,
    hitTest(lat, lng) { return hits(lat, lng); },
    fit() { this.fits++; },
    hide() { this.visible = false; },
    show() { this.visible = true; },
  };
}

/** A FimMap stand-in: a real array, a real event bus, and a recorder for applyLayerOrder. */
function fakeFim(layers = []) {
  const subs = new Map();
  return {
    layers,
    orderPushes: 0,
    on(evt, fn) { (subs.get(evt) ?? subs.set(evt, new Set()).get(evt)).add(fn); return this; },
    off(evt, fn) { subs.get(evt)?.delete(fn); return this; },
    emit(evt, p) { for (const fn of [...(subs.get(evt) || [])]) fn(p); return this; },
    listeners(evt) { return subs.get(evt)?.size ?? 0; },
    applyLayerOrder() { this.orderPushes++; return this; },
    removeLayer(l) {
      const i = this.layers.indexOf(l);
      if (i >= 0) { this.layers.splice(i, 1); this.emit("layers:changed", { reason: "removed", layer: l }); }
    },
  };
}

const rows = (el) => [...el.querySelectorAll(".lyr")];
// Rows are identified by layer id, not by their visible label: `layerLabel` deliberately prefers a
// filename or type over a generated id, so the label is a separate concern tested on its own.
const ids = (el) => rows(el).map((r) => r.getAttribute("data-layer-id"));
const names = (el) => rows(el).map((r) => r.querySelector(".nm").textContent);
const rowBtn = (el, i, title) => [...rows(el)[i].querySelectorAll("button")].find((b) => b.title === title);

describe("createLayerPanel: listing", () => {
  test("requires a fim and a real target", () => {
    assert.throws(() => UI.createLayerPanel(host(), {}), /\{ fim \} is required/);
    assert.throws(() => UI.createLayerPanel("#nope", { fim: fakeFim() }), /not found/);
  });

  test("lists TOP-FIRST — the reverse of fim.layers, which is bottom-up", () => {
    const fim = fakeFim([fakeLayer("bottom"), fakeLayer("middle"), fakeLayer("top")]);
    const { el } = UI.createLayerPanel(host(), { fim });
    assert.deepEqual(ids(el), ["top", "middle", "bottom"]);
  });

  test("an empty map says so rather than rendering nothing", () => {
    const { el } = UI.createLayerPanel(host(), { fim: fakeFim([]) });
    assert.match(el.textContent, /No layers/);
  });

  test("hidden layers stay listed and are marked — that is the point of the list", () => {
    const fim = fakeFim([fakeLayer("a", { visible: false }), fakeLayer("b")]);
    const { el } = UI.createLayerPanel(host(), { fim });
    assert.deepEqual(ids(el), ["b", "a"]);
    assert.ok(rows(el)[1].className.includes("off"), "the hidden one is flagged");
    assert.equal(rowBtn(el, 1, "Show").textContent, "○");
  });

  test("the label prefers a registered filename over the type", () => {
    const fim = fakeFim([fakeLayer("x", { name: "flood.tif" })]);
    assert.deepEqual(names(UI.createLayerPanel(host(), { fim }).el), ["flood.tif"]);
    assert.equal(UI.layerLabel({ id: "i" }), "i");
    assert.equal(UI.layerLabel({ id: "i", type: "raster" }), "raster");
  });

  test("it redraws when the map announces a change", () => {
    const fim = fakeFim([fakeLayer("a")]);
    const { el } = UI.createLayerPanel(host(), { fim });
    fim.layers.push(fakeLayer("b"));
    assert.deepEqual(ids(el), ["a"], "not yet — nothing announced it");
    fim.emit("layers:changed", { reason: "added" });
    assert.deepEqual(ids(el), ["b", "a"]);
  });
});

describe("createLayerPanel: the row controls", () => {
  test("show/hide toggles the layer and the row", () => {
    const l = fakeLayer("a");
    const { el } = UI.createLayerPanel(host(), { fim: fakeFim([l]) });
    rowBtn(el, 0, "Hide").click();
    assert.equal(l.visible, false);
    assert.ok(rows(el)[0].className.includes("off"));
    rowBtn(el, 0, "Show").click();
    assert.equal(l.visible, true);
  });

  test("fit calls the layer's own fit()", () => {
    const l = fakeLayer("a");
    const { el } = UI.createLayerPanel(host(), { fim: fakeFim([l]) });
    rowBtn(el, 0, "Fit map to this layer").click();
    assert.equal(l.fits, 1);
  });

  test("remove drops it from the map and clears the selection if it was selected", () => {
    const a = fakeLayer("a"), b = fakeLayer("b");
    const fim = fakeFim([a, b]);
    let selected = "unset";
    const panel = UI.createLayerPanel(host(), { fim, selected: b, onSelect: (l) => { selected = l; } });
    rowBtn(panel.el, 0, "Remove").click();          // row 0 is `b` (top-first)
    assert.deepEqual(fim.layers, [a]);
    assert.equal(selected, null, "the removed layer cannot stay selected");
  });

  test("clicking the name selects, and the row shows it", () => {
    const a = fakeLayer("a"), b = fakeLayer("b");
    const seen = [];
    const panel = UI.createLayerPanel(host(), { fim: fakeFim([a, b]), onSelect: (l) => seen.push(l?.id) });
    rows(panel.el)[1].querySelector(".nm").click();  // bottom row = `a`
    assert.deepEqual(seen, ["a"]);
    assert.equal(panel.selected, a);
    assert.ok(rows(panel.el)[1].className.includes("sel"));
  });
});

describe("createLayerPanel: reordering", () => {
  test("bring forward moves it UP the panel and LATER in fim.layers", () => {
    const a = fakeLayer("a"), b = fakeLayer("b"), c = fakeLayer("c");
    const fim = fakeFim([a, b, c]);                  // bottom -> top
    const { el } = UI.createLayerPanel(host(), { fim });
    assert.deepEqual(ids(el), ["c", "b", "a"]);
    rowBtn(el, 1, "Bring forward").click();          // `b`
    assert.deepEqual(fim.layers.map((l) => l.id), ["a", "c", "b"], "b moved toward the top of the array");
    assert.deepEqual(ids(el), ["b", "c", "a"]);
  });

  test("send backward is its inverse", () => {
    const a = fakeLayer("a"), b = fakeLayer("b"), c = fakeLayer("c");
    const fim = fakeFim([a, b, c]);
    const { el } = UI.createLayerPanel(host(), { fim });
    rowBtn(el, 1, "Send backward").click();          // `b`
    assert.deepEqual(fim.layers.map((l) => l.id), ["b", "a", "c"]);
  });

  // The bug this guards: moving the array without telling the map leaves hit-testing following the
  // new order while the drawing still follows the old one.
  test("every move pushes the order to the map", () => {
    const fim = fakeFim([fakeLayer("a"), fakeLayer("b")]);
    const { el } = UI.createLayerPanel(host(), { fim });
    rowBtn(el, 1, "Bring forward").click();
    assert.equal(fim.orderPushes, 1);
  });

  test("the ends are disabled — no move can fall off the stack", () => {
    const fim = fakeFim([fakeLayer("a"), fakeLayer("b")]);
    const { el } = UI.createLayerPanel(host(), { fim });
    assert.equal(rowBtn(el, 0, "Bring forward").disabled, true, "topmost cannot go higher");
    assert.equal(rowBtn(el, 1, "Send backward").disabled, true, "bottom cannot go lower");
    assert.equal(fim.orderPushes, 0);
  });
});

describe("createLayerPanel: lifecycle", () => {
  test("destroy() removes the panel AND unsubscribes", () => {
    const fim = fakeFim([fakeLayer("a")]);
    const panel = UI.createLayerPanel(host(), { fim });
    assert.equal(fim.listeners("layers:changed"), 1);
    panel.destroy();
    assert.equal(host().querySelector("[data-fim-ui=layer-panel]"), null);
    assert.equal(fim.listeners("layers:changed"), 0, "a leaked listener would redraw a dead panel");
  });

  test("pretty injects one stylesheet however many panels mount", () => {
    const fim = fakeFim([]);
    UI.createLayerPanel(host(), { fim, pretty: true });
    UI.createLayerPanel(host(), { fim, pretty: true });
    assert.equal(document.querySelectorAll("#fim-layer-panel-css").length, 1);
  });
});

describe("createLayerSelect", () => {
  const hitAll = () => true;

  test("selects the TOPMOST layer under the click", () => {
    const a = fakeLayer("a", { hits: hitAll }), b = fakeLayer("b", { hits: hitAll });
    const fim = fakeFim([a, b]);                     // b is on top
    const sel = UI.createLayerSelect(fim, { fit: false });
    fim.emit("map:click", { lat: 1, lng: 1 });
    assert.equal(sel.selected, b);
    assert.deepEqual(sel.stack.map((l) => l.id), ["b", "a"], "stack is topmost-first");
  });

  test("clicking the same spot CYCLES through the overlap, then wraps", () => {
    const a = fakeLayer("a", { hits: hitAll }), b = fakeLayer("b", { hits: hitAll });
    const fim = fakeFim([a, b]);
    const sel = UI.createLayerSelect(fim, { fit: false });
    const click = () => fim.emit("map:click", { lat: 1, lng: 1 });
    click(); assert.equal(sel.selected.id, "b");
    click(); assert.equal(sel.selected.id, "a", "the one underneath");
    click(); assert.equal(sel.selected.id, "b", "wraps");
  });

  test("a click somewhere else restarts at the top", () => {
    const a = fakeLayer("a", { hits: hitAll }), b = fakeLayer("b", { hits: hitAll });
    const fim = fakeFim([a, b]);
    const sel = UI.createLayerSelect(fim, { fit: false });
    fim.emit("map:click", { lat: 1, lng: 1 });
    fim.emit("map:click", { lat: 1, lng: 1 });
    assert.equal(sel.selected.id, "a");
    fim.emit("map:click", { lat: 40, lng: 40 });
    assert.equal(sel.selected.id, "b", "a new spot is a new stack");
  });

  test("hidden layers and misses are excluded from the stack", () => {
    const hidden = fakeLayer("hidden", { hits: hitAll, visible: false });
    const missed = fakeLayer("missed", { hits: () => false });
    const hit = fakeLayer("hit", { hits: hitAll });
    const fim = fakeFim([hidden, missed, hit]);
    const sel = UI.createLayerSelect(fim, { fit: false });
    fim.emit("map:click", { lat: 1, lng: 1 });
    assert.deepEqual(sel.stack.map((l) => l.id), ["hit"]);
  });

  test("a click on nothing reports empty and does not change the selection", () => {
    const fim = fakeFim([fakeLayer("a", { hits: () => false })]);
    let empty = null;
    const sel = UI.createLayerSelect(fim, { fit: false, onEmpty: (lat, lng) => { empty = [lat, lng]; } });
    fim.emit("map:click", { lat: 5, lng: 6 });
    assert.deepEqual(empty, [5, 6]);
    assert.equal(sel.selected, null);
    assert.deepEqual(sel.stack, []);
  });

  test("fit defaults ON — that is the point when layers overlap", () => {
    const a = fakeLayer("a", { hits: hitAll });
    const fim = fakeFim([a]);
    UI.createLayerSelect(fim);
    fim.emit("map:click", { lat: 1, lng: 1 });
    assert.equal(a.fits, 1);
  });

  test("onSelect receives the layer and the whole stack", () => {
    const a = fakeLayer("a", { hits: hitAll }), b = fakeLayer("b", { hits: hitAll });
    const fim = fakeFim([a, b]);
    let got = null;
    UI.createLayerSelect(fim, { fit: false, onSelect: (l, s) => { got = { l, s }; } });
    fim.emit("map:click", { lat: 1, lng: 1 });
    assert.equal(got.l.id, "b");
    assert.deepEqual(got.s.map((x) => x.id), ["b", "a"]);
  });

  test("off() unsubscribes", () => {
    const fim = fakeFim([fakeLayer("a", { hits: hitAll })]);
    const sel = UI.createLayerSelect(fim, { fit: false });
    assert.equal(fim.listeners("map:click"), 1);
    sel.off();
    assert.equal(fim.listeners("map:click"), 0);
  });
});
