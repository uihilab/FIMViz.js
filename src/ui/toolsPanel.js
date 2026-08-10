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
 * @property {'select'|'checkbox'|'range'|'color'|'text'|'number'|'bands'|'gradient'} type
 * @property {string} key    - the settings knob this control writes
 * @property {string} [label]
 * @property {*} [value]     - current value (for initial render)
 * @property {Array<{value: any, label: string}>} [options] - for 'select'
 * @property {number} [min] @property {number} [max] @property {number} [step] - for 'range'/'number'
 * @property {string} [note] - a line of explanation rendered under the control
 */

/**
 * PURE: the control spec for a raster layer.
 *
 * With a `ColorScale` attached this is every knob `RasterSettings.SCALE_KEYS` accepts — palette,
 * continuous, min, max, unit, stops, colorStops — plus opacity and the hover toggle. All seven route
 * through `layer.settings.set()`, which coalesces them into ONE `colorScale.set(patch)`, so editing
 * several at once is one repaint.
 *
 * The read side is `colorScale.toJSON()` rather than the scale's fields: it is the documented,
 * structured-cloneable description, and it is the only thing that reports which of the three
 * mutually-exclusive colouring modes (palette / discrete bands / gradient control points) is live.
 * @param {import('../package/layer.js').RasterLayer} layer
 * @returns {Control[]}
 */
export function rasterControls(layer) {
  const controls = [];
  if (layer.colorScale) {
    const cs = layer.colorScale.toJSON();
    controls.push({
      type: "select", key: "palette", label: "Palette",
      options: paletteNames().map((n) => ({ value: n, label: n })),
      value: typeof cs.palette === "string" ? cs.palette : "",
      // The three modes are mutually exclusive in the engine (setPalette/setStops/setColorStops each
      // clear the others), so picking a palette IS how you leave bands or gradient behind.
      note: cs.stops || cs.colorStops ? "picking a palette clears the bands/gradient below" : undefined,
    });
    // Reads `continuous`, the flag this checkbox WRITES — not `kind`, which is derived and reports
    // 'classed' whenever stops exist, so a scale with both would show the box unticked while the flag
    // was on and toggling it would appear to do nothing.
    controls.push({ type: "checkbox", key: "continuous", label: "Continuous", value: !!cs.continuous });
    controls.push({ type: "number", key: "min", label: "Min", value: cs.min, step: "any" });
    controls.push({ type: "number", key: "max", label: "Max", value: cs.max, step: "any" });
    controls.push({ type: "text", key: "unit", label: "Unit", value: cs.unit ?? "" });
    controls.push({
      type: "bands", key: "stops", label: "Bands", value: cs.stops,
      note: "discrete: one flat colour per range",
    });
    controls.push({
      type: "gradient", key: "colorStops", label: "Gradient", value: cs.colorStops,
      note: "control points, interpolated — needs Continuous on to blend",
    });
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
.fim-tools-panel.fim-pretty input[type=number],.fim-tools-panel.fim-pretty input[type=text]{flex:1;min-width:0;background:#0f1216;color:#e6edf3;border:1px solid #2b3440;border-radius:5px;padding:3px 6px;font-size:12px}
.fim-tools-panel.fim-pretty .fim-note{display:block;margin:-3px 0 7px 92px;color:#6e7681;font-size:11px;font-style:italic}
.fim-tools-panel.fim-pretty .fim-stops{margin:6px 0 8px}
.fim-tools-panel.fim-pretty .fim-stops>span.hd{display:block;color:#8b949e;font-size:12px;margin-bottom:4px}
.fim-tools-panel.fim-pretty .fim-stop{display:flex;gap:4px;align-items:center;margin:3px 0}
.fim-tools-panel.fim-pretty .fim-stop input[type=number]{width:52px;flex:0 0 auto}
.fim-tools-panel.fim-pretty .fim-stop input[type=text]{flex:1;min-width:36px}
.fim-tools-panel.fim-pretty .fim-stop input[type=color]{width:26px;height:22px;padding:0;border:1px solid #2b3440;border-radius:4px;background:none}
.fim-tools-panel.fim-pretty .fim-stops button{background:transparent;color:#58a6ff;border:1px solid #2b3440;border-radius:5px;padding:2px 7px;font-size:11px;cursor:pointer}
.fim-tools-panel.fim-pretty .fim-stop button{color:#8b949e;padding:2px 6px}
`;

function injectPrettyStyles(doc) {
  if (doc.getElementById("fim-tools-panel-css")) return;
  const s = doc.createElement("style");
  s.id = "fim-tools-panel-css";
  s.textContent = PRETTY_CSS;
  (doc.head || doc.body || doc.documentElement).appendChild(s);
}

const el = (doc, tag, props = {}, kids = []) => {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "attrs") for (const [a, av] of Object.entries(v)) e.setAttribute(a, av);
    else e[k] = v;
  }
  for (const k of kids) e.append(k);
  return e;
};

const HEX = /^#[0-9a-f]{6}$/i;
const asHex = (c, fallback) => (typeof c === "string" && HEX.test(c) ? c : fallback);

/**
 * The discrete-band editor (`stops`) and the gradient-control-point editor (`colorStops`), which are
 * the same widget with two row shapes — a band is `{min, max, color, label}`, a control point is
 * `{value, color}`. Both write the WHOLE array on every edit, because that is the shape
 * `ColorScale.setStops`/`setColorStops` take: there is no per-row engine call to route to, and a
 * whole-array write is also what makes the mode switch (bands ⇄ gradient) a single settings write.
 *
 * Neither offers a "clear" button. Emptying `stops` does NOT restore palette mode — `setStops([])`
 * leaves the scale explicit with no bands, i.e. everything unpainted. Leaving these modes is done by
 * picking a palette, which is what the engine's own mutual exclusion says, and what the palette
 * control's note tells the user.
 */
function stopsEditor(doc, c, commit) {
  const gradient = c.type === "gradient";
  const box = el(doc, "div", { className: "fim-stops", attrs: { "data-control": c.key } });
  box.append(el(doc, "span", { className: "hd", textContent: c.label || c.key }));

  // Working state, seeded from the scale. Rows are edited in place and the whole lot is written on
  // each change, so what the user sees and what the engine holds cannot drift apart mid-edit.
  let rows = gradient
    ? (c.value?.values ?? []).map((v, i) => ({ value: v, color: asHex(c.value.colors?.[i], "#58a6ff") }))
    : (c.value ?? []).map((s) => ({ ...s, color: asHex(s.color, "#58a6ff") }));

  function write() {
    if (gradient) {
      // setColorStops REQUIRES two or more points and throws below that, so one point is treated as
      // an incomplete edit — rendered, not yet committed. Otherwise adding the first of a pair would
      // throw in the user's face halfway through a legitimate action.
      if (rows.length < 2) return;
      commit({ values: rows.map((r) => r.value), colors: rows.map((r) => r.color) });
    } else {
      commit(rows.map((r) => ({ min: r.min, max: r.max, color: r.color, label: r.label || undefined })));
    }
  }

  function draw() {
    for (const old of [...box.querySelectorAll(".fim-stop, .fim-stops-add")]) old.remove();
    rows.forEach((r, i) => {
      const line = el(doc, "div", { className: "fim-stop", attrs: { "data-row": String(i) } });
      const num = (key, ph) => {
        const inp = el(doc, "input", { type: "number", step: "any", placeholder: ph, attrs: { "data-field": key } });
        if (r[key] != null) inp.value = String(r[key]);
        inp.addEventListener("change", () => { r[key] = inp.value === "" ? null : Number(inp.value); write(); });
        return inp;
      };
      if (gradient) line.append(num("value", "value"));
      else line.append(num("min", "from"), num("max", "to"));

      const colour = el(doc, "input", { type: "color", value: r.color, attrs: { "data-field": "color" } });
      colour.addEventListener("input", () => { r.color = colour.value; write(); });
      line.append(colour);

      if (!gradient) {
        const label = el(doc, "input", { type: "text", placeholder: "label", value: r.label ?? "", attrs: { "data-field": "label" } });
        label.addEventListener("change", () => { r.label = label.value; write(); });
        line.append(label);
      }
      const del = el(doc, "button", { type: "button", textContent: "✕", title: "remove" });
      del.addEventListener("click", () => { rows.splice(i, 1); draw(); write(); });
      line.append(del);
      box.append(line);
    });

    const add = el(doc, "button", {
      type: "button", className: "fim-stops-add",
      textContent: gradient ? "+ control point" : "+ band",
    });
    add.addEventListener("click", () => {
      const last = rows[rows.length - 1];
      rows.push(gradient
        ? { value: (last?.value ?? 0) + 1, color: "#58a6ff" }
        : { min: last?.max ?? 0, max: (last?.max ?? 0) + 1, color: "#58a6ff", label: "" });
      draw(); write();
    });
    box.append(add);
  }
  draw();
  return box;
}

function controlEl(doc, c, layer) {
  const commit = (v) => { layer.settings.set({ [c.key]: v }); };
  if (c.type === "bands" || c.type === "gradient") {
    const box = stopsEditor(doc, c, commit);
    if (c.note) box.append(el(doc, "span", { className: "fim-note", textContent: c.note }));
    return box;
  }

  const row = doc.createElement("label");
  const span = doc.createElement("span");
  span.textContent = c.label || c.key;
  let input;

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
  } else if (c.type === "number") {
    input = doc.createElement("input"); input.type = "number";
    input.step = c.step ?? "any";
    if (c.min != null) input.min = c.min;
    if (c.max != null) input.max = c.max;
    if (c.value != null) input.value = String(c.value);
    // Blank is not zero. `min`/`max` define a domain, and committing NaN would silently break the
    // colour mapping for anyone who cleared the field to retype it.
    input.addEventListener("change", () => {
      if (input.value === "") return;
      const n = Number(input.value);
      if (Number.isFinite(n)) commit(n);
    });
  } else {
    input = doc.createElement("input"); input.type = "text"; input.value = c.value ?? "";
    input.addEventListener("change", () => commit(input.value));
  }
  input.setAttribute("data-control", c.key);
  row.append(span, input);
  if (!c.note) return row;
  // A note belongs to the control, so the two must arrive as one node — render() appends whatever
  // controlEl returns, once per control.
  return el(doc, "div", {}, [row, el(doc, "span", { className: "fim-note", textContent: c.note })]);
}

/**
 * Mount a tools panel for `layer` into `root`. `controls` overrides the preset — an array or a
 * `(layer) => Control[]` function. `pretty:true` injects a scoped stylesheet; otherwise the panel is
 * bare structure the host styles.
 *
 * `reactive:true` keeps the panel in step with changes made anywhere else — `layer.set()`, another
 * panel, a preset button. See the focus rule below; it is the reason this is opt-in rather than
 * always on.
 * @param {Element|string} root
 * @param {{ layer: import('../package/layer.js').Layer, controls?: any, pretty?: boolean,
 *           reactive?: boolean }} opts
 * @returns {{ el: Element, update: () => void, destroy: () => void }}
 */
export function createToolsPanel(root, { layer, controls, pretty = false, reactive = false } = {}) {
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

  // ── reactive mode ─────────────────────────────────────────────────────────────────────
  // Unlike a legend, this panel is made of LIVE INPUTS, and rebuilding it destroys them. A restyle
  // arrives on every keystroke-driven commit, so a naive subscription would rip the field out from
  // under the cursor mid-edit. So: if focus is inside the panel, defer — remember that a redraw is
  // owed and do it when focus leaves. The user's own edits are exactly the ones that need no repaint,
  // since the control they are typing in already holds the value.
  let owed = false;
  let scheduled = false;
  let dead = false;

  const focusInside = () => panel.contains(doc.activeElement) && doc.activeElement !== doc.body;

  function refresh() {
    scheduled = false;
    if (dead) return;
    if (focusInside()) { owed = true; return; }
    owed = false;
    render();
  }
  function schedule() {
    if (scheduled || dead) return;
    scheduled = true;
    queueMicrotask(refresh);   // one redraw per batch: a settings write can emit two of these
  }
  const onFocusOut = () => { if (owed) schedule(); };

  if (reactive) {
    for (const e of REACTIVE_EVENTS) layer.on?.(e, schedule);
    panel.addEventListener("focusout", onFocusOut);
  }

  return {
    el: panel,
    update: render,
    destroy() {
      dead = true;
      if (reactive) {
        for (const e of REACTIVE_EVENTS) layer.off?.(e, schedule);
        panel.removeEventListener("focusout", onFocusOut);
      }
      panel.remove();
    },
  };
}

// `settings` as well as the two effect events: this panel shows knobs that change neither the colours
// nor the pixels (the hover toggle), and a second panel on the same layer should still track them.
const REACTIVE_EVENTS = ["restyle", "recomputed", "settings"];
