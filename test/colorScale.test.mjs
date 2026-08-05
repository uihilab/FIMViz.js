// ColorScale palette registry (package/colorScale.js) — the open-registration + fail-loud behaviour.
// A typo used to render 'blues' silently; now an unknown palette throws, and hosts can register
// their own (the registerLayerType pattern). Headless.

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  ColorScale, PALETTES, registerPalette, hasPalette, paletteNames,
} from "../src/package/colorScale.js";

describe("palette registry", () => {
  test("built-in names resolve", () => {
    for (const name of Object.keys(PALETTES)) assert.ok(hasPalette(name), name);
    assert.ok(paletteNames().includes("viridis"));
  });

  test("an unknown palette name is not silently accepted", () => {
    assert.equal(hasPalette("nope"), false);
    // The old behaviour: PALETTES['nope']?.colors || PALETTES.blues.colors → wrong render, no signal.
    assert.throws(() => new ColorScale({ palette: "nope" }), /unknown palette "nope"/);
    assert.throws(() => new ColorScale({ palette: "nope" }), /Available:/);
  });

  test("set({palette}) rejects an unknown name", () => {
    const cs = new ColorScale({ palette: "blues" });
    assert.throws(() => cs.set({ palette: "bogus" }), /unknown palette "bogus"/);
    assert.equal(cs.palette, "blues", "state unchanged after a rejected set");
  });

  test("set() is the one knob writer: batch, chainable, ONE onChange", () => {
    const cs = new ColorScale({ palette: "blues" });
    let fired = 0;
    cs.onChange(() => fired++);
    const returned = cs.set({ palette: "viridis", min: 0, max: 46, continuous: true, unit: "m" });
    assert.equal(returned, cs, "chainable — returns the scale, synchronously");
    assert.equal(fired, 1, "one notification for the whole batch, not one per key");
    assert.equal(cs.palette, "viridis");
    assert.equal(cs.unit, "m");
    assert.equal(cs.continuous, true, "continuous is a GETTER now, not a setter method");
    assert.equal(cs.kind, "continuous");
  });

  test("set() throws on an unknown key instead of silently ignoring it", () => {
    const cs = new ColorScale({ palette: "blues" });
    assert.throws(() => cs.set({ pallete: "viridis" }), /unknown key\(s\) "pallete"/);
  });

  test("the removed setters are gone, not deprecated", () => {
    const cs = new ColorScale({ palette: "blues" });
    assert.equal(cs.setPalette, undefined, "setPalette folded into set({palette})");
    assert.equal(cs.setDomain, undefined, "setDomain folded into set({min,max})");
    assert.equal(typeof cs.continuous, "boolean", "continuous(bool) is now a boolean getter");
    // The index-addressed ops are NOT knobs and stay as their own verbs.
    assert.equal(typeof cs.setColor, "function");
    assert.equal(typeof cs.setRange, "function");
    assert.equal(typeof cs.setLabel, "function");
  });

  test("a custom color array is always allowed (no registration needed)", () => {
    const cs = new ColorScale({ palette: ["#000000", "#ffffff"] });
    assert.deepEqual(cs.getRgb(0), [0, 0, 0]);
    assert.deepEqual(cs.getRgb(1), [255, 255, 255]);
  });
});

describe("registerPalette", () => {
  const CUSTOM = "test-custom-palette";
  afterEach(() => { /* registry is module state; names are unique per test to avoid bleed */ });

  test("a registered palette resolves by name and colours the scale", () => {
    registerPalette(CUSTOM, ["#010101", "#0a0a0a", "#141414"]);
    assert.ok(hasPalette(CUSTOM));
    assert.ok(paletteNames().includes(CUSTOM));
    const cs = new ColorScale({ palette: CUSTOM, min: 0, max: 1 });
    assert.doesNotThrow(() => cs.getRgb(0.5));
    assert.deepEqual(cs.getRgb(0), [1, 1, 1], "first stop of the custom palette");
  });

  test("registration validates its inputs", () => {
    assert.throws(() => registerPalette("", ["#000", "#fff"]), /name string is required/);
    assert.throws(() => registerPalette("x", ["#000"]), />=2 hex colors/);
    assert.throws(() => registerPalette("x", "notarray"), />=2 hex colors/);
  });

  test("registering does not mutate the built-in PALETTES table", () => {
    const before = Object.keys(PALETTES).length;
    registerPalette("another-custom", ["#111", "#222"]);
    assert.equal(Object.keys(PALETTES).length, before, "built-ins stay immutable");
  });
});

// "A value that isn't one must never take a colour from the ramp" (docs/usage/COLOR_SCALE.md).
// Numeric coercion is what made this dangerous: Number(null) and Number('') are 0, so an absent value
// used to render as the domain MINIMUM — "no data" indistinguishable from "the lowest reading".
describe("ColorScale: absent values vs. real ones", () => {
  const scale = () => new ColorScale({ palette: "viridis", min: 0, max: 10, continuous: true });

  test("null / undefined / '' / NaN / non-numeric all resolve to no colour", () => {
    const cs = scale();
    for (const v of [null, undefined, "", NaN, "abc", Infinity, -Infinity]) {
      assert.equal(cs.getColor(v), null, `getColor(${String(v)}) must be null`);
      assert.equal(cs.getRgb(v), null, `getRgb(${String(v)}) must be null`);
    }
  });

  test("…but 0 is a real value and still takes the minimum colour", () => {
    const cs = scale();
    assert.deepEqual(cs.getRgb(0), cs.getRgb(0.0), "sanity");
    assert.ok(cs.getColor(0), "zero must colour — it is a reading, not an absence");
    assert.notEqual(cs.getColor(0), cs.getColor(10), "and not be confused with the top of the ramp");
    assert.ok(cs.getColor("5"), "a numeric string is a value too");
  });

  test("missingColor is honoured on the palette path, verbatim for CSS colours", () => {
    const cs = new ColorScale({ palette: "viridis", min: 0, max: 10, continuous: true,
      missingColor: "#cccccc" });
    assert.equal(cs.getColor(null), "#cccccc", "returned as given, not round-tripped through rgb");
    assert.deepEqual(cs.getRgb(NaN), [204, 204, 204], "and parsed for the hot path");
    assert.equal(cs.getColor(5), "rgb(39, 173, 129)", "real values still come off the ramp");
  });

  test("a malformed rgb string can never escape — the old failure was undetectable", () => {
    const cs = scale();
    for (const v of [NaN, "abc"]) {
      assert.ok(!String(cs.getColor(v)).includes("NaN"), `getColor(${String(v)}) leaked NaN`);
    }
  });
});

describe("ColorScale: reading the domain back", () => {
  test("getValues() works for a CONTINUOUS scale, whose stops are {value} not {min,max}", () => {
    const cs = new ColorScale({ palette: "viridis", min: 0, max: 10, continuous: true });
    const vals = cs.getValues();
    assert.ok(vals.length >= 2);
    assert.ok(vals.every(Number.isFinite), `every breakpoint must be a number, got ${JSON.stringify(vals)}`);
    assert.equal(vals[0], 0, "first breakpoint is the domain min");
    assert.equal(vals[vals.length - 1], 10, "last is the domain max");
  });

  test("…and still works for a banded scale, whose stops are {min,max}", () => {
    const vals = new ColorScale({ palette: "viridis", min: 0, max: 10, continuous: false }).getValues();
    assert.ok(vals.every(Number.isFinite));
    assert.equal(vals[0], 0);
    assert.equal(vals[vals.length - 1], 10);
  });
});
