// FimMap — Dataset registry/ref-count delegation + exclusive display-claim policy
// (package/fimMap.js). Headless: no map, no boot.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FimMap } from "../src/package/fimMap.js";
import { Layer } from "../src/package/layer.js";
import { Dataset } from "../src/package/dataset.js";
import { createApp } from "../src/package/fimViz.js";
import { registerMapProvider } from "../src/package/mapProvider.js";

// A REAL (isolated) app: Dataset registry + ref-counting live there and FimMap delegates, so a stub
// would not exercise the seam these tests exist to cover.
const fakeApp = () => createApp();

describe("Dataset lifecycle: owned by the APP, delegated from the map", () => {
  test("a shared Dataset is evicted only when the LAST reference drops", () => {
    const fim = new FimMap({ app: fakeApp() });
    const ds = new Dataset({ name: "x" });
    let released = 0;
    ds.release = () => { released++; };          // spy on eviction

    fim._acquireDataset(ds);
    fim._acquireDataset(ds);                      // two layers hold the same source
    fim._releaseDataset(ds);
    assert.equal(released, 0, "still referenced by one layer — not evicted");
    fim._releaseDataset(ds);
    assert.equal(released, 1, "evicted once the count hits zero");
  });

  test("acquire/release tolerate nullish and over-release", () => {
    const fim = new FimMap({ app: fakeApp() });
    assert.doesNotThrow(() => { fim._acquireDataset(null); fim._releaseDataset(undefined); });
    const ds = new Dataset({ name: "y" });
    let released = 0; ds.release = () => { released++; };
    fim._releaseDataset(ds);                       // release with no prior acquire
    assert.equal(released, 1, "a zero/negative count still evicts, once");
  });

  test("TWO MAPS sharing one Dataset: neither evicts while the other still renders it", () => {
    // The count is per-APP, not per-map. Counted per map, map A dropping its last Layer would call
    // ds.release() and silently evict a decode map B is still rendering — A cannot see B's refs.
    const app = createApp();
    const a = new FimMap({ app });
    const b = new FimMap({ app });
    const ds = new Dataset({ name: "shared.tif" });
    let released = 0; ds.release = () => { released++; };

    a._acquireDataset(ds);
    b._acquireDataset(ds);
    assert.equal(app._datasetRefCount(ds), 2, "both maps counted on the one app");

    a._releaseDataset(ds);
    assert.equal(released, 0, "map B still renders it — the decode must survive");
    b._releaseDataset(ds);
    assert.equal(released, 1, "evicted only once BOTH maps let go");
  });

  test("two apps are independent — one releasing does not touch the other", () => {
    const app1 = createApp(), app2 = createApp();
    const m1 = new FimMap({ app: app1 }), m2 = new FimMap({ app: app2 });
    const ds = new Dataset({ name: "s.tif" });
    let released = 0; ds.release = () => { released++; };
    m1._acquireDataset(ds); m2._acquireDataset(ds);
    m1._releaseDataset(ds);
    assert.equal(released, 1, "app1's count hit zero independently of app2's");
  });
});

describe("Dataset registry lives on the app, shared by every map on it", () => {
  const ab = (n) => new Dataset({ name: n });

  test("fim.datasets delegates to the app — visible from a sibling map", async () => {
    const app = createApp();
    const a = new FimMap({ app });
    const b = new FimMap({ app });
    const ds = app._registerDataset(ab("iowa.geojson"));

    assert.deepEqual(a.datasets, [ds]);
    assert.deepEqual(b.datasets, [ds], "a file parsed on map A is usable as a source on map B");
    assert.deepEqual(app.datasets, [ds]);
  });

  test("registration is idempotent, and the getter returns a COPY", () => {
    const app = createApp();
    const ds = ab("x.tif");
    app._registerDataset(ds); app._registerDataset(ds);
    assert.equal(app.datasets.length, 1);
    app.datasets.push(ab("nope.tif"));
    assert.equal(app.datasets.length, 1, "mutating the returned array does not register anything");
  });

  test("releasing the decode does NOT unregister the Dataset", () => {
    const app = createApp();
    const ds = ab("z.tif"); ds.release = () => {};
    app._registerDataset(ds);
    app._acquireDataset(ds); app._releaseDataset(ds);
    assert.deepEqual(app.datasets, [ds],
      "the registry records what was PARSED; the count records what is RENDERED");
  });

  test("two apps keep separate registries", () => {
    const app1 = createApp(), app2 = createApp();
    app1._registerDataset(ab("a.tif"));
    assert.equal(app1.datasets.length, 1);
    assert.equal(app2.datasets.length, 0);
  });
});

describe("FimMap: exclusive display claim (formalizes activeDisplayLayer)", () => {
  test("claiming with a new exclusive layer tears down the prior claimant", () => {
    const fim = new FimMap({ app: fakeApp() });
    const a = new Layer({ map: fim, type: "velocity", exclusive: true });
    const b = new Layer({ map: fim, type: "ensemble", exclusive: true });
    let aRemoved = false;
    a.on("removed", () => { aRemoved = true; });

    fim._claimExclusive(a);
    assert.equal(fim.exclusiveClaimant, a);
    fim._claimExclusive(b);
    assert.equal(aRemoved, true, "prior claimant was torn down");
    assert.equal(fim.exclusiveClaimant, b, "new claimant holds the slot");
  });

  test("re-claiming with the SAME layer does not tear it down", () => {
    const fim = new FimMap({ app: fakeApp() });
    const a = new Layer({ map: fim, type: "velocity", exclusive: true });
    let removed = 0; a.on("removed", () => { removed++; });
    fim._claimExclusive(a);
    fim._claimExclusive(a);
    assert.equal(removed, 0);
    assert.equal(fim.exclusiveClaimant, a);
  });

  test("unregistering the claimant clears the slot", () => {
    const fim = new FimMap({ app: fakeApp() });
    const a = new Layer({ map: fim, type: "velocity", exclusive: true });
    fim._claimExclusive(a);
    a.remove();                                    // → _unregisterLayer clears the claimant
    assert.equal(fim.exclusiveClaimant, null);
  });
});

describe("Layer.remove() balances the constructor's source acquire", () => {
  // The constructor acquires every source; only setSources released. So a Layer that was created
  // and removed left a permanent +1, and the Dataset's memoized decode — the entire pixel array for
  // a raster — stayed pinned for the life of the page.
  const dsWithSpy = (name) => {
    const ds = new Dataset({ name, kind: "vector", data: { type: "FeatureCollection", features: [] }, bounds: {} });
    ds._evicted = 0; ds.release = () => { ds._evicted++; };
    return ds;
  };

  test("create → remove returns the count to zero and evicts", () => {
    const app = createApp();
    const fim = new FimMap({ app });
    const ds = dsWithSpy("a.geojson");
    const l = new Layer({ map: fim, sources: [ds] });
    assert.equal(app._datasetRefCount(ds), 1, "constructor acquired");
    l.remove();
    assert.equal(app._datasetRefCount(ds), 0, "remove() released");
    assert.equal(ds._evicted, 1);
  });

  test("remove() is idempotent — a second call does not double-release", () => {
    const app = createApp();
    const fim = new FimMap({ app });
    const ds = dsWithSpy("b.geojson");
    const l = new Layer({ map: fim, sources: [ds] });
    l.remove(); l.remove(); l.remove();
    assert.equal(ds._evicted, 1, "evicted exactly once");
    assert.equal(app._datasetRefCount(ds), 0, "count never goes negative");
  });

  test("a multi-source layer releases every source", () => {
    const app = createApp();
    const fim = new FimMap({ app });
    const d1 = dsWithSpy("1.geojson"), d2 = dsWithSpy("2.geojson");
    new Layer({ map: fim, sources: [d1, d2] }).remove();
    assert.equal(d1._evicted, 1);
    assert.equal(d2._evicted, 1);
  });

  test("the 'removed' subscriber still sees a live decode (release happens last)", () => {
    const app = createApp();
    const fim = new FimMap({ app });
    const ds = dsWithSpy("c.geojson");
    const l = new Layer({ map: fim, sources: [ds] });
    let atEmit = null;
    l.on("removed", () => { atEmit = ds._evicted; });
    l.remove();
    assert.equal(atEmit, 0, "not yet evicted while 'removed' handlers run");
    assert.equal(ds._evicted, 1, "evicted afterwards");
  });
});

describe("Dataset registry verbs: adoptDataset / removeDataset", () => {
  const ds = (n) => new Dataset({ name: n, kind: "vector",
    data: { type: "FeatureCollection", features: [] }, bounds: {} });

  test("adoptDataset makes a Dataset from another app discoverable here", () => {
    const a1 = createApp(), a2 = createApp();
    const d = a1._registerDataset(ds("shared.geojson"));
    assert.equal(a2.datasets.length, 0);
    assert.equal(a2.adoptDataset(d), d);
    assert.deepEqual(a2.datasets, [d], "same instance — no re-parse, no second decode");
    assert.deepEqual(a1.datasets, [d], "still registered on the origin app");
  });

  test("adoptDataset is idempotent", () => {
    const app = createApp(); const d = ds("x.geojson");
    app.adoptDataset(d); app.adoptDataset(d);
    assert.equal(app.datasets.length, 1);
  });

  test("removeDataset unregisters and releases", () => {
    const app = createApp(); const d = ds("y.geojson");
    let evicted = 0; d.release = () => { evicted++; };
    app.adoptDataset(d);
    assert.equal(app.removeDataset(d), true);
    assert.equal(app.datasets.length, 0);
    assert.equal(evicted, 1);
    assert.equal(app.removeDataset(d), false, "false when it was never registered");
  });

  test("removeDataset REFUSES while a layer still renders it", () => {
    const app = createApp(); const fim = new FimMap({ app });
    const d = ds("held.geojson"); app.adoptDataset(d);
    const l = new Layer({ map: fim, sources: [d] });
    assert.throws(() => app.removeDataset(d), /still rendered by 1 layer/);
    assert.deepEqual(app.datasets, [d], "nothing was removed");
    assert.equal(fim.removeDataset(d, { force: true }), true, "force overrides");
    assert.equal(app.datasets.length, 0);
    l.remove();
  });

  test("layer.remove({ purgeSource }) forgets sources nothing else holds", () => {
    const app = createApp(); const fim = new FimMap({ app });
    const kept = ds("kept.geojson"), gone = ds("gone.geojson");
    app.adoptDataset(kept); app.adoptDataset(gone);
    const keeper = new Layer({ map: fim, sources: [kept] });      // a sibling still holds `kept`
    const l = new Layer({ map: fim, sources: [kept, gone] });

    l.remove({ purgeSource: true });
    assert.ok(app.datasets.includes(kept), "still held by a sibling layer — NOT purged");
    assert.ok(!app.datasets.includes(gone), "nothing else held it — purged");
    keeper.remove();
  });

  test("plain remove() leaves the registry alone", () => {
    const app = createApp(); const fim = new FimMap({ app });
    const d = ds("stays.geojson"); app.adoptDataset(d);
    new Layer({ map: fim, sources: [d] }).remove();
    assert.deepEqual(app.datasets, [d], "remove() drops the DECODE, not the registration");
  });
});

describe("addLayer(spec) — rebuild a layer from another map's descriptor", () => {
  const provider = () => registerMapProvider("spec-demo", {
    requiresApiKey: false, acceptsCRS: () => true, create: async () => ({}),
    addVector: () => ({}), removeVector() {}, fitBounds() {},
  });
  const mkMap = () => {
    provider();
    const app = createApp(); app.config.provider = "spec-demo";
    const fim = new FimMap({ app }); fim._adoptMap({});
    return fim;
  };
  const mkDs = () => new Dataset({ name: "t.geojson", kind: "vector",
    data: { type: "FeatureCollection", features: [] }, bounds: {} });

  test("carries type + settings, SHARES the Dataset, adopts it onto the target app", async () => {
    const m1 = mkMap(), m2 = mkMap();
    const ds = mkDs();
    const l1 = await m1.addLayer("vector", { source: ds });
    l1.set({ color: "#ff0000", opacity: 0.4 });

    const l2 = await m2.addLayer(l1.toSpec());
    assert.equal(l2.type, "vector");
    assert.equal(l2.dataset, ds, "the SAME Dataset — no re-parse, no second decode");
    assert.equal(l2.get().color, "#ff0000", "settings carried");
    assert.equal(l2.get().opacity, 0.4);
    assert.ok(m2.app.datasets.includes(ds), "adopted onto the target app's registry");
    assert.notEqual(l1.id, l2.id, "a new layer, not the same object");
  });

  test("the two layers DIVERGE — the whole reason this is a spec, not a clone", async () => {
    const m1 = mkMap(), m2 = mkMap();
    const l1 = await m1.addLayer("vector", { source: mkDs() });
    l1.set({ color: "#ff0000" });
    const l2 = await m2.addLayer(l1.toSpec());
    l2.set({ color: "#00ff00" });
    assert.equal(l1.get().color, "#ff0000", "editing the copy never touches the original");
    assert.equal(l2.get().color, "#00ff00");
  });

  test("a spec is distinguishable from every other addLayer first-argument shape", async () => {
    const fim = mkMap();
    const ds = mkDs();
    // a Dataset carries `kind`, not `type` — must still take the infer-from-source path
    const l = await fim.addLayer(ds);
    assert.equal(l.type, "vector");
    assert.equal(l.dataset, ds);
  });
});
