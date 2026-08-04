// ui/tooltip.js — a pointer-following tooltip + a raster hover-value binding (PACKAGE_ROADMAP §5).
//
// Map-anchored UI: it consumes the map-event dispatch (FimMap.enableMapEvents). The tooltip positions
// at the DOM pointer (evt.originalEvent client coords) — provider-neutral, no getProjection() math.
// Headless rule: DOM only inside functions; no `window.foo()`.

/**
 * A tooltip element that shows/hides and follows the pointer.
 * @param {import('../package/fimMap.js').FimMap|{root?: Element}} [fim]
 * @param {{ style?: Object }} [opts]
 * @returns {{ show: (evt: any, html: string) => void, hide: () => void, destroy: () => void, el: Element }}
 */
export function createTooltip(fim, opts = {}) {
  const root = fim?.root || document.body;
  const doc = root.ownerDocument || document;
  const tip = doc.createElement("div");
  tip.className = "fim-tooltip";
  tip.setAttribute("data-fim-ui", "tooltip");
  Object.assign(tip.style, {
    position: "fixed", zIndex: 99998, pointerEvents: "none", background: "#111", color: "#fff",
    font: "12px ui-monospace,Menlo,monospace", padding: "3px 7px", borderRadius: "4px",
    display: "none", whiteSpace: "nowrap", boxShadow: "0 1px 4px rgba(0,0,0,.4)", ...(opts.style || {}),
  });
  doc.body.appendChild(tip);

  function positionFrom(evt) {
    const oe = evt?.originalEvent;
    if (oe && oe.clientX != null) {
      tip.style.left = `${oe.clientX + 12}px`;
      tip.style.top = `${oe.clientY + 12}px`;
    }
  }
  function show(evt, html) { tip.innerHTML = html; tip.style.display = "block"; positionFrom(evt); }
  function hide() { tip.style.display = "none"; }
  function destroy() { tip.remove(); }

  return { show, hide, destroy, el: tip };
}

/**
 * Wire a RasterLayer's hover value to a tooltip. Uses the UNFILTERED `map:hover` bus event so the
 * tooltip hides the moment the cursor leaves the raster footprint (valueAt → null). Requires
 * `fim.enableMapEvents()`.
 * @param {import('../package/layer.js').RasterLayer} layer
 * @param {{ tooltip?: ReturnType<typeof createTooltip>, format?: (v: number) => string }} [opts]
 * @returns {{ tooltip: ReturnType<typeof createTooltip>, off: () => void }}
 */
export function bindHoverValue(layer, { tooltip, format } = {}) {
  const fim = layer.map;
  const tip = tooltip || createTooltip(fim);
  const fmt = format || ((v) => (typeof v === "number" ? v.toFixed(3) : String(v)));
  const onHover = (e) => {
    if (layer.settings.get("hover") === false) { tip.hide(); return; }
    const v = typeof layer.valueAt === "function" ? layer.valueAt(e.lat, e.lng) : null;
    if (v == null) tip.hide(); else tip.show(e, fmt(v));
  };
  fim.on("map:hover", onHover);
  return { tooltip: tip, off: () => fim.off("map:hover", onHover) };
}
