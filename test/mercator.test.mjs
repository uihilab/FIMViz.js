// geo/mercator.js — the plate-carrée → Web Mercator row remap, and the image-vs-tiles heuristic.
//
// This is placement math: when it is wrong, nothing throws and nothing looks broken — the data is
// simply drawn somewhere it isn't. That is exactly the failure it was written to fix, so the tests
// check against independently-computed latitudes rather than against the implementation's own output.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MERCATOR_MAX_LAT, RASTER_LIMITS, mercY, invMercY, rasterRenderPlan, toMercatorRows,
} from "../src/geo/mercator.js";

const bounds = (south, north, west = -10, east = 10) => ({ north, south, east, west });
/** A grid whose every pixel encodes its own row, so a remap is checkable cell by cell. */
const rowCoded = (w, h) => {
  const px = new Float64Array(w * h);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) px[r * w + c] = r;
  return px;
};

describe("mercator: the projection itself", () => {
  test("mercY/invMercY round-trip across the usable range", () => {
    for (const lat of [-85, -60, -23.5, 0, 23.5, 45, 60, 85]) {
      assert.ok(Math.abs(invMercY(mercY(lat)) - lat) < 1e-9, `${lat} did not round-trip`);
    }
  });

  test("the equator is the fixed point, and y grows without bound toward the pole", () => {
    assert.ok(Math.abs(mercY(0)) < 1e-15, "the equator is y = 0");
    assert.ok(mercY(MERCATOR_MAX_LAT) - Math.PI < 1e-6, "the cutoff is where y = pi");
    assert.ok(mercY(89.9999) > 10, "and the pole itself is unrepresentable");
  });
});

describe("mercator: render plan", () => {
  test("the stretch factor matches the hand-computed one for a global extent", () => {
    // -80..90 clips to -80..85.0511. dy = 3.14159 - (-2.43625) = 5.5778; dphi = 165.05 deg = 2.8807 rad.
    const plan = rasterRenderPlan({ width: 180, height: 170, bounds: bounds(-80, 90) });
    assert.ok(Math.abs(plan.stretch - 1.936) < 0.01, `stretch was ${plan.stretch}`);
    assert.equal(plan.image.clipped, true, "latitude 90 cannot be drawn and must be clipped away");
    assert.equal(plan.image.bounds.north, MERCATOR_MAX_LAT);
    assert.equal(plan.image.bounds.south, -80, "the southern edge was already inside the cutoff");
    assert.equal(plan.image.height, 320, "165 surviving rows x 1.936");
    assert.equal(plan.image.width, 180, "longitude is linear in Mercator — columns are untouched");
    assert.equal(plan.mode, "image", "~58k pixels is nowhere near needing tiles");
  });

  test("a mid-latitude regional extent stretches much less", () => {
    // The Idalia NLDAS-2 fixture. dy = 0.6941 - 0.4512 = 0.2429; dphi = 11.875 deg = 0.20726 rad.
    const plan = rasterRenderPlan({ width: 104, height: 96, bounds: bounds(25.0625, 36.9375) });
    assert.ok(Math.abs(plan.stretch - 1.172) < 0.01, `stretch was ${plan.stretch}`);
    assert.equal(plan.image.clipped, false);
    assert.equal(plan.image.height, 113);
  });

  test("an equatorial sliver is passed straight through — no copy for nothing", () => {
    const plan = rasterRenderPlan({ width: 50, height: 50, bounds: bounds(-0.4, 0.4) });
    assert.equal(plan.image.mercator, false, "under 0.1% stretch there is nothing to correct");
    assert.equal(plan.image.height, 50);
  });

  // The heuristic. It keys on the OUTPUT size, not on being global: the row blowup is ~2x at worst,
  // so a global coarse grid is comfortably an image and only a genuinely large source needs tiles.
  describe("image-vs-tiles heuristic", () => {
    test("a large source trips the pixel budget and asks for tiles", () => {
      // 0.05-degree global: 7200x3600 -> ideal ~7200x7400, ~53 Mpx against a 16 Mpx budget.
      const plan = rasterRenderPlan({ width: 7200, height: 3600, bounds: bounds(-85, 85) });
      assert.equal(plan.mode, "tiles");
      assert.equal(plan.capped, true);
      assert.ok(plan.image.width * plan.image.height <= RASTER_LIMITS.maxPixels,
        "and it is still drawable — capped, not refused");
      assert.match(plan.reason, /exceeds the single-image budget/);
      assert.ok(Math.abs(plan.image.width / plan.image.height
        - plan.ideal.width / plan.ideal.height) < 0.01, "aspect is preserved when capping");
    });

    test("the side limit trips independently of the pixel budget", () => {
      // 12000x100 is only 1.2 Mpx but far past any browser's canvas width.
      const plan = rasterRenderPlan({ width: 12000, height: 100, bounds: bounds(-60, 60) });
      assert.equal(plan.mode, "tiles");
      assert.ok(plan.image.width <= RASTER_LIMITS.maxDimension);
    });

    test("every budget is overridable, which is the point of having them as options", () => {
      const grid = { width: 2000, height: 1000, bounds: bounds(-60, 60) };
      assert.equal(rasterRenderPlan(grid).mode, "image", "well inside the defaults");
      assert.equal(rasterRenderPlan(grid, { maxPixels: 1000 }).mode, "tiles");
      assert.equal(rasterRenderPlan(grid, { maxDimension: 500 }).mode, "tiles");
      assert.equal(rasterRenderPlan(grid, { maxPixels: 1000, strategy: "image" }).mode, "image",
        "an explicit strategy overrides the heuristic entirely");
      assert.equal(rasterRenderPlan(grid, { strategy: "tiles" }).mode, "tiles");
    });

    test("tileSize is carried on the plan and is overridable", () => {
      assert.equal(rasterRenderPlan({ width: 10, height: 10, bounds: bounds(-60, 60) }).tileSize, 256);
      assert.equal(rasterRenderPlan({ width: 10, height: 10, bounds: bounds(-60, 60) },
        { tileSize: 512 }).tileSize, 512);
    });

    test("mercator:false passes the grid through untouched, for a non-Mercator provider", () => {
      const plan = rasterRenderPlan({ width: 180, height: 170, bounds: bounds(-80, 90) },
        { mercator: false });
      assert.equal(plan.image.mercator, false);
      assert.equal(plan.image.height, 170, "no remap");
      assert.deepEqual(plan.image.bounds, bounds(-80, 90), "and no clipping");
    });

    test("a degenerate extent degrades to a pass-through instead of dividing by zero", () => {
      for (const b of [bounds(86, 89), bounds(10, 10), null]) {
        const plan = rasterRenderPlan({ width: 4, height: 4, bounds: b });
        assert.equal(plan.image.mercator, false);
        assert.ok(Number.isFinite(plan.image.height));
      }
    });
  });
});

describe("mercator: the remap", () => {
  // The load-bearing check. Each output row must read the source row containing ITS OWN latitude,
  // computed here from the inverse projection rather than from the implementation.
  test("every output row reads the source row holding its latitude", () => {
    const src = { pixels: rowCoded(3, 100), width: 3, height: 100, bounds: bounds(-70, 70) };
    const plan = rasterRenderPlan(src);
    const out = toMercatorRows(src, plan);

    const { north, south } = plan.image.bounds;
    const yN = mercY(north), yS = mercY(south);
    for (let dy = 0; dy < out.height; dy++) {
      const lat = invMercY(yN + ((dy + 0.5) / out.height) * (yS - yN));
      const expected = Math.min(99, Math.max(0, Math.round(((70 - lat) / 140) * 100 - 0.5)));
      assert.equal(out.pixels[dy * out.width], expected,
        `row ${dy} (lat ${lat.toFixed(3)}) read source row ${out.pixels[dy * out.width]}`);
    }
  });

  test("the equator lands halfway down a symmetric output — the whole point of the fix", () => {
    // A -60..60 grid drawn linearly would put the equator at the midpoint by accident. Use an
    // ASYMMETRIC extent, where plate carrée and Mercator disagree visibly.
    const src = { pixels: rowCoded(1, 180), width: 1, height: 180, bounds: bounds(-80, 10) };
    const plan = rasterRenderPlan(src);
    const out = toMercatorRows(src, plan);
    // Source row for the equator: (10 - 0)/90 * 180 = 20. Find where it landed in the output.
    const at = out.pixels.indexOf(20);
    const drawnFraction = at / out.height;
    const mercFraction = (mercY(10) - mercY(0)) / (mercY(10) - mercY(-80));
    assert.ok(Math.abs(drawnFraction - mercFraction) < 0.02,
      `equator drawn at ${drawnFraction.toFixed(3)} of the image, Mercator says ${mercFraction.toFixed(3)}`);
    // Plate carrée would put it at 0.111 of the image; Mercator at 0.067. That 4.4-point gap IS the
    // defect — on a 600 px-tall map it is 26 px, and it grows with the extent.
    const plateCarreeFraction = (10 - 0) / 90;
    assert.ok(Math.abs(drawnFraction - plateCarreeFraction) > 0.03,
      "and it must NOT be where the un-corrected linear stretch would have put it");
  });

  test("nearest is the default, so a classified raster keeps its class values", () => {
    const px = Float64Array.from([1, 1, 3, 3, 7, 7, 9, 9]);
    const src = { pixels: px, width: 2, height: 4, bounds: bounds(-70, 70) };
    const out = toMercatorRows(src, rasterRenderPlan(src));
    for (const v of out.pixels) {
      assert.ok([1, 3, 7, 9].includes(v), `nearest invented the value ${v} between classes`);
    }
  });

  test("linear interpolates, but falls back to nearest beside a NaN", () => {
    const px = Float64Array.from([0, 10, NaN, 30]);
    const src = { pixels: px, width: 1, height: 4, bounds: bounds(-70, 70) };
    const out = toMercatorRows(src, rasterRenderPlan(src), { method: "linear" });
    assert.ok(out.pixels.some((v) => v > 0 && v < 10), "interpolation happened somewhere");
    for (const v of out.pixels) {
      assert.ok(Number.isNaN(v) || (v >= 0 && v <= 30), `interpolation escaped the source range: ${v}`);
    }
    assert.ok(!out.pixels.some((v) => v > 10 && v < 30 && !Number.isNaN(v) && v !== 30)
      || out.pixels.includes(30), "values beside the NaN came from a real neighbour");
  });

  test("noData is respected the same way NaN is", () => {
    const px = Float64Array.from([0, 10, -9999, 30]);
    const src = { pixels: px, width: 1, height: 4, bounds: bounds(-70, 70) };
    const out = toMercatorRows(src, rasterRenderPlan(src), { method: "linear", noData: -9999 });
    for (const v of out.pixels) {
      assert.ok(v === -9999 || (v >= 0 && v <= 30), `nodata leaked into an interpolation: ${v}`);
    }
  });

  test("the output keeps the pixel array's own type", () => {
    const src = { pixels: new Float32Array(40), width: 2, height: 20, bounds: bounds(-70, 70) };
    const out = toMercatorRows(src, rasterRenderPlan(src));
    assert.ok(out.pixels instanceof Float32Array);
  });

  test("a pass-through plan returns the SAME array — no copy when there is nothing to do", () => {
    const src = { pixels: rowCoded(2, 10), width: 2, height: 10, bounds: bounds(-0.2, 0.2) };
    const out = toMercatorRows(src, rasterRenderPlan(src));
    assert.equal(out.pixels, src.pixels);
  });
});
