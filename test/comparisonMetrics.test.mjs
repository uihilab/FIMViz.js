// comparisonMetrics — headless flood-extent agreement statistics extracted from the comparison
// controller. Pure math, no DOM. Confirms the confusion matrix + derived metrics.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  compareExtentMetrics, classifyExtents, extentCategoriesToRgba, combineExtentRgba,
  paletteFromColors, EXTENT_COMPARE_PALETTE_2, DRY_DEFAULT,
  agreementCounts, agreementToRgba, ensembleAgreementRgba, defaultAgreementColors,
} from "../src/package/comparisonMetrics.js";

const DRY = -99999;
// 2x2 grid; meta bounds arbitrary (only used when a mask is supplied).
const meta = { width: 2, height: 2, bw: 0, bs: 0, be: 2, bn: 2 };

describe("compareExtentMetrics", () => {
  test("perfect agreement → PC=1, all-wet gives H=F=1", () => {
    const a = [1, 1, 1, 1];
    const b = [1, 1, 1, 1];
    const m = compareExtentMetrics(a, b, meta);
    assert.equal(m.tp, 4);
    assert.equal(m.fp, 0);
    assert.equal(m.fn, 0);
    assert.equal(m.tn, 0);
    assert.equal(m.pc, 1);
    assert.equal(m.h, 1);
    assert.equal(m.f, 1);
  });

  test("confusion matrix counts wet(!=dry) vs dry correctly", () => {
    // idx: 0 both wet (tp), 1 wet in 1 only (fp), 2 wet in 2 only (fn), 3 both dry (tn)
    const a = [1, 1, DRY, DRY];
    const b = [1, DRY, 1, DRY];
    const m = compareExtentMetrics(a, b, meta);
    assert.deepEqual([m.tp, m.fp, m.fn, m.tn], [1, 1, 1, 1]);
    assert.equal(m.n, 4);
    assert.equal(m.pc, 0.5);                 // (tp+tn)/n = 2/4
    assert.equal(m.b, 1);                    // (tp+fp)/(tp+fn) = 2/2
    assert.equal(m.h, 0.5);                  // tp/(tp+fn) = 1/2
    assert.ok(Math.abs(m.f - 1 / 3) < 1e-9); // tp/(tp+fp+fn) = 1/3
  });

  test("all-dry pixels are true-negatives → PC=1 (matches the original logic, not null)", () => {
    const m = compareExtentMetrics([DRY, DRY], [DRY, DRY], { ...meta, height: 1 });
    assert.equal(m.tn, 2);
    assert.equal(m.tp, 0);
    assert.equal(m.pc, 1);
  });

  // A zero denominator means the score has no value, not that it scored zero. 0 would read as
  // "predicted nothing where there was flooding" when the truth is "nothing to score against".
  test("all-dry: b, h, k and f are null, not 0; pc stays 1", () => {
    const m = compareExtentMetrics([DRY, DRY], [DRY, DRY], { ...meta, height: 1 });
    assert.equal(m.pc, 1, "every pixel agrees, so pc is defined");
    assert.equal(m.b, null, "no observed wet pixels, so bias has no value");
    assert.equal(m.h, null);
    assert.equal(m.f, null, "neither raster has a wet pixel");
    assert.equal(m.k, null, "both put every pixel in one class, so kappa is 0/0");
    assert.equal(m.mi, null, "null in any component makes the sum null, never 0");
  });

  test("observation dry, prediction wet: b and h are null, f and k are defined", () => {
    const m = compareExtentMetrics([1, 1], [DRY, DRY], { ...meta, height: 1 });
    assert.equal(m.fp, 2, "wet in the prediction only");
    assert.equal(m.b, null, "tp+fn is 0");
    assert.equal(m.h, null);
    assert.equal(m.f, 0, "a real 0: wet pixels were claimed and none agreed");
    assert.equal(m.pc, 0);
  });

  test("a real 0 is still 0, and stays distinguishable from null", () => {
    // prediction wet at pixel 0, observation wet at pixel 1 - no overlap at all
    const m = compareExtentMetrics([1, DRY], [DRY, 1], { ...meta, height: 1 });
    assert.equal(m.h, 0, "observed wet exists, none of it was hit");
    assert.equal(m.b, 1, "one wet predicted, one wet observed");
    assert.notEqual(m.h, null);
  });

  test("missing inputs → null (guard)", () => {
    assert.equal(compareExtentMetrics(null, [1], meta), null);
    assert.equal(compareExtentMetrics([1], [1], null), null);
  });

  test("mask restricts the comparison to the polygon (SpatialFilter)", () => {
    // Pixel sample points sit at cell corners: (px,py) → lat=bn-(py/h)*range, lng=bw+(px/w)*range.
    // For this 2x2/0..2 grid: pixel 0 = (lat2,lng0). A box around it (and no other) → only pixel 0.
    const a = [1, DRY, DRY, 1];   // pixel 0 = both wet
    const b = [1, 1, 1, DRY];
    const maskPixel0 = [{ lat: 2.5, lng: -0.5 }, { lat: 2.5, lng: 0.5 }, { lat: 1.5, lng: 0.5 }, { lat: 1.5, lng: -0.5 }];
    const m = compareExtentMetrics(a, b, meta, { mask: maskPixel0 });
    assert.equal(m.n, 1, "only the masked pixel counted");
    assert.equal(m.tp, 1, "that pixel is wet in both");
  });
});

describe("classifyExtents (N-ary pixel classification)", () => {
  test("DRY_DEFAULT is the shared -99999 sentinel", () => {
    assert.equal(DRY_DEFAULT, -99999);
  });

  test("2 layers → the classic both/only-1/only-2/neither split as a bitmask", () => {
    // idx: 0 both wet (0b11), 1 wet in layer0 only (0b01), 2 wet in layer1 only (0b10), 3 neither (0b00)
    const a = [1, 1, DRY, DRY];
    const b = [1, DRY, 1, DRY];
    const { categories, counts, nLayers } = classifyExtents([a, b]);
    assert.equal(nLayers, 2);
    assert.deepEqual([...categories], [0b11, 0b01, 0b10, 0b00]);
    assert.equal(counts[0b00], 1);
    assert.equal(counts[0b01], 1);
    assert.equal(counts[0b10], 1);
    assert.equal(counts[0b11], 1);
  });

  test("generalizes to N: bit L set ⇔ layer L wet, counts sum to pixel count", () => {
    const l0 = [1, DRY, 1];
    const l1 = [1, 1, DRY];
    const l2 = [1, 1, 1];
    const { categories, counts, nLayers } = classifyExtents([l0, l1, l2]);
    assert.equal(nLayers, 3);
    assert.deepEqual([...categories], [0b111, 0b110, 0b101]);
    assert.equal([...counts].reduce((x, y) => x + y, 0), 3);
  });

  test("custom dryValue is honoured", () => {
    const { categories } = classifyExtents([[0, 5], [0, 0]], { dryValue: 0 });
    assert.deepEqual([...categories], [0b00, 0b01]);
  });

  test("guards: <2 layers, >8 layers, mismatched grids", () => {
    assert.throws(() => classifyExtents([[1]]), /at least 2/);
    assert.throws(() => classifyExtents(new Array(9).fill([1])), /at most 8/);
    assert.throws(() => classifyExtents([[1, 1], [1]]), /share one grid/);
  });
});

describe("extentCategoriesToRgba / combineExtentRgba (visualization)", () => {
  test("the 2-layer palette reproduces the controller's exact colours", () => {
    assert.deepEqual(EXTENT_COMPARE_PALETTE_2[0b00], [0, 0, 0, 0]);        // neither → transparent
    assert.deepEqual(EXTENT_COMPARE_PALETTE_2[0b01], [247, 127, 0, 255]);  // layer0 only → orange
    assert.deepEqual(EXTENT_COMPARE_PALETTE_2[0b10], [252, 191, 73, 255]); // layer1 only → yellow
    assert.deepEqual(EXTENT_COMPARE_PALETTE_2[0b11], [214, 40, 40, 255]);  // both → red
  });

  test("combineExtentRgba matches the old inlined combine loop byte-for-byte", () => {
    const a = [1, 1, DRY, DRY];
    const b = [1, DRY, 1, DRY];
    // reference: the exact loop that lived in comparison.js (3×)
    const ref = new Uint8ClampedArray(a.length * 4);
    for (let i = 0; i < a.length; i++) {
      if (a[i] === DRY && b[i] === DRY) { /* transparent */ }
      else if (a[i] !== DRY && b[i] !== DRY) { ref[i*4]=214; ref[i*4+1]=40; ref[i*4+2]=40; ref[i*4+3]=255; }
      else if (a[i] !== DRY && b[i] === DRY) { ref[i*4]=247; ref[i*4+1]=127; ref[i*4+2]=0; ref[i*4+3]=255; }
      else { ref[i*4]=252; ref[i*4+1]=191; ref[i*4+2]=73; ref[i*4+3]=255; }
    }
    const { rgba } = combineExtentRgba([a, b]);
    assert.deepEqual([...rgba], [...ref]);
    assert.ok(rgba instanceof Uint8ClampedArray);
  });

  test("N>2 requires an explicit palette; with one it renders", () => {
    const three = [[1, DRY], [DRY, 1], [1, 1]];
    assert.throws(() => combineExtentRgba(three), /needs an explicit palette/);
    const pal = { 0b101: [10, 20, 30, 255], 0b110: [40, 50, 60, 255] };
    const { rgba } = combineExtentRgba(three, { palette: pal });
    assert.deepEqual([...rgba.slice(0, 4)], [10, 20, 30, 255]);  // pixel0 = layers 0 & 2 wet
    assert.deepEqual([...rgba.slice(4, 8)], [40, 50, 60, 255]);  // pixel1 = layers 1 & 2 wet
  });

  test("unmapped categories stay transparent", () => {
    const rgba = extentCategoriesToRgba(Uint8Array.from([0b11, 0b00]), { 0b11: [1, 2, 3, 255] });
    assert.deepEqual([...rgba], [1, 2, 3, 255, 0, 0, 0, 0]);
  });
});

describe("palette override (2^n - 1 colours)", () => {
  test("paletteFromColors: 3 colours → categories 1..3, category 0 transparent", () => {
    const pal = paletteFromColors(["#ff0000", "#00ff00", [0, 0, 255]]);
    assert.deepEqual(pal[0], [0, 0, 0, 0]);       // neither: always transparent, not in the list
    assert.deepEqual(pal[1], [255, 0, 0, 255]);   // only-1
    assert.deepEqual(pal[2], [0, 255, 0, 255]);   // only-2
    assert.deepEqual(pal[3], [0, 0, 255, 255]);   // both (array form, alpha defaulted)
  });

  test("paletteFromColors rejects a non-(2^n-1) length", () => {
    assert.throws(() => paletteFromColors(["#fff", "#000"]), /2\^n - 1/);      // 2 is not 2^n-1
    assert.throws(() => paletteFromColors(["#fff"]), /2\^n - 1/);
  });

  test("combineExtentRgba honours a `colors` override for the 2-layer case", () => {
    const a = [1, DRY], b = [1, 1];   // pixel0 both (0b11), pixel1 only-2 (0b10)
    const { rgba } = combineExtentRgba([a, b], { colors: ["#111111", "#222222", "#333333"] });
    assert.deepEqual([...rgba.slice(0, 4)], [0x33, 0x33, 0x33, 255]);   // both → 3rd colour
    assert.deepEqual([...rgba.slice(4, 8)], [0x22, 0x22, 0x22, 255]);   // only-2 → 2nd colour
  });

  test("combineExtentRgba rejects a colours list that doesn't match the layer count", () => {
    assert.throws(() => combineExtentRgba([[1], [1]], { colors: ["#111", "#222"] }), /needs 3 colors/);
  });

  test("a 3-layer comparison is fully colourable via `colors` (7 colours)", () => {
    const three = [[1, DRY], [DRY, 1], [1, 1]];   // p0 = layers 0&2 (0b101=5), p1 = layers 1&2 (0b110=6)
    const colors = ["#010101", "#020202", "#030303", "#040404", "#050505", "#060606", "#070707"];
    const { rgba } = combineExtentRgba(three, { colors });
    assert.deepEqual([...rgba.slice(0, 4)], [5, 5, 5, 255]);   // category 5 → colors[4]
    assert.deepEqual([...rgba.slice(4, 8)], [6, 6, 6, 255]);   // category 6 → colors[5]
  });
});

describe("ensemble reducer (agreement count → n colours)", () => {
  test("agreementCounts: per-pixel count of wet members (0..N) + histogram", () => {
    // 3 members, 4 pixels. counts: p0=3, p1=2, p2=1, p3=0
    const m0 = [1, 1, 1, DRY];
    const m1 = [1, 1, DRY, DRY];
    const m2 = [1, DRY, DRY, DRY];
    const { perPixel, histogram, nLayers } = agreementCounts([m0, m1, m2]);
    assert.equal(nLayers, 3);
    assert.deepEqual([...perPixel], [3, 2, 1, 0]);
    assert.deepEqual([...histogram], [1, 1, 1, 1]);   // one pixel each at counts 0,1,2,3
  });

  test("N members need only N colours (agreement 1..N; count 0 transparent)", () => {
    const m0 = [1, 1, 1, DRY];
    const m1 = [1, 1, DRY, DRY];
    const m2 = [1, DRY, DRY, DRY];
    const colors = ["#111111", "#222222", "#333333"];   // 3 colours for 3 members
    const { rgba } = ensembleAgreementRgba([m0, m1, m2], { colors });
    assert.deepEqual([...rgba.slice(0, 4)], [0x33, 0x33, 0x33, 255]);   // count 3 → colours[2]
    assert.deepEqual([...rgba.slice(4, 8)], [0x22, 0x22, 0x22, 255]);   // count 2 → colours[1]
    assert.deepEqual([...rgba.slice(8, 12)], [0x11, 0x11, 0x11, 255]);  // count 1 → colours[0]
    assert.deepEqual([...rgba.slice(12, 16)], [0, 0, 0, 0]);            // count 0 → transparent
  });

  test("omitted colours default to a viridis ramp and warn", () => {
    const r = ensembleAgreementRgba([[1, DRY], [1, 1]]);
    assert.equal(r.nLayers, 2);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /No ensemble colors/);
    assert.equal(r.rgba.length, 2 * 4);
  });

  test("a wrong-length colour list is rejected (must be exactly N)", () => {
    assert.throws(() => ensembleAgreementRgba([[1], [1], [1]], { colors: ["#111", "#222"] }),
      /3 members need 3 colors/);
  });

  test("defaultAgreementColors returns N distinct rgba stops", () => {
    const cols = defaultAgreementColors(4);
    assert.equal(cols.length, 4);
    assert.equal(cols[0].length, 4);
    assert.notDeepEqual(cols[0], cols[3]);   // ramp endpoints differ
  });

  test("agreementToRgba leaves counts with no colour transparent", () => {
    const rgba = agreementToRgba(Uint8Array.from([2, 0]), [[9, 9, 9, 255]]);   // only count 1 mapped
    assert.deepEqual([...rgba], [0, 0, 0, 0, 0, 0, 0, 0]);   // count 2 unmapped, count 0 dry
  });
});
