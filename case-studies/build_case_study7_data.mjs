// build_case_study7_data.mjs — cut Case Study 7's inputs out of the NWM retrospective Zarr on S3.
//
//     node case-studies/build_case_study7_data.mjs
//
// Source: NOAA National Water Model retrospective v2.1, CORS-open, no credentials:
//   https://noaa-nwm-retrospective-2-1-zarr-pds.s3.amazonaws.com
//
// Study 7 is the Amite River basin above USGS-07378500 (Denham Springs, LA) during the
// 10-17 August 2016 rainfall event. Two things are mirrored:
//
//   1. precip/RAINRATE — one time chunk x one spatial chunk of the 1 km forcing grid, decoded,
//      cropped to the basin and the event window, and written as a .zarr.zip with one chunk per
//      timestep. This is the n-dimensional product the study animates.
//   2. chrtout/streamflow — the hourly simulated series for ONE NHDPlus reach, written as JSON.
//      The engine never sees it: chrtout is (time, feature_id) with no lat/lon, so it cannot enter
//      through addDataset at all, and one reach costs a whole feature_id chunk to read. Both facts
//      are the study's evidence, so the script REPORTS the bytes it had to fetch for one reach.
//
// This script inherits the three constraints build_case_study6_data.mjs found by trying, and the
// comments there are the long version:
//
//   1. SciWrid's Zarr reader is "Zarr v2 (zip)". A live store URL cannot be read in place, so the
//      window has to be mirrored.
//   2. The chunk is the atomic unit ON S3, so one whole chunk is fetched.
//   3. THE COORDINATE TRAP. NWM's grid is Lambert Conformal Conic with x/y in METRES, which
//      extractGrid samples against a bbox in degrees, clamping every sample to one edge cell and
//      yielding a spatially uniform grid with no error raised. x/y are therefore re-expressed in
//      DEGREES along the grid midlines before being written.
//
// Study 6 passed the fetched chunk through undecoded, writing shape == chunks so the mirror held one
// object. That makes every single-step read decode the entire array: 672 x 350 x 350 float32 is
// 1.3 GB of WASM linear memory per select, and a reduce over the window asks for it once per step,
// which fails with "Cannot allocate Wasm memory for new instance". This script therefore DECODES the
// chunk once here, crops it to the basin and the event window, and writes one chunk per timestep, so
// a select in the browser decodes one grid rather than the stack.
//
// Unlike Study 6, nothing here is hard-coded to a chunk number. The gage location and its NHDPlus
// COMID come from NLDI, the time chunk is computed from the store's own CF time units, and the
// spatial chunk is computed by projecting the gage into the store's own GeoTransform. Change GAGE or
// EVENT and the script finds the corresponding chunks, or says why it cannot.

import JSZip from "jszip";
import proj4 from "proj4";
import { Blosc, Zlib, Zstd, GZip } from "numcodecs";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BUCKET = "https://noaa-nwm-retrospective-2-1-zarr-pds.s3.amazonaws.com";
const NLDI = "https://api.water.usgs.gov/nldi/linked-data";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");
const TAG = "amite-2016";

const NWM_LCC = "+proj=lcc +lat_1=30 +lat_2=60 +lat_0=40 +lon_0=-97 "
  + "+x_0=0 +y_0=0 +a=6370000 +b=6370000 +units=m +no_defs";

const GAGE = "USGS-07378500";              // Amite River near Denham Springs, LA
const EVENT_FROM = Date.UTC(2016, 7, 10, 0);   // the window the page opens on
const EVENT_TO = Date.UTC(2016, 7, 17, 0);

// ── plumbing ──────────────────────────────────────────────────────────────────────────────────
let fetchedBytes = 0;

async function bytesOf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const b = new Uint8Array(await r.arrayBuffer());
  fetchedBytes += b.length;
  return b;
}

const metaCache = new Map();
async function storeMeta(store) {
  if (!metaCache.has(store)) {
    const r = await fetch(`${BUCKET}/${store}.zarr/.zmetadata`);
    if (!r.ok) throw new Error(`${store}: .zmetadata ${r.status}`);
    metaCache.set(store, (await r.json()).metadata);
  }
  return metaCache.get(store);
}

const spec = (shape, dtype, compressor, fill) =>
  ({ zarr_format: 2, shape, chunks: shape, dtype, compressor, fill_value: fill, order: "C", filters: null });
const rawBytes = (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

/** Decoder for a `.zarray` compressor config. Both mirrors decode: the raster one to crop it, the
 *  streamflow one to pick a single reach out of the chunk. */
function codecOf(config) {
  if (config == null) return { decode: (b) => b };
  const id = config.id;
  if (id === "blosc") return Blosc.fromConfig(config);
  if (id === "zlib") return Zlib.fromConfig(config);
  if (id === "zstd") return Zstd.fromConfig(config);
  if (id === "gzip") return GZip.fromConfig(config);
  throw new Error(`unsupported compressor "${id}" — add it to codecOf()`);
}

/** Typed view over decoded chunk bytes, by Zarr dtype string. Little-endian only, which is what
 *  every array in this store declares; anything else throws rather than reading garbage. */
function viewOf(dtype, buf) {
  const ctor = { "<f8": Float64Array, "<f4": Float32Array, "<i4": Int32Array,
                 "<i8": BigInt64Array, "<i2": Int16Array, "|i1": Int8Array }[dtype];
  if (!ctor) throw new Error(`unsupported dtype "${dtype}"`);
  return new ctor(buf.buffer, buf.byteOffset, buf.byteLength / ctor.BYTES_PER_ELEMENT);
}

async function chunkValues(store, md, array, key) {
  const za = md[`${array}/.zarray`];
  const raw = await bytesOf(`${BUCKET}/${store}.zarr/${array}/${key}`);
  const decoded = await codecOf(za.compressor).decode(raw);
  return viewOf(za.dtype, decoded instanceof Uint8Array ? decoded : new Uint8Array(decoded.buffer));
}

/** CF "<unit> since <iso>" → a function from array index to epoch ms, given a regular axis. */
function timeAxisOf(md, array = "time") {
  const units = md[`${array}/.zattrs`]?.units;
  if (!units) throw new Error(`${array}: no CF units attribute`);
  const m = /^(\w+)\s+since\s+(.+?)\s*$/i.exec(units);
  if (!m) throw new Error(`${array}: unreadable units "${units}"`);
  const perStep = { hours: 3600e3, hour: 3600e3, minutes: 60e3, seconds: 1e3, days: 86400e3 }[m[1].toLowerCase()];
  if (!perStep) throw new Error(`${array}: unsupported time unit "${m[1]}"`);
  const origin = Date.parse(m[2].replace(" ", "T").replace(/(?<!Z)$/, "Z"));
  if (Number.isNaN(origin)) throw new Error(`${array}: unreadable epoch "${m[2]}"`);
  return { origin, perStep, units };
}

// ── the gage, its basin, and its reach — all from NLDI ─────────────────────────────────────────
async function gageContext() {
  const site = await (await fetch(`${NLDI}/nwissite/${GAGE}`)).json();
  const f = site.features?.[0];
  if (!f) throw new Error(`NLDI returned no feature for ${GAGE}`);
  const [lon, lat] = f.geometry.coordinates;
  const comid = Number(f.properties.comid);
  if (!Number.isFinite(comid)) throw new Error(`NLDI gave no comid for ${GAGE}`);

  const basin = await (await fetch(`${NLDI}/nwissite/${GAGE}/basin`)).json();
  const ring = (basin.features?.[0]?.geometry?.coordinates ?? []).flat(Infinity);
  const lons = ring.filter((_, i) => i % 2 === 0), lats = ring.filter((_, i) => i % 2 === 1);
  const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];

  console.log(`NLDI  ${GAGE}  ${lat.toFixed(4)} N ${lon.toFixed(4)} E   COMID ${comid}`);
  console.log(`      basin bbox  W ${bbox[0].toFixed(3)}  S ${bbox[1].toFixed(3)}`
    + `  E ${bbox[2].toFixed(3)}  N ${bbox[3].toFixed(3)}`);
  return { lat, lon, comid, bbox, basin };
}

// ── the forcing mirror ────────────────────────────────────────────────────────────────────────
const PAD_DEG = 0.15;      // margin around the basin, so a mask has data at its edge
const LEAD_H = 12;         // hours kept either side of the event window

/** A `.zarray` whose chunk shape differs from its array shape. */
const specChunked = (shape, chunks, dtype, compressor, fill) =>
  ({ zarr_format: 2, shape, chunks, dtype, compressor, fill_value: fill, order: "C", filters: null });

/** Indices of a monotonic coordinate array falling inside [lo, hi]. Handles either direction, since
 *  the NWM grid's y runs north to south. */
function within(coords, lo, hi) {
  const idx = [];
  for (let i = 0; i < coords.length; i++) if (coords[i] >= lo && coords[i] <= hi) idx.push(i);
  return idx;
}

async function mirrorForcing({ lat, lon, bbox }) {
  const store = "precip", variable = "RAINRATE";
  const md = await storeMeta(store);
  const za = md[`${variable}/.zarray`];
  if (!za) throw new Error(`${store}: no variable ${variable}`);
  const [nt, cy, cx] = za.chunks;
  const [, ny, nx] = za.shape;

  // Time chunk: from the store's own CF units, not from a hard-coded index.
  const t = timeAxisOf(md);
  const stepOf = (ms) => Math.round((ms - t.origin) / t.perStep);
  const timeChunk = Math.floor(stepOf(EVENT_FROM) / nt);
  if (stepOf(EVENT_FROM) < 0 || timeChunk * nt >= za.shape[0]) {
    throw new Error(`event ${new Date(EVENT_FROM).toISOString()} lies outside the store ("${t.units}")`);
  }

  // Spatial chunk: project the gage into the store's grid. Columns follow the GeoTransform. Rows
  // follow the store's own y array: the GeoTransform says north-up (py < 0), but y and the data run
  // south to north (y[0] is the southern edge), so a GeoTransform row lands on the mirror latitude.
  const gt = md["crs/.zattrs"].GeoTransform.trim().split(/\s+/).map(Number);
  const [ox, px] = gt;
  const yM = await chunkValues(store, md, "y", "0");
  if (yM.length !== ny) throw new Error(`y has ${yM.length} values, expected ${ny}`);
  const [gx, gy] = proj4("EPSG:4326", NWM_LCC, [lon, lat]);
  const col = Math.floor((gx - ox) / px);
  const row = Math.round((gy - yM[0]) / (yM[1] - yM[0]));
  if (col < 0 || row < 0 || col >= nx || row >= ny) throw new Error("gage falls outside the NWM grid");
  const chunkCol = Math.floor(col / cx), chunkRow = Math.floor(row / cy);

  const raw = await bytesOf(`${BUCKET}/${store}.zarr/${variable}/${timeChunk}.${chunkRow}.${chunkCol}`);
  const decoded = await codecOf(za.compressor).decode(raw);
  const values = viewOf(za.dtype, decoded instanceof Uint8Array ? decoded : new Uint8Array(decoded.buffer));
  if (values.length !== nt * cy * cx) {
    throw new Error(`decoded ${values.length} values, expected ${nt * cy * cx} for chunk ${nt}x${cy}x${cx}`);
  }
  const timeRaw = await chunkValues(store, md, "time", String(timeChunk));

  // Coordinates in DEGREES for the whole chunk, sampled along the grid midlines — exact for the
  // centre row and column, off by the LCC trapezoid residual (~0.4 km) at the corners.
  const col0 = chunkCol * cx, row0 = chunkRow * cy;
  const midY = yM[Math.min(ny - 1, row0 + Math.floor(cy / 2))], midX = ox + (col0 + cx / 2) * px;
  const xsAll = new Float64Array(cx), ysAll = new Float64Array(cy);
  for (let i = 0; i < cx; i++) xsAll[i] = proj4(NWM_LCC, "EPSG:4326", [ox + (col0 + i + 0.5) * px, midY])[0];
  for (let j = 0; j < cy; j++) ysAll[j] = proj4(NWM_LCC, "EPSG:4326", [midX, yM[Math.min(ny - 1, row0 + j)]])[1];

  // Crop to the basin plus a margin. The whole chunk decoded is 1.3 GB of float32 at 1 km, and the
  // browser decodes a chunk per select, so the mirror carries the basin and nothing else.
  const cols = within(xsAll, bbox[0] - PAD_DEG, bbox[2] + PAD_DEG);
  const rows = within(ysAll, bbox[1] - PAD_DEG, bbox[3] + PAD_DEG);
  if (!cols.length || !rows.length) throw new Error("the basin does not intersect the fetched chunk");
  const clipped = cols.length < cx && (xsAll[cols[0]] > bbox[0] || xsAll[cols.at(-1)] < bbox[2]);
  const W = cols.length, H = rows.length;
  const c0 = cols[0], r0 = rows[0];

  // Crop in time to the event window plus a lead, clamped to what this chunk holds.
  const t0 = Math.max(0, stepOf(EVENT_FROM) - timeChunk * nt - LEAD_H);
  const t1 = Math.min(nt, stepOf(EVENT_TO) - timeChunk * nt + LEAD_H + 1);
  if (t1 <= t0) throw new Error("the event window does not intersect the fetched time chunk");
  const nT = t1 - t0;
  const truncated = (stepOf(EVENT_TO) - timeChunk * nt) >= nt;

  const Ctor = values.constructor;
  const zmeta = {};
  const zip = new JSZip();
  const put = (path, body) => { zip.file(path, body); if (/\.z(array|attrs)$/.test(path)) zmeta[path] = JSON.parse(body); };
  zip.file(".zgroup", JSON.stringify({ zarr_format: 2 }));

  // One chunk per timestep: a select in the browser decodes H x W, not nT x H x W.
  const attrs = { ...md[`${variable}/.zattrs`], _ARRAY_DIMENSIONS: ["time", "y", "x"] };
  put(`${variable}/.zarray`,
      JSON.stringify(specChunked([nT, H, W], [1, H, W], za.dtype, null, za.fill_value)));
  put(`${variable}/.zattrs`, JSON.stringify(attrs));
  for (let k = 0; k < nT; k++) {
    const slice = new Ctor(H * W);
    const base = (t0 + k) * cy * cx;
    for (let j = 0; j < H; j++) {
      const src = base + (r0 + j) * cx + c0;
      slice.set(values.subarray(src, src + W), j * W);
    }
    zip.file(`${variable}/${k}.0.0`, rawBytes(slice));
  }

  // Time, x and y are written uncompressed as float64 — small, and one less codec to agree on.
  const times = new Float64Array(nT);
  for (let k = 0; k < nT; k++) times[k] = Number(timeRaw[t0 + k]);
  put("time/.zarray", JSON.stringify(spec([nT], "<f8", null, null)));
  put("time/.zattrs", JSON.stringify({ ...md["time/.zattrs"], _ARRAY_DIMENSIONS: ["time"] }));
  zip.file("time/0", rawBytes(times));

  const xs = Float64Array.from(cols, (i) => xsAll[i]);
  const ys = Float64Array.from(rows, (j) => ysAll[j]);
  for (const [name, arr, len] of [["x", xs, W], ["y", ys, H]]) {
    const a = { ...(md[`${name}/.zattrs`] || {}), units: "degrees", _ARRAY_DIMENSIONS: [name],
                note: "re-expressed from the source's LCC metres and cropped to the basin — see "
                  + "build_case_study7_data.mjs" };
    put(`${name}/.zarray`, JSON.stringify(spec([len], "<f8", null, null)));
    put(`${name}/.zattrs`, JSON.stringify(a));
    zip.file(`${name}/0`, rawBytes(arr));
  }

  // The source GeoTransform describes the full CONUS grid and would misplace this crop, so it is
  // dropped: x and y in degrees are what the reader derives the extent from.
  const { GeoTransform, ...crsAttrs } = md["crs/.zattrs"];
  put("crs/.zarray", JSON.stringify(spec([], "|S1", null, null)));
  put("crs/.zattrs", JSON.stringify({ ...crsAttrs,
    note: "GeoTransform dropped: it describes the full NWM grid, not this crop" }));
  zip.file(".zmetadata", JSON.stringify({ zarr_consolidated_format: 1,
    metadata: { ".zgroup": { zarr_format: 2 }, ...zmeta } }, null, 1));

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE",
                                        compressionOptions: { level: 9 } });
  const out = join(OUT_DIR, `${TAG}-${variable}.zarr.zip`);
  writeFileSync(out, buf);

  const spanStart = new Date(t.origin + (timeChunk * nt + t0) * t.perStep);
  const spanEnd = new Date(t.origin + (timeChunk * nt + t1 - 1) * t.perStep);
  const west = Math.min(xs[0], xs[W - 1]), east = Math.max(xs[0], xs[W - 1]);
  const south = Math.min(ys[0], ys[H - 1]), north = Math.max(ys[0], ys[H - 1]);

  console.log(`\nprecip/${variable}  source chunk ${timeChunk}.${chunkRow}.${chunkCol} `
    + `(${nt} x ${cy} x ${cx}, ${(raw.length / 1048576).toFixed(1)} MB compressed, `
    + `${(values.byteLength / 1048576).toFixed(0)} MB decoded)`);
  console.log(`      mirrored ${nT} x ${H} x ${W}, one chunk per step `
    + `(${(H * W * Ctor.BYTES_PER_ELEMENT / 1024).toFixed(0)} kB per select)`);
  console.log(`      ${spanStart.toISOString()} .. ${spanEnd.toISOString()}   unit "${attrs.units ?? "(none)"}"`);
  console.log(`      bbox  W ${west.toFixed(4)}  S ${south.toFixed(4)}  E ${east.toFixed(4)}  N ${north.toFixed(4)}`);
  console.log(`      zip ${(buf.length / 1048576).toFixed(2)} MB -> ${out}`);
  if (clipped) {
    console.log("      WARNING: the basin extends past this chunk's edge and the mirror stops there. "
      + "Zonal means over the clipped side would be computed against missing cells — take the "
      + "neighbouring chunk before reporting them.");
  }
  if (truncated) {
    console.log("      WARNING: the event window runs past the end of this time chunk, so the mirror "
      + "is short. Take the next time chunk before reporting an event total.");
  }
  return { file: out, steps: nT, spanStart, spanEnd, unit: attrs.units ?? null,
           bbox: [west, south, east, north], fits: !clipped && !truncated };
}

// ── the streamflow companion ──────────────────────────────────────────────────────────────────
/** Locate a COMID's position in the feature_id array. feature_id is sorted ascending, so the chunk
 *  is found by reading first/last of each candidate chunk rather than the whole 2.7 M array. */
async function locateFeature(md, comid) {
  const za = md["feature_id/.zarray"];
  const n = za.shape[0], per = za.chunks[0], nChunks = Math.ceil(n / per);
  let lo = 0, hi = nChunks - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const vals = await chunkValues("chrtout", md, "feature_id", String(mid));
    const first = Number(vals[0]), last = Number(vals[vals.length - 1]);
    if (comid < first) hi = mid - 1;
    else if (comid > last) lo = mid + 1;
    else {
      const i = Array.prototype.findIndex.call(vals, (v) => Number(v) === comid);
      if (i < 0) throw new Error(`COMID ${comid} is not in the NWM channel network`);
      return { chunk: mid, offset: i, per };
    }
  }
  throw new Error(`COMID ${comid} is outside the feature_id range`);
}

async function mirrorStreamflow({ comid }, forcing) {
  const md = await storeMeta("chrtout");
  const before = fetchedBytes;
  const { chunk, offset, per } = await locateFeature(md, comid);

  const za = md["streamflow/.zarray"];
  const [ntc, nfc] = za.chunks;
  const t = timeAxisOf(md);
  const timeChunk = Math.floor(Math.round((forcing.spanStart.getTime() - t.origin) / t.perStep) / ntc);

  const values = await chunkValues("chrtout", md, "streamflow", `${timeChunk}.${chunk}`);
  const attrs = md["streamflow/.zattrs"] ?? {};
  const scale = attrs.scale_factor ?? 1, offsetV = attrs.add_offset ?? 0;
  const fill = za.fill_value ?? attrs._FillValue ?? null;

  const series = [];
  const t0 = t.origin + timeChunk * ntc * t.perStep;
  for (let i = 0; i < ntc; i++) {
    const raw = Number(values[i * nfc + offset]);
    series.push({ t: new Date(t0 + i * t.perStep).toISOString(),
                  q: fill != null && raw === Number(fill) ? null : raw * scale + offsetV });
  }

  const cost = fetchedBytes - before;
  const payload = {
    comid, source: "NWM retrospective v2.1 chrtout/streamflow",
    unit: attrs.units ?? "m3 s-1",
    chunk: `${timeChunk}.${chunk}`,
    chunk_shape: [ntc, nfc],
    feature_offset_in_chunk: offset,
    bytes_fetched_for_one_reach: cost,
    note: "chrtout is (time, feature_id) with no lat/lon, so it cannot enter the engine through "
      + "addDataset. It is read here at build time and plotted by the host page.",
    series,
  };
  const out = join(OUT_DIR, `${TAG}-chrtout-${comid}.json`);
  writeFileSync(out, JSON.stringify(payload));

  console.log(`\nchrtout/streamflow  COMID ${comid}  chunk ${timeChunk}.${chunk}, offset ${offset} of ${per}`);
  console.log(`      chunk shape ${ntc} x ${nfc}   ${series.length} hourly values written`);
  console.log(`      ${(cost / 1048576).toFixed(1)} MB fetched to read ONE reach — the number the study reports`);
  return { file: out, bytes: cost, comid };
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`NWM retrospective v2.1 -> case-studies/data   (${TAG})\n`);
  const ctx = await gageContext();
  const forcing = await mirrorForcing(ctx);
  const flow = await mirrorStreamflow(ctx, forcing);
  console.log(`\n  ${(fetchedBytes / 1048576).toFixed(1)} MB fetched in total.`);
  console.log("  Provenance belongs in data/README.txt (protocol §0.4): store, chunk keys, accessed "
    + "date, byte counts, and the coordinate rewrite.");
  if (!forcing.fits) process.exitCode = 2;
}

main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
