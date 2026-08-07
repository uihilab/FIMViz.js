// whenIdle + applyLayerOrder — the two provider methods the layer panel and the region-draw fix
// both sit on. Black box: drive the exported provider objects with fake maps shaped like the real
// SDKs, and assert on what they do to those maps.
//
// Both are OPTIONAL members of the provider contract, so the FimMap side must degrade to a no-op for
// a third-party provider that declares neither — tested here too, because "the layer panel silently
// does nothing on a custom provider" is a support ticket nobody enjoys.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMapProvider, registerMapProvider } from "../src/package/mapProvider.js";

const leaflet = getMapProvider("leaflet");
const google = getMapProvider("google");

/** A stand-in for L.Map: records event subscriptions so whenIdle can be driven deterministically. */
function fakeLeafletMap() {
  const subs = new Map();
  return {
    on(evt, fn) { (subs.get(evt) ?? subs.set(evt, new Set()).get(evt)).add(fn); },
    off(evt, fn) { subs.get(evt)?.delete(fn); },
    fire(evt) { for (const fn of [...(subs.get(evt) || [])]) fn(); },
    listenerCount(evt) { return subs.get(evt)?.size ?? 0; },
  };
}

/** Handles that record the order bringToFront() was called in — Leaflet's actual restack mechanism. */
function leafletHandles(n) {
  const order = [];
  const handles = Array.from({ length: n }, (_, i) => ({
    name: `h${i}`, bringToFront() { order.push(this.name); },
  }));
  return { handles, order };
}

describe("leaflet provider: whenIdle", () => {
  test("resolves when the camera settles, and unsubscribes both events", async () => {
    const map = fakeLeafletMap();
    const p = leaflet.whenIdle(map, { timeout: 5000 });
    assert.equal(map.listenerCount("moveend"), 1);
    assert.equal(map.listenerCount("zoomend"), 1);
    map.fire("moveend");
    await p;
    assert.equal(map.listenerCount("moveend"), 0, "a leaked listener would fire on every later pan");
    assert.equal(map.listenerCount("zoomend"), 0);
  });

  test("zoomend settles it too", async () => {
    const map = fakeLeafletMap();
    const p = leaflet.whenIdle(map, { timeout: 5000 });
    map.fire("zoomend");
    await p;
    assert.equal(map.listenerCount("zoomend"), 0);
  });

  // The property that makes `await fim.whenIdle()` safe to write unconditionally.
  test("an ALREADY-still map resolves on the timeout rather than hanging", async () => {
    const t0 = Date.now();
    await leaflet.whenIdle(fakeLeafletMap(), { timeout: 30 });
    assert.ok(Date.now() - t0 >= 25, "it waited for the timer");
  });

  test("firing twice resolves once and does not double-unsubscribe", async () => {
    const map = fakeLeafletMap();
    const p = leaflet.whenIdle(map, { timeout: 5000 });
    map.fire("moveend");
    map.fire("moveend");
    await p;
    assert.equal(map.listenerCount("moveend"), 0);
  });
});

describe("leaflet provider: applyLayerOrder", () => {
  test("brings each handle to the front in array order, so the LAST ends up on top", () => {
    const { handles, order } = leafletHandles(3);
    const out = leaflet.applyLayerOrder({}, handles);
    assert.deepEqual(order, ["h0", "h1", "h2"], "bottom -> top");
    assert.deepEqual(out, handles, "leaflet never replaces a handle");
  });

  test("skips nulls and handles that cannot be raised, rather than throwing", () => {
    const { handles } = leafletHandles(2);
    assert.doesNotThrow(() => leaflet.applyLayerOrder({}, [handles[0], null, {}, undefined, handles[1]]));
  });

  test("an empty stack is a no-op", () => {
    assert.deepEqual(leaflet.applyLayerOrder({}, []), []);
    assert.deepEqual(leaflet.applyLayerOrder({}), []);
  });
});

describe("google provider: applyLayerOrder", () => {
  // GroundOverlay has no z-index, so the provider recreates it. That makes the RETURNED handles
  // load-bearing: a caller that keeps the old ones would later remove an overlay already off the map.
  test("recreates raster handles and returns the replacements", (t) => {
    const created = [];
    const removed = [];
    globalThis.google = {
      maps: {
        GroundOverlay: class {
          constructor(url, bounds, opts) { this.url = url; this.bounds = bounds; this.opts = opts; created.push(this); }
          setMap(m) { this.map = m; }
        },
      },
    };
    t.after(() => { delete globalThis.google; });

    const raster = (name) => ({
      name,
      getUrl: () => `${name}.png`,
      getBounds: () => ({ b: name }),
      get: (k) => (k === "opacity" ? 0.5 : false),
      setMap(m) { if (m === null) removed.push(name); },
    });
    const vector = { setStyle() {} };            // a google.maps.Data — no getUrl
    const handles = [raster("a"), vector, raster("b")];

    const map = { MAP: true };
    const out = google.applyLayerOrder(map, handles);

    assert.equal(out.length, 3);
    assert.notEqual(out[0], handles[0], "raster handles are REPLACED");
    assert.equal(out[1], vector, "the vector handle is untouched");
    assert.notEqual(out[2], handles[2]);
    assert.deepEqual(removed, ["a", "b"], "each old overlay was taken off the map");
    assert.equal(created.length, 2);
    assert.equal(created[0].url, "a.png", "url, bounds and opacity carry across the recreate");
    assert.equal(created[0].opts.opacity, 0.5);
    assert.equal(created[0].map, map, "and the replacement is added back to the same map");
  });
});

// The drag lock the freehand/brush selection tools need: tracing a stroke and panning the map are
// the same gesture, so one has to be suppressed for the length of the stroke.
describe("provider: setDraggable", () => {
  test("leaflet toggles the dragging handler", () => {
    const calls = [];
    const map = { dragging: { enable: () => calls.push("enable"), disable: () => calls.push("disable") } };
    leaflet.setDraggable(map, false);
    leaflet.setDraggable(map, true);
    assert.deepEqual(calls, ["disable", "enable"]);
  });

  test("google sets the draggable map option", () => {
    const seen = [];
    const map = { setOptions: (o) => seen.push(o) };
    google.setDraggable(map, false);
    google.setDraggable(map, true);
    assert.deepEqual(seen, [{ draggable: false }, { draggable: true }]);
  });

  test("both coerce, so a truthy non-boolean cannot leak into the SDK", () => {
    const seen = [];
    google.setDraggable({ setOptions: (o) => seen.push(o) }, 1);
    assert.deepEqual(seen, [{ draggable: true }]);
  });

  // A map torn down mid-stroke would otherwise throw from the restore path, which runs on the
  // failure route — exactly where an exception is least welcome.
  test("neither throws on a missing map or a map without the capability", () => {
    assert.doesNotThrow(() => { leaflet.setDraggable(null, true); google.setDraggable(null, true); });
    assert.doesNotThrow(() => { leaflet.setDraggable({}, false); google.setDraggable({}, false); });
  });
});

describe("FimMap.setMapDraggable", () => {
  const fimWith = async (provider) => {
    registerMapProvider("drag-spy", provider);
    const { FimMap } = await import("../src/package/fimMap.js");
    const fim = new FimMap({ app: { config: { provider: "drag-spy" }, emit() {}, on() {} } });
    fim._adoptMap({ MAP: true });
    return fim;
  };

  test("forwards to the provider and returns itself for chaining", async () => {
    const seen = [];
    const fim = await fimWith({ create: async () => ({}), setDraggable: (m, on) => seen.push([m.MAP, on]) });
    assert.equal(fim.setMapDraggable(false), fim);
    fim.setMapDraggable(true);
    assert.deepEqual(seen, [[true, false], [true, true]]);
  });

  test("a provider without setDraggable is a silent no-op, not a crash", async () => {
    const fim = await fimWith({ create: async () => ({}) });
    assert.doesNotThrow(() => fim.setMapDraggable(false));
  });

  test("an unmounted map is a no-op too — nothing to make draggable yet", async () => {
    let called = false;
    const fim = await fimWith({ create: async () => ({}), setDraggable: () => { called = true; } });
    fim._adoptMap(null);
    fim.setMapDraggable(false);
    assert.equal(called, false);
  });
});

describe("the contract is OPTIONAL — a provider may declare none of them", () => {
  test("both built-ins implement all three methods", () => {
    for (const [name, p] of [["leaflet", leaflet], ["google", google]]) {
      assert.equal(typeof p.whenIdle, "function", `${name}.whenIdle`);
      assert.equal(typeof p.applyLayerOrder, "function", `${name}.applyLayerOrder`);
      assert.equal(typeof p.setDraggable, "function", `${name}.setDraggable`);
    }
  });

  test("a third-party provider without them is still registrable", () => {
    assert.doesNotThrow(() => registerMapProvider("minimal-order-test", { create: async () => ({}) }));
    const p = getMapProvider("minimal-order-test");
    assert.equal(p.whenIdle, undefined);
    assert.equal(p.applyLayerOrder, undefined);
    assert.equal(p.setDraggable, undefined);
  });
});
