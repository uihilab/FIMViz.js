// io/grib2Lambert.js and the Lambert conformal path through io/sciwrid.js.
//
// No GRIB2 fixture is vendored. lambertGrib() below writes a small valid message (sections 0 to 8,
// simple packing) whose cells store their own native index, so a decoded pixel names the grid cell it
// came from and a misplaced pixel is visible as a wrong number.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import proj4 from "proj4";
import {
  readLambertSections, readLambertGrid, lambertProjector, lambertBbox, resampleLambert,
} from "../src/io/grib2Lambert.js";
import { parseSciwrid } from "../src/io/sciwrid.js";

/** A GRIB2 message on a Lambert grid, 16-bit simple packing, reference 0, so each value is stored as is. */
function lambertGrib({ nx, ny, la1, lo1, lov = 262.5, latin = 38.5, dx = 50000, values, hour = 0,
  shape = 6, scanningMode = 0x40 }) {
  const u = (n, bytes) => {
    const a = [];
    for (let k = bytes - 1; k >= 0; k--) a.push(Math.floor(n / 2 ** (8 * k)) & 255);
    return a;
  };
  const s32 = (v) => u((v < 0 ? 0x80000000 : 0) + Math.abs(Math.round(v)), 4);
  const sec = (num, body) => [...u(5 + body.length, 4), num, ...body];
  const s1 = sec(1, [...u(7, 2), ...u(0, 2), 2, 1, 1, ...u(2025, 2), 1, 7, 0, 0, 0, 0, 1]);
  const s3 = sec(3, [0, ...u(nx * ny, 4), 0, 0, ...u(30, 2),
    shape, 0, ...u(0, 4), 0, ...u(0, 4), 0, ...u(0, 4),
    ...u(nx, 4), ...u(ny, 4), ...s32(la1 * 1e6), ...u(Math.round(lo1 * 1e6), 4), 0,
    ...s32(latin * 1e6), ...u(Math.round(lov * 1e6), 4), ...u(dx * 1e3, 4), ...u(dx * 1e3, 4),
    0, scanningMode, ...s32(latin * 1e6), ...s32(latin * 1e6), ...s32(0), ...u(0, 4)]);
  const s4 = sec(4, [...u(0, 2), ...u(0, 2), 0, 0, 2, 0, 0, ...u(0, 2), 0, 1, ...u(hour, 4),
    1, 0, ...u(0, 4), 255, 0, ...u(0, 4)]);
  const reference = [...new Uint8Array(new Float32Array([0]).buffer)].reverse();
  const s5 = sec(5, [...u(nx * ny, 4), ...u(0, 2), ...reference, ...u(0, 2), ...u(0, 2), 16, 0]);
  const s6 = sec(6, [255]);
  const s7 = sec(7, values.flatMap((v) => u(v, 2)));
  const body = [...s1, ...s3, ...s4, ...s5, ...s6, ...s7, 0x37, 0x37, 0x37, 0x37];
  return new Uint8Array([0x47, 0x52, 0x49, 0x42, 0, 0, 0, 2, ...u(16 + body.length, 8), ...body]);
}

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

const NX = 20, NY = 15;
const GRID = { nx: NX, ny: NY, la1: 30, lo1: 250 };
const indexValues = (offset = 0) => Array.from({ length: NX * NY }, (_, k) => k + offset);

// The HRRR CONUS grid definition, as its GRIB2 section 3 declares it.
const HRRR = {
  shape: 6, radius: 6371229, nx: 1799, ny: 1059, la1: 21.138123, lo1: 237.280472, lad: 38.5, lov: 262.5,
  dx: 3000, dy: 3000, projectionCenter: 0, scanningMode: 64, latin1: 38.5, latin2: 38.5,
};

/** Per output pixel, whether it holds the native cell the Lambert math puts under its center. */
function placement(grid, g, offset = 0) {
  const proj = lambertProjector(g);
  const { west, east, south, north } = grid.bounds;
  let inside = 0, wrong = 0, outside = 0;
  for (let r = 0; r < grid.height; r++) {
    for (let c = 0; c < grid.width; c++) {
      const lon = west + (c + 0.5) * (east - west) / grid.width;
      const lat = north - (r + 0.5) * (north - south) / grid.height;
      const [fi, fj] = proj.indexOf(lon, lat);
      const i = Math.round(fi), j = Math.round(fj);
      const v = grid.pixels[r * grid.width + c];
      if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) { outside++; if (!Number.isNaN(v)) wrong++; continue; }
      inside++;
      if (v !== j * g.nx + i + offset) wrong++;
    }
  }
  return { inside, wrong, outside };
}

describe("grib2Lambert: section 3", () => {
  test("reads template 3.30 from a message, including a negative La1", () => {
    const g = readLambertGrid(lambertGrib({ ...GRID, la1: -5.25, values: indexValues() }));
    assert.deepEqual(g, {
      shape: 6, radius: 6371229, nx: NX, ny: NY, la1: -5.25, lo1: 250, lad: 38.5, lov: 262.5,
      dx: 50000, dy: 50000, projectionCenter: 0, scanningMode: 0x40, latin1: 38.5, latin2: 38.5,
    });
  });

  test("returns one entry per message in a concatenated file", () => {
    const one = lambertGrib({ ...GRID, values: indexValues() });
    assert.equal(readLambertSections(concat(one, one, one)).length, 3);
  });

  test("throws for an ellipsoidal earth, which the spherical math would misplace", () => {
    assert.throws(() => readLambertGrid(lambertGrib({ ...GRID, shape: 2, values: indexValues() })), /ellipsoid/);
  });

  test("throws for a scanning mode other than consecutive rows", () => {
    assert.throws(() => readLambertGrid(lambertGrib({ ...GRID, scanningMode: 0x60, values: indexValues() })),
      /scanning mode 0x60/);
  });

  test("throws when the messages in one file use different grids", () => {
    const a = lambertGrib({ ...GRID, values: indexValues() });
    const b = lambertGrib({ ...GRID, lo1: 251, values: indexValues() });
    assert.throws(() => readLambertGrid(concat(a, b)), /different Lambert grids/);
  });
});

describe("grib2Lambert: projection", () => {
  test("agrees with proj4 on the HRRR grid to well under a meter", () => {
    const p = lambertProjector(HRRR);
    const lcc = `+proj=lcc +lat_1=38.5 +lat_2=38.5 +lat_0=38.5 +lon_0=262.5 +a=6371229 +b=6371229 +units=m +no_defs`;
    const [x0, y0] = proj4("EPSG:4326", lcc, [HRRR.lo1, HRRR.la1]);
    for (const [i, j] of [[0, 0], [1798, 0], [0, 1058], [1798, 1058], [899, 529], [123.4, 987.6]]) {
      const [lon, lat] = proj4(lcc, "EPSG:4326", [x0 + i * 3000, y0 + j * 3000]);
      const [fi, fj] = p.indexOf(lon, lat);
      assert.ok(Math.abs(fi - i) < 1e-6 && Math.abs(fj - j) < 1e-6, `cell (${i}, ${j}) came back as (${fi}, ${fj})`);
      const [mlon, mlat] = p.lonLatOf(i, j);
      assert.ok(Math.abs(mlat - lat) < 1e-9 && Math.abs(mlon - lon) < 1e-9, `lon/lat of (${i}, ${j})`);
    }
  });

  test("gives HRRR's published corner points", () => {
    const p = lambertProjector(HRRR);
    const near = ([lon, lat], [wantLon, wantLat]) => Math.abs(lon - wantLon) < 1e-3 && Math.abs(lat - wantLat) < 1e-3;
    assert.ok(near(p.lonLatOf(0, 0), [-122.719528, 21.138123]));
    assert.ok(near(p.lonLatOf(1798, 1058), [-60.917, 47.842]));
  });

  test("the bbox covers the curved top edge, above both northern corners", () => {
    const [w, s, e, n] = lambertBbox(HRRR);
    assert.ok(w < -134 && e > -61 && Math.abs(s - 21.138) < 0.01, JSON.stringify([w, s, e, n]));
    assert.ok(n > 52, `the top edge's midpoint is near 52.6N, bbox north is ${n}`);
  });

  test("resampleLambert is NaN outside the grid", () => {
    const out = resampleLambert(indexValues(), { ...HRRR, ...GRID, dx: 50000, dy: 50000 },
      { bbox: [-10, -10, 10, 10], width: 4, height: 4 });
    assert.ok(out.every(Number.isNaN));
  });
});

describe("sciwrid adapter: Lambert conformal GRIB2", () => {
  test("places every decoded cell where the grid definition says it is", async () => {
    const ds = await parseSciwrid(lambertGrib({ ...GRID, values: indexValues() }).buffer, { name: "lcc.grib2" });
    assert.equal(ds.meta.gridTemplate, 30);
    // Read before forcing: a forced Dataset's `meta` is the decoded RasterGrid's.
    const lambert = ds.meta.lambert;
    const result = placement(await ds.grid(), lambert);
    assert.equal(result.wrong, 0, JSON.stringify(result));
    assert.ok(result.inside > 200, JSON.stringify(result));
  });

  test("needs no grid.bbox: the extent comes from section 3", async () => {
    const ds = await parseSciwrid(lambertGrib({ ...GRID, values: indexValues() }).buffer, { name: "lcc.grib2" });
    assert.deepEqual(ds.meta.grid.bbox, lambertBbox(ds.meta.lambert));
  });

  test("honors a caller's bbox and resolution", async () => {
    const grid = { bbox: [-108, 31, -103, 35], width: 40, height: 32 };
    const ds = await parseSciwrid(lambertGrib({ ...GRID, values: indexValues() }).buffer, { name: "lcc.grib2", grid });
    const lambert = ds.meta.lambert;
    const g = await ds.grid();
    assert.equal(g.width, 40);
    assert.equal(placement(g, lambert).wrong, 0);
  });

  test("each step of a multi-message file decodes its own message", async () => {
    const bytes = concat(
      lambertGrib({ ...GRID, values: indexValues(0), hour: 0 }),
      lambertGrib({ ...GRID, values: indexValues(1000), hour: 3 }));
    const ds = await parseSciwrid(bytes.buffer, { name: "lcc-series.grib2" });
    assert.equal(ds.axis.entries.length, 2);
    for (const [k, offset] of [[0, 0], [1, 1000]]) {
      const g = await ds.select(ds.axis.entries[k].coord).grid();
      assert.equal(placement(g, ds.meta.lambert, offset).wrong, 0, `step ${k}`);
    }
  });

  // Documents why materializeLambert exists. If a SciWrid upgrade places Lambert grids itself, this
  // fails, and the workaround in io/sciwrid.js can go.
  test("SciWrid's own extractGrid still misplaces the same bytes", async () => {
    const sw = await import("sciwrid-toolkit");
    const bytes = lambertGrib({ ...GRID, values: indexValues() });
    const g = readLambertGrid(bytes);
    const bbox = lambertBbox(g);
    const out = await sw.extractGrid(bytes, { variable: (await sw.scan(bytes)).variables[0].name, time: 0,
      bbox, width: NX, height: NY, workers: 0 });
    const grid = { pixels: out.data, width: NX, height: NY,
      bounds: { west: bbox[0], south: bbox[1], east: bbox[2], north: bbox[3] } };
    assert.ok(placement(grid, g).wrong > 0);
  });
});
