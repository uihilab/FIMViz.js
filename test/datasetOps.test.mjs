// Dataset transformation ops (clip / mask / reclassify) — pure grid transforms + the lazy op chain.
// Headless: no DOM, no GDAL. A stub materializer stands in for the decode. See PACKAGE_ROADMAP §2.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Dataset } from "../src/package/dataset.js";
import { RasterGrid, VectorFeatures, registerMaterializer, registerReprojector } from "../src/package/materialize.js";
import {
  maskGrid, clipGrid, reclassifyGrid, combineGrids, zonalStats, groupByGrid,
  slopeGrid, aspectGrid, hillshadeGrid, rasterizeFeatures,
} from "../src/package/rasterOps.js";

const BOUNDS = { north: 10, south: 0, east: 10, west: 0 };
const grid2x2 = () => new RasterGrid({ pixels: [1, 2, 3, 4], width: 2, height: 2, bounds: BOUNDS, noData: null });
//  cols: c0 centre lng 2.5, c1 lng 7.5 ; rows: r0 centre lat 7.5, r1 lat 2.5
const leftHalf = [{ lat: 0, lng: 0 }, { lat: 10, lng: 0 }, { lat: 10, lng: 5 }, { lat: 0, lng: 5 }];

describe("rasterOps (pure)", () => {
  test("maskGrid: outside the polygon → NaN; inside kept", () => {
    const g = maskGrid(grid2x2(), leftHalf);
    assert.equal(g.pixels[0], 1); assert.ok(Number.isNaN(g.pixels[1]));   // r0: c0 in, c1 out
    assert.equal(g.pixels[2], 3); assert.ok(Number.isNaN(g.pixels[3]));   // r1: c0 in, c1 out
    assert.deepEqual(g.bounds, BOUNDS, "footprint unchanged");
  });
  test("maskGrid invert: inside → NaN", () => {
    const g = maskGrid(grid2x2(), leftHalf, { invert: true });
    assert.ok(Number.isNaN(g.pixels[0])); assert.equal(g.pixels[1], 2);
  });
  test("clipGrid: crops to the bbox, snapped to pixel edges", () => {
    const g = clipGrid(grid2x2(), { north: 10, south: 0, east: 5, west: 0 });
    assert.equal(g.width, 1); assert.equal(g.height, 2);
    assert.deepEqual([...g.pixels], [1, 3]);
    assert.deepEqual(g.bounds, { west: 0, east: 5, north: 10, south: 0 });
  });
  test("clipGrid: a non-overlapping bbox throws", () => {
    assert.throws(() => clipGrid(grid2x2(), { north: 100, south: 90, east: 100, west: 90 }), /does not overlap/);
  });
  test("reclassifyGrid: range→value, unmatched→NaN (default)", () => {
    const g = reclassifyGrid(grid2x2(), [{ min: 2, max: 100, value: 9 }]);
    assert.ok(Number.isNaN(g.pixels[0]));               // 1 unmatched
    assert.deepEqual([...g.pixels].slice(1), [9, 9, 9]); // 2,3,4 → 9
  });
  test("reclassifyGrid: a value-less rule keeps the pixel; unmatched:'keep'", () => {
    const g = reclassifyGrid(grid2x2(), [{ min: 2, max: 4 }], { unmatched: "keep" });
    assert.deepEqual([...g.pixels], [1, 2, 3, 4]);      // 2,3 kept in-range; 1,4 kept as unmatched
  });
  test("reclassifyGrid: reports how many holes it actually created (meta.unmatchedCount)", () => {
    const holed = reclassifyGrid(grid2x2(), [{ min: 2, max: 100, value: 9 }]);
    assert.equal(holed.meta.unmatchedCount, 1, "pixel value 1 matched nothing → 1 hole");

    const full = reclassifyGrid(grid2x2(), [{ min: -Infinity, max: Infinity, value: 1 }]);
    assert.equal(full.meta?.unmatchedCount, undefined, "full coverage: no holes, no field at all");

    const kept = reclassifyGrid(grid2x2(), [{ min: 2, max: 100, value: 9 }], { unmatched: "keep" });
    assert.equal(kept.meta?.unmatchedCount, undefined, "unmatched:'keep' creates no holes to report");
  });
  test("reclassifyGrid: a callback rule maps by arbitrary expression, not just a range", () => {
    // grid2x2 pixels: [1,2,3,4]. Not a contiguous range — a plain {min,max} rule couldn't express this.
    const g = reclassifyGrid(grid2x2(), (v) => (v % 2 === 0 ? 9 : null));
    assert.ok(Number.isNaN(g.pixels[0]) && Number.isNaN(g.pixels[2]), "1,3 unmatched → NaN");
    assert.equal(g.pixels[1], 9); assert.equal(g.pixels[3], 9);   // 2,4 → 9
  });
  test("reclassifyGrid: a callback rule receives the flat row-major index as its 2nd argument", () => {
    // grid2x2 pixels: [1,2,3,4] laid out row-major → index IS the identity here; assert it's passed
    // by mapping every pixel to its own index (ignoring the value entirely).
    const g = reclassifyGrid(grid2x2(), (v, i) => i);
    assert.deepEqual([...g.pixels], [0, 1, 2, 3]);
  });
  test("reclassifyGrid: a callback returning a constant maps every valid pixel to it (no min/max involved)", () => {
    const g = reclassifyGrid(grid2x2(), () => 5);
    assert.deepEqual([...g.pixels], [5, 5, 5, 5], "a callback returning a constant maps every valid pixel to it");
  });
});

describe("combineGrids (band math, LHS-conform)", () => {
  const a = () => new RasterGrid({ pixels: [10, 20, 30, 40], width: 2, height: 2, bounds: BOUNDS, noData: null });
  const b = () => new RasterGrid({ pixels: [1, 2, 3, 4], width: 2, height: 2, bounds: BOUNDS, noData: null });
  test("difference is a − b, same grid", () => {
    const g = combineGrids([a(), b()], { op: "difference" });
    assert.deepEqual([...g.pixels], [9, 18, 27, 36]);
  });
  test("sum/mean/min/max reduce N inputs", () => {
    assert.deepEqual([...combineGrids([a(), b()], { op: "sum" }).pixels], [11, 22, 33, 44]);
    assert.deepEqual([...combineGrids([a(), b()], { op: "min" }).pixels], [1, 2, 3, 4]);
    assert.deepEqual([...combineGrids([a(), b()], { op: "max" }).pixels], [10, 20, 30, 40]);
  });
  test("resamples a coarser input onto the LHS grid", () => {
    const coarse = new RasterGrid({ pixels: [5], width: 1, height: 1, bounds: BOUNDS, noData: null });
    const g = combineGrids([a(), coarse], { op: "difference" });   // coarse → 2×2 of 5s
    assert.deepEqual([...g.pixels], [5, 15, 25, 35]);
  });
  test("a noData pixel makes the difference NaN there", () => {
    const bn = new RasterGrid({ pixels: [1, -99999, 3, 4], width: 2, height: 2, bounds: BOUNDS, noData: -99999 });
    const g = combineGrids([a(), bn], { op: "difference" });
    assert.equal(g.pixels[0], 9);
    assert.ok(Number.isNaN(g.pixels[1]));
  });
});

describe("zonalStats", () => {
  const grid = () => new RasterGrid({ pixels: [1, 2, 3, 4], width: 2, height: 2, bounds: BOUNDS, noData: null });
  test("per-zone count/sum/mean over the pixels inside each polygon", () => {
    const zones = [
      { id: "left", polygon: [{ lat: 0, lng: 0 }, { lat: 10, lng: 0 }, { lat: 10, lng: 5 }, { lat: 0, lng: 5 }] },
      { id: "all", polygon: [{ lat: 0, lng: 0 }, { lat: 10, lng: 0 }, { lat: 10, lng: 10 }, { lat: 0, lng: 10 }] },
    ];
    const [left, all] = zonalStats(grid(), zones);
    assert.equal(left.id, "left");
    assert.deepEqual([left.count, left.sum], [2, 4]);   // col0 = pixels 1,3
    assert.deepEqual([all.count, all.sum, all.min, all.max], [4, 10, 1, 4]);
    assert.equal(all.mean, 2.5);
  });
  test("empty zone → nulls, count 0", () => {
    const z = zonalStats(grid(), [{ id: "none", polygon: [{ lat: 50, lng: 50 }, { lat: 51, lng: 50 }, { lat: 51, lng: 51 }] }]);
    assert.deepEqual([z[0].count, z[0].mean], [0, null]);
  });
});

describe("Dataset lazy ops (build → force → transform)", () => {
  registerMaterializer("testras", async () => grid2x2());
  registerMaterializer("testras10", async () => new RasterGrid({ pixels: [10, 20, 30, 40], width: 2, height: 2, bounds: BOUNDS, noData: null }));
  const root = () => new Dataset({ name: "t.tif", kind: "raster", format: "testras", data: {}, bounds: BOUNDS });
  const rootA = () => new Dataset({ name: "a.tif", kind: "raster", format: "testras10", data: {}, bounds: BOUNDS });

  test("ops build a NEW lazy Dataset and never mutate the parent", () => {
    const r = root();
    const m = r.mask(leftHalf);
    assert.notEqual(m, r);
    assert.equal(r.isMaterialized, false);
    assert.equal(m.isMaterialized, false, "still lazy until forced");
  });
  test("mask forces through the chain to a masked grid", async () => {
    const g = await root().mask(leftHalf).grid();
    assert.equal(g.pixels[0], 1); assert.ok(Number.isNaN(g.pixels[1]));
  });
  test("chained ops: clip then reclassify", async () => {
    const g = await root().clip({ north: 10, south: 0, east: 5, west: 0 }).reclassify([{ min: 3, max: 100, value: 1 }]).grid();
    assert.equal(g.width, 1);
    assert.ok(Number.isNaN(g.pixels[0]));    // clipped col0 = [1,3]; 1 unmatched → NaN
    assert.equal(g.pixels[1], 1);            // 3 → 1
  });
  test("reclassify() warns (ds.warnings) when its rules leave holes, and stays silent when they don't", async () => {
    const holey = root().reclassify([{ min: 2, max: 100, value: 9 }]);
    await holey.grid();
    assert.ok(holey.warnings.some((w) => /1 pixel\(s\).*matched no rule.*became no-data/.test(w)),
      holey.warnings.join("\n"));

    const full = root().reclassify([{ min: -Infinity, max: Infinity, value: 1 }]);
    await full.grid();
    assert.equal(full.warnings.length, 0, "full-coverage rules create no holes → no warning");

    const kept = root().reclassify([{ min: 2, max: 100, value: 9 }], { unmatched: "keep" });
    await kept.grid();
    assert.equal(kept.warnings.length, 0, "unmatched:'keep' creates no holes → no warning");
  });
  test("reclassify() with a callback forces fine in-session, but toRecord() refuses to persist it", async () => {
    const ds = root().reclassify((v) => (v % 2 === 0 ? 9 : null));
    const g = await ds.grid();
    assert.equal(g.pixels[1], 9, "2 → 9 (in-session use works exactly like a range rule)");

    assert.throws(() => ds.toRecord(), /reclassify uses a callback.*can't survive storage/s);
    // The guard fires from wherever the reclassify node sits in the chain, not just at the top —
    // toRecord() recurses into every input's own toRecord().
    assert.throws(() => ds.clip({ north: 10, south: 0, east: 10, west: 5 }).toRecord(),
      /reclassify uses a callback/);
  });
  test("a raster-only op on a vector Dataset throws", () => {
    const v = new Dataset({ name: "x.geojson", kind: "vector", format: "geojson", data: {} });
    assert.throws(() => v.mask(leftHalf), /raster-only/);
  });
  test("toRecord captures the op recipe; fromRecord replays it", async () => {
    const rec = root().reclassify([{ min: 2, value: 7 }]).toRecord();
    assert.equal(rec.op.op, "reclassify");
    assert.equal(rec.inputs[0].format, "testras");
    const g = await Dataset.fromRecord(rec).grid();
    assert.ok(Number.isNaN(g.pixels[0]));   // 1 < 2 → unmatched → NaN
    assert.equal(g.pixels[1], 7);           // 2 ≥ 2 → 7
  });

  test("difference forces an N-ary op node (a − b)", async () => {
    const g = await rootA().difference(root()).grid();
    assert.deepEqual([...g.pixels], [9, 18, 27, 36]);
  });

  test("ratio is combine({op:'ratio'}), the other binary shorthand", async () => {
    const g = await rootA().ratio(root()).grid();
    assert.equal(g.width, 2);
    const direct = await rootA().combine([root()], { op: "ratio" }).grid();
    assert.deepEqual([...g.pixels], [...direct.pixels]);
  });

  test("the N-ary reducers stay on combine(), with no method shorthand", () => {
    // ds.min(others) would read as this raster's minimum, which is (await ds.stats()).min.
    for (const name of ["sum", "mean", "min", "max"]) {
      assert.equal(typeof Dataset.prototype[name], "undefined", `${name}() must not exist`);
    }
  });
  test("combine round-trips through toRecord/fromRecord (N-ary)", async () => {
    const rec = rootA().combine([root()], { op: "sum" }).toRecord();
    assert.equal(rec.op.op, "combine");
    assert.equal(rec.inputs.length, 2);
    const g = await Dataset.fromRecord(rec).grid();
    assert.deepEqual([...g.pixels], [11, 22, 33, 44]);
  });
  test("zonalStats is a terminal that forces the grid", async () => {
    const [z] = await root().zonalStats([{ id: 1, polygon: [{ lat: 0, lng: 0 }, { lat: 10, lng: 0 }, { lat: 10, lng: 10 }, { lat: 0, lng: 10 }] }]);
    assert.deepEqual([z.count, z.sum], [4, 10]);
  });

  test("reproject() after a real computation (combine/clip) warps the COMPUTED grid, not stale root bytes", async () => {
    // reproject forces by warping the CHAIN'S ROOT bytes when they're representative (see dataset.js
    // #rootData / #nonReprojectAncestorOp) — cheap, and correct for a plain source or a reproject-only
    // chain. For anything with a real computation in between (combine/clip/mask/reclassify/resample/
    // rasterize), the root bytes no longer represent this node's actual data — the reprojector must be
    // handed the ALREADY-COMPUTED grid (ctx.grid) instead, or it would silently reproject the untouched
    // original file. A stub reprojector records which ctx it was actually given, so this asserts the
    // WIRING, not the real GDAL warp (that needs a browser — see geo/gdal.js's warpGrid).
    const calls = [];
    registerReprojector(async (grid, crs, ctx = {}) => {
      calls.push({ hadSource: ctx.source != null, hadGrid: ctx.grid != null });
      return new RasterGrid({ ...grid, crs });
    });

    calls.length = 0;
    await root().reproject("EPSG:4326").grid();
    assert.deepEqual(calls[0], { hadSource: false, hadGrid: true },
      "a synthetic root (no real ArrayBuffer bytes here) has no source; grid is always offered as fallback");

    calls.length = 0;
    await root().reproject("EPSG:3857").reproject("EPSG:4326").grid();
    assert.equal(calls.length, 2, "double-reproject: parent-of-parent walk doesn't force twice");
    assert.equal(calls[1].hadGrid, true, "grid is always offered");

    calls.length = 0;
    await rootA().combine([root()], { op: "sum" }).reproject("EPSG:4326").grid();
    assert.deepEqual(calls[0], { hadSource: false, hadGrid: true },
      "combine ancestry: root bytes are NOT representative, so only grid (the real combined data) is offered");

    calls.length = 0;
    await root().clip({ north: 10, south: 0, east: 5, west: 0 }).reproject("EPSG:4326").grid();
    assert.deepEqual(calls[0], { hadSource: false, hadGrid: true }, "same for clip ancestry");
  });
});

describe("terrain (slope/aspect/hillshade, pure Horn's algorithm)", () => {
  // A 5×5 east-rising ramp: value = column index (0..4), constant down each column → no y-gradient.
  // cellsize is 1 (bounds span 5° over 5 px), so the interior gradient is exactly 1 unit/cell.
  const RAMP_BOUNDS = { north: 5, south: 0, east: 5, west: 0 };
  const ramp = () => {
    const pixels = new Float64Array(25);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) pixels[r * 5 + c] = c;
    return new RasterGrid({ pixels, width: 5, height: 5, bounds: RAMP_BOUNDS, noData: null });
  };
  const flat = () => new RasterGrid({ pixels: new Float64Array(25).fill(3), width: 5, height: 5, bounds: RAMP_BOUNDS, noData: null });

  test("slopeGrid: a flat grid has zero slope everywhere", () => {
    const g = slopeGrid(flat());
    assert.ok([...g.pixels].every((v) => v === 0));
  });
  test("slopeGrid: a 1-unit/cell east ramp is 45° at interior pixels", () => {
    const g = slopeGrid(ramp());
    assert.ok(Math.abs(g.pixels[2 * 5 + 2] - 45) < 1e-9);   // centre pixel (r2,c2)
  });
  test("slopeGrid: unit:'percent' matches tan(slope)*100", () => {
    const g = slopeGrid(ramp(), { unit: "percent" });
    assert.ok(Math.abs(g.pixels[2 * 5 + 2] - 100) < 1e-9);  // tan(45°) = 1 → 100%
  });
  test("aspectGrid: a flat grid is -1 (no aspect) everywhere", () => {
    const g = aspectGrid(flat());
    assert.ok([...g.pixels].every((v) => v === -1));
  });
  test("aspectGrid: values rising east → downslope faces west (270°)", () => {
    const g = aspectGrid(ramp());
    assert.ok(Math.abs(g.pixels[2 * 5 + 2] - 270) < 1e-9);
  });
  test("hillshadeGrid: a flat grid shades uniformly at 255*cos(zenith)", () => {
    const g = hillshadeGrid(flat());   // default altitude 45° → zenith 45°
    const expected = 255 * Math.cos((90 - 45) * Math.PI / 180);
    assert.ok([...g.pixels].every((v) => Math.abs(v - expected) < 1e-9));
  });
  test("hillshadeGrid: a sloped ramp shades differently than the flat baseline", () => {
    const flatShade = hillshadeGrid(flat()).pixels[12];
    const rampShade = hillshadeGrid(ramp(), { azimuth: 90 }).pixels[12];
    assert.notEqual(rampShade, flatShade);
  });
  test("a NaN neighbour propagates NaN (a hole in the data, not the grid edge)", () => {
    const g = ramp();
    g.pixels[2 * 5 + 1] = NaN;                 // poke a hole next to the centre pixel's window
    assert.ok(Number.isNaN(slopeGrid(g).pixels[2 * 5 + 2]));
    assert.ok(Number.isNaN(aspectGrid(g).pixels[2 * 5 + 2]));
    assert.ok(Number.isNaN(hillshadeGrid(g).pixels[2 * 5 + 2]));
  });
});

describe("rasterizeFeatures (vector → raster, pure)", () => {
  const BURN_BOUNDS = { north: 10, south: 0, east: 10, west: 0 };
  // Left half (lng 0-5) as a GeoJSON polygon (coords are [lng,lat]); mirrors the `leftHalf` ring above.
  const leftPoly = { type: "Feature", properties: { z: 5 }, geometry: { type: "Polygon",
    coordinates: [[[0, 0], [0, 10], [5, 10], [5, 0], [0, 0]]] } };
  test("burns a field value inside the polygon; outside is NaN", () => {
    const g = rasterizeFeatures({ type: "FeatureCollection", features: [leftPoly] }, BURN_BOUNDS,
      { width: 2, height: 2, field: "z" });
    assert.equal(g.pixels[0], 5); assert.ok(Number.isNaN(g.pixels[1]));
    assert.equal(g.pixels[2], 5); assert.ok(Number.isNaN(g.pixels[3]));
  });
  test("a constant burnValue is used when no field is given", () => {
    const g = rasterizeFeatures([leftPoly], BURN_BOUNDS, { width: 2, height: 2, burnValue: 42 });
    assert.equal(g.pixels[0], 42);
  });
  test("later features win where they overlap (burn order)", () => {
    const under = { type: "Feature", properties: { z: 1 }, geometry: leftPoly.geometry };
    const over = { type: "Feature", properties: { z: 9 }, geometry: leftPoly.geometry };
    const g = rasterizeFeatures({ type: "FeatureCollection", features: [under, over] }, BURN_BOUNDS,
      { width: 2, height: 2, field: "z" });
    assert.equal(g.pixels[0], 9);
  });
});

describe("Dataset.rasterize (kind-changing: vector → raster)", () => {
  registerMaterializer("testvec", async (root) => new VectorFeatures({ features: root.data, bounds: { north: 10, south: 0, east: 10, west: 0 }, crs: "EPSG:4326" }));
  const zonesFC = { type: "FeatureCollection", features: [
    { type: "Feature", properties: { z: 5 }, geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 10], [5, 10], [5, 0], [0, 0]]] } },
  ] };
  const vecRoot = () => new Dataset({ name: "zones.geojson", kind: "vector", format: "testvec", data: zonesFC, bounds: BOUNDS });

  test("rasterize builds a lazy Dataset whose kind flips to raster", () => {
    const r = vecRoot().rasterize({ width: 2, height: 2, field: "z" });
    assert.equal(r.kind, "raster");
    assert.equal(r.isMaterialized, false);
  });
  test("forcing it decodes the vector then burns the grid", async () => {
    const g = await vecRoot().rasterize({ width: 2, height: 2, field: "z" }).grid();
    assert.equal(g.pixels[0], 5); assert.ok(Number.isNaN(g.pixels[1]));
  });
  test("a vector-only op on a raster Dataset throws", () => {
    const r = new Dataset({ name: "t.tif", kind: "raster", format: "testras", data: {}, bounds: BOUNDS });
    assert.throws(() => r.rasterize({ width: 2, height: 2 }), /vector-only/);
  });
  test("toRecord/fromRecord round-trips the rasterize recipe", async () => {
    const rec = vecRoot().rasterize({ width: 2, height: 2, field: "z" }).toRecord();
    assert.equal(rec.op.op, "rasterize");
    const g = await Dataset.fromRecord(rec).grid();
    assert.equal(g.pixels[0], 5);
  });
});

describe("Dataset.slope/aspect/hillshade (lazy chain over a real Dataset)", () => {
  registerMaterializer("testramp", async () => {
    const pixels = new Float64Array(25);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) pixels[r * 5 + c] = c;
    return new RasterGrid({ pixels, width: 5, height: 5, bounds: { north: 5, south: 0, east: 5, west: 0 }, noData: null });
  });
  const rampDs = () => new Dataset({ name: "ramp.tif", kind: "raster", format: "testramp", data: {}, bounds: { north: 5, south: 0, east: 5, west: 0 } });

  test("slope/aspect/hillshade are lazy and chainable", async () => {
    const s = rampDs().slope();
    assert.equal(s.isMaterialized, false);
    const g = await s.grid();
    assert.ok(Math.abs(g.pixels[12] - 45) < 1e-9);
  });
  test("aspect matches the pure aspectGrid result", async () => {
    const g = await rampDs().aspect().grid();
    assert.ok(Math.abs(g.pixels[12] - 270) < 1e-9);
  });
  test("hillshade chains after slope-independent ops (reclassify)", async () => {
    // sanity: hillshade forces fine on its own chain (not literally composed with reclassify's output
    // kind, just proving multi-op lazy chains still resolve through #applyOp)
    const g = await rampDs().hillshade({ azimuth: 90 }).grid();
    assert.equal(g.width, 5);
  });
  test("a raster-only op on a vector Dataset throws", () => {
    const v = new Dataset({ name: "x.geojson", kind: "vector", format: "geojson", data: {} });
    assert.throws(() => v.slope(), /raster-only/);
    assert.throws(() => v.aspect(), /raster-only/);
    assert.throws(() => v.hillshade(), /raster-only/);
  });
  test("toRecord/fromRecord round-trips slope", async () => {
    const rec = rampDs().slope({ unit: "percent" }).toRecord();
    assert.equal(rec.op.op, "slope");
    const g = await Dataset.fromRecord(rec).grid();
    assert.ok(Math.abs(g.pixels[12] - 100) < 1e-9);
  });
});

describe("Dataset.reduce (axis stack → one grid, sugar over select+combine)", () => {
  registerMaterializer("geotiff", async (root) => (
    root.url.includes("b.tif")
      ? new RasterGrid({ pixels: [1, 2, 3, 4], width: 2, height: 2, bounds: BOUNDS, noData: null })
      : new RasterGrid({ pixels: [10, 20, 30, 40], width: 2, height: 2, bounds: BOUNDS, noData: null })
  ));
  const series = () => new Dataset({
    name: "stage-series",
    axes: [{ name: "stage", unit: null, entries: [{ coord: 0, ref: "a.tif" }, { coord: 1, ref: "b.tif" }] }],
  });

  test("reduce('mean') resolves every axis entry and reduces per pixel", async () => {
    const g = await series().reduce("mean").grid();
    assert.deepEqual([...g.pixels], [5.5, 11, 16.5, 22]);
  });
  test("reduce('sum'/'min'/'max') also work", async () => {
    assert.deepEqual([...(await series().reduce("sum").grid()).pixels], [11, 22, 33, 44]);
    assert.deepEqual([...(await series().reduce("min").grid()).pixels], [1, 2, 3, 4]);
    assert.deepEqual([...(await series().reduce("max").grid()).pixels], [10, 20, 30, 40]);
  });
  test("reduce is lazy: building it does not force anything", () => {
    const r = series().reduce("mean");
    assert.equal(r.isMaterialized, false);
  });
  test("rejects an unsupported reducer", () => {
    assert.throws(() => series().reduce("difference"), /must be one of/);
  });
  test("throws when the axis has no entries", () => {
    const empty = new Dataset({ name: "x", axes: [{ name: "stage", entries: [] }] });
    assert.throws(() => empty.reduce("mean"), /no selection axis/);
  });
});

// groupBy — the THIRD kind of reduction. reduce() collapses a selection axis; zonalStats() collapses
// space by geometry; this collapses space by ANOTHER RASTER'S VALUES. "Mean depth per land-use class",
// "rainfall binned by elevation" — i.e. one variable as a series against another.
describe("groupByGrid / ds.groupBy", () => {
  const g = (px) => new RasterGrid({ pixels: Float32Array.from(px), width: 4, height: 4,
    bounds: { north: 4, south: 0, east: 4, west: 0 } });
  //                 one NaN, to prove absent pixels are skipped ─────────────┐
  const depth = () => g([1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 4, 4, 3, 3, NaN, 4]);
  const use = () => g([10, 10, 20, 20, 10, 10, 20, 20, 30, 30, 30, 30, 30, 30, 30, 30]);
  const dem = () => g([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]);

  test("discrete: every distinct value of `by` is a class", () => {
    const rows = groupByGrid(depth(), use());
    assert.deepEqual(rows.map((r) => r.class), [10, 20, 30], "ordered by class");
    assert.deepEqual(rows.map((r) => r.count), [4, 4, 7], "class 30's NaN pixel is excluded");
    assert.equal(rows[0].mean, 1);
    assert.equal(rows[1].mean, 2);
    assert.equal(rows[2].mean, 24 / 7);
    assert.equal(rows[2].area, 7, "area is count × pixel area, same convention as zonalStats");
  });

  test("binned by a count: equal-width bands over `by`'s own range", () => {
    const rows = groupByGrid(depth(), dem(), { bins: 3 });
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((r) => r.count), [5, 5, 5], "15 valid pixels, evenly split");
    assert.deepEqual(rows[0].range, [0, 50]);
    assert.equal(rows[2].range[1], 150, "the top edge is `by`'s max…");
    assert.ok(rows[2].count > 0, "…and the last bin is closed, so the max value lands in it");
  });

  test("binned by explicit edges, used as given", () => {
    const rows = groupByGrid(depth(), dem(), { bins: [0, 50, 200] });
    assert.deepEqual(rows.map((r) => r.count), [5, 10]);
    assert.deepEqual(rows.map((r) => r.range), [[0, 50], [50, 200]]);
  });

  test("a pixel counts only where BOTH rasters have a value", () => {
    const holeyBy = g([10, 10, 20, 20, 10, 10, 20, 20, 30, 30, 30, 30, NaN, NaN, NaN, NaN]);
    const rows = groupByGrid(depth(), holeyBy);
    assert.equal(rows.reduce((n, r) => n + r.count, 0), 12,
      "16 − the 4 absent in `by`; the values' own NaN sits inside that block, so it is not a 5th loss");
    // The other order, to show it is a genuine intersection rather than one raster winning:
    const holeyValues = g([1, 1, NaN, NaN, 1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 4, 4]);
    assert.equal(groupByGrid(holeyValues, use()).reduce((n, r) => n + r.count, 0), 14);
  });

  test("noData sentinels are honoured on both sides, not just NaN", () => {
    const v = new RasterGrid({ ...depth(), pixels: Float32Array.from(
      [1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 4, 4, 3, 3, -9999, 4]), noData: -9999 });
    assert.equal(groupByGrid(v, use()).find((r) => r.class === 30).count, 7);
  });

  test("`by` on a different grid is conformed onto ours — the same LHS rule combine uses", () => {
    const coarse = new RasterGrid({ pixels: Float32Array.from([10, 20, 30, 30]), width: 2, height: 2,
      bounds: { north: 4, south: 0, east: 4, west: 0 } });
    const rows = groupByGrid(depth(), coarse);
    assert.deepEqual(rows.map((r) => r.class), [10, 20, 30]);
    assert.equal(rows.reduce((n, r) => n + r.count, 0), 15, "every valid pixel is grouped");
  });

  test("no overlapping data yields an empty table, not a throw", () => {
    const allAbsent = g(new Array(16).fill(NaN));
    assert.deepEqual(groupByGrid(depth(), allAbsent), []);
  });

  test("ds.groupBy is a terminal returning a table, and is raster-only", async () => {
    const a = Dataset.fromGrid(depth());
    const b = Dataset.fromGrid(use());
    const rows = await a.groupBy(b);
    assert.equal(rows.length, 3);
    assert.equal(rows[2].mean, 24 / 7);
    await assert.rejects(() => a.groupBy(null), /must be a raster Dataset/);
  });
});

// dataset.js divides on one rule: a synchronous method builds a lazy node and returns a Dataset, an
// async one is a terminal that forces the chain and returns data. groupBy and zonalStats broke the
// reading of it by sitting among the lazy raster ops — async was the only thing marking them apart.
// These two tests are what keeps the rule true rather than merely tidy.
describe("lazy ops vs terminals: the sync/async rule", () => {
  const LAZY = ["reproject", "mask", "clip", "reclassify", "combine", "difference", "ratio",
                "resampleTo", "slope", "aspect", "hillshade", "rasterize", "reduce",
                "select", "selectRange"];
  const TERMINALS = ["load", "grid", "features", "stats", "zonalStats", "groupBy"];

  test("every lazy op is synchronous", () => {
    for (const name of LAZY) {
      const fn = Dataset.prototype[name];
      assert.equal(typeof fn, "function", `${name} exists`);
      assert.notEqual(fn.constructor.name, "AsyncFunction",
        `${name}() must stay synchronous — an async op would compute at build time`);
    }
  });

  test("every terminal is async", () => {
    for (const name of TERMINALS) {
      const fn = Dataset.prototype[name];
      assert.equal(typeof fn, "function", `${name} exists`);
      assert.equal(fn.constructor.name, "AsyncFunction",
        `${name}() must stay async — it forces the chain`);
    }
  });

  test("a lazy op returns a new Dataset and decodes nothing", () => {
    const ds = new Dataset({ name: "t.tif", kind: "raster", format: "never-registered",
                             crs: "EPSG:4326", data: { stub: true } });
    const out = ds.clip({ north: 1, south: 0, east: 1, west: 0 }).mask([[0, 0], [1, 0], [1, 1]]);
    assert.ok(out instanceof Dataset);
    assert.notEqual(out, ds, "a new node, not a mutation");
    assert.equal(ds.isMaterialized, false, "the source was never forced");
    assert.equal(out.isMaterialized, false, "and neither was the result");
    // the format is registered nowhere, so forcing would throw — proof nothing forced
  });
});
