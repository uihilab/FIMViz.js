// The overlay subsystems (depth / ensemble / velocity) hold ONE layer per FimMap, not one per page.
//
// A module-level singleton meant a second mounted widget shared the first's overlay, stale-load
// counter, hover listener and animation state — so whichever map rendered last silently owned them.
// These assert the per-instance contract. The RENDER paths themselves are browser-only (GroundOverlay
// / L.imageOverlay, a rAF canvas, ArcGIS tiles), so this covers instancing and resolution only.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FimMap } from "../src/package/fimMap.js";
import { createApp } from "../src/package/fimViz.js";
import { depthLayerFor } from "../src/layers/depthMap.js";
import { ensembleLayerFor } from "../src/layers/ensemble.js";
import { velocityLayerFor } from "../src/layers/velocity.js";

const mounted = (id) => {
  const fim = new FimMap({ app: createApp() });
  fim._adoptMap({ id });
  return fim;
};

const SUBSYSTEMS = [
  ["depth", depthLayerFor], ["ensemble", ensembleLayerFor], ["velocity", velocityLayerFor],
];

describe("overlay subsystems are per-FimMap, not per-page", () => {
  for (const [name, layerFor] of SUBSYSTEMS) {
    test(`${name}: two maps get two distinct layers`, () => {
      const a = mounted("a"), b = mounted("b");
      const la = layerFor(a), lb = layerFor(b);
      assert.ok(la && lb);
      assert.notEqual(la, lb, "a shared instance would let one widget clobber the other's overlay");
      assert.equal(la._map, a, "each layer knows which map owns it");
      assert.equal(lb._map, b);
      assert.notEqual(la.id, lb.id);
    });

    test(`${name}: the same map always gets the same layer (created once, then stable)`, () => {
      const fim = mounted("s");
      assert.equal(layerFor(fim), layerFor(fim));
    });

    test(`${name}: resolves from a raw provider map as well as a FimMap`, () => {
      const fim = mounted("p");
      assert.equal(layerFor(fim.map), layerFor(fim),
        "overlay code is handed a provider map, so both must resolve to one layer");
    });

    test(`${name}: an unowned map yields null rather than a wrong layer`, () => {
      assert.equal(layerFor({ id: "never-mounted" }), null);
      assert.equal(layerFor(null), null);
      assert.equal(layerFor(undefined), null);
    });

    test(`${name}: addLayer('${name}') returns that map's instance`, async () => {
      const fim = mounted("reg");
      const viaRegistry = await fim.addLayer(name);
      assert.equal(viaRegistry, layerFor(fim),
        "the type registry and the accessor must agree, or the panel binds a different object than renders");
    });
  }

  test("layers are not shared across two maps on the SAME app either", () => {
    const app = createApp();
    const a = new FimMap({ app }); a._adoptMap({ id: "1" });
    const b = new FimMap({ app }); b._adoptMap({ id: "2" });
    for (const [, layerFor] of SUBSYSTEMS) assert.notEqual(layerFor(a), layerFor(b));
  });
});

describe("resolution must not duck-type a provider map as a FimMap", () => {
  // Leaflet's L.Map has its own addLayer/removeLayer. A shape check for those accepted a raw L.Map
  // as if it were a FimMap; `fim.app.config.provider` was then undefined, the provider silently
  // defaulted to google, and Google's GroundOverlay.setMap() received an L.Map — surfacing as
  // "InvalidValueError: setMap: not an instance of Map" from inside the Maps SDK.
  const leafletish = () => ({
    addLayer() {}, removeLayer() {}, fitBounds() {}, getContainer: () => null,
  });

  for (const [name, layerFor] of SUBSYSTEMS) {
    test(`${name}: an unmounted Leaflet-shaped map resolves to null, not to itself`, () => {
      assert.equal(layerFor(leafletish()), null,
        "a provider map that merely LOOKS like a FimMap must not be treated as one");
    });

    test(`${name}: a real mounted Leaflet-shaped map resolves to its owning FimMap`, () => {
      const lmap = leafletish();
      const fim = new FimMap({ app: createApp() });
      fim._adoptMap(lmap);
      assert.equal(layerFor(lmap), layerFor(fim), "resolved via the registry, not by shape");
      assert.equal(layerFor(lmap)._map, fim);
    });
  }

  test("a FimMap is still accepted directly", () => {
    const fim = mounted("direct");
    for (const [, layerFor] of SUBSYSTEMS) assert.equal(layerFor(fim)._map, fim);
  });
});

describe("no engine module clears EVERY widget's layer internally", () => {
  // The real defect was a call SITE, not the primitive: renderUserDepthLayer() opened with
  // `removeUserDepthLayer()` — no argument — which after the per-map change means "every mounted
  // widget", so rendering on map B silently tore down map A's overlay.
  //
  // A behavioural test cannot reach it (render needs geotiff + a canvas, i.e. a browser), and the
  // no-argument form must stay valid for EXTERNAL callers. So: scan for the no-argument form being
  // used INSIDE the layer modules, where a specific map is always in scope.
  const REMOVERS = ["removeUserDepthLayer", "removeEnsembleLayer", "removeUserEnsembleLayer",
                    "removeVelocityLayer"];

  test("internal teardown calls always name their map", () => {
    const offenders = [];
    for (const f of ["depthMap.js", "ensemble.js", "velocity.js"]) {
      const src = readFileSync(new URL("../src/layers/" + f, import.meta.url), "utf8");
      src.split(String.fromCharCode(10)).forEach((line, i) => {
        const t = line.trimStart();
        if (t.startsWith("//") || t.startsWith("*")) return;
        if (t.startsWith("export function") || t.startsWith("export const")) return;  // definitions
        for (const r of REMOVERS) {
          if (t.includes(r + "()")) offenders.push(f + ":" + (i + 1) + "  " + t);
        }
      });
    }
    assert.deepEqual(offenders, [],
      "pass the FimMap (or its provider map): a bare call tears down every mounted widget's layer");
  });
});

describe("rendering on one map must not tear down another's layer", () => {
  // renderUserDepthLayer clears the previous overlay first. With no argument that clear now means
  // "every mounted widget", so rendering on map B silently removed map A's overlay — visible only as
  // A's 'removed' event firing during B's render.
  test("depth: a render on B leaves A's layer alone", async () => {
    const { depthLayerFor: dlf, removeUserDepthLayer } = await import("../src/layers/depthMap.js");
    const a = mounted("keep"), bb = mounted("render");
    const la = dlf(a);
    // A stand-in for a drawn overlay. It answers BOTH providers' teardown calls — google's
    // removeRasterImage() calls setMap(null) on the GroundOverlay, leaflet's calls remove() — so the
    // test stays about instancing and does not silently depend on which provider is the default.
    la.overlay = { name: "A", setMap() {}, remove() {} };
    let aRemoved = 0;
    la.on("removed", () => { aRemoved++; });

    removeUserDepthLayer(bb);              // the targeted clear a render does first
    assert.equal(aRemoved, 0, "clearing B must not fire A's teardown");
    assert.equal(la.overlay?.name, "A", "A's overlay survives");

    removeUserDepthLayer();                // no argument = every widget, by design
    assert.equal(aRemoved, 1);
    assert.equal(la.overlay, null);
  });
});
