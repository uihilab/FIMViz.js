// ui/readModels.js — thin renderers over the Legend/Stats read-models (PACKAGE_ROADMAP.md §5).
//
// Legends and stats are DATA first (Legend.toJSON()/Stats.toJSON()); these helpers return the data,
// or an HTML string when `{ html: true }`. Ensemble/comparison "legends" are just a Legend the layer
// exposes — no binder. Pure (no DOM), so node-testable. Headless rule holds trivially.

const fmtNum = (v) => (typeof v === "number" && Number.isFinite(v) ? (Number.isInteger(v) ? v : v.toFixed(3)) : String(v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * A Legend as data (default) or an HTML swatch list (`{ html: true }`, via Legend.toHtml() when
 * present, else a built-in fallback).
 * @param {import('../package/legend.js').Legend|null} legend
 * @param {{ html?: boolean }} [opts]
 * @returns {Object|string|null}
 */
export function renderLegend(legend, { html = false } = {}) {
  if (!legend) return html ? "" : null;
  if (!html) return typeof legend.toJSON === "function" ? legend.toJSON() : legend;
  if (typeof legend.toHtml === "function") return legend.toHtml();
  const stops = legend.stops || [];
  const items = stops.map((s) => {
    const label = s.label ?? (s.value != null ? s.value : `${s.range?.min}–${s.range?.max}`);
    return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">` +
      `<span style="width:14px;height:14px;border-radius:2px;background:${esc(s.color)};display:inline-block"></span>` +
      `<span>${esc(label)}</span></div>`;
  }).join("");
  return `<div class="fim-legend">${items}</div>`;
}

/**
 * A Stats as data (default) or an HTML table of its scalar fields (`{ html: true }`).
 * @param {import('../package/stats.js').Stats|null} stats
 * @param {{ html?: boolean }} [opts]
 * @returns {Object|string|null}
 */
export function renderStats(stats, { html = false } = {}) {
  if (!stats) return html ? "" : null;
  const data = typeof stats.toJSON === "function" ? stats.toJSON() : stats;
  if (!html) return data;
  const rows = Object.entries(data)
    .filter(([, v]) => v == null || typeof v !== "object")
    .map(([k, v]) => `<tr><td style="color:#888;padding-right:10px">${esc(k)}</td><td>${esc(fmtNum(v))}</td></tr>`)
    .join("");
  return `<table class="fim-stats" style="border-collapse:collapse;font:12px ui-monospace,Menlo,monospace">${rows}</table>`;
}
