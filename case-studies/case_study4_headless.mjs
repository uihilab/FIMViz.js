// case_study4_headless.mjs — host #4 of Case Study 4: the engine with no DOM.
//
//     node case-studies/case_study4_headless.mjs
//
// Writes case-studies/out/depth.png and out/extent.png, and prints the reuse and persistence
// measurements the browser page reports too.
//
// WHAT THIS HOST HAD TO WORK AROUND, all of it findable only by trying:
//
//   1. `../src/package/lib.js` — the public entry — cannot be imported under Node at all. It does
//      `export { Loader } from "@googlemaps/js-api-loader"`, which is CJS with no named ESM export,
//      so the import throws before any user code runs. Deep imports are the only way in.
//   2. `ds.reproject()` needs a reprojector. The built-in default resolves gdal3.js to that
//      package's BROWSER build and throws `sn.readFileSync is not a function` here. gdal3.node.js
//      ships alongside it and works, so the fix is to register it through the public seam.
//   3. `gridToDataURL()` calls `document.createElement("canvas")` (rasterImage.js:61) and cannot run
//      headless. `colorizeGrid()` — the half that turns values into RGBA — is DOM-free, so the host
//      keeps that and encodes the PNG itself. The ~40 lines at the bottom of this file are the
//      measure of that gap.
//
// None of the three is a capability the engine lacks. All three are packaging.

import { createRequire } from "module";
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { deflateSync, crc32 } from "zlib";
import { fromArrayBuffer } from "geotiff";

import { Dataset } from "../src/package/dataset.js";
import { RasterGrid } from "../src/package/materialize.js";
import { parseSource } from "../src/io/parse.js";
import { registerBuiltinMaterializers } from "../src/io/materializers.js";
import { colorizeGrid } from "../src/package/rasterImage.js";
import { ColorScale } from "../src/package/colorScale.js";
import { Stats } from "../src/package/stats.js";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SAMPLES = join(ROOT, "assets", "SampleFiles");
const OUT = join(HERE, "out");

// ── workaround 2: a Node-backed reprojector through the public seam ────────────────────────────
let _gdal = null;
const gdal = async () => _gdal ??= await require("gdal3.js/dist/package/gdal3.node.js")(
  { path: relative(process.cwd(), join(ROOT, "node_modules/gdal3.js/dist/package")) });

async function nodeReproject(grid, toCrs, ctx = {}) {
  const g = await gdal();
  const tmp = join(tmpdir(), `cs4-${process.pid}-${Math.random().toString(36).slice(2)}.tif`);
  writeFileSync(tmp, Buffer.from(ctx.source));
  const { datasets } = await g.open(tmp);
  const out = await g.gdalwarp(datasets[0], ["-of", "GTiff", "-t_srs", toCrs, "-r", "near"], "w.tif");
  const b = await g.getFileBytes(out);
  rmSync(tmp, { force: true });
  const ab = b instanceof Uint8Array ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b;
  const img = await (await fromArrayBuffer(ab)).getImage();
  const [west, south, east, north] = img.getBoundingBox();
  const r = await img.readRasters();
  return new RasterGrid({
    pixels: Array.isArray(r) ? r[0] : r, width: img.getWidth(), height: img.getHeight(),
    bounds: { north, south, east, west }, crs: toCrs, noData: grid.noData,
    meta: { ...grid.meta, reprojectedFrom: grid.crs },
  });
}

// ── workaround 3: the PNG encoder the engine's DOM-bound half would have provided ──────────────
function encodePng(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;                                  // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4)
      .copy(raw, y * (width * 4 + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** colorizeGrid (DOM-free) → RGBA → PNG on disk. The engine does the colour, the host does the file. */
function writePng(grid, scale, name) {
  const rgba = colorizeGrid(grid, { colorScale: scale });
  const png = encodePng(rgba, grid.width, grid.height);
  writeFileSync(join(OUT, name), png);
  return png.length;
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────
const file = (p, n) => new File([readFileSync(p)], n, { type: "image/tiff" });
const ms = (t0) => `${(performance.now() - t0).toFixed(1)} ms`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  registerBuiltinMaterializers();
  Dataset.registerReprojector(nodeReproject);

  console.log(`Case Study 4 — headless host (${process.version})\n`);
  const host = { loc: 0, deps_added: 0, registries_touched: [], engine_css: false };

  // 1 · ingest + warp
  let t0 = performance.now();
  const depth = await parseSource(file(join(SAMPLES, "Brazos_RP100_depth.tif"), "Brazos_RP100_depth.tif"));
  console.log(`  parse depth              ${ms(t0)}   crs=${depth.crs}`);
  t0 = performance.now();
  const warped = await depth.reproject("EPSG:4326").grid();
  console.log(`  warp 26914 → 4326        ${ms(t0)}   ${warped.width}x${warped.height}`);
  host.registries_touched.push("reprojector");

  const s = Stats.raster(warped.pixels, {
    bw: warped.bounds.west, bs: warped.bounds.south, be: warped.bounds.east, bn: warped.bounds.north,
    width: warped.width, height: warped.height, noData: warped.noData,
  }, { bins: 32 });
  console.log(`  depth stats              min ${s.min.toFixed(2)}  mean ${s.mean.toFixed(2)}  max ${s.max.toFixed(2)}  n ${s.count}`);

  // 2 · the reuse measurement: M derived layers from ONE decode against M naive re-decodes
  const THRESHOLDS = [0.1, 0.5, 1, 2, 3, 4];
  t0 = performance.now();
  const src = await parseSource(file(join(SAMPLES, "Brazos_RP100_depth.tif"), "d.tif"));
  await src.grid();
  for (const th of THRESHOLDS) await src.reclassify([{ min: th, value: 1 }]).grid();
  const oneDecode = performance.now() - t0;

  t0 = performance.now();
  for (const th of THRESHOLDS) {
    const fresh = await parseSource(file(join(SAMPLES, "Brazos_RP100_depth.tif"), "d.tif"));
    await fresh.reclassify([{ min: th, value: 1 }]).grid();
  }
  const naive = performance.now() - t0;
  console.log(`\n  reuse: ${THRESHOLDS.length} layers, one decode   ${oneDecode.toFixed(1)} ms`);
  console.log(`         ${THRESHOLDS.length} layers, ${THRESHOLDS.length} decodes  ${naive.toFixed(1)} ms   → ${(naive / oneDecode).toFixed(2)}x`);
  console.log(`         (the payoff scales with decode cost — this raster is 698 kB; a 6 MB one is ~67x heavier to decode)`);

  // 3 · persistence, and the collision the protocol does not anticipate
  const plain = src.reclassify([{ min: 1, value: 1 }]);
  let recipe = null, recipeErr = null;
  try { recipe = plain.toRecord(); } catch (e) { recipeErr = e.message; }
  const decodedBytes = (await src.grid()).pixels.byteLength;
  if (recipe) {
    const bytes = JSON.stringify(recipe).length;
    console.log(`\n  toRecord (range rules)   ${bytes} B recipe vs ${decodedBytes} B decoded  → ${(decodedBytes / bytes).toFixed(0)}x`);
    t0 = performance.now();
    const back = Dataset.fromRecord(recipe);
    console.log(`  fromRecord + force       ${ms(t0)}  (rehydrated ${back.name ?? "dataset"})`);
  } else {
    console.log(`\n  toRecord (range rules)   FAILED: ${recipeErr}`);
  }

  // A CALLBACK reclassify is the only way to do band math outside combine's fixed op list
  // (difference/ratio/sum/mean/min/max) — velocity magnitude, for instance. It also cannot be
  // persisted, so a composed scene containing one is unsaveable. Composition and persistence
  // collide, and nothing in the protocol anticipates it.
  const viaCallback = src.reclassify((v) => Math.sqrt(v));
  try {
    viaCallback.toRecord();
    console.log(`  toRecord (callback)      unexpectedly SUCCEEDED`);
  } catch (e) {
    console.log(`  toRecord (callback)      throws, as documented — "${e.message.slice(0, 72)}…"`);
  }

  // 4 · the deliverable a headless host actually owes: files
  const depthScale = new ColorScale({ palette: "blues", min: 0, max: Math.max(s.max, 1),
                                      continuous: true, missingColor: "transparent" });
  const extentScale = new ColorScale({ missingColor: "transparent",
    stops: [{ min: 0.5, max: 1.5, color: "#2f6fb5", label: "flooded" }] });
  t0 = performance.now();
  const depthPng = writePng(warped, depthScale, "depth.png");
  // Warp FIRST, then threshold. Reversed, the reproject sits above a real computation, so the seam
  // hands the reprojector `ctx.grid` (the computed pixels) instead of `ctx.source` (root bytes) —
  // and warping a grid means re-encoding it as a GeoTIFF first, which the engine's own reprojector
  // does via geo/gdal.js `warpGrid` and this host does not. A host writing its own reprojector must
  // implement BOTH branches of that contract or constrain its chains, and nothing says so up front.
  const extentGrid = await depth.reproject("EPSG:4326").reclassify([{ min: 0.1, value: 1 }]).grid();
  const extentPng = writePng(extentGrid, extentScale, "extent.png");
  console.log(`\n  wrote out/depth.png      ${(depthPng / 1024).toFixed(0)} kB`);
  console.log(`  wrote out/extent.png     ${(extentPng / 1024).toFixed(0)} kB   (both in ${ms(t0)})`);

  console.log(`\n  host cost: 0 deps added beyond the engine, 0 engine CSS,`
    + ` registries touched: ${host.registries_touched.join(", ")},`
    + ` ~40 lines of PNG encoder the engine's DOM-bound half would have supplied.`);
}

main().catch((e) => { console.error("FAILED:", e.message); console.error(e.stack); process.exitCode = 1; });
