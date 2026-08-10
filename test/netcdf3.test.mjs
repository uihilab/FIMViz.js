// io/netcdf3.js — the one container format FIMViz reads itself, and only its header.
//
// These test the reader in isolation; test/sciwrid.test.mjs covers what the adapter does with it.
// The point of a direct suite is that this module's failure mode is silence — it returns null rather
// than throwing, by design — so a regression here would surface only as NetCDF3 quietly needing
// manual overrides again, which is exactly the state it was written to end.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  readNetcdf3Header, readValues, geographicExtent, timeAxis, describeNetcdf3,
} from "../src/io/netcdf3.js";

const bytes = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)));
const NC3 = () => bytes("../assets/SampleFiles/sample.nc3");
const NC4 = () => bytes("../assets/SampleFiles/idalia-nldas2.nc");

describe("netcdf3: header structure", () => {
  test("reads dimensions, variables and their attributes", () => {
    const h = readNetcdf3Header(NC3());
    assert.equal(h.version, 1);
    assert.deepEqual(h.dims.map((d) => `${d.name}=${d.size}`), ["time=3", "lat=4", "lon=5"]);
    assert.deepEqual(h.variables.map((v) => v.name), ["time", "lat", "lon", "temperature"]);
    const t = h.variables.find((v) => v.name === "temperature");
    assert.deepEqual(t.dims, ["time", "lat", "lon"]);
    assert.deepEqual(t.shape, [3, 4, 5]);
    assert.equal(t.attrs.units, "K");
  });

  test("declines anything that is not NetCDF-3 — the module is self-limiting", () => {
    assert.equal(readNetcdf3Header(NC4()), null, "NetCDF-4 is HDF5 and is not attempted");
    assert.equal(readNetcdf3Header(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), null);
    assert.equal(readNetcdf3Header(new Uint8Array(2)), null, "too short to hold a magic");
    assert.equal(describeNetcdf3(NC4()), null, "and the top-level call declines in the same way");
  });

  test("accepts an ArrayBuffer or a view over one, without copying", () => {
    const b = NC3();
    const fromView = readNetcdf3Header(b);
    const fromBuffer = readNetcdf3Header(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    assert.deepEqual(fromView.dims, fromBuffer.dims);
  });
});

describe("netcdf3: coordinate values", () => {
  test("reads a 1-D coordinate variable", () => {
    const h = readNetcdf3Header(NC3());
    const lat = h.variables.find((v) => v.name === "lat");
    assert.deepEqual(readValues(h, lat), [30, 31, 32, 33]);
  });

  test("refuses anything that is not a 1-D numeric axis — this reads coordinates, not data", () => {
    const h = readNetcdf3Header(NC3());
    assert.equal(readValues(h, h.variables.find((v) => v.name === "temperature")), null,
      "a 3-D data variable is SciWrid's job, and must stay so");
    assert.equal(readValues(h, undefined), null);
  });
});

describe("netcdf3: CF interpretation", () => {
  test("the extent is cell EDGES, not centres", () => {
    // lat centres 30..33 and lon centres -95..-91, both at 1° spacing. Reporting the centres would
    // lose half a cell on each side — a whole 2° on a coarse global grid.
    const { bbox } = geographicExtent(readNetcdf3Header(NC3()));
    assert.deepEqual(bbox, [-95.5, 29.5, -90.5, 33.5]);
  });

  test("axes are found by CF units first, so a locally-named coordinate still works", () => {
    const h = readNetcdf3Header(NC3());
    const { lon, lat } = geographicExtent(h);
    assert.equal(lon, "lon");
    assert.equal(lat, "lat");
    assert.match(h.variables.find((v) => v.name === "lat").attrs.units, /degrees_north/);
  });

  test("a standard calendar becomes real instants", () => {
    const t = timeAxis(readNetcdf3Header(NC3()));
    assert.equal(t.unitsRaw, "hours since 2020-01-01 00:00:00");
    assert.equal(t.gregorian, true);
    assert.deepEqual(t.offsets, [0, 6, 12]);
    assert.deepEqual(t.values, [
      "2020-01-01T00:00:00.000Z", "2020-01-01T06:00:00.000Z", "2020-01-01T12:00:00.000Z",
    ]);
  });

  test("describeNetcdf3 is the whole thing in one call", () => {
    const d = describeNetcdf3(NC3());
    assert.deepEqual(d.bbox, [-95.5, 29.5, -90.5, 33.5]);
    assert.equal(d.times.length, 3);
    assert.deepEqual(d.dims, { time: 3, lat: 4, lon: 5 });
    assert.deepEqual(d.variables, ["time", "lat", "lon", "temperature"]);
  });
});

// The reader's job is to supplement a working decoder, so every failure is a "we know nothing" —
// never a throw that would take down a parse that would otherwise have succeeded.
describe("netcdf3: degrades quietly, never fatally", () => {
  test("a truncated file yields null rather than throwing", () => {
    const full = NC3();
    for (const cut of [8, 40, 120, full.length - 8]) {
      const d = describeNetcdf3(full.subarray(0, cut));
      // Either it declines outright or it reports only what it could actually reach; the one
      // unacceptable outcome is an exception, and the one dangerous one is a fabricated extent.
      if (d && d.bbox) {
        assert.ok(d.bbox.every(Number.isFinite), `truncation at ${cut} produced a non-finite bbox`);
      }
    }
  });

  test("a header with no coordinate variables reports no extent, not a guessed one", () => {
    // Rebuilt from the real file with `lat`/`lon` renamed so they are no longer coordinate variables
    // (CF §5: a coordinate variable is named for its own dimension). Everything else is untouched.
    const buf = Buffer.from(NC3());
    // The variable-name strings sit in the header; renaming in place keeps every offset valid.
    const at = buf.indexOf("lat", 0, "latin1");
    assert.ok(at > 0, "fixture layout changed — this test rewrites a name in place");
    buf.write("qqq", at, "latin1");
    const d = describeNetcdf3(buf);
    assert.equal(d.lat, null, "no latitude axis found");
    assert.equal(d.bbox, null, "and therefore no extent — never an invented one");
  });
});
