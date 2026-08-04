// colorScale.js — the mutable value→(color,label) engine (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
//
// Unifies the TWO coloring paths that exist in the code today (see docs/CLASS_DIAGRAM.md
// "ColorScale's two modes"):
//   • palette-scale : { palette, min, max, continuous }  → color computed per value
//                     (from ui/rasterTools.js PALETTES + getRgbForValue / interpolateColors)
//   • explicit-stops: [{ value|range, color, label }]     → color looked up in stored stops
//                     (from layers/depthMap.js parseLegendAndUnit / buildDefaultDepthLegend)
//
// `Legend` (legend.js) is the read-model derived from this; `Stats.byClass` buckets against it.
// `onChange` is the repaint seam: `RasterLayer` subscribes to it and re-colorizes in place.

// Built-in palette table. Host code can add its own via registerPalette() — the same open
// -registration pattern as registerLayerType, so a consumer is not limited to this lab's eight.
// (ui/rasterTools.js iterates PALETTES to build the picker; it stays an object for that.)
export const PALETTES = {
  blues:     { name: "Blue Scale",  colors: ["#EFF7FB","#C6DBEF","#9ECAE1","#6BAED6","#3182BD","#08519C","#08306B"] },
  grayscale: { name: "Grayscale",   colors: ["#F7F7F7","#D9D9D9","#BDBDBD","#969696","#636363","#252525"] },
  rainbow:   { name: "Rainbow",     colors: ["#9400D3","#4B0082","#0000FF","#00FF00","#FFFF00","#FF7F00","#FF0000"] },
  heat:      { name: "Heat",        colors: ["#FFFFCC","#FED976","#FD8D3C","#FC4E2A","#E31A1C","#BD0026","#800026"] },
  viridis:   { name: "Viridis",     colors: ["#440154","#3B528B","#21908C","#27AD81","#5DC863","#AADC32","#FDE725"] },
  terrain:   { name: "Terrain",     colors: ["#006837","#78C679","#C2E699","#FFFFCC","#FEB24C","#F16913","#7F2704"] },
  reds:      { name: "Reds",        colors: ["#FFF5F0","#FCBBA1","#FB6A4A","#EF3B2C","#CB181D","#99000D"] },
  plasma:    { name: "Plasma",      colors: ["#0D0887","#7E03A8","#CC4778","#F89540","#FDE725"] },
};

// Host-registered palettes live here, keyed by name (kept out of PALETTES so the built-in table
// stays immutable and the picker can distinguish built-in vs custom if it wants to).
const _custom = new Map();

/**
 * Register a custom palette so a name string resolves to it. colors: >=2 hex strings.
 * @param {string} name
 * @param {string[]} colors
 * @returns {void}
 */
export function registerPalette(name, colors) {
  if (!name || typeof name !== "string") throw new Error("registerPalette: a name string is required");
  if (!Array.isArray(colors) || colors.length < 2) {
    throw new Error(`registerPalette("${name}"): need an array of >=2 hex colors`);
  }
  _custom.set(name, colors.slice());
}

/**
 * True if `name` resolves to a built-in or registered palette.
 * @param {string} name
 * @returns {boolean}
 */
export function hasPalette(name) {
  return Object.prototype.hasOwnProperty.call(PALETTES, name) || _custom.has(name);
}

/**
 * All known palette names (built-in + registered).
 * @returns {string[]}
 */
export function paletteNames() {
  return [...Object.keys(PALETTES), ..._custom.keys()];
}

/**
 * @param {string} hex
 * @returns {[number,number,number]}
 */
export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

function lerpRgb(c1, c2, frac) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * frac),
    Math.round(c1[1] + (c2[1] - c1[1]) * frac),
    Math.round(c1[2] + (c2[2] - c1[2]) * frac),
  ];
}

function interpolateColors(colors, t) {
  const n = colors.length - 1;
  const scaled = Math.max(0, Math.min(n, t * n));
  const idx = Math.min(Math.floor(scaled), n - 1);
  const frac = scaled - idx;
  return lerpRgb(hexToRgb(colors[idx]), hexToRgb(colors[idx + 1]), frac);
}

// Shared by setColorStops' _colorStopValues AND continuous, value-keyed _stops (a materialized
// continuous scale — see _scaleRgb): find the bracketing pair of arbitrarily-spaced control points
// and either interpolate between them (continuousMode) or snap to the nearer one. Values outside the
// outermost control points clamp to that end's color — no extrapolation.
function bracketRgb(vals, cols, value, continuousMode) {
  const n = vals.length - 1;
  if (value <= vals[0]) return hexToRgb(cols[0]);
  if (value >= vals[n]) return hexToRgb(cols[n]);
  let i = 0;
  while (i < n && value > vals[i + 1]) i++;
  if (!continuousMode) {
    const mid = (vals[i] + vals[i + 1]) / 2;
    return hexToRgb(value < mid ? cols[i] : cols[i + 1]);
  }
  const span = vals[i + 1] - vals[i];
  const frac = span > 0 ? (value - vals[i]) / span : 0;
  return lerpRgb(hexToRgb(cols[i]), hexToRgb(cols[i + 1]), frac);
}

// Resolve a palette (name or custom color array) to its colors. THROWS on an unknown name rather
// than falling back to a default, which would render the wrong colors with no signal.
// Safe on the render hot path because set({palette})/the constructor validate the name up front, so
// this is only ever reached with a value that resolves.
function paletteColors(palette) {
  if (Array.isArray(palette)) return palette;          // custom color array
  if (PALETTES[palette]) return PALETTES[palette].colors;
  if (_custom.has(palette)) return _custom.get(palette);
  throw new Error(
    `ColorScale: unknown palette "${palette}". Available: ${paletteNames().join(", ")}. ` +
    `Register a custom palette with registerPalette(name, colors).`);
}

// Validate a palette value at set time (name must be known; an array is always allowed).
function assertPalette(palette) {
  if (Array.isArray(palette)) return palette;
  if (typeof palette === "string" && hasPalette(palette)) return palette;
  throw new Error(
    `ColorScale: unknown palette "${palette}". Available: ${paletteNames().join(", ")}. ` +
    `Register a custom palette with registerPalette(name, colors), or pass a color array.`);
}

const rgbCss = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

// Normalize a stored stop to { value?, min?, max?, color, label }. GDAL legends use either
// { value, color, label } (discrete) or { range:[lo,hi], color, label } (classed).
function normalizeStop(s) {
  const out = { color: s.color, label: s.label };
  if ("value" in s) out.value = s.value;
  else if (Array.isArray(s.range)) { out.min = s.range[0]; out.max = s.range[1]; }
  else { if ("min" in s) out.min = s.min; if ("max" in s) out.max = s.max; }
  return out;
}

/**
 * @typedef {Object} ColorStop
 * @property {number} [value] - discrete mode: the exact value this stop matches
 * @property {number} [min] - classed mode: band lower bound
 * @property {number} [max] - classed mode: band upper bound
 * @property {string} color - hex or css color
 * @property {string} [label]
 */

export class ColorScale {
  /**
   * @param {Object} [opts]
   * @param {string|string[]} [opts.palette] - a `PALETTES`/registered name, or a custom array of >=2 hex colors
   * @param {number} [opts.min]
   * @param {number} [opts.max]
   * @param {boolean} [opts.continuous]
   * @param {Array<{value?: number, range?: [number,number], min?: number, max?: number, color: string, label?: string}>|null} [opts.stops] - explicit stops; presence switches to explicit mode
   * @param {string} [opts.unit]
   * @param {'palette'|'custom'|'gdal'|null} [opts.source]
   */
  constructor({ palette = "blues", min = 0, max = 1, continuous = false,
                stops = null, unit = "", source = null } = {}) {
    this.palette = assertPalette(palette);   // PALETTES key or a custom color array (validated)
    this._min = min;
    this._max = max;
    this._continuous = continuous;
    this.unit = unit;
    this._stops = stops ? stops.map(normalizeStop) : null;   // null → palette mode
    this.source = source || (this._stops ? "custom" : "palette");
    // Continuous gradient control points (setColorStops) — a THIRD mode, distinct from both palette
    // (evenly-spaced ramp) and _stops (discrete, flat bands): arbitrary breakpoint values, each with
    // its own color, interpolated between the nearest bracketing pair. Mutually exclusive with the
    // other two — setPalette/setStops/setColorStops each clear the others.
    this._colorStopValues = null;
    this._colorStopColors = null;
    /** @type {((value: number) => (string|null))|null} null → fall back to the scale */
    this.colorFor = null;
    this._listeners = [];
  }

  /**
   * @param {Array<{value?: number, range?: [number,number], color: string, label?: string}>} legend
   * @param {string} [unit]
   * @returns {ColorScale}
   */
  static fromGdalLegend(legend, unit = "") {
    return new ColorScale({ stops: legend, unit, source: "gdal" });
  }

  // ---- GDAL legend XML parser (host-registered) ----
  //
  // fromGdalLegend (above) takes an ALREADY-PARSED legend array; turning a raw GDAL_METADATA XML
  // string into one needs DOMParser (browser-only) and currently lives in layers/depthMap.js
  // (parseLegendAndUnit) — which already imports RasterLayer FROM this file, so this file importing
  // it back would be a circular import. Same registered-seam inversion as registerReprojector/
  // registerMaterializer: this module names the mechanism, layers/depthMap.js supplies the impl by
  // calling registerGdalLegendParser(parseLegendAndUnit) on import.

  /** @type {((xmlStr: string) => {legend: Array|null, unit: string|null})|null} */
  static #gdalLegendParser = null;

  /**
   * Register the GDAL_METADATA XML parser used to auto-detect an embedded legend. Called by
   * layers/depthMap.js on import.
   * @param {(xmlStr: string) => {legend: Array|null, unit: string|null}} fn
   * @returns {void}
   */
  static registerGdalLegendParser(fn) {
    if (fn != null && typeof fn !== "function") throw new Error("registerGdalLegendParser: fn must be a function");
    ColorScale.#gdalLegendParser = fn;
  }

  /** The registered GDAL legend parser, or null if nothing has registered one yet. @returns {Function|null} */
  static getGdalLegendParser() { return ColorScale.#gdalLegendParser; }

  /** @returns {'continuous'|'classed'} */
  get kind() {
    if (this._stops) return "classed";
    return this._continuous ? "continuous" : "classed";
  }

  /**
   * A plain, structured-cloneable description of this scale — enough to rebuild an equivalent one
   * with `new ColorScale(spec)`. It captures whichever of the three modes is active.
   *
   * This is a COPY, not a handle: rebuilding from it gives an independent scale, so two layers
   * built from one spec can diverge. `colorFor` (a function) and `onChange` listeners are
   * deliberately not included — neither survives serialization.
   * @returns {{palette: string|string[], min: number, max: number, continuous: boolean, unit: string,
   *            source: string|null, stops: Array|null, colorStops: {values: number[], colors: string[]}|null}}
   */
  toJSON() {
    return {
      palette: Array.isArray(this.palette) ? [...this.palette] : this.palette,
      min: this._min, max: this._max, continuous: this._continuous,
      unit: this.unit, source: this.source,
      stops: this._stops ? this._stops.map((s) => ({ ...s })) : null,
      colorStops: this._colorStopValues
        ? { values: [...this._colorStopValues], colors: [...this._colorStopColors] }
        : null,
    };
  }

  /**
   * Rebuild a scale from `toJSON()` output. Restores the continuous-control-point mode too, which
   * the constructor alone cannot express.
   * @param {Object} spec @returns {ColorScale}
   */
  static fromJSON(spec = {}) {
    const cs = new ColorScale(spec);
    if (spec.colorStops?.values) cs.setColorStops(spec.colorStops.values, spec.colorStops.colors);
    if (typeof spec.continuous === "boolean") cs._continuous = spec.continuous;
    return cs;
  }

  /** @returns {boolean} */
  get isExplicit() { return !!this._stops; }
  /** @returns {boolean} */
  get discrete() { return !!(this._stops && this._stops.length && "value" in this._stops[0]); }
  /**
   * Is interpolation on? A read-only flag — write it with `set({ continuous })`.
   * @returns {boolean}
   */
  get continuous() { return this._continuous; }

  // ---- read ----

  /**
   * [{ min?, max?, value?, color, label }] — explicit→stored | palette→derived | colorStops→one
   * `{ value, color }` per control point (setColorStops).
   * @returns {ColorStop[]}
   */
  getStops() {
    if (this._colorStopValues) {
      return this._colorStopValues.map((v, i) => ({ value: v, color: this._colorStopColors[i] }));
    }
    if (this._stops) return this._stops.map((s) => ({ ...s }));
    const colors = paletteColors(this.palette);
    const n = colors.length;
    const min = this._min, max = this._max;
    if (this._continuous) {
      // sample the ramp at each colour's position
      return colors.map((c, i) => {
        const v = n > 1 ? min + (i / (n - 1)) * (max - min) : min;
        return { value: v, color: c, label: `${v.toFixed(2)}` };
      });
    }
    const step = n > 1 ? (max - min) / n : 0;
    return colors.map((c, i) => {
      const lo = min + i * step, hi = min + (i + 1) * step;
      return { min: lo, max: hi, color: c, label: `${lo.toFixed(2)}–${hi.toFixed(2)}` };
    });
  }

  /** @returns {number[]} */
  getValues() {
    if (this._colorStopValues) return [...this._colorStopValues];
    const stops = this.getStops();
    if (this.discrete) return stops.map((s) => s.value);
    const vals = stops.map((s) => s.min);
    const last = stops[stops.length - 1];
    if (last && last.max != null && isFinite(last.max)) vals.push(last.max);
    return vals;
  }

  /**
   * @param {number} i - band index (as returned by `getStops()`)
   * @returns {{min: number|undefined, max: number|undefined}|null}
   */
  getRange(i) {
    const s = this.getStops()[i];
    return s ? { min: s.min, max: s.max } : null;
  }

  /**
   * Resolve any value → css color string (colorFor override wins; null if nothing matches).
   * @param {number} value
   * @returns {string|null}
   */
  getColor(value) {
    if (this.colorFor) {
      const c = this.colorFor(value);
      if (c != null) return c;
    }
    const rgb = this._scaleRgb(value);
    return rgb ? rgbCss(rgb) : null;
  }

  /**
   * Hot-path [r,g,b] for the render loop; null → pixel is transparent (no matching stop).
   * @param {number} value
   * @returns {[number,number,number]|null}
   */
  getRgb(value) {
    if (this.colorFor) {
      const c = this.colorFor(value);
      if (typeof c === "string" && c[0] === "#") return hexToRgb(c);
    }
    return this._scaleRgb(value);
  }

  /** @internal @param {number} value @returns {[number,number,number]|null} */
  _scaleRgb(value) {
    if (this._colorStopValues) {
      return bracketRgb(this._colorStopValues, this._colorStopColors, value, this._continuous);
    }
    if (this._stops) {
      // Value-keyed stops under continuous:true are control points, not an exact-match lookup — same
      // shape as _colorStopValues (this is exactly what a materialized continuous scale produces, via
      // setColor/setRange/setLabel on one band — see _materialize). Without this branch, virtually no
      // real pixel value ever equals one of a handful of sparse breakpoints exactly, so the whole
      // layer would render fully transparent the moment any single band got edited.
      if (this.discrete && this._continuous) {
        return bracketRgb(this._stops.map((s) => s.value), this._stops.map((s) => s.color), value, true);
      }
      const last = this._stops.length - 1;
      const entry = this.discrete
        ? this._stops.find((s) => s.value === value)
        : this._stops.find((s, idx) =>
            idx < last ? value >= s.min && value < s.max : value >= s.min);
      return entry ? hexToRgb(entry.color) : null;
    }
    const colors = paletteColors(this.palette);
    const min = this._min, max = this._max;
    const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
    if (this._continuous) return interpolateColors(colors, t);
    const band = Math.min(Math.floor(t * colors.length), colors.length - 1);
    return hexToRgb(colors[band]);
  }

  // ---- write (chainable; each fires onChange) ----

  /**
   * THE knob writer. One mutation idiom for every whole-object knob:
   *
   *   cs.set({ palette: 'viridis', min: 0, max: 46, continuous: true, unit: 'm' });
   *
   * Sync and chainable (returns `this`) — a ColorScale is a pure value type, so nothing here awaits.
   * Fires `onChange` ONCE for the whole batch, not once per key, so a repaint hook wired via
   * `onChange` doesn't redraw N times for one logical edit.
   *
   * Recognised keys: `palette`, `min`, `max`, `continuous`, `unit`, `stops`, `colorStops`
   * (`{values, colors}`). `stops`/`colorStops` are MODE switches and remain available as the explicit
   * `setStops()`/`setColorStops()` methods too; the INDEX-addressed ops (`setColor(i,·)`,
   * `setRange(i,·)`, `setLabel(i,·)`) are not knobs and stay as their own verbs.
   *
   * An unknown key throws, naming the recognised set, rather than being silently ignored.
   * @param {{palette?: string|string[], min?: number, max?: number, continuous?: boolean, unit?: string,
   *          stops?: Array<Object>, colorStops?: {values: number[], colors: string[]}}} [patch]
   * @returns {ColorScale}
   */
  set(patch = {}) {
    const KNOWN = ["palette", "min", "max", "continuous", "unit", "stops", "colorStops"];
    const unknown = Object.keys(patch).filter((k) => !KNOWN.includes(k));
    if (unknown.length) {
      throw new Error(
        `ColorScale.set: unknown key(s) ${unknown.map((k) => `"${k}"`).join(", ")}. ` +
        `Recognised: ${KNOWN.join(", ")}. Per-band edits use setColor(i, c) / setRange(i, r) / setLabel(i, s).`);
    }
    // Silence the per-key onChange so the whole batch fires exactly one notification at the end.
    const listeners = this._listeners;
    this._listeners = [];
    try {
      if ("palette" in patch) this._setPalette(patch.palette);
      if ("stops" in patch) this.setStops(patch.stops);
      if ("colorStops" in patch) this.setColorStops(patch.colorStops?.values, patch.colorStops?.colors);
      if ("continuous" in patch) this._continuous = !!patch.continuous;
      if ("min" in patch || "max" in patch) {
        this._setDomain("min" in patch ? patch.min : this._min, "max" in patch ? patch.max : this._max);
      }
      if ("unit" in patch) this.unit = patch.unit;
    } finally {
      this._listeners = listeners;
    }
    return Object.keys(patch).length ? this._changed() : this;
  }

  /**
   * @internal — use `set({ palette })`. Kept as the implementation `set()` routes to (and because it
   * carries the palette-name validation).
   * @param {string|string[]} nameOrColors
   * @returns {ColorScale}
   */
  _setPalette(nameOrColors) {
    this.palette = assertPalette(nameOrColors);
    this._stops = null;                 // back to palette mode
    this._colorStopValues = null; this._colorStopColors = null;
    if (this.source !== "gdal") this.source = "palette";
    return this._changed();
  }

  /**
   * @param {Array<{value?: number, range?: [number,number], min?: number, max?: number, color: string, label?: string}>} stops
   * @returns {ColorScale}
   */
  setStops(stops) {
    this._stops = (stops || []).map(normalizeStop);
    this._colorStopValues = null; this._colorStopColors = null;
    this.source = "custom";
    return this._changed();
  }

  /**
   * Define a CONTINUOUS color gradient via explicit control points — arbitrary breakpoint VALUES
   * (need not be evenly spaced, or even given in order — sorted internally), each paired with its own
   * color. Distinct from setStops(): that's discrete, flat bands (one solid color per range/value, no
   * interpolation); this interpolates smoothly between the nearest bracketing pair when
   * set({continuous:true}) is set (the intended pairing) —
   *   setColorStops([-1, 0, 1], ['#015498', '#ffffff', '#21bf90']).set({ continuous: true })
   * gives a diverging blue→white→green gradient skewed however the control points are spaced, not an
   * even 3-way split of some [min,max]. Values outside the outermost control point clamp to that end's
   * color (no extrapolation). With continuous false, a value takes the NEAREST control point's color
   * instead of interpolating — flat, but not "banded" in the setStops() sense, since these are point
   * positions, not ranges.
   *
   * set({min,max})'s domain keeps governing peripheral things (a legend axis label, a stats-classification
   * range) but the actual color mapping is driven entirely by these control points, not by min/max —
   * the two are complementary, not conflicting: set both if you want a labeled axis range that differs
   * from where the color control points themselves sit.
   * @param {number[]} values - breakpoint values; >= 2 required
   * @param {string[]} colors - one "#rrggbb" hex color per value, same length as `values`
   * @returns {ColorScale}
   */
  setColorStops(values, colors) {
    if (!Array.isArray(values) || !Array.isArray(colors) || values.length !== colors.length || values.length < 2) {
      throw new Error("ColorScale.setColorStops: values and colors must be same-length arrays of 2 or more entries.");
    }
    const bad = colors.find((c) => typeof c !== "string" || !/^#[0-9a-f]{6}$/i.test(c));
    if (bad !== undefined) {
      throw new Error(`ColorScale.setColorStops: "${bad}" is not a hex color — only "#rrggbb" is supported (CSS names like "blue" are not).`);
    }
    const pairs = values.map((v, i) => ({ v, c: colors[i] })).sort((a, b) => a.v - b.v);
    this._colorStopValues = pairs.map((p) => p.v);
    this._colorStopColors = pairs.map((p) => p.c);
    this._stops = null;   // continuous-gradient mode, not classed/discrete setStops() mode
    if (this.source !== "gdal") this.source = "custom";
    return this._changed();
  }

  /**
   * @internal — use `set({ min, max })`.
   * @param {number} min @param {number} max
   * @returns {ColorScale}
   */
  _setDomain(min, max) {
    this._min = min; this._max = max;
    return this._changed();
  }

  /**
   * Per-band edits materialize the palette into explicit stops, then mutate → marks it 'custom'.
   * @internal @returns {ColorStop[]}
   */
  _materialize() {
    if (!this._stops) {
      this._stops = this.getStops();   // captures whichever mode was active (palette OR colorStops)
      this._colorStopValues = null; this._colorStopColors = null;   // mutually exclusive with _stops
      this.source = "custom";
    }
    return this._stops;
  }

  /**
   * @param {number} i - band index
   * @param {{min?: number, max?: number}} range
   * @returns {ColorScale}
   */
  setRange(i, { min, max }) {
    const s = this._materialize()[i];
    if (s) { if (min != null) s.min = min; if (max != null) s.max = max; delete s.value; }
    this.source = "custom";
    return this._changed();
  }

  /**
   * @param {number} i - band index
   * @param {string} color
   * @returns {ColorScale}
   */
  setColor(i, color) {
    const s = this._materialize()[i];
    if (s) s.color = color;
    this.source = "custom";
    return this._changed();
  }

  /**
   * @param {number} i - band index
   * @param {string} label
   * @returns {ColorScale}
   */
  setLabel(i, label) {
    const s = this._materialize()[i];
    if (s) s.label = label;
    this.source = "custom";
    return this._changed();
  }

  // ---- notify ----

  /**
   * @param {(scale: ColorScale) => void} fn
   * @returns {ColorScale}
   */
  onChange(fn) { if (typeof fn === "function") this._listeners.push(fn); return this; }
  /**
   * @param {(scale: ColorScale) => void} fn
   * @returns {ColorScale}
   */
  offChange(fn) { this._listeners = this._listeners.filter((f) => f !== fn); return this; }
  /** Notify every `onChange` listener. Called by each setter after it mutates state. @internal @returns {ColorScale} */
  _changed() { for (const fn of this._listeners) fn(this); return this; }
}
