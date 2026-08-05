// Layer — the evented base + lifecycle contract (package/layer.js).
//
// A Layer is an event emitter (Leaflet L.Evented style): it fires 'rendered'/'removed' and UI
// subscribes. This is the dependency inversion that severs render code from the UI panel. These
// tests pin the contract that ui/rasterTools.js and future components rely on. Headless — no DOM,
// no google.maps.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Layer, RasterLayer, VectorLayer, registerLayerType, getLayerTypes } from "../src/package/layer.js";
import { ColorScale } from "../src/package/colorScale.js";
import { Dataset } from "../src/package/dataset.js";
import { Stats } from "../src/package/stats.js";
import { RasterGrid, registerMaterializer } from "../src/package/materialize.js";
import { registerMapProvider } from "../src/package/mapProvider.js";

describe("Layer: evented contract", () => {
  test("on/emit delivers the payload with the firing layer attached", () => {
    const layer = new Layer({ type: "userRaster" });
    let got;
    layer.on("rendered", (p) => { got = p; });
    layer.emit("rendered", { pixelData: [1, 2], meta: { width: 3 } });
    assert.deepEqual(got.pixelData, [1, 2]);
    assert.equal(got.meta.width, 3);
    assert.equal(got.layer, layer, "payload.layer is always the emitter, for shared subscribers");
  });

  test("payload.layer cannot be spoofed by the emitter's payload", () => {
    const layer = new Layer({});
    let got;
    layer.on("x", (p) => { got = p; });
    layer.emit("x", { layer: "not-me" });
    assert.equal(got.layer, layer);
  });

  test("emit with no payload still delivers { layer }", () => {
    const layer = new Layer({});
    let got;
    layer.on("removed", (p) => { got = p; });
    layer.emit("removed");
    assert.equal(got.layer, layer);
  });

  test("off stops delivery", () => {
    const layer = new Layer({});
    let n = 0;
    const fn = () => n++;
    layer.on("e", fn);
    layer.emit("e");
    layer.off("e", fn);
    layer.emit("e");
    assert.equal(n, 1);
  });

  test("once fires exactly once", () => {
    const layer = new Layer({});
    let n = 0;
    layer.once("e", () => n++);
    layer.emit("e");
    layer.emit("e");
    assert.equal(n, 1);
  });

  test("emit with no listeners is a harmless no-op (emitter stays lazy)", () => {
    const layer = new Layer({});
    assert.doesNotThrow(() => layer.emit("nobody-home"));
    assert.equal(layer._emitter, null, "emitter not created until on() is called");
  });

  test("a throwing listener does not break other listeners", () => {
    const layer = new Layer({});
    const seen = [];
    layer.on("e", () => { throw new Error("boom"); });
    layer.on("e", () => seen.push("second"));
    layer.emit("e");
    assert.deepEqual(seen, ["second"]);
  });

  test("on/off/emit are chainable", () => {
    const layer = new Layer({});
    assert.equal(layer.on("e", () => {}), layer);
    assert.equal(layer.emit("e"), layer);
    assert.equal(layer.off("e", () => {}), layer);
  });
});

describe("Layer: remove() fires 'removed' synchronously", () => {
  test("order is teardown → 'removed' → unregister", () => {
    const order = [];
    const map = { _unregisterLayer: () => order.push("unregister") };
    const layer = new Layer({ map });
    layer._teardown = () => order.push("teardown");
    layer.on("removed", () => order.push("removed"));
    layer.remove();
    assert.deepEqual(order, ["teardown", "removed", "unregister"]);
  });

  test("'removed' fires even with no _teardown hook", () => {
    const layer = new Layer({ map: { _unregisterLayer() {} } });
    let fired = false;
    layer.on("removed", () => { fired = true; });
    layer.remove();
    assert.ok(fired);
  });

  test("remove() hides the layer before emitting", () => {
    const layer = new Layer({ map: { _unregisterLayer() {} } });
    layer.show();
    let visibleAtEmit;
    layer.on("removed", () => { visibleAtEmit = layer.visible; });
    layer.remove();
    assert.equal(visibleAtEmit, false, "hidden by the time subscribers react");
  });
});

describe("Layer: subclasses inherit the evented contract", () => {
  test("RasterLayer and VectorLayer emit like the base", () => {
    for (const L of [RasterLayer, VectorLayer]) {
      const layer = new L({});
      let fired = false;
      layer.on("rendered", () => { fired = true; });
      layer.emit("rendered");
      assert.ok(fired, `${L.name} is evented`);
    }
  });

  test("active-layer filtering pattern: a stale 'removed' is ignorable by identity", () => {
    // This is the race fix a UI subscriber applies: track the active layer; ignore a 'removed'
    // from a layer that is no longer active (the switched-away one).
    let activeLayer = null;
    const bind = (layer) => {
      layer.on("rendered", () => { activeLayer = layer; });
      layer.on("removed", (p) => { if (p.layer === activeLayer) activeLayer = null; });
    };
    const a = new RasterLayer({ map: { _unregisterLayer() {} } });
    const b = new RasterLayer({ map: { _unregisterLayer() {} } });
    bind(a); bind(b);

    a.emit("rendered");                 // A active
    assert.equal(activeLayer, a);
    b.emit("rendered");                 // switch: B now active
    assert.equal(activeLayer, b);
    a.remove();                         // stale removed from A — must NOT clear B
    assert.equal(activeLayer, b, "a switched-away layer's teardown does not deactivate the panel");
  });
});

describe("Layer: events forward to the owning FimMap under `${type}:${evt}`", () => {
  // The rule that unifies the two event systems. Before it, per-layer lifecycle
  // (layer.on('rendered')) and per-map subsystem events (fim.on('velocity:activated')) were
  // unrelated mechanisms for the same idea, and a consumer had to know which subsystem produced a
  // layer to know which bus to listen on.
  function fakeMap() {
    const seen = [];
    return { seen, emit(evt, payload) { seen.push([evt, payload]); }, _unregisterLayer() {} };
  }

  test("a typed layer's event reaches the map bus, namespaced", () => {
    const map = fakeMap();
    const layer = new RasterLayer({ map, type: "userRaster" });
    layer.emit("rendered", { pixels: 4 });

    assert.equal(map.seen.length, 1);
    const [evt, payload] = map.seen[0];
    assert.equal(evt, "userRaster:rendered");
    assert.equal(payload.pixels, 4);
    assert.equal(payload.layer, layer, "payload still carries the layer");
  });

  test("both subscriptions see the same event", async () => {
    const map = fakeMap();
    const layer = new RasterLayer({ map, type: "userRaster" });
    let perLayer = null;
    layer.on("rendered", (p) => { perLayer = p; });

    layer.emit("rendered", { n: 1 });
    assert.equal(perLayer.n, 1, "per-layer subscriber fired");
    assert.equal(map.seen[0][1].n, 1, "per-map subscriber saw the same payload");
  });

  test("remove() forwards too, so a panel can react per-type", () => {
    const map = fakeMap();
    new RasterLayer({ map, type: "userRaster" }).remove();
    assert.deepEqual(map.seen.map(([e]) => e), ["userRaster:removed"]);
  });

  test("an untyped layer does not forward (nothing to namespace with)", () => {
    const map = fakeMap();
    new Layer({ map }).emit("rendered");
    assert.deepEqual(map.seen, [], "no bare ':rendered' leaking onto the bus");
  });

  test("a layer with no owning map still emits locally and does not throw", () => {
    const layer = new RasterLayer({ type: "userRaster" });
    let fired = false;
    layer.on("rendered", () => { fired = true; });
    assert.doesNotThrow(() => layer.emit("rendered"));
    assert.equal(fired, true);
  });

  test("a map lacking emit() is tolerated (the plain {_unregisterLayer} test doubles)", () => {
    const layer = new RasterLayer({ map: { _unregisterLayer() {} }, type: "userRaster" });
    assert.doesNotThrow(() => layer.emit("rendered"));
  });

  test("forwarding is derived, so a NEW layer type gets map-bus events for free", () => {
    const map = fakeMap();
    new VectorLayer({ map, type: "shp" }).emit("rendered");
    assert.equal(map.seen[0][0], "shp:rendered", "no per-subsystem wiring required");
  });
});

describe("Layer: render/compute pipeline + CRS precondition (DATASET_LAYER_ADT §4)", () => {
  // A minimal Dataset backed by a stub materializer so compute() can force a source without GDAL.
  registerMaterializer("stub-grid", async () => new RasterGrid({
    pixels: new Uint8Array([1, 2, 3, 4]), width: 2, height: 2,
    bounds: { north: 1, south: 0, east: 1, west: 0 }, crs: "EPSG:4326",
  }));
  const stubDs = (crs) => new Dataset({ name: "s", kind: "raster", format: "stub-grid", crs, data: { s: 1 } });
  const fakeMap = (provider) => ({ app: { config: { provider } }, _unregisterLayer() {} });

  test("compute() default materializes the primary source; render() draws after it", async () => {
    const drawn = [];
    class Probe extends Layer { async _draw() { drawn.push(this.result); } }
    const layer = new Probe({ map: fakeMap("google"), type: "probe", sources: [stubDs("EPSG:4326")] });
    await layer.render();
    assert.ok(layer.result instanceof RasterGrid, "compute() forced the source into a grid");
    assert.equal(drawn.length, 1, "_draw ran once, after compute");
    assert.equal(layer.visible, true);
  });

  test("render() reuses an existing result instead of recomputing", async () => {
    let computes = 0;
    class Probe extends Layer { async compute() { computes++; this.result = { ok: true }; return this.result; } }
    const layer = new Probe({ map: fakeMap("google"), type: "probe", sources: [] });
    await layer.render();
    await layer.render();
    assert.equal(computes, 1, "second render() saw a result already present");
  });

  test("the CRS precondition blocks + emits when the provider can't render the source CRS", async () => {
    class Probe extends Layer { async _draw() {} }
    const layer = new Probe({ map: fakeMap("google"), type: "probe", sources: [stubDs("EPSG:26915")] });
    await assert.rejects(() => layer.render(), /cannot render CRS "EPSG:26915".*reproject/is);
  });

  test("a WGS84-family CRS passes the precondition (google accepts 4326/4269)", async () => {
    class Probe extends Layer { async _draw() {} }
    const layer = new Probe({ map: fakeMap("google"), type: "probe", sources: [stubDs("EPSG:4269")] });
    await assert.doesNotReject(() => layer.render());
  });
});

describe("Layer: setSources / deriveSources / render-mode / exclusive (scaffolding)", () => {
  registerMaterializer("stub-src", async () => new RasterGrid({
    pixels: new Uint8Array([1]), width: 1, height: 1,
    bounds: { north: 1, south: 0, east: 1, west: 0 }, crs: "EPSG:4326",
  }));
  const stubDs = (name) => new Dataset({ name, kind: "raster", format: "stub-src", crs: "EPSG:4326", data: { s: 1 } });
  // A map double that records the Dataset ref-count + exclusive-claim calls the Layer drives.
  const recMap = (provider = "google") => {
    const acq = [], rel = [], claims = [];
    return { app: { config: { provider } }, _unregisterLayer() {},
      _acquireDataset: (d) => acq.push(d), _releaseDataset: (d) => rel.push(d),
      _claimExclusive: (l) => claims.push(l), acq, rel, claims };
  };
  class Probe extends Layer { async _draw() { this.drawn = (this.drawn || 0) + 1; } }

  test("setSources swaps sources, acquires the new BEFORE releasing the old, re-renders when live", async () => {
    const map = recMap();
    const a = stubDs("a"), b = stubDs("b");
    const layer = new Probe({ map, type: "probe", sources: [a] });   // constructor acquires a
    await layer.render();                       // now live
    await layer.setSources([b]);
    assert.equal(layer.sources[0], b, "sources replaced");
    assert.deepEqual(map.acq, [a, b], "acquired initial a, then b on swap (b acquired before a released)");
    assert.deepEqual(map.rel, [a], "released the old source");
    assert.equal(layer.drawn, 2, "re-rendered on the live swap");
  });

  test("setSources on a NOT-yet-live layer only stages sources (no render)", async () => {
    const map = recMap();
    const layer = new Probe({ map, type: "probe", sources: [stubDs("a")] });
    await layer.setSources([stubDs("b")]);      // never rendered → wasLive false
    assert.equal(layer.drawn, undefined, "did not draw");
    assert.equal(layer.visible, false);
  });

  test("deriveSources builds new sources FROM the current ones (hot-modify)", async () => {
    const map = recMap();
    const a = stubDs("a");
    const layer = new Probe({ map, type: "probe", sources: [a] });
    let seen = null;
    await layer.deriveSources((cur) => { seen = cur; return [stubDs("b")]; });
    assert.deepEqual(seen, [a], "fn receives the current sources");
    assert.equal(layer.sources[0].name, "b");
  });

  test("_resolveRenderMode: explicit override wins; auto uses provider capability + layer type", () => {
    const raster = new RasterLayer({ map: recMap("google") });    // google exposes setRasterImageUrl
    assert.equal(raster._resolveRenderMode("recreate"), "recreate", "explicit override");
    assert.equal(raster._resolveRenderMode("in-place"), "in-place");
    assert.equal(raster._resolveRenderMode("auto"), "in-place", "raster + capable provider → in-place");
    const base = new Probe({ map: recMap("google") });            // base doesn't render a raster image
    assert.equal(base._resolveRenderMode("auto"), "recreate", "non-raster layer → recreate");
  });

  test("an exclusive layer claims the display slot on render()", async () => {
    const map = recMap();
    const layer = new Probe({ map, type: "velocity", sources: [stubDs("v")], exclusive: true });
    await layer.render();
    assert.deepEqual(map.claims, [layer], "claimed the exclusive slot");
    assert.equal(new Probe({ map, type: "x", sources: [stubDs("y")] }).exclusive, false, "default is non-exclusive");
  });
});

describe("RasterLayer._draw: renders a grid through the provider seam", () => {
  // A fake provider records the raster-image calls; the canvas encode is stubbed (node has no 2d
  // context) so we assert the provider interaction + in-place/recreate behaviour, not pixels.
  const calls = [];
  let hoverUnsubCalls = 0;
  registerMapProvider("draw-spy", {
    create: () => ({}),
    addRasterImage: (map, url, bounds) => { calls.push(["add", url, bounds]); return { h: calls.length }; },
    removeRasterImage: (map, h) => calls.push(["remove", h]),
    setRasterImageUrl: (map, h, url) => { calls.push(["swap", url]); return h; },
    setRasterImageOpacity: (h, opacity) => calls.push(["opacity", h, opacity]),
    fitBounds: () => {},
    onMapMouseMove: () => () => { hoverUnsubCalls++; },
  });
  registerMaterializer("draw-grid", async () => new RasterGrid({
    pixels: Float32Array.from([1, 2, 3, 4]), width: 2, height: 2,
    bounds: { north: 1, south: 0, east: 1, west: 0 }, crs: "EPSG:4326",
  }));
  const map = { app: { config: { provider: "draw-spy" } }, map: {}, _unregisterLayer() {}, _acquireDataset() {}, _releaseDataset() {} };
  const ds = () => new Dataset({ name: "g", kind: "raster", format: "draw-grid", crs: "EPSG:4326", data: { s: 1 } });

  test("first render adds a raster image; a live in-place swap reuses the handle", async () => {
    const realDoc = globalThis.document, realID = globalThis.ImageData;
    globalThis.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
    globalThis.document = { createElement: () => ({ getContext: () => ({ putImageData() {} }), toDataURL: () => "data:image/png;base64,STUB" }) };
    try {
      calls.length = 0;
      const layer = new RasterLayer({ map, type: "userRaster", sources: [ds()] });
      await layer.render();
      assert.equal(calls[0][0], "add", "first render adds");
      assert.equal(calls[0][1], "data:image/png;base64,STUB", "positioned the colorized data URL");
      assert.deepEqual(calls[0][2], { north: 1, south: 0, east: 1, west: 0 }, "over the grid bounds");
      assert.ok(layer.overlay, "overlay handle retained");
      assert.equal(layer.rasterData.length, 4, "hover read-field populated from the grid");

      // A live source swap → in-place update via setRasterImageUrl, not remove+add.
      await layer.setSources([ds()], { render: "in-place" });
      assert.ok(calls.some((c) => c[0] === "swap"), "in-place swap used setRasterImageUrl");
      assert.ok(!calls.slice(1).some((c) => c[0] === "add"), "did not re-add on the in-place path");
    } finally {
      globalThis.document = realDoc; globalThis.ImageData = realID;
    }
  });

  test("remove() tears the overlay down via the provider", async () => {
    const realDoc = globalThis.document, realID = globalThis.ImageData;
    globalThis.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
    globalThis.document = { createElement: () => ({ getContext: () => ({ putImageData() {} }), toDataURL: () => "data:x" }) };
    try {
      calls.length = 0;
      const layer = new RasterLayer({ map, type: "userRaster", sources: [ds()] });
      await layer.render();
      layer.remove();
      assert.ok(calls.some((c) => c[0] === "remove"), "removeRasterImage called on teardown");
      assert.equal(layer.overlay, null);
    } finally {
      globalThis.document = realDoc; globalThis.ImageData = realID;
    }
  });

  test("remove() also tears down an active enableHover() subscription — no leaked listener", async () => {
    const realDoc = globalThis.document, realID = globalThis.ImageData;
    globalThis.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
    globalThis.document = { createElement: () => ({ getContext: () => ({ putImageData() {} }), toDataURL: () => "data:x" }) };
    try {
      calls.length = 0; hoverUnsubCalls = 0;
      const layer = new RasterLayer({ map, type: "userRaster", sources: [ds()] });
      await layer.render();
      layer.enableHover();
      assert.equal(hoverUnsubCalls, 0, "not torn down yet");
      layer.remove();
      assert.equal(hoverUnsubCalls, 1, "_draw()'s _teardown calls disableHover() automatically");
    } finally {
      globalThis.document = realDoc; globalThis.ImageData = realID;
    }
  });

  test("hide()/show() actually toggle the overlay via the provider, not just .visible", async () => {
    const realDoc = globalThis.document, realID = globalThis.ImageData;
    globalThis.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
    globalThis.document = { createElement: () => ({ getContext: () => ({ putImageData() {} }), toDataURL: () => "data:x" }) };
    try {
      calls.length = 0;
      const layer = new RasterLayer({ map, type: "userRaster", sources: [ds()], opacity: 0.7 });
      await layer.render();
      const overlay = layer.overlay;

      calls.length = 0;
      layer.hide();
      assert.equal(layer.visible, false);
      assert.deepEqual(calls, [["opacity", overlay, 0]], "opacity dropped to 0 via the provider");
      assert.equal(layer.overlay, overlay, "the overlay handle is NOT torn down by hide()");

      calls.length = 0;
      layer.show();
      assert.equal(layer.visible, true);
      assert.deepEqual(calls, [["opacity", overlay, 0.7]], "opacity restored to the configured value, not 1");
    } finally {
      globalThis.document = realDoc; globalThis.ImageData = realID;
    }
  });
});

describe("RasterLayer.valueAt: pixel lookup + noData tolerance", () => {
  const map = { app: { config: {} }, _unregisterLayer() {}, _acquireDataset() {}, _releaseDataset() {} };
  const layer = () => {
    const l = new RasterLayer({ map, type: "userRaster" });
    l.rasterData = [1, 2, -9999, 4];   // 2x2: row0 = [1,2], row1 = [-9999,4]
    l.meta = { bw: 0, bs: 0, be: 2, bn: 2, width: 2, height: 2, noData: -9999 };
    return l;
  };

  test("returns the nearest cell's value inside the footprint", () => {
    assert.equal(layer().valueAt(1.5, 0.5), 1);   // row0,col0
  });

  test("returns null outside the footprint", () => {
    assert.equal(layer().valueAt(5, 5), null);
  });

  test("an exact noData match returns null by default (tolerance 0)", () => {
    assert.equal(layer().valueAt(0.5, 0.5), null);   // row1,col0 = -9999
  });

  test("noDataTolerance widens the match — a near-sentinel value (resampling drift) also reads null", () => {
    const l = layer();
    l.rasterData = [1, 2, -9998.5, 4];   // drifted 0.5 off the exact sentinel
    assert.equal(l.valueAt(0.5, 0.5), -9998.5, "exact match (the default) doesn't catch drift");
    assert.equal(l.valueAt(0.5, 0.5, { noDataTolerance: 1 }), null, "tolerance:1 catches it");
  });

  test("hitTest() always uses the default (exact) tolerance — unaffected by valueAt()'s optional widening", () => {
    const l = layer();
    l.rasterData = [1, 2, -9998.5, 4];
    assert.equal(l.hitTest(0.5, 0.5), true, "still hits — a click resolution doesn't silently widen");
  });
});

describe("RasterLayer.enableHover/disableHover: standardized hover wiring (was hand-rolled per-layer, e.g. DepthLayer)", () => {
  let moveCb = null;
  let unsubCalls = 0;
  registerMapProvider("hover-spy", {
    create: () => ({}),
    onMapMouseMove: (m, cb) => { moveCb = cb; return () => { unsubCalls++; moveCb = null; }; },
  });
  const map = { app: { config: { provider: "hover-spy" } }, map: {}, _unregisterLayer() {}, _acquireDataset() {}, _releaseDataset() {} };
  const layer = () => {
    const l = new RasterLayer({ map, type: "userRaster" });
    l.rasterData = [1, 2, -9999, 4];
    l.meta = { bw: 0, bs: 0, be: 2, bn: 2, width: 2, height: 2, noData: -9999 };
    return l;
  };

  test("wires onMapMouseMove and emits 'hover' with a ready {lat,lng,value,text}", () => {
    const l = layer();
    const events = [];
    l.on("hover", (e) => events.push(e));   // emit() also attaches `layer: this` — not asserted here
    l.enableHover();
    assert.equal(typeof moveCb, "function", "listener installed");
    moveCb({ lat: 1.5, lng: 0.5 });   // → value 1 (row0,col0)
    assert.equal(events.length, 1);
    const { lat, lng, value, text } = events[0];
    assert.deepEqual({ lat, lng, value, text }, { lat: 1.5, lng: 0.5, value: 1, text: "1" });
  });

  test("formatValue/isEmpty options are honored (the DepthLayer-specific rules, now just parameters)", () => {
    const l = layer();
    const events = [];
    l.on("hover", (e) => events.push(e));
    l.enableHover({ formatValue: (v) => `${v.toFixed(1)}ft`, isEmpty: (v) => v === 2 });
    moveCb({ lat: 1.5, lng: 0.5 });   // value 1
    moveCb({ lat: 1.5, lng: 1.5 });   // value 2 → isEmpty → treated as absent
    assert.equal(events[0].text, "1.0ft");
    assert.equal(events[1].value, null);
    assert.equal(events[1].text, "—");
  });

  test("is idempotent — a second enableHover() replaces the subscription instead of stacking it", () => {
    const l = layer();
    l.enableHover();
    unsubCalls = 0;
    l.enableHover();
    assert.equal(unsubCalls, 1, "the first subscription was torn down before the second was installed");
  });

  test("disableHover() unsubscribes; a subsequent move is a no-op", () => {
    const l = layer();
    l.enableHover();
    l.disableHover();
    assert.equal(moveCb, null, "the provider's own unsubscribe ran");
  });
});

describe("VectorLayer: hide()/show() actually remove/re-add via the provider", () => {
  const calls = [];
  registerMapProvider("vector-draw-spy", {
    create: () => ({}),
    addVector: (map, geojson, opts) => { calls.push(["add", geojson, opts]); return { h: calls.length }; },
    removeVector: (map, h) => calls.push(["remove", h]),
    fitBounds: () => {},
  });
  const map = { map: {}, app: { config: { provider: "vector-draw-spy" } }, _unregisterLayer() {} };
  const geojson = { type: "FeatureCollection", features: [] };
  const vecDs = () => new Dataset({ name: "v", kind: "vector", format: "geojson", crs: "EPSG:4326", data: geojson });

  test("hide() removes the dataLayer; show() rebuilds it via addVector", () => {
    calls.length = 0;
    const layer = new VectorLayer({ map, type: "geojson", sources: [vecDs()] });
    layer.render();
    const firstHandle = layer.dataLayer;
    assert.ok(firstHandle, "render() added a dataLayer");

    calls.length = 0;
    layer.hide();
    assert.equal(layer.visible, false);
    assert.deepEqual(calls, [["remove", firstHandle]], "removeVector called on hide()");
    assert.equal(layer.dataLayer, null, "the handle is dropped so it isn't reused stale");

    calls.length = 0;
    layer.show();
    assert.equal(layer.visible, true);
    assert.equal(calls[0][0], "add", "addVector called on show()");
    assert.ok(layer.dataLayer, "a fresh dataLayer handle is back");
  });
});

describe("RasterLayer: owns a ColorScale (read-models + live-repaint seam)", () => {
  const pixels = Float32Array.from([0, 5, 10, -9999]);
  const meta = { width: 2, height: 2, bw: 0, bs: 0, be: 2, bn: 2, noData: -9999 };

  test("getLegend() is null until a ColorScale is attached, then derived from it", () => {
    const layer = new RasterLayer({ map: { _unregisterLayer() {} } });
    assert.equal(layer.getLegend(), null);
    const cs = new ColorScale({ palette: "viridis", min: 0, max: 10 });
    layer.set({ colorScale: cs });
    const legend = layer.getLegend();
    assert.ok(legend && Array.isArray(legend.stops) && legend.stops.length > 0);
    assert.equal(legend.unit, cs.unit);
  });

  test("editing the ColorScale emits 'restyle' (→ map bus 'userRaster:restyle') — the repaint seam", () => {
    const seen = [];
    const map = { emit: (e, p) => seen.push([e, p]), _unregisterLayer() {} };
    const layer = new RasterLayer({ map, type: "userRaster" });
    let local = 0;
    layer.on("restyle", () => { local++; });
    const cs = new ColorScale({ palette: "blues", min: 0, max: 1 });
    layer.set({ colorScale: cs });
    cs.set({ palette: "viridis" });           // a user palette edit
    assert.equal(local, 1, "layer's own emitter fired");
    assert.ok(seen.some(([e]) => e === "userRaster:restyle"), "forwarded to the map bus");
  });

  test("re-setting the ColorScale detaches the old listener (no leak / double-fire)", () => {
    const layer = new RasterLayer({ map: { _unregisterLayer() {} }, type: "userRaster" });
    let fires = 0;
    layer.on("restyle", () => { fires++; });
    const a = new ColorScale({ palette: "blues", min: 0, max: 1 });
    layer.set({ colorScale: a });
    layer.set({ colorScale: new ColorScale({ palette: "reds", min: 0, max: 1 }) });
    a.set({ palette: "viridis" });            // the OLD scale changes → must NOT restyle
    assert.equal(fires, 0);
  });

  test("getStats() classifies by the attached ColorScale, null before pixels load", async () => {
    const layer = new RasterLayer({ map: { _unregisterLayer() {} } });
    assert.equal(await layer.getStats(), null);
    layer.rasterData = pixels;
    layer.meta = meta;
    layer.set({ colorScale: new ColorScale({ palette: "viridis", min: 0, max: 10 }) });
    const stats = await layer.getStats();
    assert.ok(stats && typeof stats.min === "number");
    assert.equal(stats.max, 10);
  });
});

describe("VectorLayer.getStats() — headless, from the GeoJSON source", () => {
  // Found in manual browser testing: this returned null because Stats.vector only understood a
  // google.maps.Data layer — a provider leak in an otherwise headless class.
  const fc = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { n: "sq" }, geometry: { type: "Polygon",
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] } },
      { type: "Feature", properties: { n: "ln" }, geometry: { type: "LineString",
        coordinates: [[0, 0], [0, 1]] } },
      { type: "Feature", properties: { n: "pt" }, geometry: { type: "Point",
        coordinates: [2, 3] } },
    ],
  };

  test("counts by geometry type, with area/length/bbox", async () => {
    const layer = new VectorLayer({ sources: [{ data: fc, bounds: {} }] });
    const s = await layer.getStats();
    assert.ok(s, "no longer null");
    assert.equal(s.kind, "vector");
    assert.equal(s.featureCount, 3);
    assert.deepEqual(s.byType, { polygon: 1, line: 1, point: 1 });
    assert.ok(s.area > 0, "polygon area measured");
    assert.ok(s.length > 0, "line length measured");
    assert.deepEqual(s.bbox, { north: 3, south: 0, east: 2, west: 0 });
    assert.equal(typeof s.describe(), "string");
  });

  test("works with no map and without ever rendering (headless)", async () => {
    const layer = new VectorLayer({ sources: [{ data: fc, bounds: {} }] });
    assert.equal(layer.visible, false);
    assert.equal((await layer.getStats()).featureCount, 3);
  });

  test("honours a filter", async () => {
    const layer = new VectorLayer({ sources: [{ data: fc, bounds: {} }] });
    const s = await layer.getStats({ filter: (f) => f?.properties?.n === "pt" });
    assert.equal(s.featureCount, 1);
    assert.deepEqual(s.byType, { polygon: 0, line: 0, point: 1 });
  });

  test("null when the layer has no source", async () => {
    assert.equal(await new VectorLayer({}).getStats(), null);
  });
});

describe("Stats.vector accepts every feature shape (not just google.maps.Data)", () => {
  const poly = { type: "Feature", properties: {}, geometry: { type: "Polygon",
    coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] } };
  const fc = { type: "FeatureCollection", features: [poly] };

  test("FeatureCollection / Feature / Feature[] all agree", () => {
    const a = Stats.vector(fc), b = Stats.vector(poly), c = Stats.vector([poly]);
    assert.equal(a.featureCount, 1);
    assert.equal(b.featureCount, 1);
    assert.equal(c.featureCount, 1);
    assert.equal(Math.round(a.area), Math.round(b.area));
  });

  test("a google.maps.Data-shaped layer still works (the app's call site)", () => {
    // Minimal fake matching the Google API surface normalizeFeatures discriminates on.
    const latLng = (lng, lat) => ({ lat: () => lat, lng: () => lng });
    const ringObj = { getArray: () => [latLng(0,0), latLng(0,1), latLng(1,1), latLng(1,0)] };
    const fakeData = {
      getFeatureById() { return null; },
      forEach(cb) {
        cb({ getGeometry: () => ({ getType: () => "Polygon", getArray: () => [ringObj] }) });
      },
    };
    const s = Stats.vector(fakeData);
    assert.equal(s.featureCount, 1);
    assert.deepEqual(s.byType, { polygon: 1, line: 0, point: 0 });
    assert.ok(s.area > 0);
    // Same square as the GeoJSON above → same area, proving the two paths agree.
    assert.equal(Math.round(s.area), Math.round(Stats.vector(fc).area));
  });

  test("empty / null sources are a zeroed Stats, not a throw", () => {
    for (const empty of [null, undefined, [], { type: "FeatureCollection", features: [] }]) {
      const s = Stats.vector(empty);
      assert.equal(s.featureCount, 0);
      assert.equal(s.bbox, null);
    }
  });
});

describe("layer.toSpec() → map2.addLayer(spec) — transfer without cloning", () => {
  const fc = { type: "FeatureCollection", features: [
    { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [1, 2] } }] };
  const mkDs = () => new Dataset({ name: "t.geojson", kind: "vector", data: fc, bounds: {} });

  test("toSpec is a plain, structured-cloneable description", () => {
    const l = new VectorLayer({ sources: [mkDs()], type: "vector" });
    l.set({ color: "#ff0000", opacity: 0.4 });
    const spec = l.toSpec();
    assert.equal(spec.type, "vector");
    assert.equal(spec.settings.color, "#ff0000");
    assert.equal(spec.settings.opacity, 0.4);
    assert.equal(spec.sources.length, 1);
    assert.doesNotThrow(() => structuredClone({ ...spec, sources: [] }),
      "everything but the live Datasets survives structured clone");
  });

  test("a raster spec carries the ColorScale as a DESCRIPTION, not a handle", () => {
    const l = new RasterLayer({ map: { _unregisterLayer() {} } });
    l.set({ colorScale: new ColorScale({ palette: "viridis", min: 0, max: 46, continuous: true, unit: "m" }) });
    const spec = l.toSpec();
    assert.equal(typeof spec.colorScale, "object");
    assert.equal(spec.colorScale.palette, "viridis");
    assert.equal(spec.colorScale.continuous, true);
    assert.equal(spec.colorScale.unit, "m");
    assert.ok(!(spec.colorScale instanceof ColorScale), "a description, so it cannot be shared by accident");
  });

  test("ColorScale round-trips through toJSON/fromJSON, including colorStops mode", () => {
    const cs = new ColorScale({ palette: "blues", min: 0, max: 10 });
    cs.setColorStops([-1, 0, 1], ["#015498", "#ffffff", "#21bf90"]);
    cs.set({ continuous: true, unit: "m" });
    const back = ColorScale.fromJSON(cs.toJSON());
    assert.equal(back.unit, "m");
    assert.equal(back.continuous, true);
    assert.deepEqual(back.getRgb(-0.5), cs.getRgb(-0.5), "same colours after the round trip");
    assert.deepEqual(back.getRgb(0.5), cs.getRgb(0.5));
  });

  test("the rebuilt scale DIVERGES — editing one never recolours the other", () => {
    const cs = new ColorScale({ palette: "viridis", min: 0, max: 10 });
    const copy = ColorScale.fromJSON(cs.toJSON());
    assert.notEqual(copy, cs, "a new instance, not the same object");
    copy.set({ palette: "heat" });
    assert.equal(cs.palette, "viridis", "the original is untouched");
  });
});

describe("getLayerTypes() — the public read of the layer-type registry", () => {
  test("lists the built-ins, and anything a host registers", () => {
    const before = getLayerTypes();
    assert.ok(Array.isArray(before));
    // layer.js registers these two itself; the rest self-register from their own modules on import.
    assert.ok(before.includes("vector"), "the one generic type the engine always registers");
    assert.ok(before.includes("raster"));

    registerLayerType("test-only-type", () => new Layer({ type: "test-only-type" }));
    assert.ok(getLayerTypes().includes("test-only-type"), "a host's own type shows up");
    assert.equal(getLayerTypes().length, before.length + 1);
  });

  test("returns a copy — mutating the result cannot corrupt the registry", () => {
    const list = getLayerTypes();
    list.push("not-real");
    assert.ok(!getLayerTypes().includes("not-real"));
  });
});

describe("VectorLayer: colours features by a property through a ColorScale", () => {
  // The same ColorScale a raster uses. Nothing in it is pixel-specific — it maps a value to a
  // colour — so a feature property is as good a source of that value as a pixel is.
  const styleCalls = [];
  registerMapProvider("vector-style-spy", {
    create: () => ({}),
    addVector: (map, geojson, opts) => { styleCalls.push(opts.style); return { h: styleCalls.length }; },
    removeVector: () => {},
    fitBounds: () => {},
  });
  const map = { map: {}, app: { config: { provider: "vector-style-spy" } }, _unregisterLayer() {} };

  const feat = (depth) => ({
    type: "Feature", properties: depth === undefined ? {} : { depth },
    geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] },
  });
  const fc = { type: "FeatureCollection", features: [feat(0), feat(5), feat(10), feat(undefined)] };
  const vecDs = () => new Dataset({ name: "v", kind: "vector", format: "geojson", crs: "EPSG:4326", data: fc });
  const scale = () => new ColorScale({ palette: "blues", min: 0, max: 10, continuous: true });

  const mk = (extra = {}) => {
    styleCalls.length = 0;
    return new VectorLayer({ map, type: "geojson", sources: [vecDs()], ...extra });
  };

  test("with no scale the style stays a plain object — unchanged behaviour", () => {
    const layer = mk();
    layer.render({ style: { fillColor: "#abc" } });
    assert.deepEqual(styleCalls[0], { fillColor: "#abc" }, "no function, no grading");
  });

  test("scale + colorBy makes the provider style a per-feature function", () => {
    const layer = mk({ colorScale: scale(), colorBy: "depth" });
    layer.render();
    const style = styleCalls[0];
    assert.equal(typeof style, "function", "the provider seam's per-feature style form");

    const lo = style({ feature: fc.features[0], index: 0 });
    const hi = style({ feature: fc.features[2], index: 2 });
    assert.ok(lo.fillColor && hi.fillColor);
    assert.notEqual(lo.fillColor, hi.fillColor, "different values get different colours");
    assert.equal(lo.fillColor, lo.strokeColor, "fill and stroke both follow the value");
  });

  test("a feature missing the property keeps the base style rather than a made-up colour", () => {
    const layer = mk({ colorScale: scale(), colorBy: "depth" });
    layer.render({ style: { fillColor: "#base", strokeWidth: 3 } });
    const style = styleCalls[0];
    const missing = style({ feature: fc.features[3], index: 3 });
    assert.equal(missing.fillColor, "#base", "not graded");
    const graded = style({ feature: fc.features[1], index: 1 });
    assert.equal(graded.strokeWidth, 3, "the flat style still merges under the graded colour");
    assert.notEqual(graded.fillColor, "#base", "…but the colour is the scale's");
  });

  test("missingColor paints the no-value features when the scale declares one", () => {
    const cs = new ColorScale({ palette: "blues", min: 0, max: 10, continuous: true, missingColor: "#cccccc" });
    const layer = mk({ colorScale: cs, colorBy: "depth" });
    layer.render({ style: { fillColor: "#base" } });
    const style = styleCalls[0];
    assert.equal(style({ feature: fc.features[3], index: 3 }).fillColor, "#cccccc",
      "explicitly rendered as 'no data', not left looking like the base style");
    assert.notEqual(style({ feature: fc.features[1], index: 1 }).fillColor, "#cccccc",
      "a real value is still coloured by the ramp");

    // Settable after the fact, through the same one-knob path, and it survives a mode switch:
    // it answers a question none of the three colouring modes can.
    layer.set({ missingColor: "#ff0000" });
    layer.set({ palette: "viridis" });
    assert.equal(layer.colorScale.missingColor, "#ff0000");
    layer.set({ missingColor: null });
    assert.equal(layer.colorScale.missingColor, null, "back to 'let the consumer decide'");
  });

  test("colorBy alone (or a scale alone) does not grade — both are needed", () => {
    const onlyBy = mk({ colorBy: "depth" });
    onlyBy.render();
    assert.notEqual(typeof styleCalls[0], "function");

    const onlyScale = mk({ colorScale: scale() });
    onlyScale.render();
    assert.notEqual(typeof styleCalls[0], "function");
  });

  test("getLegend() works on a vector layer, like it does on a raster", () => {
    const layer = mk({ colorScale: scale(), colorBy: "depth" });
    const legend = layer.getLegend();
    assert.ok(legend, "a Legend, derived from the same scale");
    assert.ok(legend.stops.length > 0);
    assert.equal(mk().getLegend(), null, "null until a scale is attached");
  });

  test("editing the scale restyles a live layer and emits 'restyle'", () => {
    const layer = mk({ colorScale: scale(), colorBy: "depth" });
    layer.render();
    let restyled = 0;
    layer.on("restyle", () => { restyled++; });

    styleCalls.length = 0;
    layer.colorScale.set({ palette: "viridis" });
    assert.equal(restyled, 1, "one event for the whole patch");
    assert.equal(styleCalls.length, 1, "the overlay was re-added through the new resolution");
  });

  test("set({ colorScale, colorBy }) routes through settings, and rejects a non-ColorScale", () => {
    const layer = mk();
    layer.set({ colorScale: scale(), colorBy: "depth" });   // settings.set is synchronous
    assert.equal(layer.colorBy, "depth");
    assert.ok(layer.colorScale);
    // The same guard the raster path has: a palette NAME here is the classic mistake, and it must
    // fail loudly instead of half-attaching.
    assert.throws(() => layer.set({ colorScale: "viridis" }), /expected a ColorScale instance/);
    assert.ok(layer.colorScale, "the previous scale is intact after the rejected write");
  });

  test("getStats() buckets byClass with the scale that is colouring the features", async () => {
    const layer = mk({ colorScale: new ColorScale({ palette: "blues", min: 0, max: 10 }), colorBy: "depth" });
    const s = await layer.getStats();
    assert.equal(s.featureCount, 4, "every feature counts, graded or not");
    assert.ok(Array.isArray(s.byClass) && s.byClass.length > 0);
    const bucketed = s.byClass.reduce((n, c) => n + c.count, 0);
    assert.equal(bucketed, 3, "the property-less feature lands in no bucket");
    assert.equal((await mk().getStats()).byClass, undefined, "no scale, no byClass");
  });
});

describe("Layer: chainable ops (immediate application, one render)", () => {
  // The ops live on Dataset; these are the same ops reachable from the layer you already have.
  // What is "immediate" is the SOURCE rewrite — the redraw still waits for render(), and the data
  // still computes lazily at the terminal inside compute().
  const grid = () => new RasterGrid({
    pixels: Float32Array.from([1, 2, 3, 4]), width: 2, height: 2,
    bounds: { north: 2, south: 0, east: 2, west: 0 }, crs: "EPSG:4326",
  });
  const rasterDs = () => Dataset.fromGrid(grid(), { name: "r" });
  const bbox = { north: 1, south: 0, east: 1, west: 0 };

  test("each op returns the layer, so they chain", () => {
    const layer = new RasterLayer({ sources: [rasterDs()] });
    const out = layer.clip(bbox).reclassify([{ min: 0, max: 10, value: 1 }]);
    assert.equal(out, layer, "chainable");
  });

  test("sources are rewritten NOW — not queued until render", () => {
    const layer = new RasterLayer({ sources: [rasterDs()] });
    const before = layer.dataset;
    layer.clip(bbox);
    assert.notEqual(layer.dataset, before, "layer.dataset already reflects the op");
    assert.equal(layer.dataset.kind, "raster");
  });

  test("an op invalidates the memoized compute and marks the layer dirty", async () => {
    // A headless drawable: the real raster _draw() needs a canvas, and this is about the op
    // bookkeeping, not pixels.
    registerMapProvider("op-spy", { create: () => ({}), acceptsCRS: () => true });
    class Drawable extends Layer { async _draw() {} }
    const map = { map: {}, app: { config: { provider: "op-spy" } }, _unregisterLayer() {} };
    const layer = new Drawable({ map, sources: [rasterDs()] });

    await layer.compute();
    assert.ok(layer.result, "computed once");
    assert.equal(layer.dirty, false);

    layer.clip(bbox);
    assert.equal(layer.result, null, "the stale grid is dropped, so render() recomputes");
    assert.equal(layer.dirty, true, "what is drawn no longer matches the sources");

    await layer.render();
    assert.equal(layer.dirty, false, "render() reconciles them");
    assert.ok(layer.result, "and it recomputed on the way through");
  });

  test("data stays lazy — chaining computes nothing until a terminal", () => {
    const ds = rasterDs();
    const layer = new RasterLayer({ sources: [ds] });
    layer.clip(bbox).mask([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }]);
    assert.equal(layer.dataset.isMaterialized, false, "the derived tail is unforced");
    assert.equal(layer.result, null);
  });

  test("ops apply across ALL sources, so a multi-source layer stays aligned", () => {
    const layer = new RasterLayer({ sources: [rasterDs(), rasterDs()] });
    const before = [...layer.sources];
    layer.clip(bbox);
    assert.equal(layer.sources.length, 2);
    for (let i = 0; i < 2; i++) assert.notEqual(layer.sources[i], before[i], `source ${i} was derived`);
  });

  test("a bad op throws AT THE CALL, leaving the layer untouched", () => {
    const vecDs = new Dataset({ name: "v", kind: "vector", format: "geojson", crs: "EPSG:4326",
      data: { type: "FeatureCollection", features: [] } });
    const layer = new VectorLayer({ sources: [vecDs] });
    const before = layer.dataset;
    assert.throws(() => layer.clip(bbox), /raster-only op/, "the Dataset's own kind gate fires");
    assert.equal(layer.dataset, before, "no partial application");
    assert.equal(layer.dirty, false);
  });

  test("reset() returns to the sources the layer was built from", async () => {
    const original = rasterDs();
    const layer = new RasterLayer({ sources: [original] });
    layer.clip(bbox).slope();
    assert.notEqual(layer.dataset, original);

    await layer.reset();
    assert.equal(layer.dataset, original, "back to the pristine source, not the derived tail");
    assert.equal(layer.dirty, false);
    await layer.reset();   // idempotent
    assert.equal(layer.dataset, original);
  });

  test("rasterize refuses to chain, and says what to do instead", () => {
    const layer = new RasterLayer({ sources: [rasterDs()] });
    assert.throws(() => layer.rasterize(), /changes a Dataset's kind/);
    assert.throws(() => layer.rasterize(), /fim\.addLayer/, "names the alternative");
  });

  test("an op on a layer with no sources throws rather than silently doing nothing", () => {
    assert.throws(() => new RasterLayer({}).clip(bbox), /has no source Dataset/);
  });
});

describe("registries hang off the type they serve", () => {
  // The barrel exports TYPES; the functions that act on a type are statics on it. One import (the
  // class you already have) instead of loose top-level verbs whose owner was never in doubt.
  test("Layer.registerType / Layer.types()", () => {
    const before = Layer.types();
    assert.ok(before.includes("vector") && before.includes("raster"));
    Layer.registerType("static-registry-probe", () => new Layer({ type: "static-registry-probe" }));
    assert.ok(Layer.types().includes("static-registry-probe"));
    assert.equal(Layer.types().length, before.length + 1);
  });

  test("ColorScale.registerPalette / ColorScale.palettes()", () => {
    assert.ok(ColorScale.palettes().includes("viridis"), "built-ins are listed");
    assert.ok(!ColorScale.palettes().includes("probe-ramp"));
    ColorScale.registerPalette("probe-ramp", ["#000000", "#ffffff"]);
    assert.ok(ColorScale.palettes().includes("probe-ramp"));
    // palettes() subsumes the old hasPalette(): a list answers "is it available" on its own.
    const cs = new ColorScale({ palette: "probe-ramp", min: 0, max: 1 });
    assert.ok(cs.getColor(0.5), "the registered ramp really colours");
  });

  test("Dataset.formats() / Dataset.registerMaterializer", async () => {
    // (The built-in decoders come from importing io/materializers.js, which this file does not —
    // materialize.test.mjs covers that. Here it is the registry contract itself.)
    assert.ok(!Dataset.formats().includes("probe-fmt"));
    Dataset.registerMaterializer("probe-fmt", async () => new RasterGrid({
      pixels: Float32Array.from([1]), width: 1, height: 1,
    }));
    assert.ok(Dataset.formats().includes("probe-fmt"));
    const ds = new Dataset({ name: "p", kind: "raster", format: "probe-fmt", data: new ArrayBuffer(0) });
    assert.equal((await ds.grid()).width, 1, "the registered decoder is what forcing dispatches to");
  });
});
