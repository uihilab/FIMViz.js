// createRegionDraw — the four selection tools, BLACK BOX.
//
// The point of the generalization is that polygon, rectangle, freehand and brush all hand back the
// SAME thing: rings of {lat,lng} wrapped in a SpatialFilter, which is what `dataset.mask()` and
// `layer.getStats({ filter })` already take. So most of what is asserted here is geometry — is the
// shape the one the gestures described — rather than which callbacks fired.
//
// Headless on purpose: no jsdom. The key handling is exercised through an injected `keyTarget`,
// which is also how a host would scope keys to its own map container instead of the whole document.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createRegionDraw, REGION_MODES } from "../src/ui/regionDraw.js";
import { createRegionOverlay, regionGeoJSON } from "../src/ui/regionOverlay.js";
import { SpatialFilter } from "../src/package/filter.js";

/**
 * A FimMap stand-in exposing only what the tool uses. `captureInteraction` reproduces the real
 * identity-checked release — a stale release must not clear someone else's capture — because the
 * trailing-click swallow depends on exactly that.
 */
function fakeMap({ view = null } = {}) {
  let handler = null;
  const draggable = [];
  const scratch = [];
  const send = (type) => (lat, lng) => handler?.({ type, lat, lng });
  return {
    captureInteraction(fn) {
      handler = fn;
      return () => { if (handler === fn) handler = null; };
    },
    setMapDraggable(on) { draggable.push(on); },
    viewMetrics: () => view,
    addScratchVector(geojson, opts) { const h = { geojson, opts, live: true }; scratch.push(h); return h; },
    removeScratchVector(h) { if (h) h.live = false; },
    click: send("click"), hover: send("hover"),
    down: send("mousedown"), up: send("mouseup"),
    get captured() { return handler !== null; },
    get draggable() { return draggable; },
    get scratch() { return scratch; },
    get liveScratch() { return scratch.filter((h) => h.live); },
  };
}

/** A minimal EventTarget for keys, so the tool never needs a document. */
function fakeKeys() {
  const listeners = new Set();
  return {
    addEventListener(type, fn) { if (type === "keydown") listeners.add(fn); },
    removeEventListener(type, fn) { listeners.delete(fn); },
    press(key) { let prevented = false; for (const fn of [...listeners]) fn({ key, preventDefault: () => { prevented = true; } }); return prevented; },
    get count() { return listeners.size; },
  };
}

const ringBounds = (ring) => ({
  s: Math.min(...ring.map((p) => p.lat)), n: Math.max(...ring.map((p) => p.lat)),
  w: Math.min(...ring.map((p) => p.lng)), e: Math.max(...ring.map((p) => p.lng)),
});

describe("regionDraw: modes", () => {
  test("REGION_MODES is the toolbar order", () => {
    assert.deepEqual([...REGION_MODES], ["polygon", "rectangle", "freehand", "brush"]);
  });

  test("an unknown mode throws at construction, naming the valid ones", () => {
    assert.throws(() => createRegionDraw(fakeMap(), { mode: "lasso" }),
      /unknown mode 'lasso'.*polygon, rectangle, freehand, brush/);
  });

  test("setMode rejects an unknown mode and leaves the current one alone", () => {
    const rd = createRegionDraw(fakeMap(), { mode: "polygon" });
    assert.throws(() => rd.setMode("wand"), /unknown mode 'wand'/);
    assert.equal(rd.mode, "polygon");
  });

  test("setMode mid-draw discards the shape WITHOUT reporting a cancel", () => {
    const map = fakeMap();
    let cancelled = false;
    const rd = createRegionDraw(map, { onCancel: () => { cancelled = true; } });
    rd.start();
    map.click(1, 1); map.click(2, 2);
    rd.setMode("rectangle");
    assert.equal(cancelled, false, "the host asked for the switch; it is not a cancellation");
    assert.deepEqual(rd.points, [], "a half-drawn polygon cannot carry over into a rectangle");
    assert.equal(rd.active, true, "still armed — the tool changed, the session did not end");
    assert.equal(map.captured, true);
  });

  test("setMode while idle does not arm the tool", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map);
    rd.setMode("brush");
    assert.equal(rd.mode, "brush");
    assert.equal(rd.active, false);
    assert.equal(map.captured, false);
  });

  test("setMode to the current mode is a no-op that keeps the shape", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "polygon" });
    rd.start(); map.click(1, 1);
    rd.setMode("polygon");
    assert.deepEqual(rd.points, [{ lat: 1, lng: 1 }]);
  });
});

describe("regionDraw: rectangle", () => {
  test("two clicks fully determine it, so the second one finishes the draw", () => {
    const map = fakeMap();
    let done;
    const rd = createRegionDraw(map, { mode: "rectangle", onComplete: (f, p, r) => { done = { f, p, r }; } });
    rd.start();
    map.click(10, 20);
    assert.equal(rd.active, true, "one corner is not a rectangle");
    map.click(30, 40);
    assert.equal(rd.active, false, "…two is, and asking for Finish as well would add no information");
    assert.ok(done.f instanceof SpatialFilter);
    assert.equal(done.r.length, 1);
    assert.equal(done.r[0].length, 4);
    assert.equal(map.captured, false, "the modal capture must be released");
  });

  test("the corners normalize — dragging up-left gives the same box as down-right", () => {
    const box = (a, b, c, d) => {
      const map = fakeMap();
      const rd = createRegionDraw(map, { mode: "rectangle" });
      rd.start(); map.click(a, b); map.click(c, d);
      return ringBounds(rd.rings[0]);
    };
    assert.deepEqual(box(10, 20, 30, 40), { s: 10, n: 30, w: 20, e: 40 });
    assert.deepEqual(box(30, 40, 10, 20), { s: 10, n: 30, w: 20, e: 40 });
    assert.deepEqual(box(30, 20, 10, 40), { s: 10, n: 30, w: 20, e: 40 });
  });

  test("the filter contains the interior and rejects the outside", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "rectangle" });
    rd.start();
    map.click(0, 0);
    const f = (map.click(10, 10), rd.rings);
    const filter = new SpatialFilter(f);
    assert.equal(filter.contains(5, 5), true);
    assert.equal(filter.contains(-5, 5), false);
  });

  test("hover after the first corner previews a rubber band; before it, nothing", () => {
    const map = fakeMap();
    const seen = [];
    const rd = createRegionDraw(map, { mode: "rectangle", onPreview: (r) => seen.push(r) });
    rd.start();
    map.hover(5, 5);
    assert.deepEqual(seen.at(-1), [], "no corner placed yet — there is no band to draw");
    map.click(0, 0);
    map.hover(10, 10);
    assert.equal(seen.at(-1).length, 1);
    assert.deepEqual(ringBounds(seen.at(-1)[0]), { s: 0, n: 10, w: 0, e: 10 });
  });
});

describe("regionDraw: freehand", () => {
  test("press, move, release traces a ring and finishes on its own", () => {
    const map = fakeMap();
    let done;
    const rd = createRegionDraw(map, { mode: "freehand", onComplete: (f, p, r) => { done = { f, p, r }; } });
    rd.start();
    map.down(0, 0); map.hover(0, 10); map.hover(10, 10); map.hover(10, 0);
    assert.equal(rd.points.length, 4, "the press point plus each move");
    map.up(10, 0);
    assert.equal(rd.active, false);
    assert.equal(done.r.length, 1);
    assert.equal(done.f.contains(5, 5), true);
  });

  test("moves BEFORE the press are not part of the stroke", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "freehand" });
    rd.start();
    map.hover(80, 80); map.hover(81, 81);
    assert.deepEqual(rd.points, [], "the pointer crossing the map is not a drawing gesture");
    map.down(0, 0); map.hover(1, 1);
    assert.equal(rd.points.length, 2);
  });

  test("the trailing click after mouseup is swallowed, not treated as a new gesture", () => {
    const map = fakeMap();
    let selects = 0;
    const rd = createRegionDraw(map, { mode: "freehand" });
    rd.start();
    map.down(0, 0); map.hover(0, 5); map.hover(5, 5);
    map.up(5, 5);
    assert.equal(map.captured, true, "a capture is held briefly to eat the trailing click");
    map.click(5, 5);                     // the browser's click that completes press-drag-release
    assert.equal(map.captured, false, "…and released the moment it arrives");
    assert.equal(selects, 0);
    assert.equal(rd.active, false);
  });

  test("a host that starts another tool from onComplete wins over the swallow capture", () => {
    const map = fakeMap();
    let ownHandler = false;
    const rd = createRegionDraw(map, {
      mode: "freehand",
      onComplete: () => { map.captureInteraction(() => { ownHandler = true; }); },
    });
    rd.start();
    map.down(0, 0); map.hover(0, 5); map.hover(5, 5); map.up(5, 5);
    map.click(1, 1);
    assert.equal(ownHandler, true, "the host's capture replaced ours, as later-wins requires");
  });

  test("falls back to click-to-start / click-to-stop when the host never enabled mousedown", () => {
    const map = fakeMap();
    let done;
    const rd = createRegionDraw(map, { mode: "freehand", onComplete: (f) => { done = f; } });
    rd.start();
    map.click(0, 0);                      // start tracing
    map.hover(0, 10); map.hover(10, 10);
    map.click(10, 0);                     // stop — and this one counts as a vertex
    assert.equal(rd.active, false);
    assert.ok(done instanceof SpatialFilter);
    assert.equal(done.features[0].length, 4, "the terminating click is a place the user chose");
    assert.equal(done.contains(5, 5), true);
  });

  test("a stroke of fewer than 3 samples yields null rather than a degenerate ring", () => {
    const map = fakeMap();
    let done = "unset";
    const rd = createRegionDraw(map, { mode: "freehand", onComplete: (f) => { done = f; } });
    rd.start();
    map.down(0, 0); map.hover(0, 1); map.up(0, 1);
    assert.equal(done, null);
  });

  test("minSampleMetres drops near-identical samples from a slow drag", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "freehand", minSampleMetres: 10000 });
    rd.start();
    map.down(0, 0);
    map.hover(0, 0.001); map.hover(0, 0.002);   // ~100 m and ~220 m — both under the threshold
    assert.equal(rd.points.length, 1, "a jittering pointer must not become thousands of vertices");
    map.hover(0, 0.2);                          // ~22 km — a real move
    assert.equal(rd.points.length, 2);
  });
});

describe("regionDraw: brush", () => {
  test("each sample stamps a ring, and the stamps union into one filter", () => {
    const map = fakeMap();
    let done;
    const rd = createRegionDraw(map, { mode: "brush", brushRadius: 5000, onComplete: (f, p, r) => { done = { f, p, r }; } });
    rd.start();
    map.down(0, 0); map.hover(0, 0.5); map.hover(0, 1);
    map.up(0, 1);
    assert.equal(done.p.length, 3, "three samples");
    assert.equal(done.r.length, 3, "…so three stamps");
    assert.equal(done.f.contains(0, 0), true, "under the first stamp");
    assert.equal(done.f.contains(0, 1), true, "under the last stamp");
    assert.equal(done.f.contains(0, 5), false, "well off the stroke");
  });

  test("a single dab is already a usable region — one stamp is 3+ vertices", () => {
    const map = fakeMap();
    let done = "unset";
    const rd = createRegionDraw(map, { mode: "brush", brushRadius: 1000, onComplete: (f) => { done = f; } });
    rd.start();
    map.down(20, 30); map.up(20, 30);
    assert.ok(done instanceof SpatialFilter, "unlike a 1-point polygon, a 1-point brush has area");
    assert.equal(done.contains(20, 30), true);
  });

  test("brushSides controls the stamp's vertex count", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "brush", brushSides: 6 });
    rd.start(); map.down(0, 0);
    assert.equal(rd.rings[0].length, 6);
  });

  test("the stamp is a circle on the ground, so it widens in longitude away from the equator", () => {
    const spanAt = (lat) => {
      const map = fakeMap();
      const rd = createRegionDraw(map, { mode: "brush", brushRadius: 10000 });
      rd.start(); map.down(lat, 0);
      const b = ringBounds(rd.rings[0]);
      return { lat: b.n - b.s, lng: b.e - b.w };
    };
    const eq = spanAt(0), far = spanAt(60);
    assert.ok(Math.abs(eq.lat - far.lat) < 1e-9, "latitude degrees are the same length everywhere");
    assert.ok(far.lng > eq.lng * 1.9, `60°N needs ~2× the longitude span (got ${far.lng / eq.lng})`);
  });
});

describe("regionDraw: brush size in screen units", () => {
  // 100 m per pixel over an 800 px-wide map: 2vw = 16 px = 1600 m.
  const view = { metresPerPixel: 100, width: 800, height: 400 };
  const spanMetres = (rd, map) => {
    rd.start(); map.down(0, 0);
    const ring = rd.rings[0];
    const dLat = Math.max(...ring.map((p) => p.lat)) - Math.min(...ring.map((p) => p.lat));
    return (dLat / 2) * (Math.PI / 180) * 6378137;      // half the lat span back to metres
  };

  test("'vw' is a percentage of the MAP's width, resolved against the live view", () => {
    const map = fakeMap({ view });
    const r = spanMetres(createRegionDraw(map, { mode: "brush", brushRadius: "2vw" }), map);
    assert.ok(Math.abs(r - 1600) < 1, `2vw of 800px at 100 m/px is 1600 m (got ${r})`);
  });

  test("'vh' measures the height, and 'px' is literal pixels", () => {
    const map = fakeMap({ view });
    assert.ok(Math.abs(spanMetres(createRegionDraw(map, { mode: "brush", brushRadius: "2vh" }), map) - 800) < 1);
    assert.ok(Math.abs(spanMetres(createRegionDraw(map, { mode: "brush", brushRadius: "20px" }), map) - 2000) < 1);
  });

  test("a plain number stays metres — a fixed ground footprint", () => {
    const map = fakeMap({ view });
    assert.ok(Math.abs(spanMetres(createRegionDraw(map, { mode: "brush", brushRadius: 500 }), map) - 500) < 1);
  });

  // A screen-sized brush must degrade, not throw: the map may not be mounted, or the provider may
  // not implement viewMetrics at all.
  test("falls back to a ground size when the map cannot report its scale", () => {
    const map = fakeMap({ view: null });
    assert.ok(Math.abs(spanMetres(createRegionDraw(map, { mode: "brush", brushRadius: "2vw" }), map) - 250) < 1);
  });

  test("a nonsense unit throws, naming what it accepts", () => {
    const map = fakeMap({ view });
    const rd = createRegionDraw(map, { mode: "brush", brushRadius: "2 furlongs" });
    rd.start();
    assert.throws(() => map.down(0, 0), /expected metres as a number, or '<n>vw'/);
  });

  test("brushRadius is settable mid-stroke, so a size slider works", () => {
    const map = fakeMap({ view });
    const rd = createRegionDraw(map, { mode: "brush", brushRadius: "1vw" });
    rd.start();
    map.down(0, 0);
    rd.brushRadius = "4vw";
    map.hover(1, 1);
    const span = (r) => Math.max(...r.map((p) => p.lat)) - Math.min(...r.map((p) => p.lat));
    assert.ok(span(rd.rings[1]) > span(rd.rings[0]) * 3.5, "the second stamp used the new size");
    assert.equal(rd.brushRadius, "4vw");
  });

  test("the size is re-resolved per stamp, so a zoom mid-stroke is honoured", () => {
    const live = { metresPerPixel: 100, width: 800, height: 400 };
    const map = fakeMap({ view: live });
    const rd = createRegionDraw(map, { mode: "brush", brushRadius: "2vw" });
    rd.start();
    map.down(0, 0);
    live.metresPerPixel = 50;                     // the user zoomed in one level mid-drag
    map.hover(1, 1);
    const span = (r) => Math.max(...r.map((p) => p.lat)) - Math.min(...r.map((p) => p.lat));
    assert.ok(Math.abs(span(rd.rings[1]) / span(rd.rings[0]) - 0.5) < 0.01,
      "half the ground size at half the metres-per-pixel — the same size ON SCREEN");
  });
});

describe("regionOverlay", () => {
  const roles = (gj) => gj.features.map((f) => f.properties.role);

  test("a single point is already visible — a vertex marker from the first click", () => {
    const gj = regionGeoJSON([], [{ lat: 1, lng: 2 }]);
    assert.deepEqual(roles(gj), ["vertex"]);
    assert.deepEqual(gj.features[0].geometry.coordinates, [2, 1], "GeoJSON is x,y — lng first");
  });

  test("two points draw an open edge; three close into a ring", () => {
    const pts = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }];
    assert.deepEqual(roles(regionGeoJSON([], pts.slice(0, 2))), ["edge", "vertex", "vertex"]);
    const closed = regionGeoJSON([pts], pts);
    assert.deepEqual(roles(closed), ["ring", "vertex", "vertex", "vertex"]);
    assert.equal(closed.features[0].geometry.coordinates[0].length, 4, "the ring is closed back to its start");
    assert.ok(!roles(closed).includes("edge"), "the polygon's own outline IS the edge");
  });

  test("a brush's many stamps each become a ring", () => {
    const stamp = (lat) => [{ lat, lng: 0 }, { lat, lng: 1 }, { lat: lat + 1, lng: 1 }];
    assert.deepEqual(roles(regionGeoJSON([stamp(0), stamp(5)], [], { vertices: false })), ["ring", "ring"]);
  });

  test("vertices:false leaves only the shape", () => {
    const pts = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }];
    assert.deepEqual(roles(regionGeoJSON([pts], pts, { vertices: false })), ["ring"]);
  });

  test("show() paints one scratch vector, and repainting replaces rather than stacks", async () => {
    const map = fakeMap();
    const overlay = createRegionOverlay(map);
    const pts = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }];
    overlay.show([pts], pts);
    overlay.show([pts], pts);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(map.scratch.length, 1, "two show()s inside one frame cost ONE rebuild");
    assert.equal(map.liveScratch.length, 1);
    overlay.show([pts], [...pts, { lat: 2, lng: 2 }]);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(map.scratch.length, 2);
    assert.equal(map.liveScratch.length, 1, "the previous overlay was removed, not left on the map");
  });

  test("clear() and destroy() take the shape off the map", async () => {
    const map = fakeMap();
    const overlay = createRegionOverlay(map);
    const pts = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }];
    overlay.show([pts], pts);
    await new Promise((r) => setTimeout(r, 30));
    overlay.clear();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(map.liveScratch.length, 0);
    assert.equal(overlay.geojson, null);

    overlay.show([pts], pts);
    await new Promise((r) => setTimeout(r, 30));
    overlay.destroy();
    assert.equal(map.liveScratch.length, 0, "destroy must not leave an orphan overlay behind");
  });

  test("an empty shape draws nothing at all", async () => {
    const map = fakeMap();
    createRegionOverlay(map).show([], []);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(map.scratch.length, 0, "an empty FeatureCollection is not worth an overlay");
  });

  test("the default style tells ring, edge and vertex apart", async () => {
    const map = fakeMap();
    const overlay = createRegionOverlay(map);
    const pts = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }];
    overlay.show([pts], pts);
    await new Promise((r) => setTimeout(r, 30));
    const style = map.scratch[0].opts.style;
    const ring = style({ feature: { properties: { role: "ring" } }, index: 0 });
    const vertex = style({ feature: { properties: { role: "vertex" } }, index: 1 });
    assert.ok(ring.fillOpacity > 0 && ring.fillOpacity < 1, "a translucent fill, so the raster shows through");
    assert.equal(vertex.pointRadius, 4, "vertices are circles, in the NEUTRAL style vocabulary");
    assert.equal(vertex.strokeColor, "#ffffff");
  });

  test("a caller's own style wins outright", async () => {
    const map = fakeMap();
    const mine = { strokeColor: "#f00" };
    createRegionOverlay(map, { style: mine }).show([[{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }]]);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(map.scratch[0].opts.style, mine);
  });

  // The whole reason the overlay exists: the tool is headless, so without this the user draws blind.
  test("wired to onPreview, a polygon draw is visible from the FIRST click", async () => {
    const map = fakeMap();
    const overlay = createRegionOverlay(map);
    const rd = createRegionDraw(map, { onPreview: (rings, pts) => overlay.show(rings, pts) });
    rd.start();
    map.click(0, 0);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(map.liveScratch.length, 1, "one point is not a ring, but it IS something to look at");
    assert.deepEqual(roles(overlay.geojson), ["vertex"]);

    map.click(0, 1); map.click(1, 1);
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(roles(overlay.geojson), ["ring", "vertex", "vertex", "vertex"]);
  });
});

describe("regionDraw: keys", () => {
  test("Escape cancels, Enter finishes, Backspace undoes — and each is prevented", () => {
    const keyTarget = fakeKeys();
    const map = fakeMap();
    let cancelled = false, completed = "unset";
    const rd = createRegionDraw(map, {
      keyTarget, onCancel: () => { cancelled = true; }, onComplete: (f) => { completed = f; },
    });
    rd.start();
    map.click(0, 0); map.click(0, 10); map.click(10, 10); map.click(10, 0);
    assert.equal(keyTarget.press("Backspace"), true);
    assert.equal(rd.points.length, 3);
    assert.equal(keyTarget.press("Enter"), true);
    assert.ok(completed instanceof SpatialFilter);
    assert.equal(cancelled, false);

    rd.start();
    map.click(1, 1);
    assert.equal(keyTarget.press("Escape"), true);
    assert.equal(cancelled, true);
    assert.deepEqual(rd.points, []);
  });

  test("the listener is detached on stop, so keys do nothing between draws", () => {
    const keyTarget = fakeKeys();
    const rd = createRegionDraw(fakeMap(), { keyTarget });
    assert.equal(keyTarget.count, 0);
    rd.start();
    assert.equal(keyTarget.count, 1);
    rd.cancel();
    assert.equal(keyTarget.count, 0, "a stale keydown handler on document is a leak, not a feature");
  });

  test("keys:false leaves the target untouched", () => {
    const keyTarget = fakeKeys();
    createRegionDraw(fakeMap(), { keyTarget, keys: false }).start();
    assert.equal(keyTarget.count, 0);
  });

  test("an unrelated key is ignored and NOT prevented", () => {
    const keyTarget = fakeKeys();
    const rd = createRegionDraw(fakeMap(), { keyTarget });
    rd.start();
    assert.equal(keyTarget.press("a"), false);
    assert.equal(rd.active, true);
  });
});

describe("regionDraw: camera freeze", () => {
  test("drag modes suppress panning for the length of the stroke and restore it", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "freehand" });
    rd.start();
    assert.deepEqual(map.draggable, [false], "tracing and panning are the same gesture");
    map.down(0, 0); map.hover(0, 5); map.hover(5, 5); map.up(5, 5);
    assert.deepEqual(map.draggable, [false, true], "restored on finish, not left off");
  });

  test("cancel restores panning too — the failure path is the one that strands a map", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "brush" });
    rd.start(); rd.cancel();
    assert.deepEqual(map.draggable, [false, true]);
  });

  test("polygon does NOT freeze the camera — repositioning between vertices is legitimate", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "polygon" });
    rd.start(); map.click(0, 0); rd.finish();
    assert.deepEqual(map.draggable, []);
  });

  test("freezeCamera:false opts out entirely", () => {
    const map = fakeMap();
    createRegionDraw(map, { mode: "freehand", freezeCamera: false }).start();
    assert.deepEqual(map.draggable, []);
  });

  test("a map with no setMapDraggable is fine — the tool never feature-detects", () => {
    let handler = null;
    const bare = { captureInteraction(fn) { handler = fn; return () => { handler = null; }; } };
    const rd = createRegionDraw(bare, { mode: "freehand" });
    assert.doesNotThrow(() => { rd.start(); rd.cancel(); });
    assert.equal(handler, null);
  });
});

describe("regionDraw: undo and accessors", () => {
  test("undo drops the last vertex and reports the shortened ring", () => {
    const map = fakeMap();
    const seen = [];
    const rd = createRegionDraw(map, { onPoint: (p) => seen.push(p.length) });
    rd.start();
    map.click(0, 0); map.click(0, 1); map.click(1, 1);
    rd.undo();
    assert.deepEqual(seen, [1, 2, 3, 2]);
    assert.deepEqual(rd.points, [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }]);
  });

  test("undo on a brush drops the stamp with its sample, not just the sample", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "brush" });
    rd.start();
    map.down(0, 0); map.hover(0, 1); map.hover(0, 2);
    assert.equal(rd.rings.length, 3);
    rd.undo();
    assert.equal(rd.points.length, 2);
    assert.equal(rd.rings.length, 2, "a stamp left behind by its sample would be an orphan region");
  });

  test("undo with nothing placed is a no-op", () => {
    const rd = createRegionDraw(fakeMap());
    rd.start();
    assert.doesNotThrow(() => rd.undo());
    assert.deepEqual(rd.points, []);
  });

  test("rings is a COPY — a caller cannot mutate the tool's geometry", () => {
    const map = fakeMap();
    const rd = createRegionDraw(map, { mode: "rectangle" });
    rd.start(); map.click(0, 0); map.click(10, 10);
    rd.rings[0].push({ lat: 99, lng: 99 });
    assert.equal(rd.rings[0].length, 4);
  });

  test("cancel clears the preview so a host erases its overlay", () => {
    const map = fakeMap();
    const seen = [];
    const rd = createRegionDraw(map, { onPreview: (r) => seen.push(r) });
    rd.start(); map.click(0, 0);
    rd.cancel();
    assert.deepEqual(seen.at(-1), []);
  });
});
