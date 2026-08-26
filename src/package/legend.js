// legend.js — the read-model twin of a ColorScale, for display (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
//
// A Legend is data first: { unit, kind, source, stops[] } plus the formatLabel and formatValue
// hooks a host can set. `toHtml()` is a default renderer. A host wanting its own markup reads
// `toJSON()`, which carries everything, and renders from that.

/**
 * @typedef {Object} LegendStop
 * @property {number} [value]
 * @property {number} [min]
 * @property {number} [max]
 * @property {string} color
 * @property {string} [label]
 */

export class Legend {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.unit]
   * @param {'classed'|'continuous'} [opts.kind]
   * @param {'gdal'|'palette'|'default'|'custom'} [opts.source]
   * @param {LegendStop[]} [opts.stops]
   */
  constructor({ unit = "", kind = "classed", source = "palette", stops = [] } = {}) {
    this.unit = unit;
    this.kind = kind;            // 'classed' | 'continuous'
    this.source = source;        // 'gdal' | 'palette' | 'default' | 'custom'
    this.stops = stops;          // [{ value?|min?/max?, color, label }]
    /** @type {((stop: LegendStop) => string)|null} host hook for the whole row label */
    this.formatLabel = null;
    /** @type {(value: number|string) => string} */
    this.formatValue = (v) => (typeof v === "number" ? v.toFixed(2) : `${v}`);
  }

  /**
   * @param {import('./colorScale.js').ColorScale} cs
   * @param {Object} [opts]
   * @param {string} [opts.source]
   * @returns {Legend}
   */
  static fromColorScale(cs, { source } = {}) {
    return new Legend({
      unit: cs.unit,
      kind: cs.kind,
      source: source || cs.source,
      stops: cs.getStops(),
    });
  }

  /**
   * Builds one stop's row label. `formatLabel` takes precedence. A gdal or custom legend shows the
   * label it already carries, while a palette or default legend builds a "lo–hi unit" label.
   * @internal @param {LegendStop} stop @returns {string}
   */
  _label(stop) {
    if (this.formatLabel) return this.formatLabel(stop);
    const auto = this.source === "palette" || this.source === "default";
    if (!auto && stop.label != null) return stop.label;
    const sfx = this.unit ? ` ${this.unit}` : "";
    if ("value" in stop) return `${this.formatValue(stop.value)}${sfx}`;
    const hi = stop.max != null && isFinite(stop.max) ? `–${this.formatValue(stop.max)}` : "+";
    return `${this.formatValue(stop.min)}${hi}${sfx}`;
  }

  /**
   * Renders the legend as HTML: a gradient bar with min and max when continuous, colored rows
   * when classed.
   * @returns {string}
   */
  toHtml() {
    if (!this.stops.length) return "";
    const sfx = this.unit ? ` ${this.unit}` : "";

    if (this.kind === "continuous") {
      const colors = this.stops.map((s) => s.color);
      const n = colors.length;
      const vals = this.stops.map((s) => (s.value != null ? s.value : s.min));
      const max = vals[vals.length - 1], min = vals[0];
      const grad = `linear-gradient(to top, ${colors.join(",")})`;
      return `<div style="display:flex;align-items:stretch;gap:6px;margin:4px 0">
      <div style="width:15px;height:${n * 12}px;background:${grad};flex-shrink:0;border:1px solid #ccc;"></div>
      <div style="display:flex;flex-direction:column;justify-content:space-between;font-size:0.85em">
        <span>${this.formatValue(max)}${sfx}</span>
        <span>${this.formatValue(min)}${sfx}</span>
      </div></div>`;
    }

    return this.stops.map((s) => `<div style="display:flex;align-items:center;gap:5px;margin:2px 0">
      <span style="background-color:${s.color};width:15px;height:15px;flex-shrink:0;display:inline-block;border:1px solid #ccc;"></span>
      <span style="font-size:0.85em">${this._label(s)}</span></div>`).join("");
  }

  /** @returns {{unit: string, kind: string, source: string, stops: LegendStop[]}} */
  toJSON() {
    const { unit, kind, source, stops } = this;
    return { unit, kind, source, stops };
  }
}
