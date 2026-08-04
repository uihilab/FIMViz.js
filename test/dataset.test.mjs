// Dataset (package/dataset.js) + warp (geo/warp.js). See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Dataset } from "../src/package/dataset.js";
import { warp } from "../src/geo/warp.js";
import { parseSource } from "../src/io/parse.js";
import { RasterGrid, registerMaterializer } from "../src/package/materialize.js";

const SAMPLES = fileURLToPath(new URL("../assets/SampleFiles/", import.meta.url));
const ab = (f) => {
  const b = readFileSync(SAMPLES + f);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe("Dataset: purity", () => {
  test("constructible standalone, with no infrastructure loaded", () => {
    // The property that matters: Dataset has ZERO imports, so it can round-trip through storage
    // and be tested without dragging in the GDAL toolchain.
    const ds = new Dataset({ name: "synthetic", kind: "raster", crs: "EPSG:3857" });
    assert.equal(ds.name, "synthetic");
    assert.equal(ds.crs, "EPSG:3857");
    assert.match(ds.id, /^ds_/);
  });

  test("reproject IS a Dataset op now — but Dataset still imports no GDAL (headless via the seam)", async () => {
    // The design reversed the old "reproject lives only in geo/" rule (docs/DATASET_LAYER_ADT §2):
    // building a reproject node is pure — the warp runs only on FORCE, dispatched through the
    // registered reprojector. So the method exists, yet the type stays constructible/testable without
    // the toolchain, and forcing with NO reprojector registered fails with a clear, actionable error.
    // A stub materializer lets the BASE decode so the force reaches the reprojector check; NO
    // reprojector is registered, so forcing the reproject node fails with the actionable error.
    registerMaterializer("stub-raster", async () => new RasterGrid({
      pixels: new Uint8Array([1]), width: 1, height: 1,
      bounds: { north: 1, south: 0, east: 1, west: 0 }, crs: "EPSG:26915",
    }));
    const ds = new Dataset({ name: "n.tif", kind: "raster", crs: "EPSG:26915",
      data: { stub: true }, format: "stub-raster" });
    const rp = ds.reproject("EPSG:4326");
    assert.notEqual(rp, ds, "reproject returns a NEW lazy Dataset (immutable)");
    assert.equal(rp.crs, "EPSG:4326");
    assert.equal(ds.crs, "EPSG:26915", "the original is untouched");
    await assert.rejects(() => rp.load(), /no reprojector registered/);
    // The standalone geo/ helper is `warp` — deliberately NOT named `reproject`, because
    // ds.reproject() above is LAZY (returns an unforced node) while warp() is EAGER. One name
    // must never mean both.
    assert.equal(typeof warp, "function", "the standalone geo/ helper still exists, as warp()");
    assert.equal(typeof Dataset.prototype.reproject, "function", "the lazy op keeps the name reproject");
  });

  test("reproject to the SAME crs is a no-op that returns the same instance", () => {
    const ds = new Dataset({ name: "n.tif", kind: "raster", crs: "EPSG:4326" });
    assert.equal(ds.reproject("EPSG:4326"), ds);
  });

  test("reproject normalizes case, so a differently-cased request to the same CRS is ALSO a no-op", () => {
    // Regression: `ds.reproject('epsg:4326')` used to store the crs verbatim, producing a Dataset
    // whose .crs was the literal string "epsg:4326" — a different value than "EPSG:4326" as far as
    // the render-time provider-CRS check (a case-sensitive Set.has) was concerned, so a render threw
    // "cannot render CRS" even though the target was WGS84 all along.
    const ds = new Dataset({ name: "n.tif", kind: "raster", crs: "EPSG:4326" });
    assert.equal(ds.reproject("epsg:4326"), ds, "same CRS regardless of case — still a no-op");
    const other = new Dataset({ name: "n.tif", kind: "raster", crs: "EPSG:26915" });
    assert.equal(other.reproject("epsg:4326").crs, "EPSG:4326", "normalized to canonical uppercase form");
  });

  test("reproject rejects a malformed CRS immediately, naming the expected form", () => {
    const ds = new Dataset({ name: "n.tif", kind: "raster", crs: "EPSG:26915" });
    assert.throws(() => ds.reproject("not-a-crs"), /not a recognized CRS.*EPSG:<code>/);
    assert.throws(() => ds.reproject("4326"), /not a recognized CRS/, "missing the EPSG: prefix");
  });

  test("reproject on a vector throws (vectors are EPSG:4326 by spec)", () => {
    const v = new Dataset({ name: "x.geojson", kind: "vector", crs: "EPSG:4326" });
    assert.throws(() => v.reproject("EPSG:26915"), /vector reprojection is not implemented/);
  });

  test("ids are unique", () => {
    assert.notEqual(new Dataset({}).id, new Dataset({}).id);
  });

  test("defaults are inert", () => {
    const ds = new Dataset();
    assert.equal(ds.crs, null);
    assert.equal(ds.bounds, null);
    assert.equal(ds.data, null);
    assert.equal(ds.name, ds.id, "name falls back to id");
  });
});

describe("Dataset: record round-trip", () => {
  test("toRecord carries everything incl. id + data; toJSON drops data", () => {
    const ds = new Dataset({
      name: "x.tif", kind: "raster", format: "geotiff", crs: "EPSG:26914",
      bounds: { north: 1, south: 0, east: 1, west: 0 }, meta: { width: 2 },
      data: new Uint8Array([1, 2]).buffer,
    });
    const rec = ds.toRecord();
    assert.ok("data" in rec && "id" in rec, "toRecord is the storage payload");
    const json = ds.toJSON();
    assert.ok(!("data" in json), "toJSON is the metadata view");
    assert.ok("crs" in json);
  });

  test("fromRecord(toRecord(ds)) preserves identity and payload", () => {
    // Regression: the previous storage wrapper derived the key from the filename and DELETED id,
    // so the "stable id for storage/share/restore" did not survive a save.
    const ds = new Dataset({
      name: "x.tif", kind: "raster", format: "geotiff", crs: "EPSG:26914",
      bounds: { north: 1, south: 0, east: 1, west: 0 }, meta: { width: 2 },
      data: new Uint8Array([9, 8]).buffer,
    });
    const back = Dataset.fromRecord(ds.toRecord());
    assert.ok(back instanceof Dataset);
    assert.equal(back.id, ds.id);
    assert.equal(back.crs, ds.crs);
    assert.deepEqual(back.bounds, ds.bounds);
    assert.deepEqual([...new Uint8Array(back.data)], [9, 8]);
  });

  test("fromRecord(nullish) → null", () => {
    assert.equal(Dataset.fromRecord(undefined), null);
    assert.equal(Dataset.fromRecord(null), null);
  });
});

describe("Dataset: selection axis", () => {
  // A URL-backed series (e.g. one flood-model's stage extents): `data` stays null, `axis` holds
  // descriptors, and each entry's `ref` may be ONE url or NAMED variants { raster, vector }.
  const stageAxis = {
    name: "stage",
    unit: "ft",
    entries: [
      { coord: 19, ref: { raster: "", vector: "des_moines/55_19p0.kmz" }, meta: { discharge: 16400, layerId: 5805 } },
      { coord: 19.5, ref: { raster: "d/19p5.tif", vector: "des_moines/55_19p5.kmz" }, meta: { discharge: 17500 } },
      { coord: 34, ref: "des_moines/55_34.kmz", meta: { discharge: 71200 } },
    ],
  };

  test("axes defaults to null; data stays for inlined payloads only", () => {
    assert.equal(new Dataset().axes, null);
    assert.equal(new Dataset().axis, null, "the 1-D sugar accessor is null too");
    const ds = new Dataset({ kind: "vector", format: "fim-scenario-series", axis: stageAxis });
    assert.equal(ds.data, null, "a URL-backed series carries descriptors in axes, not data");
    assert.equal(ds.axis.entries.length, 3);
  });

  test("singular `axis:` is 1-D sugar for the canonical `axes:` array; both read back the same", () => {
    const viaSugar = new Dataset({ axis: stageAxis });
    const viaArray = new Dataset({ axes: [stageAxis] });
    assert.deepEqual(viaSugar.axes, [stageAxis], "sugar is normalized to a 1-element array");
    assert.equal(viaSugar.axis, stageAxis, "…and `.axis` reads the primary back");
    assert.deepEqual(viaArray.axes, viaSugar.axes);
    // `axes:` wins if both are supplied
    const other = { name: "time", entries: [] };
    assert.deepEqual(new Dataset({ axis: stageAxis, axes: [other] }).axes, [other]);
  });

  test("an entry's ref supports BOTH a variant object and a bare url string", () => {
    const ds = new Dataset({ axis: stageAxis });
    assert.deepEqual(ds.axis.entries[1].ref, { raster: "d/19p5.tif", vector: "des_moines/55_19p5.kmz" });
    assert.equal(ds.axis.entries[2].ref, "des_moines/55_34.kmz");
  });

  test("selectAxisEntry: exact match, then nearest on a numeric axis (primary by default)", () => {
    const ds = new Dataset({ axis: stageAxis });
    assert.equal(ds.selectAxisEntry(19.5).meta.discharge, 17500, "exact");
    assert.equal(ds.selectAxisEntry(20).coord, 19.5, "nearest (20 → 19.5)");
    assert.equal(ds.selectAxisEntry(100).coord, 34, "nearest clamps to the top entry");
    assert.equal(ds.selectAxisEntry(19.5, { nearest: false }).coord, 19.5);
    assert.equal(ds.selectAxisEntry(20, { nearest: false }), null, "no exact match, nearest disabled");
    assert.equal(new Dataset().selectAxisEntry(1), null, "no axes → null");
  });

  test("N-D ready: a second axis is selectable by index or name", () => {
    const timeAxis = { name: "time", unit: "h", entries: [{ coord: 0, ref: "t0" }, { coord: 6, ref: "t6" }] };
    const ds = new Dataset({ axes: [stageAxis, timeAxis] });
    assert.equal(ds.axis.name, "stage", "primary is still axes[0]");
    assert.equal(ds.selectAxisEntry(6, { axis: "time" }).ref, "t6", "by name");
    assert.equal(ds.selectAxisEntry(0, { axis: 1 }).ref, "t0", "by index");
    assert.equal(ds.selectAxisEntry(19.5, { axis: 0 }).meta.discharge, 17500, "primary still works");
  });

  test("axes round-trip through toRecord/fromRecord and appear in toJSON (lightweight)", () => {
    const ds = new Dataset({ name: "des_moines HEC-RAS", kind: "vector", axis: stageAxis });
    const back = Dataset.fromRecord(ds.toRecord());
    assert.deepEqual(back.axes, [stageAxis]);
    assert.equal(back.axis, back.axes[0], "sugar accessor survives the round-trip");
    assert.ok("axes" in ds.toJSON(), "axes are metadata, not a heavy payload, so toJSON keeps them");
  });
});

describe("warp (eager free function)", () => {
  test("an equivalent CRS is a no-op that returns the SAME instance (no copy, no GDAL)", async () => {
    const ds = await parseSource(ab("4326.tif"), { name: "4326.tif" });
    assert.equal(await warp(ds, "EPSG:4326"), ds);
  });

  test("NAD83 → WGS84 is a no-op (≈1-2 m, below render resolution)", async () => {
    const ds = new Dataset({ name: "n.tif", kind: "raster", crs: "EPSG:4269" });
    assert.equal(await warp(ds, "EPSG:4326"), ds);
  });

  test("guards throw with actionable messages", async () => {
    const raster = await parseSource(ab("4326.tif"), { name: "4326.tif" });
    const vector = await parseSource(ab("iowa_lakes_meta.geojson"), { name: "iowa_lakes_meta.geojson" });
    await assert.rejects(() => warp(null, "EPSG:4326"), /a Dataset is required/);
    await assert.rejects(() => warp(raster), /a target CRS is required/);
    await assert.rejects(() => warp(vector, "EPSG:26914"), /vector reprojection is not implemented/);
  });

  test("a vector no-ops rather than throwing when already in the target CRS", async () => {
    const vector = await parseSource(ab("iowa_lakes_meta.geojson"), { name: "iowa_lakes_meta.geojson" });
    assert.equal(await warp(vector, "EPSG:4326"), vector);
  });

  // NOT COVERED: an actual GDAL warp (a projected raster → EPSG:4326). gdal3.js is browser-only —
  // its Emscripten loader fails in Node ("sn.readFileSync is not a function") — so the warp path
  // needs browser verification. Everything up to the getGdal() call is covered above.
});
