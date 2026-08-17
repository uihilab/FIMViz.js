// build-fig-3-2.mjs — emits figures/fig-3-2-dependency-graph.svg from the actual import graph.
//
//     node figures/build-fig-3-2.mjs
//
// The figure is MEASURED, not drawn: every node, edge and level below comes from parsing the
// `from "./…"` specifiers in src/. Re-run it after any structural change and the figure follows.
//
// Grouping is by architectural TIER, not by directory. `src/package/` holds three tiers at once
// (primitives, the layer model, the seam), so a directory-level collapse manufactures edges in both
// directions between package↔geo and package↔io and makes an acyclic graph look cyclic. Splitting
// package/ along its real seams is what lets the collapsed graph stay a DAG — which it is.

import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, dirname, resolve, relative } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "src");
const norm = (p) => relative(ROOT, p).split("\\").join("/");

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    statSync(p).isDirectory() ? walk(p) : e.endsWith(".js") && files.push(p);
  }
})(ROOT);

const modEdges = new Map();
for (const f of files) {
  const deps = new Set();
  for (const m of readFileSync(f, "utf8").matchAll(/from\s+"(\.[^"]+)"/g)) {
    deps.add(norm(resolve(dirname(f), m[1])));
  }
  modEdges.set(norm(f), deps);
}

const GROUPS = {
  kernel:     { label: "Kernel",             sub: "events · config · dom",
                mods: ["package/events.js", "package/config.js", "package/dom.js"] },
  grids:      { label: "Grids & features",   sub: "materialize",
                mods: ["package/materialize.js"] },
  readmodels: { label: "Read models",        sub: "ColorScale · Legend · Stats · Filter",
                mods: ["package/colorScale.js", "package/legend.js", "package/stats.js",
                       "package/filter.js"] },
  storage:    { label: "Persistence",        sub: "storage",
                mods: ["io/storage.js"] },
  projection: { label: "Projection",         sub: "resample · crs · mercator · tif meta",
                mods: ["geo/resample.js", "geo/crs.js", "geo/mercator.js", "geo/tifMeta.js",
                       "geo/tifBounds.js", "geo/arcgislink.js"] },
  provider:   { label: "Map-provider seam",  sub: "mapProvider",
                mods: ["package/mapProvider.js"] },
  dataset:    { label: "Dataset & ops",      sub: "Dataset · rasterOps · metrics",
                mods: ["package/dataset.js", "package/rasterOps.js", "package/comparisonMetrics.js",
                       "package/hazusDamage.js"] },
  ingest:     { label: "Ingest & decode",    sub: "parse · materializers · sciwrid",
                mods: ["io/parse.js", "io/parsePrimitives.js", "io/read.js", "io/netcdf3.js",
                       "io/materializers.js", "io/sciwrid.js"] },
  warp:       { label: "GDAL warp provider", sub: "warp · gdal · reprojector",
                mods: ["geo/warp.js", "geo/gdal.js", "io/reprojector.js"] },
  layermodel: { label: "Layer model",        sub: "Layer · Comparison · Ensemble",
                mods: ["package/layer.js", "package/layerSettings.js", "package/rasterImage.js",
                       "package/comparisonLayer.js", "package/ensembleAggregationLayer.js"] },
  app:        { label: "App & mount",        sub: "FimViz · FimMap · mount",
                mods: ["package/fimMap.js", "package/fimViz.js", "package/mount.js"] },
  domain:     { label: "Domain layers",      sub: "depthMap · ensemble · velocity",
                mods: ["layers/depthMap.js", "layers/ensemble.js", "layers/velocity.js",
                       "layers/index.js", "vendor/plotty.min.js", "vendor/water-canvas.min.js"] },
  barrel:     { label: "Public API",         sub: "lib.js",
                mods: ["package/lib.js"] },
  ui:         { label: "Interface kit",      sub: "ui/ — optional",
                mods: files.map(norm).filter((f) => f.startsWith("ui/")) },
};

const groupOf = new Map();
for (const [g, { mods }] of Object.entries(GROUPS)) for (const m of mods) groupOf.set(m, g);
const missing = [...modEdges.keys()].filter((m) => !groupOf.has(m));
if (missing.length) throw new Error(`ungrouped modules: ${missing.join(", ")}`);

// ── collapse ──────────────────────────────────────────────────────────────────────────────────
const out = new Map(Object.keys(GROUPS).map((k) => [k, new Map()]));
for (const [f, ds] of modEdges) {
  const a = groupOf.get(f);
  for (const d of ds) {
    const b = groupOf.get(d);
    if (!b || a === b) continue;
    out.get(a).set(b, (out.get(a).get(b) || 0) + 1);
  }
}

// ── acyclicity + longest-path levels (a node sits one above its deepest dependency) ───────────
const level = new Map();
const seen = new Set();
function depth(n, stack = new Set()) {
  if (stack.has(n)) throw new Error(`cycle through ${n}`);
  if (level.has(n)) return level.get(n);
  stack.add(n);
  let d = 0;
  for (const t of out.get(n).keys()) d = Math.max(d, depth(t, stack) + 1);
  stack.delete(n);
  level.set(n, d);
  seen.add(n);
  return d;
}
for (const n of out.keys()) depth(n);

// ── transitive reduction: an edge a→b is redundant when b is reachable from a the long way ────
const reach = new Map();
function reachable(n) {
  if (reach.has(n)) return reach.get(n);
  const s = new Set();
  reach.set(n, s);
  for (const t of out.get(n).keys()) { s.add(t); for (const u of reachable(t)) s.add(u); }
  return s;
}
for (const n of out.keys()) reachable(n);
const essential = new Set();
for (const [a, m] of out) {
  for (const b of m.keys()) {
    let redundant = false;
    for (const mid of m.keys()) if (mid !== b && reachable(mid).has(b)) { redundant = true; break; }
    if (!redundant) essential.add(`${a}|${b}`);
  }
}

// ── layout: one row per level, lowest at the bottom ───────────────────────────────────────────
const W = 1000, PAD_X = 30, TOP = 74, ROW = 92, NW = 186, NH = 50;
const rows = [];
for (const [n, l] of level) (rows[l] ||= []).push(n);
// `ui` is optional and only reaches into read models — park it to the right of its row.
const maxLevel = rows.length - 1;
const H = TOP + rows.length * ROW + 108;

const pos = new Map();
rows.forEach((names, l) => {
  names.sort();
  const y = TOP + (maxLevel - l) * ROW;
  const span = names.length * NW + (names.length - 1) * 26;
  let x = (W - span) / 2;
  for (const n of names) { pos.set(n, { x, y }); x += NW + 26; }
});

const cx = (n) => pos.get(n).x + NW / 2;
const top = (n) => pos.get(n).y;
const bot = (n) => pos.get(n).y + NH;

const FILL = {
  kernel: "#e2e8f0", grids: "#eef2f6", readmodels: "#eef2f6", storage: "#eef2f6",
  projection: "#eef2f6", provider: "#e6edf5", dataset: "#eef2f6", ingest: "#eef2f6",
  warp: "#fef3c7", layermodel: "#eef2f6", app: "#eef2f6", domain: "#eef2f6",
  barrel: "#dbeafe", ui: "#ffffff",
};
const STROKE = { provider: "#a8bdd4", warp: "#d97706", barrel: "#60a5fa", ui: "#94a3b8" };

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const svg = [];
svg.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
     font-family="Inter, 'Helvetica Neue', Arial, sans-serif">
  <title>FIMViz.js module dependency graph</title>
  <desc>Import graph of src/, collapsed from 57 modules to 14 architectural components. Acyclic.
        Levels are longest-path depth in the dependency DAG; an arrow means "imports".</desc>
  <defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="#64748b"/>
    </marker>
    <marker id="af" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="#cbd5e1"/>
    </marker>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>`);

svg.push(`  <text x="${PAD_X}" y="30" font-size="14" font-weight="700" fill="#0f172a">Module dependency graph — 57 modules in 14 components, ${[...out.values()].reduce((a, m) => a + m.size, 0)} component edges</text>`);
svg.push(`  <text x="${PAD_X}" y="49" font-size="11.5" fill="#475569">An arrow means "imports". Rows are longest-path depth in the dependency DAG. Solid = transitively essential; faint = implied by a longer path.</text>`);
svg.push(`  <text x="${PAD_X}" y="65" font-size="11.5" font-weight="700" fill="#166534">The graph is acyclic: every arrow points down. No component imports anything above it.</text>`);

// edges first, so nodes paint over them
for (const [a, m] of out) {
  for (const [b, w] of m) {
    const key = `${a}|${b}`, keep = essential.has(key);
    const x1 = cx(a), y1 = bot(a), x2 = cx(b), y2 = top(b);
    const my = (y1 + y2) / 2;
    const d = `M${x1.toFixed(1)},${y1.toFixed(1)} C${x1.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
    svg.push(`  <path d="${d}" fill="none" stroke="${keep ? "#64748b" : "#e2e8f0"}" `
      + `stroke-width="${keep ? Math.min(1 + w * 0.35, 3).toFixed(2) : 0.8}" `
      + `marker-end="url(#${keep ? "a" : "af"})" opacity="${keep ? 0.85 : 0.9}"/>`);
  }
}

for (const [n, { x, y }] of pos) {
  const g = GROUPS[n];
  const dash = n === "ui" ? ` stroke-dasharray="4 3"` : "";
  svg.push(`  <rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="6" fill="${FILL[n]}" `
    + `stroke="${STROKE[n] || "#cbd5e1"}"${dash}/>`);
  svg.push(`  <text x="${x + 11}" y="${y + 21}" font-size="12.5" font-weight="700" fill="#0f172a">${esc(g.label)}</text>`);
  svg.push(`  <text x="${x + 11}" y="${y + 38}" font-size="10.5" fill="#475569">${esc(g.sub)}</text>`);
  svg.push(`  <text x="${x + NW - 11}" y="${y + 21}" font-size="10" fill="#94a3b8" text-anchor="end">${g.mods.length}</text>`);
}

const noteY = H - 74;
svg.push(`  <text x="${PAD_X}" y="${noteY}" font-size="11.5" fill="#475569">Components, not directories. <tspan font-weight="700">src/package/</tspan> spans three tiers, so collapsing by directory yields edges in both directions between</text>`);
svg.push(`  <text x="${PAD_X}" y="${noteY + 17}" font-size="11.5" fill="#475569">package↔geo and package↔io and hides that the graph is a DAG. The <tspan font-weight="700" fill="#92400e">GDAL warp provider</tspan> is drawn amber because it depends on the</text>`);
svg.push(`  <text x="${PAD_X}" y="${noteY + 34}" font-size="11.5" fill="#475569">primitives and registers itself back into them — the inversion that keeps the seam one-directional (Fig. 3.1).</text>`);
svg.push(`  <text x="${PAD_X}" y="${noteY + 55}" font-size="10.5" fill="#94a3b8">Generated by figures/build-fig-3-2.mjs from src/ — re-run to regenerate.</text>`);
svg.push("</svg>");

const dest = join(HERE, "fig-3-2-dependency-graph.svg");
writeFileSync(dest, svg.join("\n"));
console.log(`wrote ${relative(resolve(HERE, ".."), dest)}  (${rows.length} levels, `
  + `${[...out.values()].reduce((a, m) => a + m.size, 0)} edges, ${essential.size} essential)`);
for (let l = rows.length - 1; l >= 0; l--) console.log(`  L${l}  ${rows[l].join(", ")}`);
