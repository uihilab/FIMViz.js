// createAxisSlider — scrubbing a Dataset's selection axis, BLACK BOX.
//
// The widget's whole job is `layer.setSources([ds.select(coord)])`, so most of what matters is timing
// rather than markup: a stale frame must never win, and the play loop must wait for the frame it
// asked for. Both are asserted against a layer whose swap can be made deliberately slow.
//
// Nothing here is time-axis specific on purpose — the axis model covers stages, levels, bands and
// ensemble members too, and the widget must not have learned otherwise.

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
  UI = await import("../src/ui/axisSlider.js");
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  dom.window.close();
});

const host = () => document.getElementById("host");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for a condition rather than for a duration. Playback is paced by real timers, and this suite
 * runs alongside others — a fixed sleep that passes on an idle machine fails on a busy one, which is
 * a flaky test rather than a real signal.
 */
async function until(fn, ms = 1000) {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await tick(5);
  return fn();
}

/**
 * A Dataset stand-in carrying an axis. `select()` returns a marker child rather than a real Dataset —
 * the widget is being tested, not the lazy graph, and what matters is WHICH coord it asked for.
 */
function axisDataset({ name = "series", entries = 4, axisName = "time", unit = null, meta } = {}) {
  return {
    name,
    axes: [{
      name: axisName, unit, entries: Array.from({ length: entries }, (_, i) => ({
        coord: i * 10,
        meta: meta ? meta(i) : { time: `2023-08-3${i}T00:00Z` },
      })),
    }],
    get axis() { return this.axes[0]; },
    select(coord, opts) { return { coord, opts, __child: true }; },
  };
}

/** A layer whose source swap can be made slow, and per-swap, to force out-of-order resolution. */
function fakeLayer(ds, { delays = [] } = {}) {
  const applied = [];
  let n = 0;
  return {
    dataset: ds,
    sources: [ds],
    applied,
    setSources(next) {
      const d = delays[n++] ?? 0;
      return new Promise((res) => setTimeout(() => { applied.push(next[0].coord); res(this); }, d));
    },
  };
}

const el = (s, sel) => s.el.querySelector(`[data-axis="${sel}"]`);
const text = (s, sel) => el(s, sel).textContent;
const input = (node) => node.dispatchEvent(new dom.window.Event("input"));

describe("axisSlider: mounting and readout", () => {
  test("renders a range over the axis, with a label and a position", () => {
    const ds = axisDataset({ entries: 3 });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds) });
    assert.equal(s.el.getAttribute("data-fim-ui"), "axis-slider");
    assert.equal(el(s, "range").max, "2");
    assert.equal(s.length, 3);
    assert.equal(s.index, 0);
    assert.equal(text(s, "counter"), "1 / 3");
    assert.match(text(s, "label"), /2023-08-30/);
  });

  test("the axis unit rides along in the counter", () => {
    const ds = axisDataset({ entries: 2, unit: "h" });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds) });
    assert.equal(text(s, "counter"), "1 / 2 h");
  });

  test("a starting index is honoured and clamped", () => {
    const ds = axisDataset({ entries: 3 });
    assert.equal(UI.createAxisSlider(host(), { layer: fakeLayer(ds), index: 2 }).index, 2);
    assert.equal(UI.createAxisSlider(host(), { layer: fakeLayer(ds), index: 99 }).index, 2);
    assert.equal(UI.createAxisSlider(host(), { layer: fakeLayer(ds), index: -5 }).index, 0);
  });

  test("a custom label replaces the default", () => {
    const ds = axisDataset({ entries: 2 });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds), label: (e, i) => `step ${i}@${e.coord}` });
    assert.equal(text(s, "label"), "step 0@0");
  });

  // The axis model is not time-specific, and neither is this.
  test("it drives a NON-temporal axis just as well", () => {
    const ds = axisDataset({ axisName: "member", entries: 3, meta: (i) => ({ label: `member ${i + 1}` }) });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds) });
    assert.equal(s.axis.name, "member");
    assert.equal(text(s, "label"), "member 1");
  });

  test("a named axis can be selected out of several", () => {
    const ds = axisDataset({ entries: 2 });
    ds.axes.push({ name: "level", entries: [{ coord: 500, meta: { label: "500 hPa" } }] });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds), axis: "level" });
    assert.equal(s.axis.name, "level");
    assert.equal(s.length, 1);
  });

  // Not an error: a host mounting this against "whatever the user loaded" should not have to pre-check.
  test("a dataset with NO axis renders a note, disabled, instead of throwing", () => {
    const s = UI.createAxisSlider(host(), { layer: { dataset: { name: "plain.tif" } } });
    assert.equal(s.axis, null);
    assert.equal(s.length, 0);
    assert.equal(el(s, "range"), null);
    assert.match(s.el.textContent, /no selection axis on "plain\.tif"/);
    assert.doesNotThrow(() => { s.play(); s.pause(); s.destroy(); });
  });

  test("rejects a missing layer and a bad target", () => {
    assert.throws(() => UI.createAxisSlider(host(), {}), /\{ layer \} is required/);
    assert.throws(() => UI.createAxisSlider("#nope", { layer: fakeLayer(axisDataset()) }), /not found/);
  });
});

describe("axisSlider: scrubbing", () => {
  test("moving the range selects that entry's coord and swaps the layer", async () => {
    const ds = axisDataset({ entries: 4 });
    const layer = fakeLayer(ds);
    const changed = [];
    const s = UI.createAxisSlider(host(), { layer, onChange: (e, i) => changed.push(i) });

    const range = el(s, "range");
    range.value = "2"; input(range);
    await tick();
    assert.deepEqual(layer.applied, [20], "select() was called with the entry's coord, not its index");
    assert.equal(s.index, 2);
    assert.equal(text(s, "counter"), "3 / 4");
    assert.deepEqual(changed, [2]);
  });

  test("the readout moves immediately, before the pixels land", async () => {
    const ds = axisDataset({ entries: 3 });
    const layer = fakeLayer(ds, { delays: [30] });
    const s = UI.createAxisSlider(host(), { layer });
    await s.goto(1);                       // resolves only after the swap
    assert.equal(text(s, "counter"), "2 / 3");
    assert.deepEqual(layer.applied, [10]);
  });

  test("next/prev wrap around the ends", async () => {
    const ds = axisDataset({ entries: 3 });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds) });
    await s.prev();
    assert.equal(s.index, 2, "prev from the start wraps to the end");
    await s.next();
    assert.equal(s.index, 0);
  });

  test("loop:false clamps instead, and disables the button at the end", async () => {
    const ds = axisDataset({ entries: 2 });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds), loop: false });
    assert.equal(el(s, "prev").disabled, true, "already at the start");
    await s.goto(1);
    assert.equal(el(s, "next").disabled, true);
  });

  test("goto clamps out-of-range input rather than selecting undefined", async () => {
    const ds = axisDataset({ entries: 3 });
    const layer = fakeLayer(ds);
    const s = UI.createAxisSlider(host(), { layer });
    await s.goto(99);
    assert.equal(s.index, 2);
    assert.deepEqual(layer.applied, [20]);
  });

  // THE correctness property. Dragging fires far faster than a grid decodes, so several swaps are in
  // flight at once and they do not finish in order. Without the guard the last frame to RESOLVE wins
  // rather than the last one asked for, and the map shows a step nobody selected.
  test("a slow earlier frame that resolves LAST does not win", async () => {
    const ds = axisDataset({ entries: 4 });
    const layer = fakeLayer(ds, { delays: [50, 0] });      // frame 1 slow, frame 2 fast
    const changed = [];
    const s = UI.createAxisSlider(host(), { layer, onChange: (e, i) => changed.push(i) });

    const p1 = s.goto(1);
    const p2 = s.goto(2);
    await Promise.all([p1, p2]);
    await tick(80);

    assert.deepEqual(changed, [2], "only the frame the user actually asked for reported");
    assert.equal(s.index, 2);
  });

  test("an error on a stale frame is swallowed; on the current one it is reported", async () => {
    const ds = axisDataset({ entries: 3 });
    const errs = [];
    const layer = fakeLayer(ds);
    layer.setSources = (next) => (next[0].coord === 10
      ? Promise.reject(new Error("decode failed"))
      : Promise.resolve());
    const s = UI.createAxisSlider(host(), { layer, onError: (e, i) => errs.push(i) });
    await s.goto(1);
    assert.deepEqual(errs, [1]);
    assert.equal(s.index, 1, "the position still moved — the frame failed, the intent did not");
  });
});

describe("axisSlider: play", () => {
  test("play advances, and each frame waits for the previous to land", async () => {
    const ds = axisDataset({ entries: 3 });
    const layer = fakeLayer(ds);
    const s = UI.createAxisSlider(host(), { layer, interval: 5 });
    assert.equal(s.playing, false);
    s.play();
    assert.equal(s.playing, true);
    assert.ok(await until(() => layer.applied.length >= 2),
      `it advanced (${layer.applied.length} frames)`);
    assert.deepEqual(layer.applied.slice(0, 2), [10, 20], "…one entry at a time, in order");
    s.pause();
    assert.equal(s.playing, false);
  });

  // A fixed setInterval would queue frames faster than a slow source can draw them, and the playhead
  // would run away from the map.
  test("a source slower than the interval does not queue frames up", async () => {
    const ds = axisDataset({ entries: 6 });
    const layer = fakeLayer(ds, { delays: Array(6).fill(25) });
    const s = UI.createAxisSlider(host(), { layer, interval: 1 });
    s.play();
    await tick(70);
    s.pause();
    assert.ok(layer.applied.length <= 4,
      `frames are paced by the decode, not the timer (got ${layer.applied.length})`);
  });

  test("scrubbing pauses playback — the user took over", async () => {
    const ds = axisDataset({ entries: 4 });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds), interval: 5 });
    s.play();
    const range = el(s, "range");
    range.value = "3"; input(range);
    assert.equal(s.playing, false, "the user took over the moment they touched it");
    await tick(30);
    assert.equal(s.index, 3);
  });

  test("the play button toggles, and shows which state it is in", async () => {
    const ds = axisDataset({ entries: 3 });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds), interval: 5 });
    const btn = el(s, "play");
    assert.equal(btn.textContent, "▶");
    btn.click();
    assert.equal(s.playing, true);
    assert.equal(btn.textContent, "❚❚");
    btn.click();
    assert.equal(s.playing, false);
    await tick(20);
  });

  test("play:false leaves the button out entirely", () => {
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(axisDataset()), play: false });
    assert.equal(el(s, "play"), null);
  });

  test("loop:false stops at the end instead of wrapping", async () => {
    const ds = axisDataset({ entries: 2 });
    const s = UI.createAxisSlider(host(), { layer: fakeLayer(ds), interval: 2, loop: false, index: 1 });
    s.play();
    assert.ok(await until(() => !s.playing), "playback stopped at the end rather than wrapping");
    assert.equal(s.index, 1);
  });

  test("destroy() stops playback and removes the element", async () => {
    const ds = axisDataset({ entries: 4 });
    const layer = fakeLayer(ds);
    const s = UI.createAxisSlider(host(), { layer, interval: 3 });
    s.play();
    await until(() => layer.applied.length >= 1);
    s.destroy();
    // One swap may already be in flight and will still land — that call was issued before destroy and
    // cannot be unmade. What must stop is the slider issuing NEW ones.
    await tick(30);
    const after = layer.applied.length;
    await tick(40);
    assert.equal(layer.applied.length, after, "a destroyed slider must not keep swapping sources");
    assert.equal(host().querySelectorAll("[data-fim-ui=axis-slider]").length, 0);
  });
});

describe("axisSlider: the pure helpers", () => {
  test("axisOf takes an index or a name, and accepts the 1-D `axis` sugar", () => {
    const ds = axisDataset({ entries: 2, axisName: "stage" });
    assert.equal(UI.axisOf(ds, 0).name, "stage");
    assert.equal(UI.axisOf(ds, "stage").name, "stage");
    assert.equal(UI.axisOf(ds, "nope"), null);
    assert.equal(UI.axisOf({ axis: ds.axes[0] }).name, "stage", "the 1-D sugar works too");
  });

  test("axisOf treats an EMPTY axis as no axis — there is nothing to scrub", () => {
    assert.equal(UI.axisOf({ axes: [{ name: "time", entries: [] }] }), null);
    assert.equal(UI.axisOf(null), null);
    assert.equal(UI.axisOf({}), null);
  });

  test("axisEntryLabel prefers an explicit label, then time, then the coord", () => {
    assert.equal(UI.axisEntryLabel({ coord: 3, meta: { label: "L", time: "T" } }), "L");
    assert.equal(UI.axisEntryLabel({ coord: 3, meta: { time: "T" } }), "T");
    assert.equal(UI.axisEntryLabel({ coord: 3, meta: {} }), "3");
    assert.equal(UI.axisEntryLabel({ coord: 3 }), "3");
    assert.equal(UI.axisEntryLabel(null), "");
  });
});
