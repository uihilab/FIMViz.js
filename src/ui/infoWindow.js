// ui/infoWindow.js — a click info window + a vector feature-info binding (PACKAGE_ROADMAP §5).
//
// Map-anchored UI: consumes the click dispatch. It opens at the DOM pointer (provider-neutral). The
// feature binding uses the PER-LAYER `click` event, which the dispatch only delivers when the click
// lands inside a feature (VectorLayer.hitTest) — so the window opens on a feature, not empty map.
// Headless rule: DOM only inside functions; no `window.foo()`.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * A dismissible info window positioned at the pointer.
 * @param {import('../package/fimMap.js').FimMap|{root?: Element}} [fim]
 * @param {{ style?: Object }} [opts]
 * @returns {{ open: (evt: any, html: string|Node) => void, close: () => void, destroy: () => void, el: Element }}
 */
export function createInfoWindow(fim, opts = {}) {
  const root = fim?.root || document.body;
  const doc = root.ownerDocument || document;
  const box = doc.createElement("div");
  box.className = "fim-infowindow";
  box.setAttribute("data-fim-ui", "infowindow");
  Object.assign(box.style, {
    position: "fixed", zIndex: 99997, background: "#fff", color: "#111",
    font: "12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif", padding: "8px 22px 8px 10px",
    borderRadius: "6px", display: "none", boxShadow: "0 3px 12px rgba(0,0,0,.35)",
    maxWidth: "280px", maxHeight: "240px", overflow: "auto", ...(opts.style || {}),
  });
  const closeBtn = doc.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Close");
  Object.assign(closeBtn.style, {
    position: "absolute", top: "2px", right: "6px", border: "0", background: "none",
    cursor: "pointer", fontSize: "16px", lineHeight: "1", color: "#111",
  });
  closeBtn.addEventListener("click", () => hide());
  const content = doc.createElement("div");
  box.append(closeBtn, content);
  doc.body.appendChild(box);

  function open(evt, html) {
    if (html instanceof Node) content.replaceChildren(html);
    else content.innerHTML = String(html ?? "");
    const oe = evt?.originalEvent;
    if (oe && oe.clientX != null) {
      box.style.left = `${oe.clientX + 8}px`;
      box.style.top = `${oe.clientY + 8}px`;
    }
    box.style.display = "block";
  }
  function hide() { box.style.display = "none"; }
  function destroy() { box.remove(); }

  return { open, close: hide, destroy, el: box };
}

/**
 * A tiny HTML table of a feature's properties — the default info-window content.
 * @param {Object} [props]
 * @returns {string}
 */
export function propsTable(props = {}) {
  const entries = Object.entries(props || {});
  if (!entries.length) return "<em>(no properties)</em>";
  const rows = entries
    .map(([k, v]) => `<tr><td style="color:#666;padding-right:8px">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join("");
  return `<table style="border-collapse:collapse">${rows}</table>`;
}

/**
 * Wire a VectorLayer's feature clicks to an info window. The per-layer `click` fires only over a
 * feature (dispatch hitTest), so this opens on the clicked feature. Requires `fim.enableMapEvents()`.
 * @param {import('../package/layer.js').VectorLayer} layer
 * @param {{ infoWindow?: ReturnType<typeof createInfoWindow>, render?: (feature: Object) => (string|Node) }} [opts]
 * @returns {{ infoWindow: ReturnType<typeof createInfoWindow>, off: () => void }}
 */
export function bindFeatureInfo(layer, { infoWindow, render } = {}) {
  const iw = infoWindow || createInfoWindow(layer.map);
  const rnd = render || ((f) => propsTable(f?.properties));
  const onClick = (e) => {
    const f = typeof layer.featureAt === "function" ? layer.featureAt(e.lat, e.lng) : null;
    if (!f) { iw.close(); return; }
    iw.open(e, rnd(f));
  };
  layer.on("click", onClick);
  return { infoWindow: iw, off: () => layer.off("click", onClick) };
}
