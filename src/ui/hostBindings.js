// ui/hostBindings.js — views over the engine→host event bus (PACKAGE_ROADMAP.md §5).
//
// The engine's only outbound channels are the host bus and `console`; it never reaches for UI. Most
// of that bus already had a consumer (`notify`/`error` → toast, `layers:changed` → layer panel).
// These cover the rest of it that a LIBRARY can sensibly draw:
//
//   busy                     → createBusyIndicator
//   raster:metadata          → bindRasterMetadata
//   raster:metadata-hidden   ↲
//   layer:raster-oversized   → connectToast (see toast.js) — a real user-facing problem that
//   layer:crs-unrenderable   ↲  otherwise only reached console.warn
//
// `storage:changed` and `upload:complete` deliberately get NO widget. Both mean "a host list you own
// is now stale" / "dismiss the affordance you showed", and neither the list nor the affordance is
// ours — inventing one would be the same app-opinionated mistake the unified Layer Panel was kept out
// of the package to avoid. They are ordinary events: `fim.on('storage:changed', …)`.
//
// Headless rule: DOM only inside functions; no `window.foo()`.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const BUSY_CSS = `
.fim-busy{display:none;align-items:center;gap:8px;font:12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#8b949e}
.fim-busy[data-active]{display:flex}
.fim-busy .fim-busy-dot{width:11px;height:11px;border:2px solid #58a6ff;border-right-color:transparent;border-radius:50%;animation:fim-busy-spin .7s linear infinite}
@keyframes fim-busy-spin{to{transform:rotate(360deg)}}
`;

const META_CSS = `
.fim-meta{display:none;font:12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e6edf3}
.fim-meta[data-shown]{display:block}
.fim-meta h4{margin:0 0 5px;font-size:12px;color:#e6edf3}
.fim-meta table{border-collapse:collapse;width:100%}
.fim-meta td{padding:1px 0;vertical-align:top}
.fim-meta td.k{color:#8b949e;padding-right:10px;white-space:nowrap}
.fim-meta td.num{font-family:ui-monospace,Menlo,monospace}
`;

function injectStyles(doc, id, css) {
  if (doc.getElementById(id)) return;
  const s = doc.createElement("style");
  s.id = id; s.textContent = css;
  (doc.head || doc.body || doc.documentElement).appendChild(s);
}

function mount(root, className, dataName) {
  const doc = root?.ownerDocument || (typeof document === "undefined" ? null : document);
  if (!doc) throw new Error(`${dataName}: no document — mount this in a browser`);
  const el = doc.createElement("div");
  el.className = className;
  el.setAttribute("data-fim-ui", dataName);
  (root || doc.body).appendChild(el);
  return { doc, el };
}

/**
 * A busy indicator driven by the engine's `busy` event.
 *
 * The event carries a `source` ('depth' | 'ensemble' | a parse | …) precisely because work overlaps,
 * so this REF-COUNTS by source rather than tracking one boolean: two jobs starting and one finishing
 * must leave the indicator up. A single `active:false` from a source that never announced itself is
 * ignored rather than clearing everything — otherwise one stray event hides an indicator that three
 * real jobs are still relying on.
 *
 * @param {import('../package/fimMap.js').FimMap|{on: Function, off?: Function}} fim
 * @param {{ root?: Element, label?: string|((sources: string[]) => string), pretty?: boolean }} [opts]
 * @returns {{ el: Element, active: boolean, sources: string[], off: () => void, destroy: () => void }}
 */
export function createBusyIndicator(fim, { root, label = "Working…", pretty = true } = {}) {
  if (!fim?.on) throw new Error("createBusyIndicator: a FimMap (or anything with .on) is required");
  const { doc, el } = mount(root, "fim-busy" + (pretty ? " fim-pretty" : ""), "busy");
  if (pretty) injectStyles(doc, "fim-busy-css", BUSY_CSS);

  const dot = doc.createElement("span");
  dot.className = "fim-busy-dot";
  const text = doc.createElement("span");
  el.append(dot, text);

  /** @type {Map<string, number>} source → outstanding jobs */
  const counts = new Map();

  function paint() {
    const sources = [...counts.keys()];
    if (sources.length) {
      el.setAttribute("data-active", "");
      el.setAttribute("data-sources", sources.join(","));
      text.textContent = typeof label === "function" ? label(sources) : label;
    } else {
      el.removeAttribute("data-active");
      el.removeAttribute("data-sources");
    }
  }

  const onBusy = ({ active, source = "default" } = {}) => {
    const n = counts.get(source) || 0;
    if (active) counts.set(source, n + 1);
    else if (n <= 1) counts.delete(source);
    else counts.set(source, n - 1);
    paint();
  };
  fim.on("busy", onBusy);
  paint();

  return {
    el,
    get active() { return counts.size > 0; },
    get sources() { return [...counts.keys()]; },
    off: () => { fim.off?.("busy", onBusy); },
    destroy() { fim.off?.("busy", onBusy); el.remove(); },
  };
}

/**
 * A raster-metadata panel driven by the `raster:metadata` / `raster:metadata-hidden` pair.
 *
 * The engine computes the rows and emits them (`geo/tifMeta.js`) precisely so it never has to name a
 * panel; this is the panel. The payload carries two shapes — flat `rows` and `specRows` with a `num`
 * flag — and this renders `specRows` when present, since the flag is what makes numeric fields line
 * up in a monospace column.
 *
 * @param {import('../package/fimMap.js').FimMap|{on: Function, off?: Function}} fim
 * @param {{ root?: Element, render?: (payload: Object) => string, pretty?: boolean }} [opts]
 * @returns {{ el: Element, shown: boolean, payload: Object|null, off: () => void, destroy: () => void }}
 */
export function bindRasterMetadata(fim, { root, render, pretty = true } = {}) {
  if (!fim?.on) throw new Error("bindRasterMetadata: a FimMap (or anything with .on) is required");
  const { doc, el } = mount(root, "fim-meta" + (pretty ? " fim-pretty" : ""), "raster-metadata");
  if (pretty) injectStyles(doc, "fim-meta-css", META_CSS);

  let payload = null;

  const onShow = (p) => {
    payload = p || null;
    el.innerHTML = (render || renderRasterMetadata)(payload);
    el.setAttribute("data-shown", "");
  };
  // The engine says "no longer current" rather than "clear" — so the panel hides but keeps what it
  // had, and a host that wants the last-known values can still read `payload`.
  const onHide = () => { el.removeAttribute("data-shown"); };

  fim.on("raster:metadata", onShow);
  fim.on("raster:metadata-hidden", onHide);

  const off = () => {
    fim.off?.("raster:metadata", onShow);
    fim.off?.("raster:metadata-hidden", onHide);
  };
  return {
    el,
    get shown() { return el.hasAttribute("data-shown"); },
    get payload() { return payload; },
    off,
    destroy() { off(); el.remove(); },
  };
}

/**
 * PURE: a `raster:metadata` payload → an HTML table. Exported so a host can reuse the default
 * rendering inside its own chrome, or test it without a DOM.
 * @param {{name?: string, title?: string, rows?: Array, specRows?: Array}|null} payload
 * @returns {string}
 */
export function renderRasterMetadata(payload) {
  if (!payload) return "";
  const specRows = payload.specRows
    || (payload.rows || []).map(([k, v]) => ({ k, v }));
  const body = specRows
    .map(({ k, v, num }) => `<tr><td class="k">${esc(k)}</td><td${num ? ' class="num"' : ""}>${esc(v)}</td></tr>`)
    .join("");
  const heading = payload.name || payload.title;
  return (heading ? `<h4>${esc(heading)}</h4>` : "") + `<table>${body}</table>`;
}
