// ui/operationsPanel.js — apply Dataset transformation ops to a live layer (docs/PACKAGE_ROADMAP §2).
//
// A view that turns the lazy Dataset ops into a form. Each apply derives a new Dataset FROM the
// layer's current source (`layer.deriveSources`, so memoized ancestors are reused) and re-renders in
// place; Reset points the layer back at its original source. Styled to match the tools panel
// (`pretty`). Headless rule: DOM only inside functions; no `window.foo()`.
//
// The ops are a TABLE, not a hand-written form each. One row per op, declaring the fields it needs
// and the one line that runs it — which is why widening from two ops to the engine's full set cost
// a table entry apiece, and why an op can never disagree with its own controls. Every op is filtered
// by `kind`, so a vector layer is offered rasterize and nothing that would throw on it.

const PRETTY_CSS = `
.fim-ops-panel.fim-pretty{background:#161b22;color:#e6edf3;border:1px solid #2b3440;border-radius:8px;padding:4px 12px 10px;font:13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;min-width:210px}
.fim-ops-panel.fim-pretty .op-group{border-bottom:1px solid #2b3440}
.fim-ops-panel.fim-pretty .op-group:last-of-type{border-bottom:0}
.fim-ops-panel.fim-pretty .op-group>summary{cursor:pointer;padding:7px 0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8b949e}
.fim-ops-panel.fim-pretty .op{display:flex;flex-direction:column;gap:5px;padding:0 0 9px}
.fim-ops-panel.fim-pretty .op-title{font-size:12px;color:#8b949e}
.fim-ops-panel.fim-pretty .op-row{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.fim-ops-panel.fim-pretty label{display:flex;gap:4px;align-items:center;font-size:11px;color:#8b949e}
.fim-ops-panel.fim-pretty input[type=number],.fim-ops-panel.fim-pretty input[type=text]{width:66px;background:#0f1216;color:#e6edf3;border:1px solid #2b3440;border-radius:5px;padding:4px 6px;font-size:12px}
.fim-ops-panel.fim-pretty select{background:#0f1216;color:#e6edf3;border:1px solid #2b3440;border-radius:5px;padding:4px 6px;font-size:12px;max-width:150px}
.fim-ops-panel.fim-pretty button{background:#58a6ff;color:#08111f;border:0;border-radius:6px;padding:5px 10px;font-weight:600;cursor:pointer;font-size:12px}
.fim-ops-panel.fim-pretty button.sec{background:transparent;color:#58a6ff;border:1px solid #2b3440}
.fim-ops-panel.fim-pretty button:disabled{opacity:.45;cursor:not-allowed}
.fim-ops-panel.fim-pretty .op-note{font-size:11px;color:#8b949e;font-style:italic}
`;

function injectStyles(doc) {
  if (doc.getElementById("fim-ops-panel-css")) return;
  const s = doc.createElement("style");
  s.id = "fim-ops-panel-css"; s.textContent = PRETTY_CSS;
  (doc.head || doc.body || doc.documentElement).appendChild(s);
}

const num = (v) => (v === "" || v == null ? null : Number(v));

/**
 * The op table. Each entry:
 *   id      — stable, used for `data-op` and for test/host targeting
 *   group   — the collapsible section it lives under
 *   kind    — 'raster' | 'vector', matched against the layer's dataset kind
 *   title   — the label above the controls
 *   button  — the action's verb
 *   fields  — the controls, in order
 *   enabled — (ctx) => true | a string explaining why not (shown, and the button disabled)
 *   fill    — (ctx) => initial values, for ops whose defaults come from the layer
 *   run     — (ctx, v) => a Dataset op, a Promise (terminal), or undefined to do nothing
 *
 * `run` returning `undefined` is a deliberate no-op, not an error: "Apply" with every field blank
 * should leave the layer alone rather than derive an identity node or pop an error toast.
 */
const OPS = [
  // ── extent ──────────────────────────────────────────────────────────────────────────────
  {
    id: "clip", group: "Extent", kind: "raster", title: "Clip — crop to a bbox", button: "Clip",
    fields: [
      { k: "north", t: "number", label: "N" }, { k: "south", t: "number", label: "S" },
      { k: "east", t: "number", label: "E" }, { k: "west", t: "number", label: "W" },
    ],
    // Prefilled from the layer's own footprint, so the fields show the units and rough magnitude the
    // op expects instead of four empty boxes you have to guess at.
    fill: ({ layer }) => {
      const b = layer.dataset?.bounds;
      return b ? { north: b.north, south: b.south, east: b.east, west: b.west } : {};
    },
    run: (_ctx, v) => (v.north == null || v.south == null || v.east == null || v.west == null
      ? undefined
      : (ds) => ds.clip({ north: v.north, south: v.south, east: v.east, west: v.west })),
  },
  {
    id: "mask", group: "Extent", kind: "raster", title: "Mask — clip to the drawn region",
    button: "Mask to region",
    fields: [{ k: "invert", t: "checkbox", label: "invert" }],
    enabled: ({ region }) => (region ? true : "no region source wired up"),
    run: ({ region }, v) => {
      const rg = region?.();
      return rg ? (ds) => ds.mask(rg, { invert: v.invert }) : undefined;
    },
  },

  // ── values ──────────────────────────────────────────────────────────────────────────────
  {
    id: "reclassify", group: "Values", kind: "raster",
    title: "Reclassify — remap a value range", button: "Apply",
    fields: [
      { k: "min", t: "number", ph: "min" }, { k: "max", t: "number", ph: "max" },
      { k: "value", t: "number", ph: "→ value" },
      { k: "unmatched", t: "select", label: "others", options: ["nodata", "keep"] },
    ],
    // Leaving `value` blank is the engine's documented "keep the matched pixel's value" band, which
    // is exactly a threshold — so one op covers both without a second set of controls.
    run: (_ctx, v) => (v.min == null && v.max == null
      ? undefined
      : (ds) => ds.reclassify([{ min: v.min, max: v.max, ...(v.value == null ? {} : { value: v.value }) }],
        { unmatched: v.unmatched })),
  },

  // ── terrain ─────────────────────────────────────────────────────────────────────────────
  {
    id: "slope", group: "Terrain", kind: "raster", title: "Slope — steepness (Horn)", button: "Slope",
    fields: [
      { k: "unit", t: "select", label: "unit", options: ["degrees", "percent"] },
      { k: "zFactor", t: "number", label: "z", value: 1 },
    ],
    run: (_ctx, v) => (ds) => ds.slope({ unit: v.unit, ...(v.zFactor == null ? {} : { zFactor: v.zFactor }) }),
  },
  {
    id: "aspect", group: "Terrain", kind: "raster", title: "Aspect — downslope bearing",
    button: "Aspect", fields: [], run: () => (ds) => ds.aspect(),
  },
  {
    id: "hillshade", group: "Terrain", kind: "raster", title: "Hillshade — shaded relief",
    button: "Hillshade",
    fields: [
      { k: "azimuth", t: "number", label: "az", value: 315 },
      { k: "altitude", t: "number", label: "alt", value: 45 },
      { k: "zFactor", t: "number", label: "z", value: 1 },
    ],
    run: (_ctx, v) => (ds) => ds.hillshade({ azimuth: v.azimuth, altitude: v.altitude, zFactor: v.zFactor }),
  },

  // ── grid ────────────────────────────────────────────────────────────────────────────────
  {
    id: "resample", group: "Grid", kind: "raster",
    title: "Resample — onto a new pixel grid (same footprint)", button: "Resample",
    fields: [
      { k: "width", t: "number", ph: "w" }, { k: "height", t: "number", ph: "h" },
      {
        k: "method", t: "select", label: "method",
        options: ["nearest", "bilinear", "cubic", "lanczos", "mode", "min", "max", "med"],
      },
    ],
    // Only `nearest` and `bilinear` are pure JS; the rest need a registered GDAL resampler and throw
    // at force. Left selectable on purpose — the error names what to register, and hiding them would
    // hide the escape hatch from the person most likely to want it.
    run: (_ctx, v) => {
      if (!v.width || !v.height) return undefined;
      return (ds) => {
        const b = ds.bounds;
        if (!b) throw new Error("resample: the source has no bounds to resample within");
        return ds.resampleTo({ width: v.width, height: v.height, bounds: b }, { method: v.method });
      };
    },
  },
  {
    id: "reproject", group: "Grid", kind: "raster", title: "Reproject — warp to a CRS (GDAL)",
    button: "Reproject",
    fields: [{ k: "crs", t: "text", ph: "EPSG:4326", value: "EPSG:4326" }],
    run: (_ctx, v) => (v.crs ? (ds) => ds.reproject(v.crs) : undefined),
  },

  // ── multi-layer ─────────────────────────────────────────────────────────────────────────
  {
    id: "combine", group: "Multi-layer", kind: "raster",
    title: "Combine — band math against another layer", button: "Combine",
    fields: [
      { k: "other", t: "layer" },
      { k: "op", t: "select", label: "op", options: ["difference", "ratio", "sum", "mean", "min", "max"] },
    ],
    enabled: ({ operands }) => (operands().length ? true : "needs a second raster layer"),
    run: ({ operands }, v) => {
      const other = operands().find((l) => String(l.id) === String(v.other));
      return other?.dataset ? (ds) => ds.combine([other.dataset], { op: v.op }) : undefined;
    },
  },

  // ── axis ────────────────────────────────────────────────────────────────────────────────
  {
    id: "reduce", group: "Axis", kind: "raster",
    title: "Reduce — collapse a selection axis to one grid", button: "Reduce",
    fields: [
      { k: "op", t: "select", label: "op", options: ["mean", "sum", "min", "max"] },
      { k: "axis", t: "number", label: "axis", value: 0 },
    ],
    enabled: ({ layer }) => (layer.dataset?.axes?.length ? true : "this dataset has no selection axis"),
    run: (_ctx, v) => (ds) => ds.reduce(v.op, { axis: v.axis ?? 0 }),
  },

  // ── vector ──────────────────────────────────────────────────────────────────────────────
  {
    id: "rasterize", group: "Vector", kind: "vector",
    title: "Rasterize — burn features onto a new grid", button: "Rasterize",
    fields: [
      { k: "width", t: "number", ph: "w", value: 512 }, { k: "height", t: "number", ph: "h", value: 512 },
      { k: "field", t: "text", ph: "field" }, { k: "burnValue", t: "number", label: "burn", value: 1 },
    ],
    // NOT an in-place derive: rasterize changes the Dataset's kind, and a VectorLayer cannot draw a
    // raster (Layer.rasterize() throws saying exactly this). So it needs a map to add a NEW layer to.
    enabled: ({ fim }) => (fim ? true : "pass { fim } — rasterize adds a new layer, it cannot replace this one"),
    kindChanging: true,
    run: ({ layer, fim }, v) => {
      if (!v.width || !v.height) return undefined;
      const ds = layer.dataset.rasterize({
        width: v.width, height: v.height,
        ...(v.field ? { field: v.field } : {}), burnValue: v.burnValue ?? 1,
      });
      return () => fim.addLayer(ds);
    },
  },

  // ── analysis (terminals: these return DATA, not a layer) ────────────────────────────────
  {
    id: "zonalStats", group: "Analysis", kind: "raster",
    title: "Zonal stats — summarise the drawn region", button: "Compute",
    fields: [], terminal: true,
    enabled: ({ region }) => (region ? true : "no region source wired up"),
    run: ({ layer, region }) => {
      const rg = region?.();
      return rg ? () => layer.dataset.zonalStats([{ id: "region", polygon: rg.features ?? rg }]) : undefined;
    },
  },
  {
    id: "groupBy", group: "Analysis", kind: "raster",
    title: "Group by — this layer's values, binned by another's", button: "Compute",
    fields: [{ k: "other", t: "layer" }, { k: "bins", t: "number", ph: "bins" }],
    terminal: true,
    enabled: ({ operands }) => (operands().length ? true : "needs a second raster layer"),
    run: ({ layer, operands }, v) => {
      const other = operands().find((l) => String(l.id) === String(v.other));
      if (!other?.dataset) return undefined;
      return () => layer.dataset.groupBy(other.dataset, v.bins ? { bins: v.bins } : {});
    },
  },
];

/** The groups, in the order they should appear. */
const GROUP_ORDER = ["Extent", "Values", "Terrain", "Grid", "Multi-layer", "Axis", "Vector", "Analysis"];

/**
 * Mount an operations panel for `layer` into `root`.
 *
 * @param {Element|string} root
 * @param {{ layer: import('../package/layer.js').Layer,
 *           region?: () => (import('../package/filter.js').SpatialFilter|Array|null),
 *           layers?: () => Array<import('../package/layer.js').Layer>,
 *           fim?: import('../package/fimMap.js').FimMap,
 *           open?: string[],
 *           pretty?: boolean,
 *           onApply?: (layer: any, err?: Error) => void,
 *           onResult?: (id: string, data: any) => void }} opts
 * @returns {{ el: Element, ops: string[], destroy: () => void }}
 */
export function createOperationsPanel(root, {
  layer, region, layers, fim, open = ["Extent", "Values"], pretty = false, onApply, onResult,
} = {}) {
  if (!layer) throw new Error("createOperationsPanel: { layer } is required");
  const host = typeof root === "string" ? document.querySelector(root) : root;
  if (!host) throw new Error("createOperationsPanel: target element not found");
  const doc = host.ownerDocument || document;
  const baseSources = layer.sources?.slice() ?? [layer.dataset];   // the pristine sources, for Reset

  // Rasters other than this one — the operand pool for combine/groupBy. A getter, not a snapshot:
  // the host's layer list changes under the panel, and a stale operand list offers layers that are
  // no longer on the map.
  const operands = () => (layers?.() ?? [])
    .filter((l) => l !== layer && l?.dataset && (l.dataset.kind ?? "raster") === "raster");

  const kind = layer.dataset?.kind ?? "raster";
  const ctx = { layer, region, operands, fim };

  const panel = doc.createElement("div");
  panel.className = "fim-ops-panel" + (pretty ? " fim-pretty" : "");
  panel.setAttribute("data-fim-ui", "operations-panel");
  if (pretty) injectStyles(doc);

  const mk = (tag, props = {}, kids = []) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "attrs") for (const [a, av] of Object.entries(v)) e.setAttribute(a, av);
      else e[k] = v;
    }
    for (const k of kids) e.append(k);
    return e;
  };

  async function run(op, action) {
    try {
      if (op.terminal || op.kindChanging) {
        const data = await action();
        if (op.terminal) onResult?.(op.id, data);
        onApply?.(layer);
      } else {
        await layer.deriveSources(([ds]) => [action(ds)], { render: "in-place" });
        onApply?.(layer);
      }
    } catch (err) {
      console.error(`[fimviz] operation ${op.id} failed:`, err);
      onApply?.(layer, err);
    }
  }

  /** Build one field control and a reader for its current value. */
  function field(f, initial) {
    const start = initial?.[f.k] ?? f.value;
    if (f.t === "select") {
      const el = mk("select", { attrs: { "data-field": f.k } },
        f.options.map((o) => mk("option", { value: o, textContent: o })));
      el.value = start ?? f.options[0];
      return [el, () => el.value];
    }
    if (f.t === "layer") {
      const el = mk("select", { attrs: { "data-field": f.k } });
      const refill = () => {
        const keep = el.value;
        el.textContent = "";
        for (const l of operands()) el.append(mk("option", { value: String(l.id), textContent: labelOf(l) }));
        if ([...el.options].some((o) => o.value === keep)) el.value = keep;
      };
      refill();
      el.addEventListener("focus", refill);      // the list can change while the panel is open
      return [el, () => el.value];
    }
    if (f.t === "checkbox") {
      const el = mk("input", { type: "checkbox", checked: !!start, attrs: { "data-field": f.k } });
      return [mk("label", {}, [el, doc.createTextNode(f.label ?? f.k)]), () => el.checked];
    }
    const el = mk("input", {
      type: f.t, placeholder: f.ph ?? f.k, attrs: { "data-field": f.k },
      ...(f.t === "number" ? { step: "any" } : {}),
    });
    if (start != null) el.value = String(start);
    const read = () => (f.t === "number" ? num(el.value) : el.value.trim());
    return [f.label ? mk("label", {}, [doc.createTextNode(f.label), el]) : el, read];
  }

  const rows = [];
  for (const op of OPS) {
    if (op.kind !== kind) continue;
    const initial = op.fill?.(ctx);
    const controls = [];
    const readers = {};
    for (const f of op.fields) {
      const [el, read] = field(f, initial);
      controls.push(el);
      readers[f.k] = read;
    }

    const why = op.enabled ? op.enabled(ctx) : true;
    const btn = mk("button", { textContent: op.button, disabled: why !== true });
    btn.addEventListener("click", () => {
      const v = Object.fromEntries(Object.entries(readers).map(([k, r]) => [k, r()]));
      let action;
      // `run` itself can throw — `reproject('nonsense')` and `rasterize` validate their arguments
      // eagerly, at the call that made the mistake. That has to reach onApply like any other failure.
      try { action = op.run(ctx, v); }
      catch (err) { console.error(`[fimviz] operation ${op.id} failed:`, err); return void onApply?.(layer, err); }
      if (action) run(op, action);
    });

    const row = mk("div", { className: "op", attrs: { "data-op": op.id } }, [
      mk("span", { className: "op-title", textContent: op.title }),
      mk("div", { className: "op-row" }, [...controls, btn]),
      ...(why === true ? [] : [mk("span", { className: "op-note", textContent: why })]),
    ]);
    rows.push([op.group, row]);
  }

  for (const group of GROUP_ORDER) {
    const inGroup = rows.filter(([g]) => g === group).map(([, r]) => r);
    if (!inGroup.length) continue;
    panel.append(mk("details", { open: open.includes(group), className: "op-group", attrs: { "data-group": group } },
      [mk("summary", { textContent: group }), ...inGroup]));
  }

  const resetBtn = mk("button", { className: "sec", textContent: "Reset to original" });
  resetBtn.addEventListener("click", async () => {
    try { await layer.setSources(baseSources, { render: "in-place" }); onApply?.(layer); }
    catch (err) { console.error("[fimviz] reset failed:", err); onApply?.(layer, err); }
  });
  panel.append(mk("div", { className: "op", attrs: { "data-op": "reset" } },
    [mk("div", { className: "op-row" }, [resetBtn])]));

  host.appendChild(panel);

  return {
    el: panel,
    /** The ops actually offered for this layer's kind — the host can tell what it got. */
    get ops() { return rows.map(([, r]) => r.getAttribute("data-op")); },
    destroy: () => panel.remove(),
  };
}

// Kept local rather than imported from layerPanel.js: the operand dropdown needs a short name, and
// importing the panel module for one formatter would couple two independent views.
function labelOf(l) {
  return l?.dataset?.name || l?.name || l?.type || String(l?.id ?? "layer");
}
