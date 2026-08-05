// The SciWrid-backed adapter for multi-dimensional scientific formats (io/sciwrid.js).
// See docs/PACKAGE_ROADMAP.md §8. The selector plumbing this rides on is covered in dataset.test.mjs.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Dataset } from "../src/package/dataset.js";
import { Stats } from "../src/package/stats.js";
import { parseSciwrid, registerSciwridFormats, SCIWRID_FORMATS } from "../src/io/sciwrid.js";

// A real 120-step NetCDF4 (NLDAS-2 rainfall over Hurricane Idalia, ~900 KB) is vendored in
// assets/SampleFiles so these run on any clone — a skipped integration test is one nobody notices is
// gone. Override with FIMVIZ_NC_FIXTURE to point at a bigger/different file.
const FIXTURE = process.env.FIMVIZ_NC_FIXTURE ||
  fileURLToPath(new URL("../assets/SampleFiles/idalia-nldas2.nc", import.meta.url));

const range = (pixels) => {
  let n = 0, min = Infinity, max = -Infinity;
  for (const v of pixels) { if (Number.isNaN(v)) continue; n++; if (v < min) min = v; if (v > max) max = v; }
  return { n, min: n ? min : null, max: n ? max : null };
};

describe("sciwrid adapter: registration + preconditions", () => {
  test("registers a decoder for every format it claims", () => {
    registerSciwridFormats();
    for (const f of SCIWRID_FORMATS) {
      assert.ok(Dataset.formats().includes(f), `${f} should be decodable after registration`);
    }
  });

  test("is NOT auto-registered by importing the barrel — it stays opt-in", async () => {
    // The payload rule: io/materializers.js must never reach sciwrid, or its wasm lands in every
    // consumer's initial bundle. Guarded at the source level, since importing it here would
    // register the formats and defeat the check.
    const src = readFileSync(fileURLToPath(new URL("../src/io/materializers.js", import.meta.url)), "utf8");
    assert.ok(!/sciwrid/i.test(src), "io/materializers.js must not import or name the sciwrid adapter");
  });

  test("a Dataset with no variable to decode fails fast, naming the parser", async () => {
    registerSciwridFormats();
    const ds = new Dataset({ name: "bare.nc", format: "netcdf4", data: new ArrayBuffer(8),
      meta: { grid: { width: 2, height: 2, bbox: [0, 0, 1, 1] } } });
    await assert.rejects(() => ds.grid(), /no variable to decode.*parseSciwrid/s);
  });

  test("a Dataset with no target grid fails fast, saying why one is needed", async () => {
    registerSciwridFormats();
    const ds = new Dataset({ name: "nogrid.nc", format: "netcdf4", data: new ArrayBuffer(8),
      selector: { variable: "TMP", time: 0 } });
    await assert.rejects(() => ds.grid(), /no target grid.*extractGrid resamples/s);
  });

  test("an unusable source type is rejected before anything is read", async () => {
    await assert.rejects(() => parseSciwrid(42), /ArrayBuffer, TypedArray, Blob\/File, URL/);
  });
});

describe("sciwrid adapter: real NetCDF4", () => {
  const load = () => parseSciwrid(readFileSync(FIXTURE), { name: "idalia-nldas2.nc" });

  test("the vendored fixture is present — these tests must not silently stop running", () => {
    assert.ok(existsSync(FIXTURE), `missing NetCDF fixture: ${FIXTURE}`);
  });

  test("scan() becomes a lazy Dataset with a real time axis — nothing decoded yet", async () => {
    const ds = await load();
    assert.equal(ds.kind, "raster");
    assert.equal(ds.format, "netcdf4");
    assert.equal(ds.crs, "EPSG:4326", "extractGrid resamples to a geographic bbox — no GDAL warp");
    assert.equal(ds.isMaterialized, false, "scan() reads metadata only");
    assert.deepEqual(ds.bounds, { west: -87.9375, south: 25.0625, east: -75.0625, north: 36.9375 });
    assert.equal(ds.meta.variable, "Rainf");
    assert.equal(ds.meta.unit, "kg m-2");
    assert.deepEqual(ds.meta.grid.width + "x" + ds.meta.grid.height, "104x96", "the file's NATIVE grid");
    assert.equal(ds.axis.name, "time");
    assert.equal(ds.axis.entries.length, 120);
  });

  test("axis coords are epoch ms, so select()'s nearest-match works (a slider needs it)", async () => {
    const ds = await load();
    const entry = ds.selectAxisEntry(Date.parse("2023-08-28T06:29:00Z"));
    assert.equal(entry.meta.time, "2023-08-28T06:00:00Z", "29 minutes past → nearest hourly step");
    assert.equal(typeof entry.coord, "number", "ISO strings would disable nearest entirely");
  });

  test("selecting a timestep decodes exactly that slice, off the SAME bytes", async () => {
    const ds = await load();
    const t = ds.select(Date.parse("2023-08-28T06:00:00Z"));
    assert.deepEqual(t.selector, { variable: "Rainf", time: 6 });
    assert.equal(t.data, ds.data, "no second read of the file");

    const g = await t.grid();
    assert.equal(g.width, 104);
    assert.equal(g.height, 96);
    assert.equal(g.crs, "EPSG:4326");
    assert.equal(g.meta.unit, "kg m-2");
    const { n, min, max } = range(g.pixels);
    assert.equal(n, 5090, "the masked-out domain arrives as NaN, which the ops already treat as absent");
    assert.ok(min >= 0 && max > 1, `rainfall should be non-negative and non-trivial (got ${min}..${max})`);
  });

  test("the ops and read-models work on it unchanged — the point of decoding into RasterGrid", async () => {
    const ds = await load();
    const t = ds.select(Date.parse("2023-08-28T06:00:00Z"));

    const clipped = await t.clip({ north: 31, south: 27, east: -79, west: -84 }).grid();
    assert.ok(clipped.width < 104 && clipped.height < 96, "clip narrowed the footprint");

    const g = await t.grid();
    const stats = Stats.raster(g.pixels, {
      bw: g.bounds.west, bs: g.bounds.south, be: g.bounds.east, bn: g.bounds.north,
      width: g.width, height: g.height, unit: g.meta.unit,
    });
    assert.equal(stats.count, 5090, "Stats agrees with the grid on what counts as a value");
  });

  test("reduce() collapses 120 real timesteps — temporal aggregation, no new grid math", async () => {
    const ds = await load();
    const mean = await ds.reduce("mean").grid();
    const max = await ds.reduce("max").grid();
    assert.equal(mean.width, 104);
    assert.equal(mean.height, 96);
    assert.equal(range(mean.pixels).n, 5090, "the NaN mask survives the reduction");
    assert.ok(range(max.pixels).max > range(mean.pixels).max,
      "a storm peak must exceed the 5-day mean — the axis really was traversed");
  });

  test("a selected timestep round-trips through toRecord/fromRecord", async () => {
    const ds = await load();
    const rec = ds.select(Date.parse("2023-08-28T06:00:00Z")).toRecord();
    registerSciwridFormats();   // rehydration skips the parser, so the decoders must be registered
    const back = Dataset.fromRecord(rec);
    assert.deepEqual(back.selector, { variable: "Rainf", time: 6 });
    assert.equal((await back.grid()).width, 104, "and still decodes");
  });
});
