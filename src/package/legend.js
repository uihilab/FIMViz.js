// legend.js — the read-model twin of a ColorScale, for display (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
//
// A Legend is data first: { unit, kind, source, stops[] } + formatLabel/formatValue host hooks.
// `toHtml()` is a faithful default renderer; a host that wants its own markup reads `toJSON()`
// (which is data-complete) and renders from that instead.

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
   * Resolve one stop's row label: `formatLabel` wins if set; gdal/custom legends show their own
   * stored label as-is; palette/default legends auto-build a "lo–hi unit" label.
   * @internal @param {LegendStop} stop @returns {string}
   */
  _label(stop) {
    if (this.formatLabel) return this.formatLabel(stop);
    // gdal/custom legends carry their own labels (show as-is); palette/default auto-build a
    // "lo–hi unit" label. Mirrors the old buildOriginalLegendHtml vs buildPaletteLegendHtml split.
    const auto = this.source === "palette" || this.source === "default";
    if (!auto && stop.label != null) return stop.label;
    const sfx = this.unit ? ` ${this.unit}` : "";
    if ("value" in stop) return `${this.formatValue(stop.value)}${sfx}`;
    const hi = stop.max != null && isFinite(stop.max) ? `–${this.formatValue(stop.max)}` : "+";
    return `${this.formatValue(stop.min)}${hi}${sfx}`;
  }

  /**
   * HTML for the legend. Continuous → a gradient bar with min/max; classed → coloured rows.
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
