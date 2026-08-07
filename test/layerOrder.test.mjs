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

describe("the contract is OPTIONAL — a provider may declare neither", () => {
  test("both built-ins implement both methods", () => {
    for (const [name, p] of [["leaflet", leaflet], ["google", google]]) {
      assert.equal(typeof p.whenIdle, "function", `${name}.whenIdle`);
      assert.equal(typeof p.applyLayerOrder, "function", `${name}.applyLayerOrder`);
    }
  });

  test("a third-party provider without them is still registrable", () => {
    assert.doesNotThrow(() => registerMapProvider("minimal-order-test", { create: async () => ({}) }));
    const p = getMapProvider("minimal-order-test");
    assert.equal(p.whenIdle, undefined);
    assert.equal(p.applyLayerOrder, undefined);
  });
});
