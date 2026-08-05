// ui/toolsPanel.js — a layer tools panel bound to layer.settings (docs/PACKAGE_ROADMAP.md §5).
//
// A view over `layer.settings` (the change-model): a control's onchange calls
// `layer.settings.set({ [key]: value })`, which applies the knob, re-renders when needed, and emits
// the effect event. The GENERALIZED interface is `createToolsPanel(root, { layer, controls })` where
// `controls` is a declarative spec; the PRESETS `rasterControls`/`vectorControls` build that spec
// from a layer. Control-spec generation is pure (node-testable); only render() touches the DOM.
// Headless rule: DOM only inside functions; no `window.foo()`.

import { paletteNames } from "../package/colorScale.js";

/**
 * @typedef {Object} Control
 * @property {'select'|'checkbox'|'range'|'color'|'text'} type
 * @property {string} key    - the settings knob this control writes
 * @property {string} [label]
 * @property {*} [value]     - current value (for initial render)
 * @property {Array<{value: any, label: string}>} [options] - for 'select'
 * @property {number} [min] @property {number} [max] @property {number} [step] - for 'range'
 */

/**
 * PURE: the control spec for a raster layer — palette + continuous (only if a ColorScale is
 * attached), opacity, hover-value toggle.
 * @param {import('../package/layer.js').RasterLayer} layer
 * @returns {Control[]}
 */
export function rasterControls(layer) {
  const controls = [];
  if (layer.colorScale) {
    controls.push({
      type: "select", key: "palette", label: "Palette",
      options: paletteNames().map((n) => ({ value: n, label: n })),
      value: typeof layer.colorScale.palette === "string" ? layer.colorScale.palette : "",
    });
    controls.push({ type: "checkbox", key: "continuous", label: "Continuous", value: layer.colorScale.kind === "continuous" });
  }
  controls.push({ type: "range", key: "opacity", label: "Opacity", min: 0, max: 1, step: 0.05, value: layer.settings.get("opacity") ?? 1 });
  controls.push({ type: "checkbox", key: "hover", label: "Hover value", value: layer.settings.get("hover") !== false });
  return controls;
}

/**
 * PURE: the control spec for a vector layer — fill/stroke colour + fill opacity, plus the palette
 * controls when the layer is grading features by a property (`colorScale` + `colorBy`). Those two
 * keys are the SAME ones `rasterControls` emits, because they write the same `ColorScale` — so a
 * host's palette picker is one control that fits either kind of layer.
 * @param {import('../package/layer.js').VectorLayer} layer
 * @returns {Control[]}
 */
export function vectorControls(layer) {
  const controls = [];
  if (layer.colorScale && layer.colorBy) {
    controls.push({
      type: "select", key: "palette", label: "Palette",
      options: paletteNames().map((n) => ({ value: n, label: n })),
      value: typeof layer.colorScale.palette === "string" ? layer.colorScale.palette : "",
    });
    controls.push({ type: "checkbox", key: "continuous", label: "Continuous", value: layer.colorScale.kind === "continuous" });
  } else {
    // No grading: one flat colour is the only thing that can apply.
    controls.push({ type: "color", key: "color", label: "Colour", value: "#3388ff" });
  }
  controls.push({ type: "range", key: "opacity", label: "Fill opacity", min: 0, max: 1, step: 0.05, value: layer.settings.get("opacity") ?? 1 });
  return controls;
}

/** PURE: pick the preset spec by layer shape (raster exposes valueAt; vector exposes featureAt). */
function defaultControls(layer) {
  return typeof layer.valueAt === "function" ? rasterControls(layer) : vectorControls(layer);
}

const PRETTY_CSS = `
.fim-tools-panel.fim-pretty{background:#161b22;color:#e6edf3;border:1px solid #2b3440;border-radius:8px;padding:10px 12px;font:13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-width:210px}
.fim-tools-panel.fim-pretty label{display:flex;gap:8px;align-items:center;margin:6px 0}
.fim-tools-panel.fim-pretty label>span{min-width:84px;color:#8b949e;font-size:12px}
.fim-tools-panel.fim-pretty select,.fim-tools-panel.fim-pretty input[type=range]{flex:1}
`;

function injectPrettyStyles(doc) {
  if (doc.getElementById("fim-tools-panel-css")) return;
  const s = doc.createElement("style");
  s.id = "fim-tools-panel-css";
  s.textContent = PRETTY_CSS;
  (doc.head || doc.body || doc.documentElement).appendChild(s);
}

function controlEl(doc, c, layer) {
  const row = doc.createElement("label");
  const span = doc.createElement("span");
  span.textContent = c.label || c.key;
  let input;
  const commit = (v) => { layer.settings.set({ [c.key]: v }); };

  if (c.type === "select") {
    input = doc.createElement("select");
    for (const o of c.options || []) {
      const opt = doc.createElement("option");
      opt.value = o.value; opt.textContent = o.label;
      input.appendChild(opt);
    }
    if (c.value != null) input.value = c.value;
    input.addEventListener("change", () => commit(input.value));
  } else if (c.type === "checkbox") {
    input = doc.createElement("input"); input.type = "checkbox"; input.checked = !!c.value;
    input.addEventListener("change", () => commit(input.checked));
  } else if (c.type === "range") {
    input = doc.createElement("input"); input.type = "range";
    input.min = c.min; input.max = c.max; input.step = c.step; input.value = c.value;
    input.addEventListener("input", () => commit(parseFloat(input.value)));
  } else if (c.type === "color") {
    input = doc.createElement("input"); input.type = "color"; if (c.value) input.value = c.value;
    input.addEventListener("input", () => commit(input.value));
  } else {
    input = doc.createElement("input"); input.value = c.value ?? "";
    input.addEventListener("change", () => commit(input.value));
  }
  row.append(span, input);
  return row;
}

/**
 * Mount a tools panel for `layer` into `root`. `controls` overrides the preset — an array or a
 * `(layer) => Control[]` function. `pretty:true` injects a scoped stylesheet; otherwise the panel is
 * bare structure the host styles.
 * @param {Element|string} root
 * @param {{ layer: import('../package/layer.js').Layer, controls?: any, pretty?: boolean }} opts
 * @returns {{ el: Element, update: () => void, destroy: () => void }}
 */
export function createToolsPanel(root, { layer, controls, pretty = false } = {}) {
  if (!layer) throw new Error("createToolsPanel: { layer } is required");
  const host = typeof root === "string" ? document.querySelector(root) : root;
  if (!host) throw new Error(`createToolsPanel: target ${typeof root === "string" ? root : "element"} not found`);
  const doc = host.ownerDocument || document;

  const specFor = () => {
    if (!controls) return defaultControls(layer);
    return typeof controls === "function" ? controls(layer) : controls;
  };

  const panel = doc.createElement("div");
  panel.className = "fim-tools-panel" + (pretty ? " fim-pretty" : "");
  panel.setAttribute("data-fim-ui", "tools-panel");
  if (pretty) injectPrettyStyles(doc);
  host.appendChild(panel);

  function render() {
    panel.replaceChildren();
    for (const c of specFor()) panel.appendChild(controlEl(doc, c, layer));
  }
  render();

  return {
    el: panel,
    update: render,
    destroy: () => panel.remove(),
  };
}
