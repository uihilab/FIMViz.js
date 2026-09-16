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
    await assert.rejects(() => ds.grid(), /no variable to decode.*addDataset/s);
  });

  test("a Dataset with no target grid fails fast, saying why one is needed", async () => {
    registerSciwridFormats();
    const ds = new Dataset({ name: "nogrid.nc", format: "netcdf4", data: new ArrayBuffer(8),
      selector: { variable: "TMP", time: 0 } });
    await assert.rejects(() => ds.grid(), /no target grid.*resamples/s);
  });

  // The reader is our implementation choice, not a fact about the caller's data — so a user who
  // never opens src/ has no way to learn the name, and no reason to. Pinned because it is exactly the
  // kind of thing that erodes one message at a time.
  test("no user-facing error names the reader", () => {
    const src = readFileSync(fileURLToPath(new URL("../src/io/sciwrid.js", import.meta.url)), "utf8");
    const thrown = src.match(/new Error\((?:[^()]|\([^()]*\))*\)/gs) || [];
    const leaks = thrown.filter((m) => /sciwrid/i.test(m) && !/'sciwrid-toolkit' reader/.test(m));
    assert.deepEqual(leaks, [], "thrown messages must name the public call, not the vendor " +
      "(the sole exception is the load failure, whose fix IS that specifier)");
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

  test("opts.grid is a PARTIAL override — a bbox alone keeps the file's own pixel dims", async () => {
    // The escape hatch for files whose extent scan() cannot derive (2-D curvilinear coordinates).
    const ds = await parseSciwrid(readFileSync(FIXTURE), {
      name: "override", grid: { bbox: [-90, 24, -74, 38] },
    });
    assert.deepEqual(ds.bounds, { west: -90, south: 24, east: -74, north: 38 }, "the supplied extent");
    assert.equal(ds.meta.grid.width, 104, "width still from the variable's own shape");
    assert.equal(ds.meta.grid.height, 96, "height too");
    const g = await ds.select(ds.axis.entries[0].coord).grid();
    assert.equal(g.width, 104);
    assert.deepEqual(g.bounds, { west: -90, south: 24, east: -74, north: 38 }, "and it decodes there");
  });

  test("a malformed bbox override is rejected rather than silently misplacing the data", async () => {
    await assert.rejects(
      () => parseSciwrid(readFileSync(FIXTURE), { grid: { bbox: [10, 10, 5, 5] } }),
      /max is not greater than min/);
  });

  // A wrong extent is worse than a missing one: the missing one throws, the wrong one puts every
  // pixel confidently somewhere it isn't. scan() takes min/max of anything NAMED like a coordinate,
  // including projected `x`/`y` in metres, so the numbers must be range-checked as degrees.
  test("a PROJECTED extent (x/y in metres) is rejected, not silently believed", async () => {
    await assert.rejects(
      // A real HRRR-shaped Lambert Conformal extent, in metres.
      () => parseSciwrid(readFileSync(FIXTURE), { grid: { bbox: [-2699020, -1588806, 2697980, 1588806] } }),
      (e) => {
        assert.match(e.message, /latitudes are out of range/);
        assert.match(e.message, /metres, not degrees/, "must name the likely cause");
        return true;
      });
  });

  test("a latitude just past the pole is caught — the boundary, not just absurd values", async () => {
    await assert.rejects(
      () => parseSciwrid(readFileSync(FIXTURE), { grid: { bbox: [-100, -91, -80, 45] } }),
      /\|lat\| must be <= 90/);
  });

  test("the 0..360 longitude convention is still accepted", async () => {
    // Both -180..180 and 0..360 are in wide use; rejecting the latter would break real files.
    const ds = await parseSciwrid(readFileSync(FIXTURE), { grid: { bbox: [270, 24, 285, 37] } });
    assert.deepEqual(ds.bounds, { west: 270, south: 24, east: 285, north: 37 });
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

// "GRIB2 and Zarr become repeat applications of the same glue" (PACKAGE_ROADMAP.md §8). They are —
// but only after the one format-specific difference below, which is why they are tested and not
// merely registered: registering a format the adapter cannot actually read is a false claim.
describe("sciwrid adapter: GRIB2", () => {
  // NCEP Stage IV precipitation, trimmed to 4 messages with SciWrid's own trim() (26 MB → 930 KB).
  const FIX = fileURLToPath(new URL("../assets/SampleFiles/idalia-stage4-4h.grb2", import.meta.url));
  const EXTENT = { bbox: [-87.98, 24.02, -75.01, 36.99], width: 200, height: 200 };

  test("dimensions come from nx/ny — GRIB2 reports no `shape` at all", async () => {
    // A GRIB2 message IS one 2-D field, so scan() gives nx/ny (+ `messages` for the count) rather
    // than a CF shape string. Reading `shape` alone threw "no usable 2-D shape".
    const ds = await parseSciwrid(readFileSync(FIX), { grid: EXTENT });
    assert.equal(ds.format, "grib2");
    assert.equal(ds.meta.variable, "Total precipitation");
    assert.equal(ds.axis.entries.length, 4, "one axis entry per message");
  });

  test("GRIB2 never reports an extent — the FORMAT, not this file's grid", async () => {
    // Easy to misdiagnose: Stage IV is polar-stereographic, so "curvilinear" looks like the cause.
    // It isn't. SciWrid assigns a bbox only on its netcdf4/zarr/parquet paths, so a rectilinear GRIB2
    // is equally extent-less. The message must say that, or it sends the reader to inspect the file.
    await assert.rejects(() => parseSciwrid(readFileSync(FIX)), (e) => {
      assert.match(e.message, /no usable geographic extent/);
      assert.match(e.message, /never derives an extent for grib2/, "must blame the format");
      assert.ok(!/curvilinear/i.test(e.message),
        "and must NOT suggest curvilinear coords, which is a different cause entirely");
      assert.match(e.message, /addDataset\(file, \{/, "and show the PUBLIC call that fixes it");
      return true;
    });
  });

  test("decodes and reduces once an extent is given", async () => {
    const ds = await parseSciwrid(readFileSync(FIX), { grid: EXTENT });
    const g = await ds.select(ds.axis.entries[1].coord).grid();
    assert.equal(g.width, 200);
    assert.equal(g.crs, "EPSG:4326", "resampled off the polar grid onto the requested window");
    const max = await ds.reduce("max").grid();
    assert.ok(range(max.pixels).max > 0, "accumulated precipitation over 4 hours");
    assert.ok(range(max.pixels).max >= range(g.pixels).max, "a max over the axis bounds any one step");
  });
});

describe("sciwrid adapter: Zarr v2", () => {
  // AORC precipitation. Unlike the GRIB2 above this store HAS CF coordinates, so it needs no override
  // — the same code path, no format-specific handling, which is the claim §8 makes.
  const FIX = fileURLToPath(new URL("../assets/SampleFiles/idalia-aorc.zarr.zip", import.meta.url));

  test("works with no override at all — real coordinates give a real extent", async () => {
    const ds = await parseSciwrid(readFileSync(FIX));
    assert.equal(ds.format, "zarr");
    assert.equal(ds.meta.variable, "APCP_surface");
    assert.equal(ds.meta.grid.width, 390);
    assert.equal(ds.meta.grid.height, 390);
    assert.equal(ds.axis.entries.length, 120);
    assert.ok(ds.bounds.west < -87 && ds.bounds.east > -76, `real extent, got ${JSON.stringify(ds.bounds)}`);
  });

  test("shape arrives as an ARRAY here, not a string — both parse to the same dims", async () => {
    const ds = await parseSciwrid(readFileSync(FIX));
    const g = await ds.select(ds.axis.entries[10].coord).grid();
    assert.equal(g.width, 390);
    assert.equal(g.height, 390);
    assert.equal(g.crs, "EPSG:4326");
    assert.ok(range(g.pixels).n > 0);
  });
});

// NetCDF3 needed BOTH an extent override and an acknowledgement, and neither limitation was real:
// SciWrid populates a bbox only on its netcdf4/zarr/parquet paths and cannot yet decode NetCDF3 time
// units, but the files themselves carry `lon`/`lat`/`time` coordinate variables with CF units right
// there in the header. io/netcdf3.js reads them, so a NetCDF3 file now opens with no options at all.
describe("sciwrid adapter: NetCDF3 (header-supplemented — no overrides needed)", () => {
  const FIX = fileURLToPath(new URL("../assets/SampleFiles/sample.nc3", import.meta.url));

  test("opens with NO options — extent and timestamps both come from the file's own header", async () => {
    const ds = await parseSciwrid(readFileSync(FIX));
    // lat centres 30..33 step 1, lon centres -95..-91 step 1 → cell EDGES, not centres.
    assert.deepEqual(ds.bounds, { west: -95.5, south: 29.5, east: -90.5, north: 33.5 },
      "cell edges — using centres would lose half a cell on every side");
    assert.equal(ds.meta.extraDims, undefined, "nothing collapsed, so nothing to acknowledge");
    assert.equal(ds.axis.entries.length, 3);
    assert.equal(ds.axis.unit, "ms", "'hours since 2020-01-01' on a standard calendar → real instants");
    assert.equal(ds.meta.axisSource, "header");
    assert.deepEqual(ds.axis.entries.map((e) => e.coord), [
      Date.parse("2020-01-01T00:00:00Z"), Date.parse("2020-01-01T06:00:00Z"),
      Date.parse("2020-01-01T12:00:00Z"),
    ]);
  });

  test("select() and reduce() work on it — the payoff of routing through the axis", async () => {
    const ds = await parseSciwrid(readFileSync(FIX));
    const g0 = await ds.select(Date.parse("2020-01-01T00:00:00Z")).grid();
    assert.equal(g0.width, 5);
    assert.equal(g0.height, 4);
    assert.equal(range(g0.pixels).n, 20, "every cell decoded");
    const g2 = await ds.select(Date.parse("2020-01-01T12:00:00Z")).grid();
    assert.notDeepEqual([...g0.pixels], [...g2.pixels], "different steps are genuinely different data");
    const mean = await ds.reduce("mean").grid();
    assert.equal(range(mean.pixels).n, 20, "and the whole axis collapses with no new grid math");
  });

  test("header: false restores the unsupplemented behaviour — the extent error returns", async () => {
    // Worth pinning both halves: the supplement is what makes the file work, and turning it off must
    // land exactly on the old, correct diagnosis rather than on some third state.
    await assert.rejects(() => parseSciwrid(readFileSync(FIX), { header: false }), (e) => {
      assert.match(e.message, /never derives an extent for netcdf3/,
        "must blame the format, not send the reader hunting for curvilinear coordinates");
      return true;
    });
    const ds = await parseSciwrid(readFileSync(FIX),
      { header: false, grid: { bbox: [-10, -5, 10, 5] } });
    assert.equal(ds.axis.unit, "index", "and with no header the axis falls back to positions");
    assert.equal(ds.meta.axisSource, "index");
  });

  test("an explicit override still beats the header — the caller is always the authority", async () => {
    const ds = await parseSciwrid(readFileSync(FIX), {
      grid: { bbox: [-100, 20, -80, 40] },
      series: { coords: [10, 20, 30] },
    });
    assert.deepEqual(ds.bounds, { west: -100, south: 20, east: -80, north: 40 });
    assert.deepEqual(ds.axis.entries.map((e) => e.coord), [10, 20, 30]);
    assert.equal(ds.meta.axisSource, "caller");
  });

  test("a coords GENERATOR is accepted too, and nearest-match works off it", async () => {
    const ds = await parseSciwrid(readFileSync(FIX), {
      series: { coords: (i) => new Date(Date.UTC(2001, i, 1)), name: "time" },
    });
    assert.equal(ds.axis.unit, "ms");
    assert.deepEqual(ds.axis.entries.map((e) => e.coord),
      [Date.UTC(2001, 0, 1), Date.UTC(2001, 1, 1), Date.UTC(2001, 2, 1)]);
    // Nearest-match on a date the file never names — the thing a time slider needs.
    assert.equal(ds.select(Date.UTC(2001, 1, 5)).selector.time, 1, "Feb 5 → the Feb 1 step");
    assert.equal(ds.select(Date.UTC(2001, 1, 20)).selector.time, 2, "…but Feb 20 is nearer Mar 1");
  });

  test("series: false restores the old single-grid behaviour, acknowledgement and all", async () => {
    await assert.rejects(
      () => parseSciwrid(readFileSync(FIX), { series: false }),
      /has 3 dimensions.*only 2 are modelled/s,
      "with no axis to model it, the leading dimension is unmodelled again");
    const ds = await parseSciwrid(readFileSync(FIX), { series: false, allowExtraDims: true });
    assert.equal(ds.axes, null);
    assert.deepEqual(ds.selector, { variable: "temperature", time: 0 });
  });
});

// The two geometry conventions a caller can override. Both default to what CF files overwhelmingly
// use, so neither changes an existing call.
describe("sciwrid adapter: grid conventions (dims.order, lon)", () => {
  const FIX = fileURLToPath(new URL("../assets/SampleFiles/idalia-nldas2.nc", import.meta.url));

  test("dims.order picks which trailing pair is (lat, lon); 'yx' is CF and the default", async () => {
    const cf = await parseSciwrid(readFileSync(FIX));
    assert.equal(cf.meta.grid.height, 96, "shape 120x96x104 → (…, lat=96, lon=104)");
    assert.equal(cf.meta.grid.width, 104);
    const xy = await parseSciwrid(readFileSync(FIX), { dims: { order: "xy" } });
    assert.equal(xy.meta.grid.height, 104, "'xy' reads the pair as (…, lon, lat)");
    assert.equal(xy.meta.grid.width, 96);
  });

  test("an explicit width/height still wins over either order", async () => {
    const ds = await parseSciwrid(readFileSync(FIX), { dims: { order: "xy" }, grid: { width: 10, height: 20 } });
    assert.equal(ds.meta.grid.width, 10);
    assert.equal(ds.meta.grid.height, 20);
  });

  test("lon defaults to 'native' — the file's own convention is left alone", async () => {
    const ds = await parseSciwrid(readFileSync(FIX), { grid: { bbox: [270, 24, 285, 37] } });
    assert.deepEqual(ds.bounds, { west: 270, south: 24, east: 285, north: 37 });
    assert.equal(ds.meta.lon, undefined, "nothing recorded, nothing to undo at decode time");
  });

  test("a regional extent a whole turn away is RELABELLED — no pixel work at all", async () => {
    const ds = await parseSciwrid(readFileSync(FIX),
      { grid: { bbox: [270, 24, 285, 37] }, lon: "-180..180" });
    assert.deepEqual(ds.bounds, { west: -90, south: 24, east: -75, north: 37 });
    assert.equal(ds.meta.lon.shiftCols, 0, "a pure relabel — the data is identical");
    const g = await ds.select(ds.axis.entries[0].coord).grid();
    assert.deepEqual(g.bounds, { west: -90, south: 24, east: -75, north: 37 },
      "and the decoded grid agrees with the Dataset");
  });

  test("a GLOBAL extent is genuinely rolled — the reader cannot do this for us", async () => {
    // Asking extractGrid for [-180,…,180] on a 0..360 file returns the same pixels with the requested
    // bbox echoed back, which would put the Pacific where the Atlantic belongs. So the roll happens
    // here, on the decoded grid. The bbox below is synthetic (this is a regional file) — what is being
    // pinned is the column arithmetic, which is what would silently misplace data if it were wrong.
    const opts = { grid: { bbox: [0, 24, 360, 37], width: 104, height: 96 } };
    const native = await parseSciwrid(readFileSync(FIX), opts);
    const rolled = await parseSciwrid(readFileSync(FIX), { ...opts, lon: "-180..180" });
    assert.deepEqual(rolled.bounds, { west: -180, south: 24, east: 180, north: 37 });
    assert.equal(rolled.meta.lon.shiftCols, 52, "half of 104 columns — the antimeridian moves to centre");

    const a = await native.select(native.axis.entries[0].coord).grid();
    const b = await rolled.select(rolled.axis.entries[0].coord).grid();
    const eq = (x, y) => (Number.isNaN(x) && Number.isNaN(y)) || x === y;
    for (let r = 0; r < 96; r++) {
      for (let c = 0; c < 104; c++) {
        assert.ok(eq(b.pixels[r * 104 + c], a.pixels[r * 104 + ((c + 52) % 104)]),
          `row ${r} col ${c} must read the native column 52 to its east`);
      }
    }
  });

  test("'0..360' is the same machinery in the other direction", async () => {
    const ds = await parseSciwrid(readFileSync(FIX),
      { grid: { bbox: [-90, 24, -75, 37] }, lon: "0..360" });
    assert.deepEqual(ds.bounds, { west: 270, south: 24, east: 285, north: 37 });
  });

  test("an extent that can be neither rolled nor relabelled throws instead of guessing", async () => {
    // Straddling the target window's edge without being global would need the grid split and rejoined.
    await assert.rejects(
      () => parseSciwrid(readFileSync(FIX), { grid: { bbox: [170, 24, 190, 37] }, lon: "-180..180" }),
      /neither global nor a whole 360.*split and re-joined/s);
  });
});

// A variable with dimensions beyond (lat, lon) + time — T(time, level, lat, lon) is ordinary in
// ERA5/GFS/CMIP — must not quietly become a normal-looking scrubber over a level nobody chose.
describe("sciwrid adapter: unmodelled dimensions", () => {
  // No 4-D fixture is vendored, so the arithmetic is pinned directly: the guard is
  // dims.length > 2 + (hasTime ? 1 : 0), and these assert the boundary either side of it.
  const FIX = fileURLToPath(new URL("../assets/SampleFiles/idalia-nldas2.nc", import.meta.url));

  test("a 3-D (time, lat, lon) variable is fully modelled and passes untouched", async () => {
    const ds = await parseSciwrid(readFileSync(FIX));
    assert.equal(ds.meta.extraDims, undefined, "nothing was collapsed, so nothing is recorded");
    assert.equal(ds.axis.entries.length, 120);
  });

  test("a dimension nothing models still counts as unmodelled", async () => {
    // The guard is arithmetic on the DECLARED SHAPE, not on what the reader admits to. sample.nc3 is
    // (time, lat, lon); `series: false` removes the axis that models dimension 0, so it is unmodelled
    // again and the guard must catch it — the same arithmetic that caught netcdf3's invisible time
    // dimension before the index axis existed to model it.
    const nc3 = readFileSync(fileURLToPath(new URL("../assets/SampleFiles/sample.nc3", import.meta.url)));
    const base = { grid: { bbox: [-10, -5, 10, 5] }, series: false };
    await assert.rejects(() => parseSciwrid(nc3, base), /has 3 dimensions.*only 2 are modelled/s);
    const ok = await parseSciwrid(nc3, { ...base, allowExtraDims: true });
    assert.equal(ok.meta.extraDims, 1);
    assert.equal(ok.meta.shape, "3x4x5", "the shape is kept so a consumer can see what was dropped");
  });
});

// A NetCDF4 file whose leading dimension is not a CF time coordinate, like DWR's weather generator
// grids (dimension `date`, integer day numbers, no `units`). The decoder returns step 0 for any index
// on such a file, so parseSciwrid refuses to build a series over it.
describe("sciwrid adapter: NetCDF4 without a CF time coordinate", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const h5wasm = await import("h5wasm/node");
  await h5wasm.ready;
  const NT = 3, NY = 4, NX = 5;

  /** Three steps whose values are step * 100 + cell index, on a 4 x 5 north-up grid. */
  const writeNetcdf4 = (path, { cfTime }) => {
    const f = new h5wasm.File(path, "w");
    const tName = cfTime ? "time" : "date";
    const t = cfTime
      ? f.create_dataset({ name: "time", data: new Float64Array([0, 1, 2]), shape: [NT], dtype: "<f8" })
      : f.create_dataset({ name: "date", data: new BigInt64Array([42004n, 42005n, 42006n]), shape: [NT], dtype: "<q" });
    if (cfTime) t.create_attribute("units", "days since 2015-01-01");
    const lat = f.create_dataset({ name: "lat", data: new Float64Array([32, 32.5, 33, 33.5]), shape: [NY], dtype: "<f8" });
    lat.create_attribute("units", "degrees_north");
    const lon = f.create_dataset({ name: "lon", data: new Float64Array([-124, -123.75, -123.5, -123.25, -123]), shape: [NX], dtype: "<f8" });
    lon.create_attribute("units", "degrees_east");
    t.make_scale(tName); lat.make_scale("lat"); lon.make_scale("lon");
    const data = new Float32Array(NT * NY * NX);
    for (let k = 0; k < NT; k++) for (let c = 0; c < NY * NX; c++) data[k * NY * NX + c] = k * 100 + c;
    const v = f.create_dataset({ name: "pr", data, shape: [NT, NY, NX], dtype: "<f4" });
    v.create_attribute("units", "mm");
    v.attach_scale(0, tName); v.attach_scale(1, "lat"); v.attach_scale(2, "lon");
    f.close();
    const b = readFileSync(path);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };

  const dir = mkdtempSync(join(tmpdir(), "fimviz-nc4-"));
  const dateOnly = writeNetcdf4(join(dir, "date-only.nc"), { cfTime: false });
  const cfTime = writeNetcdf4(join(dir, "cf-time.nc"), { cfTime: true });
  rmSync(dir, { recursive: true, force: true });
  // Row 3 of a north-up grid is lat 32, column 0 is lon -124: native cell 0.
  const southWest = (grid) => grid.pixels[(NY - 1) * NX];

  test("refuses a series it would decode as the first step at every position", async () => {
    await assert.rejects(parseSciwrid(dateOnly, { name: "date-only.nc" }), /no CF time coordinate/);
    await assert.rejects(parseSciwrid(dateOnly, { name: "date-only.nc", series: { coords: [0, 1, 2] } }),
      /no CF time coordinate/, "caller coordinates do not change what the decoder indexes");
  });

  test("series: false reads the first step on purpose", async () => {
    const ds = await parseSciwrid(dateOnly, { name: "date-only.nc", series: false, allowExtraDims: true });
    assert.equal(ds.axis, null);
    assert.equal(southWest(await ds.grid()), 0);
  });

  test("with a CF time coordinate, each step decodes its own values", async () => {
    const ds = await parseSciwrid(cfTime, { name: "cf-time.nc" });
    assert.equal(ds.axis.entries.length, NT);
    assert.equal(ds.meta.axisSource, "scan");
    for (let k = 0; k < NT; k++) {
      assert.equal(southWest(await ds.select(ds.axis.entries[k].coord).grid()), k * 100, `step ${k}`);
    }
  });
});
