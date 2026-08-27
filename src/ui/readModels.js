// ui/readModels.js — the Legend/Stats read-models: pure renderers, and live bindings
// (PACKAGE_ROADMAP.md §5).
//
// Legends and stats are DATA first (Legend.toJSON()/Stats.toJSON()); `renderLegend`/`renderStats`
// return the data, or an HTML string when `{ html: true }`. Those two are PURE — no DOM, so they are
// node-testable and usable from anywhere.
//
// `bindLegend`/`bindStats` are the live half: they mount one of those renderers into an element and
// keep it current by subscribing to the layer's own effect events, so a host never has to remember to
// re-read after a repaint. DOM only inside functions, per the module rule.

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

// ── live bindings ───────────────────────────────────────────────────────────────────────────────
//
// The layer's effect events, and why exactly these three:
//   restyle    — the colour scale changed (palette, bands, min/max, opacity)
//   recomputed — the pixels changed (noData, an applied op)
//   rendered   — a draw completed, which is when a legend derived FROM the grid (a GDAL legend
//                detected mid-render) first exists at all
// `settings` is deliberately not among them: it fires for every knob including the ones that change
// neither, such as the hover toggle.
const MODEL_EVENTS = ["restyle", "recomputed", "rendered"];

/**
 * Shared machinery for the two binders below.
 *
 * Two things it exists to get right. **Coalescing:** one logical change can emit more than one of
 * MODEL_EVENTS (a settings write that redraws emits `recomputed` *and* `rendered`), so updates are
 * batched to one per microtask. **Ordering:** `getStats()` is async, and a fast sequence of edits can
 * resolve out of order — the token means a stale result is dropped rather than painted over a newer
 * one, which is the difference between a lagging panel and a wrong one.
 */
function bindReadModel(layer, { root, name, read, empty }) {
  if (!layer) throw new Error(`${name}: a layer is required`);
  // A selector string resolves here, matching the panel factories. See ui/hostBindings.js.
  if (typeof root === "string") {
    const found = typeof document === "undefined" ? null : document.querySelector(root);
    if (!found) throw new Error(`${name}: no element matches "${root}"`);
    root = found;
  }
  const doc = root?.ownerDocument || (typeof document === "undefined" ? null : document);
  if (!doc) throw new Error(`${name}: no document — this is the live half of the module, mount it in a browser`);

  const el = doc.createElement("div");
  el.setAttribute("data-fim-ui", name);
  root?.appendChild(el);

  let token = 0;
  let scheduled = false;
  let dead = false;

  async function paint() {
    scheduled = false;
    if (dead) return;
    const mine = ++token;
    let out;
    try { out = await read(); }
    catch (err) { console.error(`[fimviz] ${name} failed to read:`, err); out = null; }
    if (dead || mine !== token) return;                  // a newer update overtook this one
    if (out == null || out === "") { el.textContent = ""; if (empty) el.append(empty); return; }
    if (typeof out === "string") el.innerHTML = out;
    else { el.textContent = ""; el.append(String(out)); }
  }

  function schedule() {
    if (scheduled || dead) return;
    scheduled = true;
    queueMicrotask(paint);
  }

  const onEvent = () => schedule();
  for (const e of MODEL_EVENTS) layer.on?.(e, onEvent);
  // A removed layer's panel would otherwise sit there showing the last thing it saw, holding a
  // subscription to a layer that is gone.
  const onRemoved = () => { el.textContent = ""; if (empty) el.append(empty); off(); };
  layer.on?.("removed", onRemoved);

  function off() {
    if (dead) return;
    dead = true;
    for (const e of MODEL_EVENTS) layer.off?.(e, onEvent);
    layer.off?.("removed", onRemoved);
  }

  paint();
  return {
    el,
    /** Force a re-read — for state the layer cannot know about, such as a newly drawn region. */
    update: schedule,
    off,
    destroy() { off(); el.remove(); },
  };
}

/**
 * Mount a legend that keeps itself current.
 *
 * ```js
 * const legend = bindLegend(layer, { root: document.querySelector('#legend') });
 * layer.set({ palette: 'viridis' });     // the panel repaints itself
 * ```
 * @param {import('../package/layer.js').Layer} layer
 * @param {{ root?: Element|string, html?: boolean, render?: Function, empty?: string }} [opts]
 *   `render` overrides `renderLegend` — take the Legend, return an HTML string.
 * @returns {{ el: Element, update: () => void, off: () => void, destroy: () => void }}
 */
export function bindLegend(layer, { root, html = true, render = renderLegend, empty = "" } = {}) {
  return bindReadModel(layer, {
    root, name: "legend", empty,
    read: () => render(layer.getLegend?.() ?? null, { html }),
  });
}

/**
 * Mount a statistics table that keeps itself current.
 *
 * `filter` may be a value or a getter — a getter, because the usual filter is a drawn region that
 * changes independently of the layer. The layer emits nothing when a region is drawn, so call
 * `update()` after that; everything the LAYER can know about is already automatic.
 *
 * @param {import('../package/layer.js').Layer} layer
 * @param {{ root?: Element|string, html?: boolean, filter?: *|(() => *), render?: Function, empty?: string }} [opts]
 * @returns {{ el: Element, update: () => void, off: () => void, destroy: () => void }}
 */
export function bindStats(layer, { root, html = true, filter, render = renderStats, empty = "" } = {}) {
  return bindReadModel(layer, {
    root, name: "stats", empty,
    read: async () => {
      const f = typeof filter === "function" ? filter() : filter;
      const stats = await layer.getStats?.(f ? { filter: f } : {});
      return render(stats ?? null, { html });
    },
  });
}
