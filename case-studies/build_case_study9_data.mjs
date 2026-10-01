// build_case_study9_data.mjs — mirrors three gridMET year files and describes them for case_study9.html.
//
// Usage:  node case-studies/build_case_study9_data.mjs [--year 2019]
//
// Writes into case-studies/data/ (git-ignored, see data/.gitignore):
//   gridmet-2019/pr_2019.nc, tmmn_2019.nc, tmmx_2019.nc   the agency files, byte for byte
//   gridmet-2019-basins.geojson                            two NLDI basins, simplified
//   gridmet-2019-manifest.json                             what the page needs to know before it parses
//
// Source: gridMET (Abatzoglou 2013), https://www.climatologylab.org/gridmet.html, CC0.
// Files: https://www.northwestknowledge.net/metdata/data/<var>_<year>.nc, one variable per year, CONUS
// at 1/24 degree, daily.
//
// Why the files are NOT rewritten. Case Study 8 had to add a CF time coordinate to the DWR files before
// the engine could select a day. This builder only copies and describes: the page parses the file the
// agency serves. The manifest records the variable name, units, packing, chunking, and time coordinate
// read from each file with h5wasm, so the page never assumes them, and so a reader can check what the
// engine was given.
//
// Why the basins are simplified. The page masks CONUS grids of about 0.8 million cells with each basin.
// The NLDI polygons carry tens of thousands of vertices, far finer than a 1/24 degree cell, and the
// mask cost grows with vertex count. Douglas-Peucker at SIMPLIFY_DEG (a quarter of a cell) keeps the
// outline to within a quarter cell. The vertex counts before and after go in the manifest.

import { mkdirSync, statSync, existsSync, readFileSync, writeFileSync, createWriteStream } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const h5wasm = await import("h5wasm/node");
await h5wasm.ready;

const argYear = process.argv.indexOf("--year");
const YEAR = argYear > 0 ? Number(process.argv[argYear + 1]) : 2019;
const TAG = `gridmet-${YEAR}`;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");
const FILE_DIR = join(OUT_DIR, TAG);

const BASE = "https://www.northwestknowledge.net/metdata/data";
const VARIABLES = ["pr", "tmmn", "tmmx"];
const NLDI = "https://api.water.usgs.gov/nldi/linked-data";
const GAGES = [
  { id: "USGS-06934500", name: "Missouri River at Hermann, MO" },
  { id: "USGS-06805500", name: "Platte River at Louisville, NE" },
];
const SIMPLIFY_DEG = 1 / 96;          // a quarter of a 1/24 degree cell
const PROBE_ORIGIN = "https://example.org";

// ── attributes ────────────────────────────────────────────────────────────────────────────────────
/** An h5wasm attribute as a plain JS value: one number, one string, or an array. */
function attr(attrs, name) {
  const a = attrs?.[name];
  if (!a) return null;
  let v = a.value;
  if (ArrayBuffer.isView(v) || Array.isArray(v)) v = v.length === 1 ? v[0] : Array.from(v, (x) => (typeof x === "bigint" ? Number(x) : x));
  if (typeof v === "bigint") v = Number(v);
  return v;
}

/** "days since 1900-01-01 00:00:00" -> epoch ms for a value in those units, or null if unparseable. */
function cfTimeParser(units) {
  const m = /^\s*(seconds?|minutes?|hours?|days?)\s+since\s+(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/i.exec(units ?? "");
  if (!m) return null;
  const step = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[1][0].toLowerCase()];
  const origin = Date.UTC(+m[2], +m[3] - 1, +m[4], +(m[5] ?? 0), +(m[6] ?? 0), +(m[7] ?? 0));
  return (v) => origin + v * step;
}

// ── download ──────────────────────────────────────────────────────────────────────────────────────
async function probe(url) {
  const res = await fetch(url, { method: "HEAD", headers: { Origin: PROBE_ORIGIN } });
  return {
    status: res.status,
    bytes: Number(res.headers.get("content-length")) || null,
    allow_origin: res.headers.get("access-control-allow-origin"),
    last_modified: res.headers.get("last-modified"),
  };
}

async function download(url, path) {
  // The marker holds the byte count of a download that finished, so an interrupted file is fetched again.
  const marker = `${path}.bytes`;
  if (existsSync(path) && existsSync(marker) && statSync(path).size === Number(readFileSync(marker, "utf8"))) {
    return { path, fetched: false };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const expected = Number(res.headers.get("content-length"));
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
  const size = statSync(path).size;
  if (expected && size !== expected) throw new Error(`${url}: got ${size} bytes, the server sent ${expected}`);
  const sig = readFileSync(path).subarray(0, 8);
  if (sig[1] !== 0x48 || sig[2] !== 0x44 || sig[3] !== 0x46) {
    throw new Error(`${url}: not an HDF5 (NetCDF4) file; first bytes ${Array.from(sig, (b) => b.toString(16)).join(" ")}`);
  }
  writeFileSync(marker, String(size));
  return { path, fetched: true };
}

// ── describe ──────────────────────────────────────────────────────────────────────────────────────
/** Reads what the page must know about one gridMET file. Throws on anything the page cannot use. */
function describe(path, name) {
  const f = new h5wasm.File(path, "r");
  try {
    const entries = f.keys().map((k) => ({ k, item: f.get(k) })).filter(({ item }) => item && Array.isArray(item.shape));
    const oneD = entries.filter(({ item }) => item.shape.length === 1);
    const byUnits = (re) => oneD.find(({ item }) => re.test(String(attr(item.attrs, "units") ?? "")));
    const time = byUnits(/\ssince\s/i);
    const lat = byUnits(/degrees?_?north/i) ?? oneD.find(({ k }) => /^lat(itude)?$/i.test(k));
    const lon = byUnits(/degrees?_?east/i) ?? oneD.find(({ k }) => /^lon(gitude)?$/i.test(k));
    const data = entries.filter(({ item }) => item.shape.length === 3);
    if (!time) throw new Error(`${name}: no 1-D coordinate with CF "since" units; the page could not select a day`);
    if (!lat || !lon) throw new Error(`${name}: no latitude/longitude coordinate found`);
    if (data.length !== 1) throw new Error(`${name}: expected one 3-D variable, found ${data.map((d) => d.k).join(", ") || "none"}`);

    const v = data[0];
    const toMs = cfTimeParser(attr(time.item.attrs, "units"));
    if (!toMs) throw new Error(`${name}: time units "${attr(time.item.attrs, "units")}" do not parse as CF`);
    const t = Array.from(time.item.value, Number);
    const latV = Array.from(lat.item.value, Number);
    const lonV = Array.from(lon.item.value, Number);
    const step = (a) => (a.length > 1 ? (a.at(-1) - a[0]) / (a.length - 1) : null);
    for (let i = 1; i < t.length; i++) {
      if (t[i] - t[i - 1] !== t[1] - t[0]) throw new Error(`${name}: time steps are not uniform at index ${i}`);
    }
    let chunks = null;
    try { chunks = v.item.metadata?.chunks ?? null; } catch { /* metadata is informative only */ }

    return {
      variable: v.k,
      dtype: String(v.item.dtype),
      shape: v.item.shape,
      chunks,
      attrs: Object.fromEntries(["units", "long_name", "standard_name", "scale_factor", "add_offset",
        "_FillValue", "missing_value", "_Unsigned"].map((a) => [a, attr(v.item.attrs, a)]).filter(([, x]) => x != null)),
      time: {
        name: time.k, units: attr(time.item.attrs, "units"), calendar: attr(time.item.attrs, "calendar"),
        n: t.length, first: new Date(toMs(t[0])).toISOString(), last: new Date(toMs(t.at(-1))).toISOString(),
        step_days: (toMs(t[1]) - toMs(t[0])) / 864e5,
      },
      lat: { name: lat.k, n: latV.length, first: latV[0], last: latV.at(-1), step: step(latV) },
      lon: { name: lon.k, n: lonV.length, first: lonV[0], last: lonV.at(-1), step: step(lonV) },
    };
  } finally {
    f.close();
  }
}

// ── basins ────────────────────────────────────────────────────────────────────────────────────────
function perpDist([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(x - x1, y - y1);
  const u = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  return Math.hypot(x - (x1 + u * dx), y - (y1 + u * dy));
}

/** Iterative Douglas-Peucker over one closed ring; keeps the ring closed and at least 4 points. */
function simplifyRing(ring, tol) {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = perpDist(ring[i], ring[a], ring[b]);
      if (d > max) { max = d; idx = i; }
    }
    if (idx > 0 && max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : ring;
}

function simplifyGeometry(geom, tol) {
  const polys = geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
  const simplified = polys.map((rings) => rings.map((r) => simplifyRing(r, tol)));
  return geom.type === "MultiPolygon"
    ? { type: "MultiPolygon", coordinates: simplified }
    : { type: "Polygon", coordinates: simplified[0] };
}

const vertexCount = (geom) => (geom.type === "MultiPolygon" ? geom.coordinates.flat(2) : geom.coordinates.flat(1)).length;
const bboxOf = (geom) => {
  const pts = geom.type === "MultiPolygon" ? geom.coordinates.flat(2) : geom.coordinates.flat(1);
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])),
          Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
};

// ── run ───────────────────────────────────────────────────────────────────────────────────────────
mkdirSync(FILE_DIR, { recursive: true });
console.log(`gridMET ${YEAR} -> case-studies/data/${TAG}\n`);

const files = [];
for (const v of VARIABLES) {
  const name = `${v}_${YEAR}.nc`;
  const url = `${BASE}/${name}`;
  const t0 = Date.now();
  const cors = await probe(url);
  if (cors.status !== 200) throw new Error(`${url}: HEAD returned HTTP ${cors.status}`);
  const { path, fetched } = await download(url, join(FILE_DIR, name));
  const d = describe(path, name);
  const bytes = statSync(path).size;
  files.push({ key: v, name, url, mirror: `${TAG}/${name}`, bytes, cors, ...d });
  console.log(`${name.padEnd(14)} ${(bytes / 1048576).toFixed(1)} MiB  ${d.variable} ${d.dtype} [${d.shape.join(" x ")}]  `
    + `${d.attrs.units ?? "?"}  scale ${d.attrs.scale_factor ?? 1} offset ${d.attrs.add_offset ?? 0}  `
    + `${d.time.first.slice(0, 10)}..${d.time.last.slice(0, 10)}  chunks ${JSON.stringify(d.chunks)}  `
    + `CORS ${cors.allow_origin ?? "none"}  ${fetched ? "downloaded" : "cached"} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// The three files must share one grid and one calendar, or the page's per-day combines would misalign.
const ref = files[0];
for (const f of files.slice(1)) {
  for (const k of ["lat", "lon"]) {
    if (f[k].n !== ref[k].n || Math.abs(f[k].first - ref[k].first) > 1e-6 || Math.abs(f[k].last - ref[k].last) > 1e-6) {
      throw new Error(`${f.name}: ${k} differs from ${ref.name}`);
    }
  }
  if (f.time.n !== ref.time.n || f.time.first !== ref.time.first) throw new Error(`${f.name}: time axis differs from ${ref.name}`);
}

const basins = [];
for (const g of GAGES) {
  const res = await fetch(`${NLDI}/nwissite/${g.id}/basin`);
  if (!res.ok) throw new Error(`NLDI ${g.id}: HTTP ${res.status}`);
  const fc = await res.json();
  const geom = fc.features[0].geometry;
  const simple = simplifyGeometry(geom, SIMPLIFY_DEG);
  basins.push({ type: "Feature", properties: { gage: g.id, name: g.name,
    vertices_nldi: vertexCount(geom), vertices: vertexCount(simple), bbox: bboxOf(simple) }, geometry: simple });
  console.log(`\nNLDI  ${g.id}  ${g.name}  ${vertexCount(geom)} -> ${vertexCount(simple)} vertices  bbox ${bboxOf(simple).map((x) => x.toFixed(2)).join(", ")}`);
}
writeFileSync(join(OUT_DIR, `${TAG}-basins.geojson`), JSON.stringify({ type: "FeatureCollection", features: basins }));

const manifest = {
  generated: new Date().toISOString(),
  generator: "case-studies/build_case_study9_data.mjs",
  source: "https://www.climatologylab.org/gridmet.html",
  license: "CC0 1.0 (gridMET, Abatzoglou 2013)",
  citation: "Abatzoglou, J. T. (2013), Development of gridded surface meteorological data for ecological applications and modelling, International Journal of Climatology, 33: 121-131",
  year: YEAR,
  probe_origin: PROBE_ORIGIN,
  grid: { lat: ref.lat, lon: ref.lon },
  basins: `${TAG}-basins.geojson`,
  simplify_deg: SIMPLIFY_DEG,
  files,
};
writeFileSync(join(OUT_DIR, `${TAG}-manifest.json`), JSON.stringify(manifest, null, 1));
console.log(`\nwrote ${TAG}-manifest.json and ${TAG}-basins.geojson`);
console.log("Provenance belongs in data/README.txt (protocol §0.4): source, files, accessed date, license.");
