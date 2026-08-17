// build_case_study6_data.mjs — cut Case Study 6's inputs out of the NWM retrospective Zarr on S3.
//
//     node case-studies/build_case_study6_data.mjs
//
// Source: NOAA National Water Model retrospective v2.1, CORS-open, no credentials:
//   https://noaa-nwm-retrospective-2-1-zarr-pds.s3.amazonaws.com
//
// WHY THIS SCRIPT EXISTS RATHER THAN A URL IN THE PAGE — three constraints, each found by trying:
//
//   1. SciWrid's Zarr reader is "Zarr v2 (zip)". `scan()` on a live store URL range-requests the
//      directory and S3 answers 416. A store cannot be read in place; it has to be mirrored.
//   2. The chunk is the atomic unit — you cannot fetch less than one. So the mirror rewrites the
//      array so the single chunk we took IS the whole array (shape == chunks, key 0.0.0), reusing
//      the original blosc bytes. Nothing is decoded or re-encoded here.
//   3. THE COORDINATE TRAP. NWM's grid is Lambert Conformal Conic and its x/y arrays are in METRES.
//      `extractGrid` samples using those arrays while the engine hands it a bbox in degrees, so every
//      sample point falls outside the source range and nearest-neighbour clamps them all to one edge
//      cell — yielding a SPATIALLY UNIFORM grid, with no error raised, whose value still varies over
//      time so it looks like it works. Passing `grid.bbox` (which the engine's own error message
//      recommends) relabels the extent without changing the sampling and does not help.
//      The fix, and the reason this script writes coordinates rather than copying them: x/y are
//      re-expressed in DEGREES along the grid midlines before being written.
//
// The window is not chosen — it is the chunk that contains 13 March 2019. Chunk 523 covers
// 2019-03-07T03Z .. 2019-04-04T00Z: a week of antecedent snowpack, the bomb cyclone, three weeks of
// recession. Spatial chunk 5.6 at 1 km is a 350 x 350 km box over eastern Nebraska.

import JSZip from "jszip";
import proj4 from "proj4";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BUCKET = "https://noaa-nwm-retrospective-2-1-zarr-pds.s3.amazonaws.com";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");

const NWM_LCC = "+proj=lcc +lat_1=30 +lat_2=60 +lat_0=40 +lon_0=-97 "
  + "+x_0=0 +y_0=0 +a=6370000 +b=6370000 +units=m +no_defs";

const TIME_CHUNK = 523;                 // the chunk containing 2019-03-13
const CHUNK_ROW = 5, CHUNK_COL = 6;     // 1 km spatial chunk over eastern Nebraska

/** What to mirror. `layer` collapses a 4-D variable's vertical dimension at build time. */
const WANTED = [
  { store: "ldasout", variable: "SNEQV",    note: "snow water equivalent" },
  { store: "ldasout", variable: "ACSNOM",   note: "accumulated snowmelt" },
  { store: "ldasout", variable: "SOIL_M",   note: "soil moisture, top layer", layer: 0 },
  { store: "precip",  variable: "RAINRATE", note: "precipitation rate" },
];

const metaCache = new Map();
async function storeMeta(store) {
  if (!metaCache.has(store)) {
    const r = await fetch(`${BUCKET}/${store}.zarr/.zmetadata`);
    if (!r.ok) throw new Error(`${store}: .zmetadata ${r.status}`);
    metaCache.set(store, (await r.json()).metadata);
  }
  return metaCache.get(store);
}

const bytesOf = async (store, path) => {
  const r = await fetch(`${BUCKET}/${store}.zarr/${path}`);
  if (!r.ok) throw new Error(`${store}/${path}: HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};

const spec = (shape, dtype, compressor, fill) =>
  ({ zarr_format: 2, shape, chunks: shape, dtype, compressor, fill_value: fill, order: "C", filters: null });
const rawBytes = (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

async function mirror({ store, variable, note, layer }) {
  const md = await storeMeta(store);
  // ldasout carries no `crs` array; precip's covers the same 1 km grid (same corner, same spacing).
  const geo = md["crs/.zattrs"] ? md : await storeMeta("precip");
  const za = md[`${variable}/.zarray`];
  if (!za) throw new Error(`${store}: no variable ${variable}`);

  const chunks = za.chunks;
  const is4d = chunks.length === 4;
  if (is4d && layer == null) throw new Error(`${variable} is 4-D — pass a \`layer\``);
  // A 4-D variable is [time, y, level, x] — the level sits BETWEEN y and x, not before them, so
  // "second from the end" picks the level (chunked to 1) and silently yields a 1-row mirror.
  const nt = chunks[0];
  const cy = chunks[1];
  const cx = chunks[is4d ? 3 : 2];

  // Chunk key: 3-D is t.y.x, 4-D is t.y.level.x (the level dimension chunks to 1).
  const key = is4d ? `${TIME_CHUNK}.${CHUNK_ROW}.${layer}.${CHUNK_COL}`
                   : `${TIME_CHUNK}.${CHUNK_ROW}.${CHUNK_COL}`;
  const data = await bytesOf(store, `${variable}/${key}`);
  const time = await bytesOf(store, `time/${TIME_CHUNK}`);

  // ── coordinates, in DEGREES — see the header. Sampled along the grid midlines, which is exact for
  // the centre row/column and off by the LCC trapezoid residual (~0.4 km) at the corners.
  const gt = geo["crs/.zattrs"].GeoTransform.trim().split(/\s+/).map(Number);
  const [ox, px, , oy, , py] = gt;
  const col0 = CHUNK_COL * cx, row0 = CHUNK_ROW * cy;
  const midY = oy + (row0 + cy / 2) * py, midX = ox + (col0 + cx / 2) * px;
  const xs = new Float64Array(cx), ys = new Float64Array(cy);
  for (let i = 0; i < cx; i++) xs[i] = proj4(NWM_LCC, "EPSG:4326", [ox + (col0 + i + 0.5) * px, midY])[0];
  for (let j = 0; j < cy; j++) ys[j] = proj4(NWM_LCC, "EPSG:4326", [midX, oy + (row0 + j + 0.5) * py])[1];

  const zmeta = {};
  const zip = new JSZip();
  const put = (p, b) => { zip.file(p, b); if (/\.z(array|attrs)$/.test(p)) zmeta[p] = JSON.parse(b); };
  zip.file(".zgroup", JSON.stringify({ zarr_format: 2 }));

  // The variable, always written 3-D: a 4-D source has its level dimension collapsed to the one
  // layer taken, so the mirror never carries a degenerate axis for a consumer to trip over.
  const attrs = { ...md[`${variable}/.zattrs`], _ARRAY_DIMENSIONS: ["time", "y", "x"] };
  if (layer != null) attrs.soil_layer_index = layer;
  put(`${variable}/.zarray`, JSON.stringify(spec([nt, cy, cx], za.dtype, za.compressor, za.fill_value)));
  put(`${variable}/.zattrs`, JSON.stringify(attrs));
  zip.file(`${variable}/0.0.0`, data);

  const tza = md["time/.zarray"];
  put("time/.zarray", JSON.stringify(spec([nt], tza.dtype, tza.compressor, tza.fill_value)));
  put("time/.zattrs", JSON.stringify(md["time/.zattrs"]));
  zip.file("time/0", time);

  for (const [name, arr, len] of [["x", xs, cx], ["y", ys, cy]]) {
    const a = { ...(md[`${name}/.zattrs`] || {}), units: "degrees", _ARRAY_DIMENSIONS: [name],
                note: "re-expressed from the source's LCC metres — see build_case_study6_data.mjs" };
    put(`${name}/.zarray`, JSON.stringify(spec([len], "<f8", null, null)));
    put(`${name}/.zattrs`, JSON.stringify(a));
    zip.file(`${name}/0`, rawBytes(arr));
  }

  put("crs/.zarray", JSON.stringify(spec([], "|S1", null, null)));
  put("crs/.zattrs", JSON.stringify(geo["crs/.zattrs"]));
  zip.file(".zmetadata", JSON.stringify({ zarr_consolidated_format: 1,
    metadata: { ".zgroup": { zarr_format: 2 }, ...zmeta } }, null, 1));

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE",
                                        compressionOptions: { level: 9 } });
  const out = join(OUT_DIR, `nwm-ne-2019-${variable}.zarr.zip`);
  writeFileSync(out, buf);
  console.log(`  ${variable.padEnd(9)} ${note.padEnd(26)} ${nt} x ${cy} x ${cx}`
    + `  chunk ${(data.length / 1048576).toFixed(1)} MB -> zip ${(buf.length / 1048576).toFixed(2)} MB`);
  return { variable, bbox: [xs[0], ys[cy - 1], xs[cx - 1], ys[0]], steps: nt };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`NWM retrospective v2.1 -> case-studies/data  (chunk ${TIME_CHUNK}, spatial ${CHUNK_ROW}.${CHUNK_COL})\n`);
  const made = [];
  for (const w of WANTED) made.push(await mirror(w));
  const b = made[0].bbox;
  console.log(`\n  bbox  W ${b[0].toFixed(4)}  S ${b[1].toFixed(4)}  E ${b[2].toFixed(4)}  N ${b[3].toFixed(4)}`);
  console.log(`  ${made.length} files written. Provenance belongs in data/README.txt (protocol §0.4).`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
