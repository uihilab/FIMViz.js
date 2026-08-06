// Filter.from's coercion contract — in particular that it is DUCK-TYPED.
//
// `fimviz` and `fimviz/ui` are two separate bundles that each carry their own copy of filter.js, so
// a SpatialFilter built inside `fimviz/ui` (createRegionDraw does exactly that) is not `instanceof`
// the engine bundle's Filter. Browser verification caught this as "Filter.from: unrecognized filter
// input" thrown from layer.getStats({ filter }) on the ui module's OWN region-draw output.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { Filter, SpatialFilter, PredicateFilter } from "../src/package/filter.js";

const SQUARE = [{ lat: 0, lng: 0 }, { lat: 0, lng: 2 }, { lat: 2, lng: 2 }, { lat: 2, lng: 0 }];

describe("Filter.from coercion", () => {
  test("a real Filter instance is returned as-is", () => {
    const f = new SpatialFilter(SQUARE);
    assert.equal(Filter.from(f), f);
  });

  test("a function becomes a PredicateFilter", () => {
    // A raster predicate is called (value, x, y, at) — not with the unit object.
    const f = Filter.from((value) => value > 1);
    assert.ok(f instanceof PredicateFilter);
    assert.equal(f.test({ value: 2 }), true);
    assert.equal(f.test({ value: 0 }), false);
  });

  test("a vector unit hands the predicate the feature instead", () => {
    const f = Filter.from((feature) => feature.properties.keep === true);
    assert.equal(f.test({ feature: { properties: { keep: true } }, lat: 0, lng: 0 }), true);
    assert.equal(f.test({ feature: { properties: { keep: false } }, lat: 0, lng: 0 }), false);
  });

  test("an array becomes a SpatialFilter", () => {
    const f = Filter.from(SQUARE);
    assert.ok(f instanceof SpatialFilter);
    assert.equal(f.contains(1, 1), true);
    assert.equal(f.contains(9, 9), false);
  });

  test("a Region-like { toFilter() } is unwrapped", () => {
    const inner = new SpatialFilter(SQUARE);
    assert.equal(Filter.from({ toFilter: () => inner }), inner);
  });

  test("null/undefined coerce to null, not an error", () => {
    assert.equal(Filter.from(null), null);
    assert.equal(Filter.from(undefined), null);
  });

  test("a FOREIGN filter is accepted on its test() method, not its class", () => {
    // Stands in for a SpatialFilter from the other bundle: same shape, unrelated class identity.
    class ForeignFilter {
      test(u) { return u.value > 5; }
      isEmpty() { return false; }
    }
    const foreign = new ForeignFilter();
    assert.equal(foreign instanceof Filter, false, "precondition: not an instanceof");
    const f = Filter.from(foreign);
    assert.equal(f, foreign);
    assert.equal(f.test({ value: 9 }), true);
  });

  test("a plain object with a test() method works too (host-supplied filter)", () => {
    const f = Filter.from({ test: (u) => u.value === 3 });
    assert.equal(f.test({ value: 3 }), true);
    assert.equal(f.test({ value: 4 }), false);
  });

  test("an array is read as a polygon even though it is also an object", () => {
    // Ordering guard: arrays are checked before the duck-type, or [] would fall through.
    assert.ok(Filter.from([[0, 0], [0, 2], [2, 2]]) instanceof SpatialFilter);
  });

  test("something with neither test(), toFilter(), nor array shape still throws", () => {
    assert.throws(() => Filter.from({ nope: true }), /unrecognized filter input/);
    assert.throws(() => Filter.from(42), /unrecognized filter input/);
  });
});

describe("Filter.all conjunction", () => {
  test("combines heterogeneous inputs, including a foreign filter", () => {
    const foreign = { test: (u) => u.lat > 0.5 };
    const f = Filter.all([SQUARE, foreign, (value) => value !== 0]);
    assert.equal(f.test({ lat: 1, lng: 1, value: 7 }), true);
    assert.equal(f.test({ lat: 0.1, lng: 1, value: 7 }), false);   // fails the foreign filter
    assert.equal(f.test({ lat: 1, lng: 1, value: 0 }), false);     // fails the predicate
  });

  test("an empty list is null, a single filter is passed through unwrapped", () => {
    assert.equal(Filter.all([]), null);
    assert.equal(Filter.all([null, undefined]), null);
    const one = new SpatialFilter(SQUARE);
    assert.equal(Filter.all([one]), one);
  });
});
