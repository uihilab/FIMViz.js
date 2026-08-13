// case_study1_headless.mjs — the Node half of Case Study 1.
//
// Runs the identical evaluation chain the browser page runs, so the two can be diffed. Usage:
//
//     node case-studies/case_study1_headless.mjs [--out results_headless.csv]
//
// THE REPROJECTOR IS THE POINT OF THIS FILE. `ds.reproject()` dispatches through a seam
// (Dataset.registerReprojector); the engine's built-in default is a lazily-loaded fallback that
// imports io/reprojector.js → geo/gdal.js → `import initGdalJs from "gdal3.js"`, which resolves to
// that package's browser build and throws `sn.readFileSync is not a function` under Node. The
// package also ships `gdal3.node.js`, which initialises here in ~160 ms with 128 raster drivers.
// So the warp is browser-only BY PACKAGING, NOT BY CAPABILITY — io/reprojector.js's own header
// asserts otherwise ("gdal3.js is BROWSER-ONLY ... needs a browser to actually RUN") and is wrong.
// Registering a Node-backed reprojector below is what makes browser–headless parity achievable at
// all, and it is a demonstration of the seam rather than a workaround around it.

import { createRequire } from "module";
import { readFileSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { dirname, join, relative } from "path";
import { fromArrayBuffer } from "geotiff";

// NOT `../src/package/lib.js`. The barrel does `export { Loader } from "@googlemaps/js-api-loader"`,
// which is CJS and exposes no named ESM export, so importing the engine's public entry throws
// `does not provide an export named 'Loader'` under Node — before any of this file's own code runs.
// Deep imports are the only way in headless, and that is a hard blocker on the parity claim, not a
// stylistic preference. `exports["./src/*"]` in package.json makes them a supported path at least.
import { Dataset } from "../src/package/dataset.js";
import { RasterGrid } from "../src/package/materialize.js";
import { ComparisonLayer } from "../src/package/comparisonLayer.js";
import { parseSource } from "../src/io/parse.js";
import { registerBuiltinMaterializers } from "../src/io/materializers.js";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

// ── shared configuration (must match case_study1.html exactly) ────────────────────────────────
export const EMS = {
  api: "https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api",
  code: "EMSR864",
  aoi: 1,
};
export const JRC_LOCAL = join(HERE, "data", "jrc_RP100_ermidas_3035.tif");
export const TARGET_CRS = "EPSG:4326";
export const WET_THRESHOLDS = [0, 0.5, 1.0];      // metres of modelled depth counted as "wet"
export const DRY = 0;

// ── the Node reprojector: the seam the browser fills with the CDN wasm build ───────────────────
let _gdal = null;
async function gdal() {
  if (_gdal) return _gdal;
  const initGdalJs = require("gdal3.js/dist/package/gdal3.node.js");
  // gdal3.node.js resolves `path` against cwd, so an absolute path is concatenated onto it and the
  // wasm 404s. Hand it a cwd-relative one.
  _gdal = await initGdalJs({ path: relative(process.cwd(), join(ROOT, "node_modules/gdal3.js/dist/package")) });
  return _gdal;
}

/**
 * The reproject seam's contract: (grid, targetCrs, ctx) => RasterGrid. Mirrors io/reprojector.js.
 *
 * Note the browser and Node gdal3.js builds differ in more than their loader: the browser build's
 * `open()` accepts a File, the Node build's takes a filesystem PATH (hand it a File and it fails
 * with `t.split is not a function`). So a host cannot share one reprojector across both — which is
 * the same packaging split as the entry point, one layer down.
 */
async function nodeReproject(grid, targetCrs, ctx = {}) {
  const G = await gdal();
  const name = ctx.name || "reproject.tif";
  if (!(ctx.source instanceof ArrayBuffer)) {
    throw new Error("node reprojector: expected root bytes on ctx.source");
  }
  const tmp = join(tmpdir(), `fimviz-cs1-${process.pid}-${name}`);
  writeFileSync(tmp, Buffer.from(ctx.source));

  const { datasets } = await G.open(tmp);
  const out = await G.gdalwarp(datasets[0], ["-of", "GTiff", "-t_srs", targetCrs, "-r", "near"], name);
  const warped = await G.getFileBytes(out);
  rmSync(tmp, { force: true });

  const ab = warped instanceof Uint8Array
    ? warped.buffer.slice(warped.byteOffset, warped.byteOffset + warped.byteLength)
    : warped;
  const image = await (await fromArrayBuffer(ab)).getImage();
  const [west, south, east, north] = image.getBoundingBox();
  const rasters = await image.readRasters();
  return new RasterGrid({
    pixels: Array.isArray(rasters) ? rasters[0] : rasters,
    width: image.getWidth(), height: image.getHeight(),
    bounds: { north, south, east, west }, crs: targetCrs,
    noData: grid.noData, bands: image.getSamplesPerPixel(),
    meta: { ...grid.meta, width: image.getWidth(), height: image.getHeight(), reprojectedFrom: grid.crs },
  });
}

// ── the chain, written once and shared with the page ──────────────────────────────────────────
export const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [String(v)]);

/** Pull the DEL_PRODUCT vector layer URLs for one activation AOI straight from the EMS API. */
export async function emsLayers(fetchImpl = fetch) {
  const r = await fetchImpl(`${EMS.api}/public-activations/?code=${EMS.code}`);
  const j = await r.json();
  const a = Array.isArray(j) ? j[0] : j.results ? j.results[0] : j;
  const aoi = a.aois.find((x) => x.number === EMS.aoi);
  const del = aoi.products.find((p) => p.type === "DEL" && !p.monitoring);
  const url = (kind) => del.layers.find((l) => l.name.includes(kind)).json;
  return { aoiName: aoi.name, observed: url("observedEventA"), modelled: url("modelledEventA"),
           acquired: del.images?.[0]?.acquisitionTime ?? null, sensor: del.images?.[0]?.sensorName ?? null };
}

/** Depth raster → binary wet mask at `threshold` metres. NaN/nodata → dry. */
export function thresholdWet(grid, threshold) {
  const px = new Uint8Array(grid.pixels.length);
  let wet = 0;
  for (let i = 0; i < px.length; i++) {
    const v = grid.pixels[i];
    if (Number.isFinite(v) && v !== grid.noData && v > threshold) { px[i] = 1; wet++; }
  }
  return { grid: new RasterGrid({ pixels: px, width: grid.width, height: grid.height,
                                  bounds: grid.bounds, crs: grid.crs, noData: null }), wet };
}

/** Burn a vector Dataset onto exactly the target grid's geometry, then binarise. */
export async function rasterizeOnto(vectorDs, target) {
  const g = await vectorDs.rasterize({
    width: target.width, height: target.height, bounds: target.bounds, burnValue: 1,
  }).grid();
  const px = new Uint8Array(g.pixels.length);
  let wet = 0;
  for (let i = 0; i < px.length; i++) if (g.pixels[i] === 1) { px[i] = 1; wet++; }
  return { grid: new RasterGrid({ pixels: px, width: g.width, height: g.height,
                                  bounds: g.bounds, crs: g.crs, noData: null }), wet };
}

export const derive = (tp, fp, fn, tn) => ({
  tp, fp, fn, tn, n: tp + fp + fn + tn,
  csi: +(tp + fp + fn > 0 ? tp / (tp + fp + fn) : 0).toFixed(6),
  pod: +(tp + fn > 0 ? tp / (tp + fn) : 0).toFixed(6),
  far: +(tp + fp > 0 ? fp / (tp + fp) : 0).toFixed(6),
  bias: +(tp + fn > 0 ? (tp + fp) / (tp + fn) : 0).toFixed(6),
  containment: +(tp + fn > 0 ? tp / (tp + fn) : 0).toFixed(6),
});

/** [prediction, observation] → contingency. `mask` scopes it to a SpatialFilter polygon. */
export function scorePair(predGrid, obsGrid, { policy = "low", mask = null } = {}) {
  const layer = new ComparisonLayer({ sources: [predGrid, obsGrid] });
  const r = layer.compute({ policy, method: "nearest", dryValue: DRY, ...(mask ? { mask } : {}) });
  const m = mask ? layer.metricsForMask(mask) : r.metrics;
  return { result: r, row: { ...derive(m.tp, m.fp, m.fn, m.tn), kappa: +m.k.toFixed(6),
                             grid_w: r.grid.width, grid_h: r.grid.height } };
}

const toCsv = (rows) => {
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
};

// ── run ───────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const outArg = process.argv.indexOf("--out");
  const outFile = outArg > -1 ? process.argv[outArg + 1] : join(HERE, "results_headless.csv");

  registerBuiltinMaterializers();
  Dataset.registerReprojector(nodeReproject);
  const t = (label, fn) => {
    const t0 = performance.now();
    return Promise.resolve(fn()).then((v) => {
      console.log(`  ${label.padEnd(26)} ${(performance.now() - t0).toFixed(1)} ms`);
      return v;
    });
  };

  console.log(`Case Study 1 — headless (${process.version})\n`);

  const layers = await t("ems api", () => emsLayers());
  console.log(`  AOI: ${layers.aoiName} · ${layers.sensor} · ${layers.acquired}`);

  // parseSource wants a Blob/File with a detectable name; Node 18+ has both globally.
  const getVec = async (url, name) =>
    parseSource(new File([await (await fetch(url)).arrayBuffer()], name,
                         { type: "application/geo+json" }));

  const observed = await t("fetch+parse observed", () => getVec(layers.observed, "observed.geojson"));
  const modelled = await t("fetch+parse modelled", () => getVec(layers.modelled, "modelled.geojson"));

  const jrcBytes = readFileSync(JRC_LOCAL);
  const jrc = await t("parse jrc (EPSG:3035)", () =>
    parseSource(new File([jrcBytes], "jrc_RP100_ermidas_3035.tif", { type: "image/tiff" })));
  console.log(`  jrc crs=${jrc.crs}`);

  const warped = await t("warp 3035 → 4326 (lazy)", () => jrc.reproject(TARGET_CRS).grid());
  console.log(`  warped ${warped.width}x${warped.height}  bounds ${JSON.stringify(warped.bounds)}`);

  const obs = await t("rasterize observed", () => rasterizeOnto(observed, warped));
  const mod = await t("rasterize modelled", () => rasterizeOnto(modelled, warped));

  const rows = [];
  for (const th of WET_THRESHOLDS) {
    const wet = thresholdWet(warped, th);
    const { row } = scorePair(wet.grid, obs.grid, { policy: "low" });
    rows.push({ study: "1", environment: `node ${process.version}`, scope: "basin",
                wet_threshold_m: th, pred_wet_cells: wet.wet, obs_wet_cells: obs.wet, ...row });
    console.log(`  th=${th}m  CSI ${row.csi.toFixed(4)}  POD ${row.pod.toFixed(4)}`
      + `  containment ${row.containment.toFixed(4)}  bias ${row.bias.toFixed(4)}`);
  }

  // Observability: is the EMS observed extent a strict subset of its modelled extent?
  const { row: obsv } = scorePair(mod.grid, obs.grid, { policy: "low" });
  rows.push({ study: "1", environment: `node ${process.version}`, scope: "observability",
              wet_threshold_m: "", pred_wet_cells: mod.wet, obs_wet_cells: obs.wet, ...obsv });
  console.log(`\n  observability: observed inside modelled = ${(100 * obsv.containment).toFixed(1)}%`
    + `  (FN ${obsv.fn}${obsv.fn === 0 ? " — strict subset" : ""})`);

  writeFileSync(outFile, toCsv(rows));
  console.log(`\nwrote ${outFile} (${rows.length} rows)`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("case_study1_headless.mjs")) {
  main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
}
