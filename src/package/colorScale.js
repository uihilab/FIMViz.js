// colorScale.js — maps a value to a color and a label (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
//
// Two coloring paths, described in docs/CLASS_DIAGRAM.md under "ColorScale's two modes":
//   • palette-scale : { palette, min, max, continuous } → color computed per value (ui/rasterTools.js)
//   • explicit-stops: [{ value|range, color, label }] → color looked up in stops (layers/depthMap.js)
//
// legend.js derives its read model from this. RasterLayer recolors on `onChange`.

// Built-in palettes. registerPalette() adds more, the same way registerLayerType() extends layers.
// Stays an object because ui/rasterTools.js iterates it to build the picker.
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

// Registered palettes, keyed by name. Held apart from PALETTES so the built-in table stays
// immutable and the picker can tell a custom palette from a built-in one.
const _custom = new Map();

/**
 * Register a palette so a name string resolves to it. `colors` needs at least 2 hex strings.
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
 * True for a value that isn't one: `null`, `undefined`, `''`, `NaN`, a non-numeric string or an
 * infinity. Runs before any arithmetic, because `Number(null)` and `Number('')` are both `0`, so an
 * absent value would otherwise paint as the domain minimum (docs/usage/COLOR_SCALE.md).
 * @param {*} v
 * @returns {boolean}
 */
function isAbsentValue(v) {
  return v == null || v === "" || !Number.isFinite(typeof v === "number" ? v : Number(v));
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

// Finds the pair of control points bracketing `value`, then interpolates between them when
// `continuousMode` is set or snaps to the nearer one. Points need not be evenly spaced; a value
// past the outermost one clamps to that end's color. Serves _colorStopValues and value-keyed
// _stops alike (see _scaleRgb).
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

// Resolves a palette name or color array to its colors. Throws on an unknown name instead of
// falling back to a default, which would render wrong colors with no signal. The constructor and
// set({ palette }) validate up front, so the render path only sees names that resolve.
function paletteColors(palette) {
  if (Array.isArray(palette)) return palette;          // custom color array
  if (PALETTES[palette]) return PALETTES[palette].colors;
  if (_custom.has(palette)) return _custom.get(palette);
  throw new Error(
    `ColorScale: unknown palette "${palette}". Available: ${paletteNames().join(", ")}. ` +
    `Register a custom palette with registerPalette(name, colors).`);
}

// Validates a palette at set time. A name must be known; an array is always allowed.
function assertPalette(palette) {
  if (Array.isArray(palette)) return palette;
  if (typeof palette === "string" && hasPalette(palette)) return palette;
  throw new Error(
    `ColorScale: unknown palette "${palette}". Available: ${paletteNames().join(", ")}. ` +
    `Register a custom palette with registerPalette(name, colors), or pass a color array.`);
}

const rgbCss = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

// Normalizes a stored stop to { value?, min?, max?, color, label }. GDAL legends arrive as either
// { value, color, label } for discrete stops or { range:[lo,hi], color, label } for classed ones.
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
   * @param {string|null} [opts.missingColor] - color for an absent value (`null`, `undefined`,
   *   `NaN` or `''`). Defaults to `null`, meaning no color: a vector feature keeps its base style
   *   and a raster pixel stays transparent. Set it to draw missing data as an explicit swatch.
   */
  constructor({ palette = "blues", min = 0, max = 1, continuous = false,
                stops = null, unit = "", source = null, missingColor = null } = {}) {
    // Not one of the three coloring modes, so switching palette, stops or colorStops leaves it
    // alone. It answers a question none of them cover: what color is a value that doesn't exist?
    this.missingColor = missingColor;
    this.palette = assertPalette(palette);   // PALETTES key or a custom color array (validated)
    this._min = min;
    this._max = max;
    this._continuous = continuous;
    this.unit = unit;
    this._stops = stops ? stops.map(normalizeStop) : null;   // null → palette mode
    this.source = source || (this._stops ? "custom" : "palette");
    // Control points for the third mode, written by setColorStops(): arbitrary breakpoint values,
    // each with its own color, interpolated between the bracketing pair. The other two modes are a
    // palette (an evenly-spaced ramp) and _stops (flat bands). Each of the three setters clears the
    // other two.
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

  // ---- palette registry, as statics on the type it serves -----------------------------------
  //
  // A palette only means something as a ColorScale's ramp, so the registry lives here rather than
  // as loose exports. palettes() replaces paletteNames() and hasPalette(), since `.includes(x)`
  // answers both.

  /**
   * Add a palette by name. `colors`: >= 2 hex strings.
   * @param {string} name
   * @param {string[]} colors
   * @returns {void}
   */
  static registerPalette(name, colors) { return registerPalette(name, colors); }

  /**
   * Every palette name `{ palette }` accepts, built-in and registered.
   * @returns {string[]}
   */
  static palettes() { return paletteNames(); }

  // ---- GDAL legend XML parser, registered by the host ----
  //
  // fromGdalLegend() above takes an already-parsed legend array. Parsing raw GDAL_METADATA XML
  // needs DOMParser, so it lives in layers/depthMap.js as parseLegendAndUnit, which already imports
  // RasterLayer from here. Importing it back would be circular, so that file calls
  // registerGdalLegendParser(parseLegendAndUnit) on import instead, as registerReprojector does.

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
   * A structured-cloneable description of this scale, enough to rebuild an equivalent one with
   * `new ColorScale(spec)`, capturing whichever of the three modes is active. The result is a copy,
   * so two layers rebuilt from one spec can diverge. It omits `colorFor` and the `onChange`
   * listeners because functions do not survive serialization.
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
   * Rebuilds a scale from `toJSON()` output, including the control-point mode that the constructor
   * alone cannot express.
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
   * True when interpolation is on. Read-only; write it with `set({ continuous })`.
   * @returns {boolean}
   */
  get continuous() { return this._continuous; }

  // ---- read ----

  /**
   * The stops as [{ min?, max?, value?, color, label }]. Explicit mode returns the stored stops,
   * palette mode derives them, and setColorStops() mode returns one `{ value, color }` per point.
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
      // sample the ramp at each color's position
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
    // Band stops carry {min,max} and continuous stops carry {value}, so read whichever is present.
    const vals = stops.map((s) => s.min ?? s.value);
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
   * Resolves a value to a CSS color string. `colorFor` takes precedence. An absent value returns
   * `missingColor`, and a value matching no stop returns null.
   * @param {number} value
   * @returns {string|null}
   */
  getColor(value) {
    if (this.colorFor) {
      const c = this.colorFor(value);
      if (c != null) return c;
    }
    // Returned verbatim rather than through hexToRgb, which parses only 6-digit hex and would turn
    // `#ccc` or `gray` into black. Any CSS color works here.
    if (isAbsentValue(value)) return this.missingColor || null;
    const rgb = this._scaleRgb(value);
    return rgb ? rgbCss(rgb) : null;
  }

  /**
   * Returns [r,g,b] for the render loop. Returns null when no stop matches, or when the value is
   * absent and no `missingColor` is set, and colorizeGrid leaves that pixel transparent.
   * @param {number} value
   * @returns {[number,number,number]|null}
   */
  getRgb(value) {
    if (this.colorFor) {
      const c = this.colorFor(value);
      if (typeof c === "string" && c[0] === "#") return hexToRgb(c);
    }
    if (isAbsentValue(value)) return this.missingColor ? hexToRgb(this.missingColor) : null;
    return this._scaleRgb(value);
  }

  /** @internal @param {number} value @returns {[number,number,number]|null} */
  _scaleRgb(value) {
    if (this._colorStopValues) {
      return bracketRgb(this._colorStopValues, this._colorStopColors, value, this._continuous);
    }
    if (this._stops) {
      // Under continuous:true, value-keyed stops are control points, not an exact-match table, and
      // _materialize() produces exactly that when one band is edited. Without this branch a pixel
      // value almost never equals a sparse breakpoint, so one band edit would blank the layer.
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
   * Writes any whole-object setting in one call:
   *
   *   cs.set({ palette: 'viridis', min: 0, max: 46, continuous: true, unit: 'm' });
   *
   * Synchronous and chainable. Fires `onChange` once for the whole batch, not once per key, so a
   * repaint listener redraws once for one logical edit.
   *
   * Recognised keys: `palette`, `min`, `max`, `continuous`, `unit`, `stops`, `colorStops`
   * (`{values, colors}`) and `missingColor`. `stops` and `colorStops` switch mode and are also
   * available as `setStops()` and `setColorStops()`. Per-band edits keep their own verbs:
   * `setColor(i, c)`, `setRange(i, r)`, `setLabel(i, s)`. An unknown key throws.
   * @param {{palette?: string|string[], min?: number, max?: number, continuous?: boolean, unit?: string,
   *          stops?: Array<Object>, colorStops?: {values: number[], colors: string[]}}} [patch]
   * @returns {ColorScale}
   */
  set(patch = {}) {
    const KNOWN = ["palette", "min", "max", "continuous", "unit", "stops", "colorStops", "missingColor"];
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
      if ("missingColor" in patch) this.missingColor = patch.missingColor || null;
    } finally {
      this._listeners = listeners;
    }
    return Object.keys(patch).length ? this._changed() : this;
  }

  /**
   * @internal Use `set({ palette })`. This stays as the implementation `set()` calls, and it holds
   * the palette-name validation.
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
   * Defines a continuous gradient from explicit control points, sorted on the way in and not
   * required to be evenly spaced. Pair it with `set({ continuous: true })` to interpolate between
   * the bracketing pair:
   *
   *   setColorStops([-1, 0, 1], ['#015498', '#ffffff', '#21bf90']).set({ continuous: true })
   *
   * gives a diverging blue-to-white-to-green gradient skewed by the point spacing, not an even
   * three-way split of [min, max]. A value past the outermost point clamps to that end's color.
   * With `continuous` false it takes the nearest point's color. setStops() differs: one flat
   * color per range, never interpolated.
   *
   * The control points drive the color mapping alone. `set({ min, max })` still governs the legend
   * axis label and the stats classification range, so set both when they should differ.
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
   * Converts the active mode into explicit stops so a per-band edit has something to mutate, and
   * marks the scale 'custom'.
   * @internal @returns {ColorStop[]}
   */
  _materialize() {
    if (!this._stops) {
      this._stops = this.getStops();   // captures whichever mode was active, palette or colorStops
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
