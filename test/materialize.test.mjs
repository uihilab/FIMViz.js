// The lazy Dataset ADT: materialize seam, terminals (load/grid/features), memoization, reproject as a
// lazy op, and storage round-trips (recipe + storeMaterialized). See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1.
//
// Importing io/materializers.js registers the node-safe geotiff + vector decoders (geotiff decodes in
// Node). The GDAL reprojector is browser-only, so reproject FORCING is tested against a STUB — the
// engine contract is grid→grid, and that is what we assert here.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Dataset } from "../src/package/dataset.js";
import {
  RasterGrid, VectorFeatures, registerReprojector, materializerFormats,
} from "../src/package/materialize.js";
import "../src/io/materializers.js";                 // side effect: register geotiff + vector decoders
import { parseSource } from "../src/io/parse.js";

const SAMPLES = fileURLToPath(new URL("../assets/SampleFiles/", import.meta.url));
const ab = (f) => {
  const b = readFileSync(SAMPLES + f);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe("materialize: registry", () => {
  test("importing io/materializers.js registers geotiff + the vector formats", () => {
    const fmts = materializerFormats();
    for (const f of ["geotiff", "geojson", "kml", "kmz", "shp", "hazus"]) {
      assert.ok(fmts.includes(f), `expected a materializer for ${f}`);
    }
  });

  test("forcing a format with no materializer throws an actionable error", async () => {
    const ds = new Dataset({ name: "x.weird", kind: "raster", format: "weird", data: new ArrayBuffer(0) });
    await assert.rejects(() => ds.load(), /no materializer registered for format "weird"/);
  });

  test("a selection-axis series can't be forced directly — select() first", async () => {
    const ds = new Dataset({ kind: "vector", axis: { name: "stage", entries: [{ coord: 1, ref: "a.kmz" }] } });
    await assert.rejects(() => ds.load(), /selection-axis series/);
  });
});

describe("materialize: raster terminal (grid)", () => {
  test("grid() decodes a real GeoTIFF into a RasterGrid, memoized", async () => {
    const ds = await parseSource(ab("4326.tif"), { name: "4326.tif" });
    assert.equal(ds.isMaterialized, false, "lazy: nothing decoded until forced");
    const g = await ds.grid();
    assert.ok(g instanceof RasterGrid);
    assert.equal(g.kind, "raster");
    assert.ok(g.width > 0 && g.height > 0, "has pixel dimensions");
    assert.ok(g.pixels?.length > 0, "has decoded pixels");
    assert.ok(g.bounds && Number.isFinite(g.bounds.north), "carries bounds");
    assert.equal(ds.isMaterialized, true);
    assert.equal(await ds.grid(), g, "memoized: same instance on re-force");
    ds.release();
    assert.equal(ds.isMaterialized, false, "release() drops the memoized decode");
  });

  test("features() on a raster (and grid() on a vector) throw a clear kind error", async () => {
    const ras = await parseSource(ab("4326.tif"), { name: "4326.tif" });
    await assert.rejects(() => ras.features(), /is a raster dataset, not a vector/);
    const vec = await parseSource(ab("iowa_lakes_meta.geojson"), { name: "iowa_lakes_meta.geojson" });
    await assert.rejects(() => vec.grid(), /is a vector dataset, not a raster/);
  });
});

describe("materialize: vector terminal (features)", () => {
  test("features() returns a VectorFeatures wrapping the GeoJSON", async () => {
    const ds = await parseSource(ab("iowa_lakes_meta.geojson"), { name: "iowa_lakes_meta.geojson" });
    const f = await ds.features();
    assert.ok(f instanceof VectorFeatures);
    assert.equal(f.kind, "vector");
    assert.equal(f.crs, "EPSG:4326");
    assert.ok(f.features?.type, "carries the GeoJSON object");
  });

  test("VectorFeatures iterates its features directly — no .features.features", async () => {
    const ds = await parseSource(ab("iowa_lakes_meta.geojson"), { name: "iowa_lakes_meta.geojson" });
    const f = await ds.features();
    const iterated = [...f];
    assert.ok(iterated.length > 0);
    assert.deepEqual(iterated, f.toArray());
    assert.equal(f.count, iterated.length);
    assert.equal(iterated[0].type, "Feature");
    // for...of is the point of the iterator — assert the loop form, not just the spread.
    let n = 0;
    for (const feature of f) { assert.ok(feature.geometry); n++; }
    assert.equal(n, f.count);
  });

  test("toArray normalizes all three payload shapes a decoder may return", () => {
    const feat = { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} };
    assert.equal(new VectorFeatures({ features: { type: "FeatureCollection", features: [feat, feat] } }).count, 2);
    assert.equal(new VectorFeatures({ features: feat }).count, 1, "a lone Feature");
    assert.equal(new VectorFeatures({ features: [feat] }).count, 1, "a bare array");
    assert.deepEqual(new VectorFeatures({ features: null }).toArray(), [], "no payload is empty, not a throw");
  });

  test("a vector Dataset with no known bounds (e.g. a lazily-rooted one) computes them from the decoded features", async () => {
    // parseSource's inline path already gets bounds for free (parse.js computes them from the same
    // features at parse time — see boundsOf() there). A URL-rooted Dataset.fromURL()/select() has no
    // such head start: nothing reads the content until THIS materializer runs, so ds.bounds is still
    // the constructor-time null going in. Constructing by hand (bypassing parse.js) reproduces exactly
    // that shape without needing a real network fetch.
    const geojson = { type: "FeatureCollection", features: [
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-90.1, 41.5] } },
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-90.3, 41.7] } },
    ] };
    const ds = new Dataset({ name: "x.geojson", kind: "vector", format: "geojson", data: geojson, bounds: null });
    assert.equal(ds.bounds, null, "unknown going in");
    const f = await ds.features();
    assert.deepEqual(f.bounds, { north: 41.7, south: 41.5, east: -90.1, west: -90.3 });
    assert.deepEqual(ds.bounds, f.bounds, "and the Dataset itself now reads the same, real bounds");
  });
});

describe("materialize: fromURL is a lazy url root", () => {
  test("fromURL infers format/kind and does not fetch until forced", () => {
    const r = Dataset.fromURL("https://example.com/d/19p5.tif");
    assert.equal(r.format, "geotiff");
    assert.equal(r.kind, "raster");
    assert.equal(r.isMaterialized, false);
    assert.equal(r.data, null, "url roots carry no inline data");

    const v = Dataset.fromURL("https://example.com/lakes.geojson");
    assert.equal(v.kind, "vector");
    assert.equal(v.crs, "EPSG:4326");
  });
});

describe("reproject: lazy op forced through the registered reprojector", () => {
  test("building a reproject node is pure; forcing dispatches to the stub warp + records a warning", async () => {
    // A stub reprojector: the engine contract is (RasterGrid, crs) => RasterGrid.
    registerReprojector(async (grid, crs) => new RasterGrid({ ...grid, crs, meta: { ...grid.meta, warped: true } }));
    const ds = await parseSource(ab("4326.tif"), { name: "4326.tif" });   // crs EPSG:4326
    const rp = ds.reproject("EPSG:3857");
    assert.notEqual(rp, ds, "immutable: a new node");
    assert.equal(rp.crs, "EPSG:3857");
    assert.equal(rp.isMaterialized, false);
    const g = await rp.grid();
    assert.equal(g.crs, "EPSG:3857");
    assert.equal(g.meta.warped, true, "the stub reprojector ran");
    assert.ok(rp.warnings.some((w) => /Reprojected/.test(w)), "force-time warning collected");
  });

  test("bounds/meta are unknown before forcing, and sync to the real post-warp values once forced", async () => {
    // The real bounds/dimensions can't be known until a warp actually runs — building the node must
    // not lie about them, but reading them back off the SAME Dataset after forcing must not stay
    // stuck at that placeholder either.
    registerReprojector(async (grid, crs) => new RasterGrid({
      ...grid, crs, bounds: { north: 9, south: 8, east: 7, west: 6 },
      width: 111, height: 222, meta: { ...grid.meta, width: 111, height: 222 },
    }));
    const ds = await parseSource(ab("4326.tif"), { name: "4326.tif" });
    const rp = ds.reproject("EPSG:3857");
    assert.equal(rp.bounds, null, "unknown pre-force — reproject can't know the real footprint yet");

    await rp.grid();
    assert.deepEqual(rp.bounds, { north: 9, south: 8, east: 7, west: 6 }, "reads the real post-warp bounds now");
    assert.equal(rp.meta.width, 111, "and the real post-warp dimensions, not the pre-warp source's");
    assert.equal(rp.meta.height, 222);
  });

  test("a plain source's real encoded bytes ARE offered as ctx.source (the cheap fast path)", async () => {
    // Complements datasetOps.test.mjs's combine/clip cases (synthetic fixtures with no real
    // ArrayBuffer data, so ctx.source is always null there). A parseFile()'d root DOES carry real
    // bytes, and reprojecting it directly is exactly the case #rootData's shortcut is FOR.
    let seenCtx = null;
    registerReprojector(async (grid, crs, ctx = {}) => { seenCtx = ctx; return new RasterGrid({ ...grid, crs }); });
    const ds = await parseSource(ab("4326.tif"), { name: "4326.tif" });
    await ds.reproject("EPSG:3857").grid();
    assert.ok(seenCtx.source instanceof ArrayBuffer, "the root's real encoded bytes were offered");
    assert.ok(seenCtx.grid, "the computed base grid is ALSO always offered, as the fallback");
  });
});

describe("storage round-trips", () => {
  test("inline root: toRecord/fromRecord unchanged (back-compat, carries data)", () => {
    const ds = new Dataset({ name: "x.tif", kind: "raster", format: "geotiff", crs: "EPSG:26914",
      bounds: { north: 1, south: 0, east: 1, west: 0 }, data: new Uint8Array([9, 8]).buffer });
    const rec = ds.toRecord();
    assert.ok("data" in rec && !("source" in rec) && !("url" in rec), "plain inline shape");
    const back = Dataset.fromRecord(rec);
    assert.equal(back.id, ds.id);
    assert.deepEqual([...new Uint8Array(back.data)], [9, 8]);
  });

  test("url root: recipe carries the url, no data; rehydrates to a lazy url Dataset", () => {
    const r = Dataset.fromURL("https://example.com/d/19p5.tif", { name: "19p5.tif" });
    const rec = r.toRecord();
    assert.equal(rec.url, "https://example.com/d/19p5.tif");
    assert.equal(rec.data, null);
    const back = Dataset.fromRecord(rec);
    assert.equal(back.format, "geotiff");
    assert.equal(back.isMaterialized, false);
  });

  test("storeMaterialized embeds the decoded grid; it rehydrates already-materialized (no re-decode)", async () => {
    const ds = await parseSource(ab("4326.tif"), { name: "4326.tif" });
    assert.throws(() => ds.toRecord({ storeMaterialized: true }), /call await ds.load\(\) first/);
    await ds.load();
    const rec = ds.toRecord({ storeMaterialized: true });
    assert.ok(rec.materialized && rec.materialized.kind === "raster");
    const back = Dataset.fromRecord(rec);
    assert.equal(back.isMaterialized, true, "restored pre-materialized");
    const g = await back.grid();
    assert.ok(g instanceof RasterGrid, "revived to a RasterGrid instance");
  });

  test("derived (reproject) node: recipe round-trips via inputs + op, rehydrates and forces", async () => {
    registerReprojector(async (grid, crs) => new RasterGrid({ ...grid, crs }));   // self-contained
    const ds = await parseSource(ab("4326.tif"), { name: "4326.tif" });
    const rp = ds.reproject("EPSG:3857");
    const rec = rp.toRecord();
    assert.ok(Array.isArray(rec.inputs) && rec.inputs.length === 1, "nests input records (not a single parent)");
    assert.equal(rec.op.op, "reproject");
    assert.equal(rec.inputs[0].data instanceof ArrayBuffer || rec.inputs[0].data === null ? true : false, true);
    const back = Dataset.fromRecord(rec);
    assert.equal(back.crs, "EPSG:3857");
    assert.equal(back.isMaterialized, false, "rehydrated lazy");
    const g = await back.grid();
    assert.equal(g.crs, "EPSG:3857", "the rebuilt chain forces through the reprojector");
  });

  test("select() resolves an axis entry into a lazy url Dataset", () => {
    const ds = new Dataset({
      kind: "vector",
      axis: { name: "stage", entries: [
        { coord: 19, ref: { raster: "d/19.tif", vector: "v/19.kmz" }, meta: { discharge: 16400 } },
        { coord: 34, ref: "v/34.kmz", meta: {} },
      ] },
    });
    const bare = ds.select(34);
    assert.equal(bare.format, "kmz");
    assert.ok(String(bare.name).endsWith("34.kmz"));

    const variant = ds.select(19, { variant: "raster", base: "https://host/" });
    assert.equal(variant.format, "geotiff");
    assert.equal(variant.isMaterialized, false);
    assert.deepEqual(variant.meta, { discharge: 16400 }, "entry meta carried to the child");

    assert.throws(() => ds.select(19), /named variants/, "object ref needs a variant");
    assert.equal(ds.select(999, { nearest: false }), null, "no match → null");
  });
});

describe("materialize: Dataset.fromURL resolveUrl applied at force (the materializer fetch)", () => {
  const FC = JSON.stringify({ type: "FeatureCollection",
    features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} }] });

  test("the carried resolver rewrites the fetched url; the original name is kept", async () => {
    const orig = globalThis.fetch, fetched = [];
    globalThis.fetch = async (u) => {
      fetched.push(u);
      return new Response(FC, { status: 200, headers: { "content-type": "application/geo+json" } });
    };
    try {
      const ds = Dataset.fromURL("https://data.example/z.geojson",
        { resolveUrl: (u) => "https://proxy/?u=" + encodeURIComponent(u) });
      await ds.features();   // force → #materializeRoot resolves, materializer fetches the RESOLVED url
      assert.equal(fetched.at(-1),
        "https://proxy/?u=" + encodeURIComponent("https://data.example/z.geojson"));
      assert.equal(ds.name, "z.geojson", "name derives from the original url, not the proxied one");
    } finally { globalThis.fetch = orig; }
  });

  test("no resolver → the url is fetched unchanged", async () => {
    const orig = globalThis.fetch, fetched = [];
    globalThis.fetch = async (u) => {
      fetched.push(u);
      return new Response(FC, { status: 200, headers: { "content-type": "application/geo+json" } });
    };
    try {
      await Dataset.fromURL("https://data.example/w.geojson").features();
      assert.equal(fetched.at(-1), "https://data.example/w.geojson");
    } finally { globalThis.fetch = orig; }
  });
});

describe("Dataset.fromGrid — the way back into the op chain", () => {
  const grid = () => new RasterGrid({
    pixels: Float32Array.from([1, 2, 3, 4]), width: 2, height: 2,
    bounds: { north: 2, south: 0, east: 2, west: 0 }, crs: "EPSG:4326", meta: { unit: "m" },
  });

  test("wraps an already-decoded grid: pre-materialized, no seam involved", async () => {
    const ds = Dataset.fromGrid(grid(), { name: "computed" });
    assert.equal(ds.kind, "raster");
    assert.equal(ds.name, "computed");
    assert.equal(ds.isMaterialized, true, "no decode is pending — the value IS the payload");
    assert.equal(ds.format, null, "no encoded bytes exist, so claiming a format would be a lie");
    assert.equal(ds.crs, "EPSG:4326", "frame comes from the value");
    assert.deepEqual(ds.bounds, { north: 2, south: 0, east: 2, west: 0 });
    assert.equal(ds.meta.unit, "m");

    const forced = await ds.grid();
    assert.equal(forced.width, 2, "the terminal returns what was handed in");
  });

  test("ops chain off it, exactly as off a parsed Dataset", async () => {
    const ds = Dataset.fromGrid(grid());
    const clipped = ds.clip({ north: 1, south: 0, east: 1, west: 0 });
    assert.notEqual(clipped, ds, "still immutable/lazy");
    assert.equal(clipped.isMaterialized, false, "the derived node is unforced");
    const g = await clipped.grid();
    assert.ok(g.width >= 1 && g.width <= 2, "the clip really ran against the wrapped grid");
  });

  test("round-trips a VectorFeatures too", async () => {
    const vf = new VectorFeatures({
      features: { type: "FeatureCollection", features: [] }, crs: "EPSG:4326",
    });
    const ds = Dataset.fromGrid(vf);
    assert.equal(ds.kind, "vector");
    assert.equal((await ds.features()).kind, "vector");
  });

  test("rejects anything that is not a decoded value", () => {
    assert.throws(() => Dataset.fromGrid(null), /RasterGrid or VectorFeatures/);
    assert.throws(() => Dataset.fromGrid({ pixels: [] }), /RasterGrid or VectorFeatures/);
  });
});
