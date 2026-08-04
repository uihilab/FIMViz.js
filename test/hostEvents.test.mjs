// The engine → host event seam (package/events.js).
//
// The engine's ONLY outbound channel to a host. Before this, library code called app UI functions
// straight off `window` (window.pushNotification(...), window.loadFileViewerOptions(), …) — the same
// coupling as importing the app, minus any tool's ability to see it, and an unguarded TypeError in
// any host that didn't define those globals.
//
// Two properties are load-bearing and tested here:
//   1. emitted events reach an attached host sink, and
//   2. with NO sink attached nothing throws — that is what makes the engine embeddable headlessly.
//
// The last suite is the regression guard that actually keeps this from creeping back: a source scan
// asserting no engine module calls an app UI global. A unit test can't catch a new `window.foo()`
// added in some branch of a 1200-line upload path; a grep over the source can.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmitter, setHostSink, setErrorSink,
  emitHost, notify, notifyStorageChanged, notifyUploadComplete, reportError,
} from "../src/package/events.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

// Collect events a sink receives, as [evt, payload] pairs.
function recordingSink() {
  const seen = [];
  const em = createEmitter();
  const record = (evt) => em.on(evt, (p) => seen.push([evt, p]));
  for (const evt of ["error", "notify", "storage:changed", "upload:complete", "upload:damage-ready"]) {
    record(evt);
  }
  return { emitter: em, seen };
}

describe("host sink: attached", () => {
  let sink;
  beforeEach(() => { sink = recordingSink(); setHostSink(sink.emitter); });
  afterEach(() => setHostSink(null));

  test("notify carries message + default level", () => {
    notify("hello");
    assert.deepEqual(sink.seen, [["notify", { message: "hello", level: "info", detail: null }]]);
  });

  test("notify accepts an explicit level and detail", () => {
    notify("careful", { level: "warn", detail: { band: 2 } });
    const [, payload] = sink.seen[0];
    assert.equal(payload.level, "warn");
    assert.deepEqual(payload.detail, { band: 2 });
  });

  test("notifyStorageChanged names the logical collection, not a UI function", () => {
    notifyStorageChanged("userFiles");
    assert.deepEqual(sink.seen, [["storage:changed", { store: "userFiles", detail: null }]]);
  });

  test("notifyUploadComplete defaults to the 'default' inlet", () => {
    notifyUploadComplete();
    assert.equal(sink.seen[0][1].target, "default");
    notifyUploadComplete("comparison");
    assert.equal(sink.seen[1][1].target, "comparison");
  });

  test("reportError emits a coded Error on 'error'", () => {
    reportError("gdal-init-failed", "boom");
    const [evt, err] = sink.seen[0];
    assert.equal(evt, "error");
    assert.equal(err.code, "gdal-init-failed");
    assert.match(err.message, /boom/);
  });

  test("emitHost reports whether a sink took it", () => {
    assert.equal(emitHost("upload:damage-ready"), true);
  });

  test("setErrorSink is still the same seam (deprecated alias)", () => {
    assert.equal(setErrorSink, setHostSink);
  });
});

describe("host sink: detached (the headless-embeddability property)", () => {
  beforeEach(() => setHostSink(null));

  test("every emitter is a silent no-op with no host attached", () => {
    // The whole point: an engine embedded without this app's UI must not throw.
    assert.doesNotThrow(() => {
      notify("nobody is listening");
      notifyStorageChanged("userFiles");
      notifyUploadComplete("comparison");
      reportError("boot-failed", "x");
      emitHost("anything");
    });
    assert.equal(emitHost("anything"), false);
  });

  test("a throwing host handler cannot break the engine call that emitted", () => {
    const em = createEmitter();
    em.on("notify", () => { throw new Error("host UI blew up"); });
    setHostSink(em);
    assert.doesNotThrow(() => notify("x"));
  });
});

describe("regression guard: no engine module calls app UI globals", () => {
  // App UI functions the engine used to reach for. This list is the contract — if a future change
  // needs one of these, it needs an event instead.
  const FORBIDDEN = [
    "pushNotification",
    "loadFileViewerOptions",
    "loadFloodExtentFileOptions",
    "loadComparisonLoaderOptions",
    "loadEnsembleDisplayOptions",
    "hideUploadOverlay",
    "hideComparisonUploadOverlay",
    "handleDamageFileUpload",
  ];

  // vendor/ is third-party and arcgislink.js is a vendored Google Maps bridge — not our code.
  const SKIP = new Set(["vendor", "arcgislink.js"]);

  // No exemptions. Reading velocity display options (app checkboxes, a display-source exclusion
  // policy, widget markup) is a host concern; the engine's velocity module exposes only
  // listVelocityPairs().
  const KNOWN_DEBT = new Map();

  function jsFiles(dir, out = []) {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) jsFiles(full, out);
      else if (entry.endsWith(".js")) out.push(full);
    }
    return out;
  }

  // Strip block + line comments so prose ABOUT the retired bridge (this file, events.js) is not
  // mistaken for a call to it. Crude but adequate: we only need call-site fidelity.
  const stripComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

  test("io/fileUpload.js is not engine code", () => {
    // Upload CONTROLLERS (reading widget textboxes, driving overlays, calling into app UI globals)
    // are a host concern and must never live in the engine. The genuinely headless parts are the
    // engine's: geo/tifBounds.js and io/read.js.
    assert.equal(existsSync(join(SRC, "io", "fileUpload.js")), false,
      "upload controllers are app tier — they must not come back into the engine");
    assert.equal(existsSync(join(SRC, "io", "fileUploadSetup.js")), false,
      "drag-drop wiring is app tier too");
    assert.equal(existsSync(join(SRC, "geo", "tifBounds.js")), true,
      "the headless geo maths stayed in the engine");
    assert.equal(existsSync(join(SRC, "io", "read.js")), true,
      "the transport-level file reads stayed in the engine");
  });

  test("no engine module calls an app UI global (beyond the recorded debt)", () => {
    const counts = new Map();
    for (const file of jsFiles(SRC)) {
      const src = stripComments(readFileSync(file, "utf8"));
      const rel = file.slice(SRC.length + 1);
      for (const fn of FORBIDDEN) {
        // Calls only: window.foo(...) or window.foo?.(...).
        const hits = src.match(new RegExp(`window\\.${fn}\\s*(\\?\\.)?\\(`, "g"));
        if (hits) counts.set(rel, (counts.get(rel) || 0) + hits.length);
      }
    }

    const unexpected = [];
    for (const [file, n] of counts) {
      const allowed = KNOWN_DEBT.get(file) ?? 0;
      if (n > allowed) unexpected.push(`${file}: ${n} call(s), ${allowed} allowed`);
    }
    assert.deepEqual(unexpected, [],
      "engine modules must emit host events, not call app UI:\n  " + unexpected.join("\n  "));
  });

  test("no engine module reaches for the app's LayerPanel", () => {
    // Distinct from the call check above: this is a PROPERTY reach (window.layerPanel.fileSpecHtml)
    // — the engine asking an app object to format markup for it. Same coupling, different shape,
    // so the call-only regex above would miss it.
    const offenders = [];
    for (const file of jsFiles(SRC)) {
      const src = stripComments(readFileSync(file, "utf8"));
      if (/window\.layerPanel/.test(src)) offenders.push(file.slice(SRC.length + 1));
    }
    assert.deepEqual(offenders, [],
      "engine modules must emit data for the host to render, not drive window.layerPanel:\n  " +
      offenders.join("\n  "));
  });

  test("NO engine module calls any app function off window", () => {
    // The strongest form of the rule, and the one that actually holds now: not a blocklist of
    // known-bad names, but "the engine calls nothing on window". Anything genuinely global is
    // either a browser API (window.addEventListener) or explicitly allowed below.
    const ALLOWED = new Set([
      "gm_authFailure",   // Google Maps invokes THIS on us; mount.js defines it, never calls it
    ]);
    const offenders = [];
    for (const file of jsFiles(SRC)) {
      const src = stripComments(readFileSync(file, "utf8"));
      for (const m of src.matchAll(/window\.([A-Za-z_]\w*)\s*(\?\.)?\(/g)) {
        if (!ALLOWED.has(m[1])) offenders.push(`${file.slice(SRC.length + 1)} → window.${m[1]}()`);
      }
    }
    assert.deepEqual(offenders, [],
      "the engine must emit host events, not call app functions:\n  " + offenders.join("\n  "));
  });

  test("velocity.js renders what it is handed and touches no storage or UI", () => {
    const src = readFileSync(join(SRC, "layers", "velocity.js"), "utf8");
    assert.match(src, /export async function renderVelocityLayer/,
      "the engine draws the buffers it is given");
    assert.equal(/export async function loadVelocityDisplayOptions/.test(src), false,
      "list UI belongs in ui/velocityTools.js");
    assert.equal(src.includes("cbox-tooltip"), false,
      "widget markup must not be generated in the engine");
    assert.equal(src.includes("filesVelocityMetadata"), false,
      "naming a table is host schema — the engine must not know this app's store names");
    assert.equal(/from ["'].*io\/db\.js["']/.test(src), false,
      "the app's file-store facade is app tier");
  });

  test("NO engine module names any database or table", () => {
    // The rule the library states in io/storage.js: "the host supplies the database name, the table
    // names and the keys". A store name or table name (even one that sounds generic, like a domain
    // adapter's store or a `_migrations` table) hardcoded in engine code violates that rule.
    //
    // `_migrations` is in this list deliberately: a table the LIBRARY invents is still a table the
    // library named — exactly the kind of leak this guard exists to catch.
    const APP_NAMES = ["fimviz-store", "toolbox-store", "filesMetadata", "filesVelocityMetadata",
                       "filesCompareMetadata", "filesDamageMetadata", "filesDepthMetadata",
                       "_migrations"];
    const offenders = [];
    for (const file of jsFiles(SRC)) {
      const src = stripComments(readFileSync(file, "utf8"));
      for (const name of APP_NAMES) {
        if (src.includes(name)) offenders.push(`${file.slice(SRC.length + 1)} → "${name}"`);
      }
    }
    assert.deepEqual(offenders, [],
      "engine must not name a host database/table:\n  " + offenders.join("\n  "));
  });
});

describe("the engine never resolves its FimMap from the ambient default app", () => {
  // `FimViz.current()?.maps?.[0]` hardcodes the DEFAULT app's FIRST map. It is correct only while
  // exactly one widget exists, and because every such site is optional-chained it fails SILENTLY —
  // a second mounted widget makes the call a no-op rather than an error. Engine code resolves its
  // instance from the provider map it was handed (`fimForMap`) or from `layer._map` instead.
  //
  // A unit test cannot catch a new one added inside a 500-line overlay path; a source scan can.
  const ENGINE = new URL("../src/", import.meta.url);
  const files = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
      if (e.isDirectory()) { if (e.name !== "vendor") walk(p); }
      else if (e.name.endsWith(".js")) files.push(p);
    }
  })(ENGINE);

  test("no engine module calls FimViz.current()", () => {
    const offenders = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      src.split("\n").forEach((line, i) => {
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
        if (/FimViz\s*\.\s*current\s*\(/.test(line)) {
          offenders.push(`${f.pathname.split("/src/")[1]}:${i + 1}`);
        }
      });
    }
    assert.deepEqual(offenders, [],
      "resolve the FimMap from fimForMap(providerMap) or layer._map, not the ambient default app");
  });

  // The same failure in the DOM direction. The overlay layers used to write host markup by id
  // (#loading-indicator, #tif-depth-hover-value, #ExtentLegend, #droughtLegend, #depth-legend,
  // #maptypes) through dom.js's ambient scope. Two things were wrong with that: those ids are one
  // deployment's chrome, so the engine did nothing at all in any other host while looking portable;
  // and the scope is a module-level global set by whichever mount ran last.
  //
  // The engine now EMITS (busy / hover / rendered / removed) and the host renders. `scoped(root)`
  // and `scopedSel` stay fair game — they take an explicit root, which is the point.
  test("no engine module reads the ambient DOM scope", () => {
    const AMBIENT = /\b(domId|domQs|domQsa|setActiveDom|resetActiveDom)\s*\(/;
    const offenders = [];
    for (const f of files) {
      const rel = f.pathname.split("/src/")[1];
      if (rel === "package/dom.js") continue;              // where they are defined
      const src = readFileSync(f, "utf8");
      src.split("\n").forEach((line, i) => {
        const t = line.trimStart();
        if (t.startsWith("//") || t.startsWith("*")) return;
        if (AMBIENT.test(line)) offenders.push(`${rel}:${i + 1}  ${t}`);
      });
    }
    assert.deepEqual(offenders, [],
      "emit the data and let the host render it — the engine must not name host markup, " +
      "and the ambient scope belongs to the app that owns those elements");
  });
});
