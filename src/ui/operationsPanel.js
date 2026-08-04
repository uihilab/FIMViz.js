// ui/operationsPanel.js — apply Dataset transformation ops to a live layer (docs/PACKAGE_ROADMAP §2).
//
// A view that turns the lazy Dataset ops (clip/mask/reclassify) into buttons. Each apply derives a
// new Dataset FROM the layer's current source (`layer.deriveSources`, so memoized ancestors are
// reused) and re-renders in place; Reset points the layer back at its original source. Styled to
// match the tools panel (`pretty`). Headless rule: DOM only inside functions; no `window.foo()`.

const PRETTY_CSS = `
.fim-ops-panel.fim-pretty{background:#161b22;color:#e6edf3;border:1px solid #2b3440;border-radius:8px;padding:10px 12px;font:13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-width:210px}
.fim-ops-panel.fim-pretty .op{display:flex;flex-direction:column;gap:6px;padding:8px 0;border-bottom:1px solid #2b3440}
.fim-ops-panel.fim-pretty .op:last-child{border-bottom:0}
.fim-ops-panel.fim-pretty .op-title{font-size:12px;color:#8b949e}
.fim-ops-panel.fim-pretty .op-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.fim-ops-panel.fim-pretty input{width:70px;background:#0f1216;color:#e6edf3;border:1px solid #2b3440;border-radius:5px;padding:4px 6px;font-size:12px}
.fim-ops-panel.fim-pretty button{background:#58a6ff;color:#08111f;border:0;border-radius:6px;padding:5px 10px;font-weight:600;cursor:pointer;font-size:12px}
.fim-ops-panel.fim-pretty button.sec{background:transparent;color:#58a6ff;border:1px solid #2b3440}
.fim-ops-panel.fim-pretty button:disabled{opacity:.45;cursor:not-allowed}
`;

function injectStyles(doc) {
  if (doc.getElementById("fim-ops-panel-css")) return;
  const s = doc.createElement("style");
  s.id = "fim-ops-panel-css"; s.textContent = PRETTY_CSS;
  (doc.head || doc.body || doc.documentElement).appendChild(s);
}

/**
 * Mount an operations panel for `layer` into `root`.
 * @param {Element|string} root
 * @param {{ layer: import('../package/layer.js').RasterLayer,
 *           region?: () => (import('../package/filter.js').SpatialFilter|Array|null),
 *           pretty?: boolean,
 *           onApply?: (layer: any, err?: Error) => void }} opts
 * @returns {{ el: Element, destroy: () => void }}
 */
export function createOperationsPanel(root, { layer, region, pretty = false, onApply } = {}) {
  if (!layer) throw new Error("createOperationsPanel: { layer } is required");
  const host = typeof root === "string" ? document.querySelector(root) : root;
  if (!host) throw new Error("createOperationsPanel: target element not found");
  const doc = host.ownerDocument || document;
  const baseDs = layer.dataset;             // the pristine source, for Reset

  const panel = doc.createElement("div");
  panel.className = "fim-ops-panel" + (pretty ? " fim-pretty" : "");
  panel.setAttribute("data-fim-ui", "operations-panel");
  if (pretty) injectStyles(doc);

  async function apply(fn) {
    try { await layer.deriveSources(([ds]) => [fn(ds)], { render: "in-place" }); onApply?.(layer); }
    catch (err) { console.error("[fimviz] operation failed:", err); onApply?.(layer, err); }
  }

  const mk = (tag, props = {}, kids = []) => { const e = doc.createElement(tag); Object.assign(e, props); for (const k of kids) e.append(k); return e; };

  // — Threshold (reclassify: keep values in [min, max), others transparent) —
  const minI = mk("input", { type: "number", placeholder: "min", step: "any" });
  const maxI = mk("input", { type: "number", placeholder: "max", step: "any" });
  const thBtn = mk("button", { textContent: "Apply" });
  thBtn.addEventListener("click", () => {
    const min = minI.value === "" ? null : parseFloat(minI.value);
    const max = maxI.value === "" ? null : parseFloat(maxI.value);
    if (min == null && max == null) return;
    apply((ds) => ds.reclassify([{ min, max }], { unmatched: "nodata" }));
  });
  const threshold = mk("div", { className: "op" }, [
    mk("span", { className: "op-title", textContent: "Threshold — keep values in range" }),
    mk("div", { className: "op-row" }, [minI, maxI, thBtn]),
  ]);

  // — Mask to region (uses the current drawn region, if any) —
  const maskBtn = mk("button", { textContent: "Mask to region" });
  maskBtn.addEventListener("click", () => { const rg = region?.(); if (rg) apply((ds) => ds.mask(rg)); });
  const mask = mk("div", { className: "op" }, [
    mk("span", { className: "op-title", textContent: "Mask — clip to the drawn region" }),
    mk("div", { className: "op-row" }, [maskBtn]),
  ]);

  // — Reset —
  const resetBtn = mk("button", { className: "sec", textContent: "Reset to original" });
  resetBtn.addEventListener("click", async () => { await layer.setSources([baseDs], { render: "in-place" }); onApply?.(layer); });
  const reset = mk("div", { className: "op" }, [mk("div", { className: "op-row" }, [resetBtn])]);

  panel.append(threshold, mask, reset);
  host.appendChild(panel);

  return { el: panel, destroy: () => panel.remove() };
}
