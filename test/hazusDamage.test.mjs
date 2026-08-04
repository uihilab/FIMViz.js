// hazusDamage — headless HAZUS damage aggregation extracted from the damage controller. Pure math,
// no DOM. Confirms the structure/content totals, population sums, and per-category GPKG breakdown.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { estimateHazusDamage } from "../src/package/hazusDamage.js";

describe("estimateHazusDamage", () => {
  test("JSON records sum sd/cd into structure/content totals", () => {
    const buildings = [
      { lat: 1, lng: 1, sd: 100, cd: 40 },
      { lat: 2, lng: 2, sd: 250, cd: 60 },
    ];
    const r = estimateHazusDamage(buildings, { isGpkg: false });
    assert.equal(r.count, 2);
    assert.equal(r.totalStructures, 350);
    assert.equal(r.totalContent, 100);
    assert.equal(r.totalPopCount, 0);
    assert.deepEqual(r.catStats, {});
  });

  test("GPKG records aggregate dollars, population, and per-category stats", () => {
    const buildings = [
      { lat: 1, lng: 1, structure: 1000, content: 500, damage_cat: "RES",
        pop_amu65: 2, pop_amo65: 1, pop_pmu65: 3, pop_pmo65: 0 },
      { lat: 2, lng: 2, structure: 400, content: 100, damage_cat: "RES",
        pop_amu65: 1, pop_amo65: 0, pop_pmu65: 0, pop_pmo65: 4 },
      { lat: 3, lng: 3, structure: 900, content: 0, damage_cat: "COM",
        pop_amu65: 0, pop_amo65: 0, pop_pmu65: 0, pop_pmo65: 0 },
    ];
    const r = estimateHazusDamage(buildings, { isGpkg: true });
    assert.equal(r.count, 3);
    assert.equal(r.totalStructures, 2300);
    assert.equal(r.totalContent, 600);
    assert.deepEqual(r.totalPop, { amu65: 3, amo65: 1, pmu65: 3, pmo65: 4 });
    assert.equal(r.totalPopCount, 11);
    assert.deepEqual(r.catStats.RES, { count: 2, structure: 1400, content: 600 });
    assert.deepEqual(r.catStats.COM, { count: 1, structure: 900, content: 0 });
  });

  test("GPKG missing damage_cat buckets under OTHER; missing dollars treated as 0", () => {
    const r = estimateHazusDamage([{ lat: 1, lng: 1 }], { isGpkg: true });
    assert.deepEqual(r.catStats.OTHER, { count: 1, structure: 0, content: 0 });
    assert.equal(r.totalStructures, 0);
  });

  test("records without lat/lng are skipped from aggregation but counted in total", () => {
    const buildings = [
      { lat: 1, lng: 1, sd: 100, cd: 10 },
      { lat: null, lng: 2, sd: 999, cd: 999 },  // skipped
      null,                                       // skipped
    ];
    const r = estimateHazusDamage(buildings, { isGpkg: false });
    assert.equal(r.count, 3, "count is the full record length");
    assert.equal(r.totalStructures, 100, "only the valid record contributed");
    assert.equal(r.totalContent, 10);
  });

  test("empty / non-array input → zeroed result", () => {
    const r = estimateHazusDamage(null, { isGpkg: true });
    assert.equal(r.count, 0);
    assert.equal(r.totalStructures, 0);
    assert.equal(r.totalPopCount, 0);
    assert.deepEqual(r.catStats, {});
  });
});
