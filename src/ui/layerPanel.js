// ui/layerPanel.js — a view of `fim.layers`, and click-to-select on the map.
//
// Two exports that work together but neither requires the other:
//
//   createLayerPanel(root, { fim })  — the list: every layer, hidden ones included, with show/hide,
//                                      fit, forward/backward and remove.
//   createLayerSelect(fim, { … })    — map clicks resolved to the layer stack under the pointer,
//                                      cycling through overlapping layers on repeated clicks.
//
// ORDER IS Z-ORDER. `fim.layers` is bottom → top, matching what `dispatchMapEventToLayers` has
// always assumed for hit-testing. The panel renders it REVERSED (topmost first), because that is how
// every layer list a user has ever met is arranged, and calls `fim.applyLayerOrder()` after a move so
// what is drawn matches what the list says. Before that method existed the two could disagree.
//
// Headless rule, as everywhere in this folder: DOM only inside functions, and the engine is never
// called back into except through its public API.

const PRETTY_CSS = `
.fim-layer-panel.fim-pretty{background:#161b22;color:#e6edf3;border:1px solid #2b3440;border-radius:8px;padding:6px;font:13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-width:230px}
.fim-layer-panel.fim-pretty .lyr{display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:6px}
.fim-layer-panel.fim-pretty .lyr+.lyr{margin-top:2px}
.fim-layer-panel.fim-pretty .lyr:hover{background:#0f1216}
.fim-layer-panel.fim-pretty .lyr.sel{background:#132135;outline:1px solid #58a6ff}
.fim-layer-panel.fim-pretty .lyr.off .nm{opacity:.45;text-decoration:line-through}
.fim-layer-panel.fim-pretty .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.fim-layer-panel.fim-pretty .ty{font:10px ui-monospace,Menlo,monospace;color:#8b949e}
.fim-layer-panel.fim-pretty button{background:transparent;border:1px solid #2b3440;color:#8b949e;border-radius:5px;padding:1px 5px;font-size:11px;cursor:pointer;line-height:1.4}
.fim-layer-panel.fim-pretty button:hover:not(:disabled){color:#e6edf3;border-color:#58a6ff}
.fim-layer-panel.fim-pretty button:disabled{opacity:.3;cursor:not-allowed}
.fim-layer-panel.fim-pretty .empty{color:#8b949e;padding:6px;font-size:12px}
`;

function injectStyles(doc) {
  if (doc.getElementById("fim-layer-panel-css")) return;
  const s = doc.createElement("style");
  s.id = "fim-layer-panel-css";
  s.textContent = PRETTY_CSS;
  (doc.head || doc.body || doc.documentElement).appendChild(s);
}

/** What to call a layer in a list. Prefers the filename a host registered, then its type, then id. */
export function layerLabel(layer) {
  return layer?._name || layer?.dataset?.name || layer?.type || layer?.id || "layer";
}

/**
 * Mount a layer list for `fim` into `root`.
 *
 * Rows are TOP-FIRST (the reverse of `fim.layers`). Hidden layers stay listed — struck through and
 * dimmed — because a layer you cannot see is exactly the one you need the list to find.
 *
 * @param {Element|string} root
 * @param {Object} opts
 * @param {import('../package/fimMap.js').FimMap} opts.fim
 * @param {boolean} [opts.pretty=false] - inject the bundled stylesheet
 * @param {import('../package/layer.js').Layer|null} [opts.selected=null] - initially selected layer
 * @param {(layer: import('../package/layer.js').Layer|null) => void} [opts.onSelect] - selection changed
 * @param {(layer: import('../package/layer.js').Layer) => void} [opts.onRemove] - after a layer is removed
 * @returns {{ el: Element, update: () => void, select: (layer: any) => void,
 *             get selected(): any, destroy: () => void }}
 */
export function createLayerPanel(root, { fim, pretty = false, selected = null, onSelect, onRemove } = {}) {
  if (!fim) throw new Error("createLayerPanel: { fim } is required");
  const host = typeof root === "string" ? document.querySelector(root) : root;
  if (!host) throw new Error("createLayerPanel: target element not found");
  const doc = host.ownerDocument || document;
  if (pretty) injectStyles(doc);

  let current = selected;

  const panel = doc.createElement("div");
  panel.className = "fim-layer-panel" + (pretty ? " fim-pretty" : "");
  panel.setAttribute("data-fim-ui", "layer-panel");
  host.appendChild(panel);

  const mk = (tag, props = {}, kids = []) => {
    const e = doc.createElement(tag);
    Object.assign(e, props);
    for (const k of kids) e.append(k);
    return e;
  };
  const btn = (label, title, onClick, disabled = false) => {
    const b = mk("button", { textContent: label, title, disabled });
    b.addEventListener("click", (ev) => { ev.stopPropagation(); onClick(); });
    return b;
  };

  /** Move `layer` one place through the array and push the new order to the map. */
  function move(layer, delta) {
    const i = fim.layers.indexOf(layer);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= fim.layers.length) return;
    fim.layers.splice(i, 1);
    fim.layers.splice(j, 0, layer);
    // Without this the array and the map disagree: hit-testing would follow the new order while the
    // drawing still followed the old one.
    fim.applyLayerOrder?.();
    render();
  }

  function setSelected(layer) {
    current = layer ?? null;
    onSelect?.(current);
    render();
  }

  function row(layer, idx, total) {
    const visible = layer.visible !== false;
    const el = mk("div", {
      className: "lyr" + (layer === current ? " sel" : "") + (visible ? "" : " off"),
    });
    el.setAttribute("data-layer-id", layer.id);

    el.append(
      btn(visible ? "◉" : "○", visible ? "Hide" : "Show", () => {
        // hide()/show() are the layer's own verbs; a raster drops to opacity 0 while a vector is
        // torn off the map, but both flip `visible`, which is all the list reports.
        if (visible) layer.hide?.(); else layer.show?.();
        render();
      }),
      mk("span", { className: "nm", textContent: layerLabel(layer), title: layerLabel(layer) }),
      mk("span", { className: "ty", textContent: layer.type || layer.kind || "" }),
      // idx here is the position in the REVERSED list, so "up" is toward the end of fim.layers.
      btn("▲", "Bring forward", () => move(layer, +1), idx === 0),
      btn("▼", "Send backward", () => move(layer, -1), idx === total - 1),
      btn("⤢", "Fit map to this layer", () => layer.fit?.()),
      btn("✕", "Remove", () => {
        fim.removeLayer?.(layer);
        if (current === layer) setSelected(null); else render();
        onRemove?.(layer);
      }),
    );
    el.querySelector(".nm").addEventListener("click", () => setSelected(layer));
    return el;
  }

  function render() {
    const top = fim.layers.slice().reverse();     // topmost first
    panel.replaceChildren();
    if (!top.length) {
      panel.append(mk("div", { className: "empty", textContent: "No layers on the map" }));
      return;
    }
    top.forEach((l, i) => panel.append(row(l, i, top.length)));
  }

  // `layers:changed` fires on add and remove; without it a panel over a plain array could only poll.
  const onChanged = () => render();
  fim.on?.("layers:changed", onChanged);
  render();

  return {
    el: panel,
    update: render,
    select: setSelected,
    get selected() { return current; },
    destroy() { fim.off?.("layers:changed", onChanged); panel.remove(); },
  };
}

/**
 * Resolve map clicks to the layer stack beneath the pointer.
 *
 * The stack is every VISIBLE layer whose `hitTest(lat, lng)` passes, topmost first. Clicking the same
 * spot again advances through it — which is the answer to "several layers overlap here and I want the
 * one underneath". `fit` (default true) also fits the map to each as you cycle, so a layer you cannot
 * find becomes findable in one click.
 *
 * This deliberately does NOT use `fim.captureInteraction`: that is modal and would suppress every
 * other layer interaction. Selection is passive, so it rides the ordinary `map:click` bus and leaves
 * hover, tooltips and feature clicks working. It therefore needs `fim.enableMapEvents(['click'])`.
 *
 * @param {import('../package/fimMap.js').FimMap} fim
 * @param {Object} [opts]
 * @param {boolean} [opts.fit=true] - fit the map to each layer as it is selected
 * @param {(layer: any, stack: any[]) => void} [opts.onSelect] - fires with the layer and the full stack
 * @param {(lat: number, lng: number) => void} [opts.onEmpty] - a click that hit no layer
 * @returns {{ off: () => void, get selected(): any, get stack(): any[], select: (l: any) => void }}
 */
export function createLayerSelect(fim, { fit = true, onSelect, onEmpty } = {}) {
  if (!fim) throw new Error("createLayerSelect: a FimMap is required");
  let selected = null;
  let stack = [];
  let lastKey = null;

  const onClick = (e) => {
    const hits = fim.layers
      .filter((l) => l?.visible !== false && typeof l.hitTest === "function" && l.hitTest(e.lat, e.lng))
      .reverse();                                   // topmost first, matching dispatch precedence
    if (!hits.length) {
      stack = []; lastKey = null;
      onEmpty?.(e.lat, e.lng);
      return;
    }
    // Round the key so ordinary hand-jitter between clicks still counts as "the same spot" — without
    // it, cycling would reset on every click and the layer underneath would be unreachable.
    const key = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
    const sameSpot = key === lastKey && stack.length === hits.length;
    const at = sameSpot ? (stack.indexOf(selected) + 1) % hits.length : 0;
    stack = hits;
    lastKey = key;
    selected = hits[at];
    if (fit) selected.fit?.();
    onSelect?.(selected, hits.slice());
  };

  fim.on?.("map:click", onClick);

  return {
    off: () => fim.off?.("map:click", onClick),
    get selected() { return selected; },
    get stack() { return stack.slice(); },
    select(layer) { selected = layer ?? null; if (fit) selected?.fit?.(); onSelect?.(selected, stack.slice()); },
  };
}
