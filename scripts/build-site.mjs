// build-site.mjs — render the markdown guides, then assemble the GitHub Pages site into .site/
//
// The repository root IS the site: `index.html`, `site.css`, `examples/`, `dist/`, `assets/`, the
// generated `guides/` and the generated `api/` all sit where the pages expect them, so `npx serve .`
// serves the real thing — every link, including the API reference and the guides. `.site/` is then
// just that same tree with the parts the public site does not need (src/, test/, docs/, vendor/,
// node_modules beyond the one external reader) left out.
//
// `guides/` and `api/` are build output and gitignored, like `dist/`.
//
// Run order matters — typedoc writes `api/`, and this copies it, so typedoc goes FIRST:
//     npm run build && npm run docs:site && node scripts/build-site.mjs
// which is what `npm run site` does.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".site");
const REPO = "https://github.com/uihilab/FIMViz.js";
const BLOB = `${REPO}/blob/main`;
const LAB = "https://hydroinformatics.tulane.edu";
const TULANE = "https://tulane.edu";

const r = (...p) => join(ROOT, ...p);
const o = (...p) => join(OUT, ...p);

// ── what gets rendered, in sidebar order ──────────────────────────────────────────────────────
// `src` is repo-relative (it is also the key link rewriting resolves against); `slug` is the page
// name under /guides/.
const GUIDES = [
  { group: "Usage guides", src: "docs/usage/USAGE.md", slug: "usage", title: "Overview" },
  { group: "Usage guides", src: "docs/usage/APP_STARTUP.md", slug: "app-startup", title: "App startup" },
  { group: "Usage guides", src: "docs/usage/APP_STARTUP_ADVANCED.md", slug: "app-startup-advanced", title: "…advanced" },
  { group: "Usage guides", src: "docs/usage/DATASET_OPERATIONS.md", slug: "dataset-operations", title: "Dataset operations" },
  { group: "Usage guides", src: "docs/usage/LAYERS.md", slug: "layers", title: "Layers" },
  { group: "Usage guides", src: "docs/usage/LAYER_SUBTYPES.md", slug: "layer-subtypes", title: "Layer subtypes" },
  { group: "Usage guides", src: "docs/usage/COLOR_SCALE.md", slug: "color-scale", title: "ColorScale" },
  { group: "Usage guides", src: "docs/usage/LEGEND.md", slug: "legend", title: "Legend" },
  { group: "Usage guides", src: "docs/usage/STORAGE.md", slug: "storage", title: "Storage" },
  { group: "Usage guides", src: "docs/usage/UI.md", slug: "ui", title: "UI module" },
  { group: "Usage guides", src: "docs/usage/test.md", slug: "console-snippets", title: "Console snippets" },
  { group: "Design & direction", src: "docs/CLASS_DIAGRAM.md", slug: "class-diagram", title: "Class diagram" },
  { group: "Design & direction", src: "docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md", slug: "decisions", title: "Decisions & tradeoffs" },
  { group: "Design & direction", src: "docs/PACKAGE_ROADMAP.md", slug: "roadmap", title: "Package roadmap" },
  { group: "Design & direction", src: "docs/CASE_STUDIES.md", slug: "case-studies", title: "Case studies" },
];
const BY_SRC = new Map(GUIDES.map((g) => [g.src, g]));

// ── link rewriting ────────────────────────────────────────────────────────────────────────────
//
// The markdown was written to be read in the repo, so its links point at sibling .md files, at
// docs/api/*.md, at examples/*.html and at src/*.js. Each of those has a different home on the site.

// docs/api/package/colorScale/classes/ColorScale.md → api/classes/package_colorScale.ColorScale.html
const API_KIND = { classes: "classes", functions: "functions", interfaces: "interfaces", variables: "variables", "type-aliases": "types" };
function apiTarget(path) {
  const parts = path.slice("docs/api/".length).replace(/\.md$/, "").split("/");
  const name = parts.pop(), kind = API_KIND[parts.pop()];
  if (!kind || !name || !parts.length) return "../api/index.html";
  return `../api/${kind}/${parts.join("_")}.${name}.html`;
}

function rewriteHref(href, fromSrc) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [pathPart, anchor = ""] = href.split(/(?=#)/);
  if (!pathPart) return href;
  const target = posix.normalize(posix.join(posix.dirname(fromSrc), pathPart)).replace(/^\.\//, "");

  const guide = BY_SRC.get(target) || BY_SRC.get(target.replace(/\/$/, ""));
  if (guide) return `./${guide.slug}.html${anchor}`;
  if (target === "README.md") return `../index.html${anchor}`;
  if (target.startsWith("docs/api")) return target.endsWith(".md") ? apiTarget(target) + anchor : "../api/index.html";
  if (target === "docs/usage" || target === "docs/usage/") return "./usage.html";
  // Any OTHER markdown — examples/README.md, a doc nobody rendered — would be served as plain text,
  // so it goes to GitHub, which renders it.
  if (target.endsWith(".md")) return `${BLOB}/${target}${anchor}`;
  if (target.startsWith("examples/")) return `../${target}${anchor}`;
  if (target.startsWith("assets/")) return `../${target}${anchor}`;
  return `${BLOB}/${target}${anchor}`;   // src/, test/, vendor/, anything else — read it on GitHub
}

// ── heading ids, GitHub's way, so the docs' own in-page anchors keep working ───────────────────
function slugger() {
  const seen = new Map();
  return (text) => {
    // GitHub's algorithm, which is what the documents' own anchors were written against: drop tags
    // and punctuation, lowercase, spaces to hyphens. Entities are dropped rather than turned into a
    // space — marked escapes an apostrophe to `&#39;`, and "aren't" has to slug as "arent".
    const base = text
      .replace(/<[^>]*>/g, "")
      .replace(/&[a-z]+;|&#\d+;/gi, "")
      .toLowerCase()
      .replace(/[^\w\- ]+/g, "")
      .replace(/ /g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

// ── the page shell ────────────────────────────────────────────────────────────────────────────
// The sidebar lists the current page's OWN group and nothing else: someone reading how to use a
// ColorScale is not shopping for the roadmap, and mixing fifteen entries from two unrelated shelves
// makes the list harder to scan for either audience. The other group is one line at the bottom.
function nav(current) {
  const here = GUIDES.find((g) => g.slug === current);
  const siblings = GUIDES.filter((g) => g.group === here.group);
  const others = [...new Set(GUIDES.map((g) => g.group))].filter((x) => x !== here.group);

  let html = `<h4>${here.group}</h4>`;
  for (const g of siblings) {
    html += `<a href="./${g.slug}.html"${g.slug === current ? ' class="current"' : ""}>${g.title}</a>`;
  }
  for (const group of others) {
    const first = GUIDES.find((g) => g.group === group);
    html += `<h4>${group}</h4><a href="./${first.slug}.html">${first.title} →</a>`;
  }
  return html;
}

// The shared chrome. `p` is the prefix back to the site root, so the same markup serves a page at any
// depth — the guides pass "../", the landing page inlines the same block with "".
export const topbar = (p, guidesHref = `${p}guides/usage.html`) => `<header class="topbar">
  <div class="wrap">
    <a class="brand" href="${p}index.html">FIM<span>Viz</span>.js</a>
    <nav>
      <a href="${p}examples/01-quickstart.html">Examples</a>
      <a href="${guidesHref}">Guides</a>
      <a href="${p}api/index.html">API</a>
      <a href="${REPO}">GitHub</a>
    </nav>
  </div>
</header>`;

export const footer = (p) => `<footer class="site">
  <div class="wrap">
    <a class="lab" href="${LAB}" title="Hydroinformatics Lab">
      <img src="${p}assets/brand/hilab-logo.png" alt="Hydroinformatics Lab" />
    </a>
    <div class="colophon">
      <b>FIMViz.js</b> — a headless flood-inundation-map visualization engine, built by the
      <a href="${LAB}">Hydroinformatics Lab</a> at <a href="${TULANE}">Tulane University</a>.
    </div>
  </div>
</footer>`;

const shell = (guide, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${guide.title} — FIMViz.js</title>
<link rel="icon" href="../assets/brand/favicon.png" />
<link rel="stylesheet" href="../site.css" />
</head>
<body>
${topbar("../", "./usage.html")}
<div class="wrap guide">
  <aside>${nav(guide.slug)}</aside>
  <main class="doc">${body}</main>
</div>
${footer("../")}
</body>
</html>
`;

// ── render one guide ──────────────────────────────────────────────────────────────────────────
function renderGuide(guide) {
  const md = readFileSync(r(guide.src), "utf8");
  let html = marked.parse(md, { gfm: true, async: false });

  const slug = slugger();
  html = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, lvl, inner) =>
    `<h${lvl} id="${slug(inner)}">${inner}</h${lvl}>`);

  html = html.replace(/href="([^"]*)"/g, (_, href) => `href="${rewriteHref(href, guide.src)}"`);

  // Mermaid blocks stay as source: rendering them would mean shipping a diagram library, and these
  // documents are still read on GitHub, which draws them.
  html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, code) => `<figure class="mermaid-src"><figcaption>Mermaid diagram source — GitHub renders it` +
      ` <a href="${BLOB}/${guide.src}">here</a></figcaption><pre><code>${code}</code></pre></figure>`);

  writeFileSync(r("guides", `${guide.slug}.html`), shell(guide, html));
}

// ── 1 · render the guides into the repo root, where the site lives ────────────────────────────
if (!existsSync(r("dist", "fimviz.js"))) {
  console.error("build-site: dist/fimviz.js is missing — run `npm run build` first.");
  process.exit(1);
}
if (!existsSync(r("api", "index.html"))) {
  console.error("build-site: api/ is missing — run `npm run docs:site` first (or just `npm run site`).");
  process.exit(1);
}

rmSync(r("guides"), { recursive: true, force: true });
mkdirSync(r("guides"), { recursive: true });
for (const g of GUIDES) renderGuide(g);

// ── 1b · point typedoc's chrome back at the site ──────────────────────────────────────────────
//
// typedoc emits `navigationLinks`, `titleLink` and `customFooterHtml` VERBATIM on every page, so a
// relative path in them is correct at exactly one depth and broken everywhere else — `../index.html`
// from api/classes/Foo.html resolves to api/index.html. The options carry a `__SITE__` token instead,
// and this rewrites it per file to the right number of `../` hops.
function rewriteApiChrome(dir = r("api"), depth = 0) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) { rewriteApiChrome(p, depth + 1); continue; }
    if (!entry.name.endsWith(".html")) continue;
    const prefix = "../".repeat(depth + 1);            // api/ itself is one level below the site root
    const src = readFileSync(p, "utf8");
    if (!src.includes("__SITE__/")) continue;
    writeFileSync(p, src.replaceAll("__SITE__/", prefix));
  }
}
rewriteApiChrome();

// ── 2 · assemble the publishable subset ───────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const copy = (from, to) => cpSync(r(from), o(to ?? from), { recursive: true });
copy("index.html");
copy("site.css");
copy("examples");
copy("guides");
copy("api");
copy("assets/brand");

// dist, minus the .d.ts tree — the site serves the bundles, not the types.
cpSync(r("dist"), o("dist"), { recursive: true, filter: (src) => !src.includes(`${sep}types`) });

// Only the sample data the pages actually name, scanned out of the pages themselves so the list
// cannot drift. Copying the whole of assets/SampleFiles would publish ~9 MB nothing links to.
const wanted = new Set();
for (const page of ["index.html", ...readdirSync(r("examples")).filter((f) => f.endsWith(".html")).map((f) => `examples/${f}`)]) {
  const html = readFileSync(r(page), "utf8");
  for (const re of [/assets\/SampleFiles\/([^"'`)\s]+)/g, /sample[A-Za-z]*\("([^"]+)"\)/g, /data-file="([^"]+)"/g]) {
    for (const m of html.matchAll(re)) if (!m[1].includes("$")) wanted.add(m[1]);
  }
}
mkdirSync(o("assets/SampleFiles"), { recursive: true });
let bytes = 0;
for (const name of [...wanted].sort()) {
  if (!existsSync(r("assets/SampleFiles", name))) {
    console.error(`build-site: a page references assets/SampleFiles/${name}, which does not exist.`);
    process.exit(1);
  }
  copy(`assets/SampleFiles/${name}`);
  bytes += statSync(r("assets/SampleFiles", name)).size;
}

// The multi-dimensional reader is deliberately not bundled, and examples/04-temporal.html resolves it
// through an import map at ../node_modules/sciwrid-toolkit/dist/index.js. Copying it to the SAME
// relative path means that page needs no site-specific edit, and behaves identically served locally.
copy("node_modules/sciwrid-toolkit/dist", "node_modules/sciwrid-toolkit/dist");

// Pages runs Jekyll over the artifact unless told not to; Jekyll ignores directories starting with
// an underscore and would try to interpret Liquid syntax inside our HTML.
writeFileSync(o(".nojekyll"), "");

const kb = (p) => `${(statSync(o(p)).size / 1024).toFixed(0)} KB`;
const count = (d) => readdirSync(o(d)).filter((f) => f.endsWith(".html")).length;
console.log(`site → ${relative(ROOT, OUT)}   (and served identically from the repo root)`);
console.log(`  index.html + site.css`);
console.log(`  examples/   ${count("examples")} pages`);
console.log(`  guides/     ${count("guides")} rendered from markdown`);
console.log(`  api/        ${count("api/classes")} classes, generated by typedoc`);
console.log(`  dist/       fimviz.js ${kb("dist/fimviz.js")}, ui.js ${kb("dist/ui.js")}`);
console.log(`  assets/     ${wanted.size} sample files the pages name, ${(bytes / 1048576).toFixed(1)} MB`);
