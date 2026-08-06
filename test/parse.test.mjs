// io/parse.js + geo/gdal.js CRS detection. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1.
//
// The load-bearing property: PARSING NEVER REPROJECTS. A Dataset comes back in its native CRS.
// Three of the sample rasters are UTM, so under the old implicit-warp parser these tests would
// have triggered a ~38 MB GDAL wasm download; they now run offline in milliseconds.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fromArrayBuffer } from "geotiff";
import { parseSource, csvHeaders, wktToGeometry } from "../src/io/parse.js";
import { readCrs, crsEquivalent, epsgNumber, encodeGridAsGeoTiff } from "../src/geo/gdal.js";
import { Dataset } from "../src/package/dataset.js";

const SAMPLES = fileURLToPath(new URL("../assets/SampleFiles/", import.meta.url));
const ab = (f) => {
  const b = readFileSync(SAMPLES + f);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

describe("geo/gdal: CRS detection", () => {
  test("reads the native CRS from geokeys", async () => {
    const cases = [
      ["4326.tif", "EPSG:4326"],
      ["Brazos_RP100_depth.tif", "EPSG:26914"],   // UTM 14N
      ["Ensemble.tif", "EPSG:26917"],             // UTM 17N
      ["Compare_0-0-DEP-12840.tif", "EPSG:4326"],
    ];
    for (const [file, expected] of cases) {
      const image = await (await fromArrayBuffer(ab(file))).getImage();
      assert.equal(readCrs(image), expected, file);
    }
  });

  test("crsEquivalent: NAD83 ≈ WGS84; unknown is never equivalent", () => {
    assert.equal(crsEquivalent("EPSG:4326", "EPSG:4326"), true);
    // 4269 ≈ 4326 within ~1-2 m — preserves the legacy isAlreadyWgs84() behaviour.
    assert.equal(crsEquivalent("EPSG:4269", "EPSG:4326"), true);
    assert.equal(crsEquivalent("EPSG:26915", "EPSG:4326"), false);
    assert.equal(crsEquivalent(null, "EPSG:4326"), false);
    assert.equal(crsEquivalent("EPSG:4326", null), false);
  });

  test("epsgNumber never returns 0 for unparseable input", () => {
    // Regression: Number("") === 0 && Number.isFinite(0), so the first cut returned 0 for null,
    // which would have made the legacy warpToEpsg4326 shim report `fromEpsg: 0` instead of null.
    assert.equal(epsgNumber("EPSG:26915"), 26915);
    assert.equal(epsgNumber(null), null);
    assert.equal(epsgNumber(""), null);
    assert.equal(epsgNumber("nonsense"), null);
  });
});

describe("geo/gdal: encodeGridAsGeoTiff (the pure half of warpGrid — no wasm, Node-testable)", () => {
  // warpGrid() itself needs GDAL wasm (browser-only — see docs/usage/USAGE.md "GDAL"), so it can't
  // run here. This is
  // the part that's actually new/risky: turning a decoded grid BACK into real GeoTIFF bytes. Round-
  // tripping through geotiff.js's own READER (the same library, its own decode path) is the strongest
  // check available without a browser — it confirms the file is well-formed and the geo-referencing
  // math (ModelPixelScale/ModelTiepoint from bounds+dimensions) round-trips exactly, independent of
  // whatever GDAL itself would later make of the (placeholder) CRS tags — see the function's own doc
  // comment for why the actual CRS is never trusted from this file, only from `-s_srs` at warp time.
  const bounds = { north: 10, south: 0, east: 20, west: 0 };

  test("round-trips dimensions, pixel values, and the geo-referencing (bounds) exactly", async () => {
    const pixels = new Float32Array([1, 2, 3, 4, 5, 6]);   // 3 wide x 2 tall
    const buf = encodeGridAsGeoTiff({ pixels, width: 3, height: 2, bounds }, "t.tif");
    assert.ok(buf instanceof ArrayBuffer);

    const image = await (await fromArrayBuffer(buf)).getImage();
    assert.equal(image.getWidth(), 3);
    assert.equal(image.getHeight(), 2);
    const [west, south, east, north] = image.getBoundingBox();
    assert.deepEqual({ north, south, east, west }, bounds, "ModelPixelScale/ModelTiepoint round-trip exactly");

    const rasters = await image.readRasters();
    const out = Array.isArray(rasters) ? rasters[0] : rasters;
    assert.deepEqual([...out], [1, 2, 3, 4, 5, 6]);
  });

  test("NaN pixels (this codebase's in-band 'no value' convention) survive the round-trip", async () => {
    const pixels = new Float32Array([1, NaN, 3, NaN]);
    const buf = encodeGridAsGeoTiff({ pixels, width: 2, height: 2, bounds }, "t.tif");
    const image = await (await fromArrayBuffer(buf)).getImage();
    const rasters = await image.readRasters();
    const out = Array.isArray(rasters) ? rasters[0] : rasters;
    assert.equal(out[0], 1);
    assert.ok(Number.isNaN(out[1]));
    assert.equal(out[2], 3);
    assert.ok(Number.isNaN(out[3]));
  });

  test("accepts a Float64Array input (a pure-JS grid op's own pixel type), casting to float32", async () => {
    const pixels = new Float64Array([1.5, 2.5, 3.5, 4.5]);
    const buf = encodeGridAsGeoTiff({ pixels, width: 2, height: 2, bounds }, "t.tif");
    const image = await (await fromArrayBuffer(buf)).getImage();
    const rasters = await image.readRasters();
    const out = Array.isArray(rasters) ? rasters[0] : rasters;
    assert.deepEqual([...out], [1.5, 2.5, 3.5, 4.5]);
  });

  test("throws naming the file when dimensions/bounds are missing, rather than encoding garbage", () => {
    assert.throws(() => encodeGridAsGeoTiff({ pixels: [1], width: 0, height: 1, bounds }, "bad.tif"),
      /"bad\.tif".*missing dimensions\/bounds/);
    assert.throws(() => encodeGridAsGeoTiff({ pixels: [1], width: 1, height: 1, bounds: null }, "bad.tif"),
      /missing dimensions\/bounds/);
  });

  // The dtype option: every real-valued GDAL type round-trips through its matching JS TypedArray —
  // exactly the intersection of GDAL's GDALDataType vocabulary and JS's native typed arrays (Byte↔
  // Uint8Array, UInt16↔Uint16Array, Int16↔Int16Array, UInt32↔Uint32Array, Int32↔Int32Array, Float32↔
  // Float32Array, Float64↔Float64Array). The complex GDAL types have no JS TypedArray counterpart at
  // all — which is a second, independent reason (besides geotiff.js's reader not decoding them) they
  // stay unsupported.
  const DTYPE_CASES = [
    ["Byte", Uint8Array, [0, 128, 255]],
    ["UInt16", Uint16Array, [0, 40000, 65535]],
    ["Int16", Int16Array, [-32768, 0, 32767]],
    ["UInt32", Uint32Array, [0, 3000000000, 4294967295]],
    ["Int32", Int32Array, [-2147483648, 0, 2147483647]],
    ["Float32", Float32Array, [1.5, -2.5, 3.5]],
    ["Float64", Float64Array, [1.123456789012, -2.5, 3.5]],
  ];

  for (const [dtype, Ctor, values] of DTYPE_CASES) {
    test(`dtype "${dtype}" round-trips through its matching TypedArray range`, async () => {
      const pixels = new Ctor(values);
      const buf = encodeGridAsGeoTiff({ pixels, width: 3, height: 1, bounds }, "t.tif", { dtype });
      const image = await (await fromArrayBuffer(buf)).getImage();
      const rasters = await image.readRasters();
      const out = Array.isArray(rasters) ? rasters[0] : rasters;
      assert.deepEqual([...out], values);
    });
  }

  test("rejects the complex GDAL types by name, explaining why (no JS TypedArray, no geotiff.js reader support)", () => {
    for (const dtype of ["CInt16", "CInt32", "CFloat32", "CFloat64"]) {
      assert.throws(() => encodeGridAsGeoTiff({ pixels: [1], width: 1, height: 1, bounds }, "t.tif", { dtype }),
        /complex sample format/, dtype);
    }
  });

  test("rejects an unrecognized dtype string, naming the valid options", () => {
    assert.throws(() => encodeGridAsGeoTiff({ pixels: [1], width: 1, height: 1, bounds }, "t.tif", { dtype: "Nonsense" }),
      /unknown dtype "Nonsense"/);
  });
});

describe("io/parse: parsing never reprojects", () => {
  test("a projected raster keeps its native CRS and native-unit bounds", async () => {
    const ds = await parseSource(ab("Brazos_RP100_depth.tif"), { name: "Brazos_RP100_depth.tif" });
    assert.equal(ds.crs, "EPSG:26914");
    assert.ok(ds.bounds.west > 500000, "bounds in metres, not degrees — the raster was NOT warped");
    assert.ok(ds.data instanceof ArrayBuffer);
  });

  test("a WGS84 raster parses with degree bounds", async () => {
    const ds = await parseSource(ab("4326.tif"), { name: "4326.tif" });
    assert.equal(ds.crs, "EPSG:4326");
    assert.ok(Math.abs(ds.bounds.west) <= 180 && Math.abs(ds.bounds.north) <= 90);
  });

  test("raster meta carries dims + nodata + raw GDAL_METADATA", async () => {
    const ds = await parseSource(ab("Brazos_RP100_depth.tif"), { name: "Brazos_RP100_depth.tif" });
    assert.equal(typeof ds.meta.width, "number");
    assert.equal(typeof ds.meta.height, "number");
    assert.ok("noData" in ds.meta && "gdalMetadata" in ds.meta);
    assert.ok(!("fromEpsg" in ds.meta), "fromEpsg is superseded by ds.crs");
  });
});

describe("io/parse: formats", () => {
  test("geojson → vector, EPSG:4326 by spec", async () => {
    const ds = await parseSource(ab("iowa_lakes_meta.geojson"), { name: "iowa_lakes_meta.geojson" });
    assert.equal(ds.kind, "vector");
    assert.equal(ds.format, "geojson");
    assert.equal(ds.crs, "EPSG:4326");
    assert.ok(ds.meta.featureCount > 0);
  });

  test("HAZUS damage is detected by shape, not extension", async () => {
    // A root `buildings` array of {lat,lng} points — not a FeatureCollection.
    const ds = await parseSource(ab("cedar_rapids_damage.json"), { name: "cedar_rapids_damage.json" });
    assert.equal(ds.format, "hazus");
    assert.equal(ds.meta.damage, true);
    assert.ok(ds.meta.buildingCount > 0);
    assert.ok(ds.bounds.west < 0 && ds.bounds.north > 0);
  });

  test("an unknown extension throws a listing error", async () => {
    await assert.rejects(() => parseSource(ab("4326.tif"), { name: "x.bogus" }),
      /unsupported or undetected format/i);
  });

  test("every Dataset declares a CRS", async () => {
    for (const f of ["4326.tif", "iowa_lakes_meta.geojson", "cedar_rapids_damage.json"]) {
      const ds = await parseSource(ab(f), { name: f });
      assert.ok(ds.crs, `${f} has no crs`);
      assert.ok(ds instanceof Dataset);
    }
  });
});

// The multi-dimensional formats reach the SAME public parser as a GeoTIFF — `addDataset(file)`, no
// opt-in import, no adapter name in the caller's code. What makes that affordable is that parse.js
// reaches the adapter through a dynamic import, so a consumer who never opens one of these files
// never loads it; these tests pin both halves.
describe("io/parse: multi-dimensional formats route to the adapter", () => {
  const NC = fileURLToPath(new URL("../assets/SampleFiles/idalia-nldas2.nc", import.meta.url));

  test("a .nc parses through parseSource with no adapter import by the caller", async () => {
    const ds = await parseSource(ab("idalia-nldas2.nc"), { name: "idalia-nldas2.nc" });
    assert.equal(ds.format, "netcdf4", "the scanner names the format — '.nc' cannot");
    assert.equal(ds.kind, "raster");
    assert.equal(ds.axis.name, "time");
    assert.equal(ds.axis.entries.length, 120);
  });

  test("options pass straight through to the adapter", async () => {
    const ds = await parseSource(ab("idalia-nldas2.nc"),
      { name: "override.nc", grid: { bbox: [-90, 24, -74, 38] } });
    assert.deepEqual(ds.bounds, { west: -90, south: 24, east: -74, north: 38 });
    assert.equal(ds.name, "override.nc");
  });

  test("its errors name the public call, so the adapter stays invisible in failure too", async () => {
    await assert.rejects(
      () => parseSource(readFileSync(NC), { name: "x.nc", grid: { bbox: [10, 10, 5, 5] } }),
      (e) => {
        assert.match(e.message, /^parseFile:/, "prefixed like every other parse error");
        assert.ok(!/sciwrid/i.test(e.message), "and never names the reader");
        return true;
      });
  });

  test("the sentinel list matches the adapter's own, so the copy cannot drift", async () => {
    // parse.js duplicates SCIWRID_FORMATS rather than importing it — a static import would pull the
    // adapter into the initial bundle and undo the deferral this whole arrangement exists for.
    const { SCIWRID_FORMATS } = await import("../src/io/sciwrid.js");
    const src = readFileSync(fileURLToPath(new URL("../src/io/parse.js", import.meta.url)), "utf8");
    const listed = /MULTIDIM_FORMATS = new Set\(\[([^\]]*)\]\)/.exec(src)[1]
      .match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
    assert.deepEqual(listed.filter((f) => f !== "multidim").sort(), [...SCIWRID_FORMATS].sort());
  });

  test("parse.js does not STATICALLY import the adapter — the payload rule", () => {
    const src = readFileSync(fileURLToPath(new URL("../src/io/parse.js", import.meta.url)), "utf8");
    assert.ok(!/^import .*sciwrid/m.test(src),
      "sciwrid.js must be reached through import(), or its ~193 KB reader lands in every bundle");
    assert.match(src, /import\("\.\/sciwrid\.js"\)/, "and it must actually be reached that way");
  });
});

describe("wktToGeometry", () => {
  test("POINT", () => {
    assert.deepEqual(wktToGeometry("POINT (10 20)"), { type: "Point", coordinates: [10, 20] });
  });
  test("LINESTRING", () => {
    assert.deepEqual(wktToGeometry("LINESTRING (0 0, 10 10, 20 25)"),
      { type: "LineString", coordinates: [[0, 0], [10, 10], [20, 25]] });
  });
  test("POLYGON with a hole", () => {
    const g = wktToGeometry("POLYGON ((0 0, 0 10, 10 10, 10 0, 0 0), (2 2, 2 4, 4 4, 4 2, 2 2))");
    assert.equal(g.type, "Polygon");
    assert.equal(g.coordinates.length, 2);
    assert.deepEqual(g.coordinates[0][0], [0, 0]);
    assert.deepEqual(g.coordinates[1][0], [2, 2]);
  });
  test("MULTIPOLYGON (two simple polygons)", () => {
    const g = wktToGeometry("MULTIPOLYGON (((0 0, 0 10, 10 10, 0 0)), ((20 20, 20 30, 30 30, 20 20)))");
    assert.equal(g.type, "MultiPolygon");
    assert.equal(g.coordinates.length, 2);
    assert.deepEqual(g.coordinates[0][0][0], [0, 0]);
    assert.deepEqual(g.coordinates[1][0][0], [20, 20]);
  });
  test("MULTIPOINT (both bare and parenthesized forms)", () => {
    assert.deepEqual(wktToGeometry("MULTIPOINT (0 0, 10 10)"), { type: "MultiPoint", coordinates: [[0, 0], [10, 10]] });
    assert.deepEqual(wktToGeometry("MULTIPOINT ((0 0), (10 10))"), { type: "MultiPoint", coordinates: [[0, 0], [10, 10]] });
  });
  test("an unsupported type throws", () => {
    assert.throws(() => wktToGeometry("GEOMETRYCOLLECTION (POINT (0 0))"), /unsupported WKT type/);
  });
  test("garbage input throws", () => {
    assert.throws(() => wktToGeometry("not wkt at all"), /not recognized as WKT/);
  });
});

describe("io/parse: csv (column-mapped, with a WKT/GeoJSON geometry-column escape hatch)", () => {
  const blob = (text) => new Blob([text]);

  test("csvHeaders reads the header row without parsing", () => {
    assert.deepEqual(csvHeaders("Lat,Lng,Name\n30,-90,A\n"), ["Lat", "Lng", "Name"]);
  });

  test("explicit { latField, lngField } builds Point features; other columns become properties", async () => {
    const text = "Y,X,Site\n30.1,-90.2,gauge-1\n30.5,-90.6,gauge-2\n";
    const ds = await parseSource(blob(text), { name: "gauges.csv", latField: "Y", lngField: "X" });
    assert.equal(ds.kind, "vector");
    assert.equal(ds.format, "csv");
    assert.equal(ds.data.features.length, 2);
    assert.deepEqual(ds.data.features[0].geometry, { type: "Point", coordinates: [-90.2, 30.1] });
    assert.deepEqual(ds.data.features[0].properties, { Site: "gauge-1" });
  });

  test("common column names are auto-detected with no mapping given", async () => {
    const text = "latitude,longitude,z\n30.1,-90.2,5\n";
    const ds = await parseSource(blob(text), { name: "auto.csv" });
    assert.deepEqual(ds.data.features[0].geometry.coordinates, [-90.2, 30.1]);
  });

  test("{ geometryField } accepts a WKT cell per row", async () => {
    const text = 'id,shape\n1,"POINT (-90.2 30.1)"\n';
    const ds = await parseSource(blob(text), { name: "wkt.csv", geometryField: "shape" });
    assert.deepEqual(ds.data.features[0].geometry, { type: "Point", coordinates: [-90.2, 30.1] });
    assert.deepEqual(ds.data.features[0].properties, { id: "1" });
  });

  test("{ geometryField } also accepts a JSON-encoded GeoJSON geometry per row", async () => {
    const text = 'id,shape\n1,"{""type"":""Point"",""coordinates"":[-90.2,30.1]}"\n';
    const ds = await parseSource(blob(text), { name: "geojsoncell.csv", geometryField: "shape" });
    assert.deepEqual(ds.data.features[0].geometry, { type: "Point", coordinates: [-90.2, 30.1] });
  });

  test("quoted fields with an embedded delimiter parse correctly", async () => {
    const text = 'lat,lng,note\n30,-90,"hello, world"\n';
    const ds = await parseSource(blob(text), { name: "quoted.csv" });
    assert.equal(ds.data.features[0].properties.note, "hello, world");
  });

  test("no mapping + no auto-detectable columns throws a listing error with .columns", async () => {
    const text = "a,b,c\n1,2,3\n";
    await assert.rejects(
      () => parseSource(blob(text), { name: "nomatch.csv" }),
      (err) => { assert.match(err.message, /couldn't detect coordinate columns/); assert.deepEqual(err.columns, ["a", "b", "c"]); return true; },
    );
  });

  test("a bad column name throws, naming the available columns", async () => {
    const text = "lat,lng\n30,-90\n";
    await assert.rejects(() => parseSource(blob(text), { name: "x.csv", latField: "Y", lngField: "lng" }),
      /no column "Y"/);
  });

  test("rows with a non-numeric coordinate are skipped, not fatal", async () => {
    const text = "lat,lng\n30,-90\nNaN,-91\n31,-92\n";
    const ds = await parseSource(blob(text), { name: "partial.csv" });
    assert.equal(ds.data.features.length, 2);
  });
});

describe("io/parse: xyz (headerless x,y,z point files)", () => {
  const blob = (text) => new Blob([text]);

  test("parses whitespace-separated x y z rows into Point features with z as a property", async () => {
    const text = "-90.2 30.1 5.5\n-90.6 30.5 6.0\n";
    const ds = await parseSource(blob(text), { name: "pts.xyz" });
    assert.equal(ds.format, "xyz");
    assert.equal(ds.data.features.length, 2);
    assert.deepEqual(ds.data.features[0].geometry, { type: "Point", coordinates: [-90.2, 30.1] });
    assert.equal(ds.data.features[0].properties.z, 5.5);
  });

  test("also accepts comma-separated rows", async () => {
    const ds = await parseSource(blob("-90.2,30.1,5.5\n"), { name: "pts.xyz" });
    assert.deepEqual(ds.data.features[0].geometry.coordinates, [-90.2, 30.1]);
  });

  test("{ swapXY: true } reads northing/easting-first rows", async () => {
    const ds = await parseSource(blob("30.1 -90.2 5.5\n"), { name: "pts.xyz", swapXY: true });
    assert.deepEqual(ds.data.features[0].geometry.coordinates, [-90.2, 30.1]);
  });

  test("extra columns become z2, z3, …", async () => {
    const ds = await parseSource(blob("-90.2 30.1 5.5 12\n"), { name: "pts.xyz" });
    assert.equal(ds.data.features[0].properties.z2, 12);
  });

  test("a malformed line is skipped, not fatal", async () => {
    const ds = await parseSource(blob("-90.2 30.1 5.5\nnot a row\n-90.6 30.5 6.0\n"), { name: "pts.xyz" });
    assert.equal(ds.data.features.length, 2);
  });
});

describe("io/parse: resolveUrl wiring — the host CORS-proxy/mirror seam (instance-safe)", () => {
  const FC = JSON.stringify({ type: "FeatureCollection",
    features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} }] });
  const stubFetch = (record) => async (u) => {
    record.url = u;
    return new Response(FC, { status: 200, headers: { "content-type": "application/geo+json" } });
  };

  test("a URL source is fetched through options.resolveUrl (the RESOLVED url)", async () => {
    const orig = globalThis.fetch, rec = {};
    globalThis.fetch = stubFetch(rec);
    try {
      const ds = await parseSource("https://data.example/x.geojson",
        { resolveUrl: (u) => "https://proxy/?u=" + encodeURIComponent(u) });
      assert.equal(rec.url, "https://proxy/?u=" + encodeURIComponent("https://data.example/x.geojson"));
      assert.equal(ds.kind, "vector");
      assert.equal(ds.name, "x.geojson", "name still derives from the ORIGINAL source, not the proxied url");
    } finally { globalThis.fetch = orig; }
  });

  test("without resolveUrl, the original url is fetched unchanged", async () => {
    const orig = globalThis.fetch, rec = {};
    globalThis.fetch = stubFetch(rec);
    try {
      await parseSource("https://data.example/y.geojson");
      assert.equal(rec.url, "https://data.example/y.geojson");
    } finally { globalThis.fetch = orig; }
  });
});
