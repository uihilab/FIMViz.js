// resample — headless grid alignment for pixel-wise ops (comparison, ensemble). Pure math, no GDAL.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  GRID_POLICY, RESAMPLE_METHODS, pixelSize, resolveTargetGrid, resampleGrid, alignRasters,
  registerResampler,
} from "../src/geo/resample.js";

// two grids over the SAME 0..4 lng / 0..4 lat footprint: coarse 2x2, fine 4x4.
const coarse = { width: 2, height: 2, bw: 0, bs: 0, be: 4, bn: 4 };
const fine = { width: 4, height: 4, bw: 0, bs: 0, be: 4, bn: 4 };

describe("resolveTargetGrid (policy → resolution)", () => {
  test("pixelSize is degrees per pixel", () => {
    assert.deepEqual(pixelSize(coarse), { x: 2, y: 2 });
    assert.deepEqual(pixelSize(fine), { x: 1, y: 1 });
  });

  test("HIGH → the finest resolution (upsample the coarse one)", () => {
    const g = resolveTargetGrid([coarse, fine], GRID_POLICY.HIGH);
    assert.deepEqual([g.width, g.height], [4, 4]);
  });

  test("LOW → the coarsest resolution (downsample the fine one)", () => {
    const g = resolveTargetGrid([coarse, fine], GRID_POLICY.LOW);
    assert.deepEqual([g.width, g.height], [2, 2]);
  });

  test("AVERAGE → the mean pixel size", () => {
    const g = resolveTargetGrid([coarse, fine], GRID_POLICY.AVERAGE);
    // mean pixel size = 1.5°/px over a 4° extent → round(4/1.5) = 3
    assert.deepEqual([g.width, g.height], [3, 3]);
  });

  test("footprint is the union of bounds", () => {
    const a = { width: 2, height: 2, bw: 0, bs: 0, be: 2, bn: 2 };
    const b = { width: 2, height: 2, bw: 1, bs: 1, be: 3, bn: 3 };
    const g = resolveTargetGrid([a, b], GRID_POLICY.HIGH);
    assert.deepEqual([g.bw, g.bs, g.be, g.bn], [0, 0, 3, 3]);
  });

  test("unknown policy throws", () => {
    assert.throws(() => resolveTargetGrid([fine], "nope"), /unknown policy/);
  });
});

describe("resampleGrid (nearest / bilinear / average)", () => {
  test("same grid is a no-op (returns the input array)", () => {
    const px = Float32Array.from([1, 2, 3, 4]);
    assert.equal(resampleGrid(px, coarse, coarse), px);
  });

  test("nearest upsample 2x2 → 4x4 replicates each source pixel into a 2x2 block", () => {
    // coarse pixels: [[1,2],[3,4]] (row-major, top row = north)
    const src = Float32Array.from([1, 2, 3, 4]);
    const out = resampleGrid(src, coarse, fine, { method: "nearest" });
    assert.deepEqual([...out], [
      1, 1, 2, 2,
      1, 1, 2, 2,
      3, 3, 4, 4,
      3, 3, 4, 4,
    ]);
  });

  test("nearest preserves a nodata sentinel (no interpolation across it)", () => {
    const src = Float32Array.from([1, -99999, 3, 4]);
    const out = resampleGrid(src, coarse, fine, { method: "nearest", noData: -99999 });
    assert.equal(out[2], -99999);   // maps to the sentinel source pixel
    assert.equal(out[0], 1);
  });

  test("average downsample 4x4 → 2x2 means each 2x2 source block", () => {
    const src = Float32Array.from([
      1, 1, 2, 2,
      1, 1, 2, 2,
      3, 3, 4, 4,
      3, 3, 4, 4,
    ]);
    const out = resampleGrid(src, fine, coarse, { method: "average" });
    assert.deepEqual([...out], [1, 2, 3, 4]);
  });

  test("average skips nodata within a block", () => {
    const src = Float32Array.from([
      2, -1, 0, 0,
      2, 2, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    const out = resampleGrid(src, fine, coarse, { method: "average", noData: -1 });
    assert.equal(out[0], 2);   // (2+2+2)/3, the -1 excluded
  });

  test("bilinear interpolates between source pixels", () => {
    // 2x1 source [0,10] over lng 0..2; sample the fine 4x1 centers → smooth ramp
    const src = Float32Array.from([0, 10]);
    const s = { width: 2, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const d = { width: 4, height: 1, bw: 0, bs: 0, be: 2, bn: 1 };
    const out = resampleGrid(src, s, d, { method: "bilinear" });
    // centers at lng .25,.75,1.25,1.75 → src frac .-.25/.25/.75/1.25 clamped → 0,2.5,7.5,10
    assert.ok(out[0] <= out[1] && out[1] < out[2] && out[2] <= out[3]);
    assert.equal(out[3], 10);
  });

  test("a GDAL-only method with no registered resampler throws a clear error", () => {
    assert.throws(() => resampleGrid(Float32Array.from([1]), coarse, fine, { method: "cubic" }),
      /needs a registered resampler/);
    assert.ok(RESAMPLE_METHODS.includes("cubic"));
  });

  test("registerResampler lets a host handle GDAL-only methods", () => {
    let seen = null;
    registerResampler((pixels, s, d, opts) => { seen = opts.method; return Float32Array.from([42]); });
    const out = resampleGrid(Float32Array.from([1, 2, 3, 4]), coarse, { ...coarse, width: 1, height: 1 }, { method: "lanczos" });
    assert.equal(seen, "lanczos");
    assert.deepEqual([...out], [42]);
    registerResampler(null);   // reset for other tests
  });
});

describe("alignRasters (bring several rasters onto one grid)", () => {
  test("two different grids resolve to a common grid, both resampled onto it", () => {
    const r1 = { pixels: Float32Array.from([1, 2, 3, 4]), meta: coarse };
    const r2 = { pixels: Float32Array.from([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]), meta: fine };
    const { grid, rasters } = alignRasters([r1, r2], { policy: GRID_POLICY.HIGH, method: "nearest" });
    assert.deepEqual([grid.width, grid.height], [4, 4]);
    assert.equal(rasters[0].pixels.length, 16);   // coarse upsampled to 4x4
    assert.equal(rasters[1].pixels, r2.pixels);    // fine already on-grid → untouched (no-op)
    assert.deepEqual(rasters[0].meta, grid);
  });
});
