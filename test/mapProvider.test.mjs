// mapProvider.js — the map-creation seam that lets mount() boot a map with no runtime.
//
// This is what turns `mount(el, { apiKey })` into a working map for a plain consumer, instead of
// making everyone import a Maps Loader and hand the result back. The Google provider can't run
// headlessly (it loads the real SDK), so the tests register a fake provider and exercise the
// registry, the apiKey-by-provider rule, and the error paths.

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  createMap, registerMapProvider, getMapProvider, mapProviderNames, providerRequiresApiKey,
  styleToGoogle, styleToLeaflet, featuresOf, resolveFeatureStyle, providerAcceptsCRS,
} from "../src/package/mapProvider.js";

describe("map provider registry", () => {
  test("google and leaflet are both built in", () => {
    assert.ok(getMapProvider("google"));
    assert.ok(getMapProvider("leaflet"));
    assert.ok(mapProviderNames().includes("google"));
    assert.ok(mapProviderNames().includes("leaflet"));
  });

  test("apiKey is required BY PROVIDER: google yes, leaflet no", () => {
    assert.equal(providerRequiresApiKey("google"), true);
    assert.equal(providerRequiresApiKey("leaflet"), false);
  });

  test("registering needs a name and a create()", () => {
    assert.throws(() => registerMapProvider("", { create() {} }), /name and a create/);
    assert.throws(() => registerMapProvider("x", {}), /name and a create/);
  });

  test("a registered provider defaults requiresApiKey to false (the Leaflet case)", () => {
    registerMapProvider("fake-leaflet", { create: (el, o) => ({ el, o }) });
    assert.equal(providerRequiresApiKey("fake-leaflet"), false);
  });
});

describe("providerAcceptsCRS: the WGS84-family check both built-ins share", () => {
  test("accepts EPSG:4326/4269 and null (unknown), rejects an unrelated CRS", () => {
    for (const name of ["google", "leaflet"]) {
      assert.equal(providerAcceptsCRS(name, "EPSG:4326"), true, name);
      assert.equal(providerAcceptsCRS(name, "EPSG:4269"), true, name);
      assert.equal(providerAcceptsCRS(name, null), true, `${name}: unknown CRS is permissive`);
      assert.equal(providerAcceptsCRS(name, "EPSG:26915"), false, name);
    }
  });

  test("is case-insensitive — a differently-cased CRS string is still the same CRS", () => {
    // Regression: Dataset.reproject() now normalizes to uppercase itself, but a CRS can also arrive
    // here from elsewhere (e.g. GDAL geokey reading) case-unnormalized — this check should not be the
    // thing that turns a real WGS84 CRS into a spurious "cannot render" failure.
    assert.equal(providerAcceptsCRS("leaflet", "epsg:4326"), true);
    assert.equal(providerAcceptsCRS("google", "Epsg:4269"), true);
  });
});

describe("createMap", () => {
  const el = { tagName: "DIV" };   // createMap never touches the element; the provider does

  beforeEach(() => {
    registerMapProvider("fake", {
      create: (element, options) => ({ element, options, kind: "fake-map" }),
    });
  });

  test("dispatches to the named provider and returns its map object", async () => {
    const map = await createMap(el, { provider: "fake", center: { lat: 1, lng: 2 }, zoom: 7 });
    assert.equal(map.kind, "fake-map");
    assert.equal(map.element, el);
    assert.equal(map.options.zoom, 7);
  });

  test("provider defaults to 'google'", async () => {
    // Google's create() would try to load the real SDK, so just assert the dispatch target — an
    // unknown apiKey means we never get past validation into the loader.
    await assert.rejects(() => createMap(el, {}), /requires an apiKey/);
  });

  test("a provider that needs no key boots with none", async () => {
    const map = await createMap(el, { provider: "fake" });
    assert.equal(map.kind, "fake-map");
  });

  test("unknown provider throws a coded, listy error", async () => {
    await assert.rejects(() => createMap(el, { provider: "nope" }), (e) => {
      assert.equal(e.code, "config-invalid");
      assert.match(e.message, /unknown map provider "nope"/);
      assert.match(e.message, /Registered:/);
      return true;
    });
  });

  test("a required apiKey that is missing is a coded error, not a loader crash", async () => {
    registerMapProvider("keyed", { requiresApiKey: true, create: () => ({}) });
    await assert.rejects(() => createMap(el, { provider: "keyed" }), (e) => {
      assert.equal(e.code, "config-invalid");
      assert.match(e.message, /requires an apiKey/);
      return true;
    });
    // …but present, it boots.
    const map = await createMap(el, { provider: "keyed", apiKey: "x" });
    assert.ok(map);
  });

  test("no element is a coded error", async () => {
    await assert.rejects(() => createMap(null, { provider: "fake" }), /no element/);
  });

  test("options pass through untouched (center/zoom/mapId/mapOptions)", async () => {
    const opts = { provider: "fake", center: { lat: 3, lng: 4 }, zoom: 9, mapId: "abc",
                   mapOptions: { tilt: 45 } };
    const map = await createMap(el, opts);
    assert.deepEqual(map.options.center, { lat: 3, lng: 4 });
    assert.equal(map.options.mapId, "abc");
    assert.deepEqual(map.options.mapOptions, { tilt: 45 });
  });
});

describe("google provider: vector contract", () => {
  test("exposes addVector / removeVector / fitBounds for the Layer model", () => {
    const g = getMapProvider("google");
    assert.equal(typeof g.addVector, "function");
    assert.equal(typeof g.removeVector, "function");
    assert.equal(typeof g.fitBounds, "function");
  });
});

describe("google provider: raster-image contract", () => {
  test("exposes addRasterImage / removeRasterImage / setRasterImageOpacity / setRasterImageUrl / onMapMouseMove", () => {
    const g = getMapProvider("google");
    assert.equal(typeof g.addRasterImage, "function");
    assert.equal(typeof g.removeRasterImage, "function");
    assert.equal(typeof g.setRasterImageOpacity, "function");
    assert.equal(typeof g.setRasterImageUrl, "function");
    assert.equal(typeof g.onMapMouseMove, "function");
  });

  test("removeRasterImage tears the handle down via setMap(null)", () => {
    const g = getMapProvider("google");
    let calledWith;
    const fakeHandle = { setMap: (m) => { calledWith = m; } };
    g.removeRasterImage({}, fakeHandle);
    assert.equal(calledWith, null);
  });

  test("removeRasterImage with no handle is a no-op (no throw)", () => {
    const g = getMapProvider("google");
    g.removeRasterImage({}, null);
  });

  test("setRasterImageOpacity delegates to the handle's setOpacity", () => {
    const g = getMapProvider("google");
    let got;
    g.setRasterImageOpacity({ setOpacity: (o) => { got = o; } }, 0.5);
    assert.equal(got, 0.5);
  });

  test("setRasterImageOpacity with no handle is a no-op (no throw)", () => {
    const g = getMapProvider("google");
    g.setRasterImageOpacity(null, 0.5);
  });
});

describe("leaflet provider: vector contract", () => {
  // The map-creating half needs a DOM (Leaflet touches window/document), so it is browser-verified,
  // not here. But the vector contract's SHAPE and the pure bounds math run fine in node.
  test("exposes the SAME vector contract as google", () => {
    const l = getMapProvider("leaflet");
    assert.equal(typeof l.addVector, "function");
    assert.equal(typeof l.removeVector, "function");
    assert.equal(typeof l.fitBounds, "function");
  });

  test("fitBounds converts { n,s,e,w } → Leaflet's [[s,w],[n,e]]", () => {
    const l = getMapProvider("leaflet");
    let got = null;
    const fakeMap = { fitBounds: (b) => { got = b; } };
    l.fitBounds(fakeMap, { north: 42, south: 41, east: -91, west: -92 });
    assert.deepEqual(got, [[41, -92], [42, -91]]);
  });

  test("fitBounds with no bounds is a no-op (no throw)", () => {
    const l = getMapProvider("leaflet");
    l.fitBounds({ fitBounds: () => { throw new Error("should not be called"); } }, null);
  });
});

describe("leaflet provider: raster-image contract", () => {
  test("exposes the SAME raster-image contract as google", () => {
    const l = getMapProvider("leaflet");
    assert.equal(typeof l.addRasterImage, "function");
    assert.equal(typeof l.removeRasterImage, "function");
    assert.equal(typeof l.setRasterImageOpacity, "function");
  });

  test("addRasterImage before any leaflet map exists throws a clear error, not a null-deref", () => {
    // mapProvider.js's leaflet _leaflet module state is only set inside create(); no leaflet map has
    // been created in this test file (that needs a DOM), so this exercises the guard deliberately.
    const l = getMapProvider("leaflet");
    assert.throws(() => l.addRasterImage({}, "data:image/png;base64,x", { north: 1, south: 0, east: 1, west: 0 }),
      /addRasterImage called before a leaflet map was created/);
  });

  test("removeRasterImage prefers handle.remove(), falls back to map.removeLayer(handle)", () => {
    const l = getMapProvider("leaflet");
    let removed = false;
    l.removeRasterImage({}, { remove: () => { removed = true; } });
    assert.equal(removed, true);

    let removedVia = null;
    l.removeRasterImage({ removeLayer: (h) => { removedVia = h; } }, { notRemove: true });
    assert.deepEqual(removedVia, { notRemove: true });
  });

  test("removeRasterImage with no handle is a no-op (no throw)", () => {
    const l = getMapProvider("leaflet");
    l.removeRasterImage({}, null);
  });

  test("setRasterImageOpacity delegates to the handle's setOpacity", () => {
    const l = getMapProvider("leaflet");
    let got;
    l.setRasterImageOpacity({ setOpacity: (o) => { got = o; } }, 0.7);
    assert.equal(got, 0.7);
  });

  test("setRasterImageUrl swaps the image in place via handle.setUrl and returns the SAME handle", () => {
    const l = getMapProvider("leaflet");
    let gotUrl;
    const handle = { setUrl: (u) => { gotUrl = u; } };
    const returned = l.setRasterImageUrl({}, handle, "data:image/png;base64,new", { north: 1, south: 0, east: 1, west: 0 });
    assert.equal(gotUrl, "data:image/png;base64,new");
    assert.equal(returned, handle);   // no remove/recreate on leaflet
  });

  test("setRasterImageUrl also updates opacity when given", () => {
    const l = getMapProvider("leaflet");
    let gotOpacity;
    const handle = { setUrl: () => {}, setOpacity: (o) => { gotOpacity = o; } };
    l.setRasterImageUrl({}, handle, "data:image/png;base64,x", {}, { opacity: 0.4 });
    assert.equal(gotOpacity, 0.4);
  });

  test("onMapMouseMove normalizes Leaflet's e.latlng to {lat, lng} and returns an unsubscribe fn", () => {
    const l = getMapProvider("leaflet");
    let onHandler, offHandler;
    const fakeMap = {
      on: (evt, fn) => { assert.equal(evt, "mousemove"); onHandler = fn; },
      off: (evt, fn) => { assert.equal(evt, "mousemove"); offHandler = fn; },
    };
    let seen = null;
    const unsubscribe = l.onMapMouseMove(fakeMap, (p) => { seen = p; });
    onHandler({ latlng: { lat: 41.6, lng: -91.5 } });
    assert.deepEqual(seen, { lat: 41.6, lng: -91.5 });
    unsubscribe();
    assert.equal(offHandler, onHandler);   // the exact handler passed to on() is the one removed
  });
});

describe("neutral vector style vocabulary", () => {
  const neutral = { fillColor: "#f00", fillOpacity: 0.3, strokeColor: "#00f", strokeWidth: 2, strokeOpacity: 0.9 };

  test("styleToGoogle: neutral names → google.maps.Data names", () => {
    assert.deepEqual(styleToGoogle(neutral), {
      fillColor: "#f00", fillOpacity: 0.3, strokeColor: "#00f", strokeWeight: 2, strokeOpacity: 0.9,
    });
  });

  test("styleToLeaflet: neutral names → Leaflet path options (color/weight, fill:true)", () => {
    assert.deepEqual(styleToLeaflet(neutral), {
      fillColor: "#f00", fill: true, fillOpacity: 0.3, color: "#00f", weight: 2, opacity: 0.9,
    });
  });

  test("both pass unknown keys through untouched (provider-native escape hatch)", () => {
    assert.equal(styleToGoogle({ icon: "x" }).icon, "x");
    assert.equal(styleToLeaflet({ dashArray: "4" }).dashArray, "4");
  });

  test("omitted neutral keys are not emitted (no undefined overwrite of provider defaults)", () => {
    assert.deepEqual(styleToGoogle({ fillColor: "#f00" }), { fillColor: "#f00" });
    assert.deepEqual(styleToLeaflet({ strokeColor: "#00f" }), { color: "#00f" });
  });
});

describe("per-feature style callback", () => {
  const fc = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { depth: 2 }, geometry: { type: "Point", coordinates: [0, 0] } },
      { type: "Feature", properties: { depth: 9 }, geometry: { type: "Point", coordinates: [1, 1] } },
    ],
  };

  test("featuresOf: FeatureCollection → its features, in order", () => {
    assert.deepEqual(featuresOf(fc), fc.features);
  });

  test("featuresOf: a lone Feature → one-element list; anything else → []", () => {
    assert.deepEqual(featuresOf(fc.features[0]), [fc.features[0]]);
    assert.deepEqual(featuresOf({ type: "Polygon", coordinates: [] }), []);
    assert.deepEqual(featuresOf(null), []);
  });

  test("callback receives { feature, index } and can branch on properties", () => {
    const seen = [];
    const style = ({ feature, index }) => { seen.push(index); return feature.properties.depth > 5 ? "#f00" : "#00f"; };
    assert.deepEqual(resolveFeatureStyle(style, fc.features[0], 0), { fillColor: "#00f", strokeColor: "#00f" });
    assert.deepEqual(resolveFeatureStyle(style, fc.features[1], 1), { fillColor: "#f00", strokeColor: "#f00" });
    assert.deepEqual(seen, [0, 1]);
  });

  test("a colour STRING is the graded-colour shorthand → { fillColor, strokeColor }", () => {
    assert.deepEqual(resolveFeatureStyle(() => "rgb(1,2,3)"), { fillColor: "rgb(1,2,3)", strokeColor: "rgb(1,2,3)" });
  });

  test("a returned OBJECT is passed through as a neutral style (opacity/width per feature)", () => {
    const r = resolveFeatureStyle(() => ({ fillColor: "#0f0", fillOpacity: 0.4, strokeWidth: 3 }));
    assert.deepEqual(r, { fillColor: "#0f0", fillOpacity: 0.4, strokeWidth: 3 });
  });

  test("a plain object style (non-callback) resolves to itself; nullish → {}", () => {
    assert.deepEqual(resolveFeatureStyle({ fillColor: "#abc" }), { fillColor: "#abc" });
    assert.deepEqual(resolveFeatureStyle(() => null), {});
    assert.deepEqual(resolveFeatureStyle(undefined), {});
  });

  test("the callback result still flows through the neutral translators", () => {
    // graded colour → google keeps fill/stroke names; leaflet maps strokeColor→color and adds fill:true
    const g = styleToGoogle(resolveFeatureStyle(() => "#f00"));
    assert.deepEqual(g, { fillColor: "#f00", strokeColor: "#f00" });
    const l = styleToLeaflet(resolveFeatureStyle(() => "#f00"));
    assert.deepEqual(l, { fillColor: "#f00", fill: true, color: "#f00" });
  });
});
