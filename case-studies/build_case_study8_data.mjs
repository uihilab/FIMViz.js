// build_case_study8_data.mjs — crops DWR's gridded weather generator to the Feather River basin.
//
// Usage:  node case-studies/build_case_study8_data.mjs [--keep-downloads]
//
// Writes into case-studies/data/ (git-ignored, see data/.gitignore):
//   oroville-2017-s<NN>.nc         one scenario, Jan-Feb 2017, pr/tmin/tmax, CF NetCDF4
//   oroville-2017-basin.geojson    the Feather River basin above USGS-11407000, from NLDI
//   oroville-2017-manifest.json    scenarios, sources, the crop, and the date rule
//
// Source: "Gridded Weather Generator Perturbations of Historical Detrended and Stochastically Generated
// Temperature and Precipitation for the State of CA and HUC8s", California DWR,
// https://data.cnra.ca.gov/dataset/ca-weather-generator-gridded-climate-pr-tmin-tmax-2023
// ProductA_100yr, Statewide NetCDF, file <N>_WGEN-A-100yr_2015_2018.nc per scenario (about 1 GB each).
//
// Why the files are rewritten. The DWR files index days with a `date` dimension holding integer day
// numbers and no CF `units`. The NetCDF4 decoder selects a day only through a CF time coordinate, so
// it reads the first day for every index, and FIMViz's parseSciwrid refuses such a series. This
// builder copies the crop out with h5wasm and adds `time` in "days since 2015-01-01".
//
// The date rule. Each file holds 1461 days, and its name says 2015-2018, which is 2015-01-01 through
// 2018-12-31. The builder checks that `date` has 1461 consecutive values and maps index k to
// 2015-01-01 + k days. It does not interpret the day numbers themselves.

import { mkdirSync, statSync, existsSync, rmSync, readFileSync, writeFileSync, createWriteStream } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const h5wasm = await import("h5wasm/node");
await h5wasm.ready;

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");
const CACHE_DIR = join(OUT_DIR, ".wgen-downloads");
const TAG = "oroville-2017";
const KEEP_DOWNLOADS = process.argv.includes("--keep-downloads");

const BOX_SHARED = "ettbry41ob8x4d4xsed89owojmj0nd5m";
const MIN_BYTES = 1e9;                    // the 2015-2018 files are about 1.02 GB
const DATASET_URL = "https://data.cnra.ca.gov/dataset/ca-weather-generator-gridded-climate-pr-tmin-tmax-2023";
const SCENARIO_LIST_URL = "https://data.cnra.ca.gov/dataset/b3b56a16-298c-4c63-8a18-126b48e78d84/resource/"
  + "6fcaf8df-7c87-4abc-8dc3-a2a9191e412f/download/cc.thermodynamic.change_list.xlsx";

// From the scenario list above. Columns: temperature change (°C), % change in mean precipitation,
// % change in the precipitation quantile. The page reports the quantile column as given.
const SCENARIOS = [
  { n: 1, fileId: "1860349509270", dT: 0, pctMean: 0, pctQuantile: 0 },
  { n: 11, fileId: "1860355885746", dT: 1, pctMean: 0, pctQuantile: 7 },
  { n: 12, fileId: "1860374853282", dT: 2, pctMean: 0, pctQuantile: 7 },
  { n: 13, fileId: "1860371226690", dT: 3, pctMean: 0, pctQuantile: 7 },
  { n: 14, fileId: "1860375589397", dT: 4, pctMean: 0, pctQuantile: 7 },
  { n: 15, fileId: "1860378098208", dT: 5, pctMean: 0, pctQuantile: 7 },
];

const GAGE = "USGS-11407000";                     // Feather River at Oroville
const NLDI = "https://api.water.usgs.gov/nldi/linked-data";
const PAD_DEG = 0.25;                             // margin around the basin, so a mask has data at its edge
const FILE_START = Date.UTC(2015, 0, 1);
const WINDOW = { from: Date.UTC(2017, 0, 1), to: Date.UTC(2017, 1, 28) };   // inclusive
const VARIABLES = ["pr", "tmin", "tmax"];
const DAY_MS = 86400e3;

let fetchedBytes = 0;

async function download(s) {
  const path = join(CACHE_DIR, `${s.n}_WGEN-A-100yr_2015_2018.nc`);
  // The marker holds the byte count of a download that finished, so an interrupted file is fetched again.
  const marker = `${path}.bytes`;
  if (existsSync(path) && existsSync(marker) && statSync(path).size === Number(readFileSync(marker, "utf8"))) return path;
  const url = `https://cadwr.box.com/index.php?rm=box_download_shared_file&shared_name=${BOX_SHARED}&file_id=f_${s.fileId}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`scenario ${s.n}: download failed, HTTP ${res.status}`);
  const expected = Number(res.headers.get("content-length"));
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
  const size = statSync(path).size;
  if (expected && size !== expected) throw new Error(`scenario ${s.n}: got ${size} bytes, the server sent ${expected}`);
  if (size < MIN_BYTES) throw new Error(`scenario ${s.n}: got ${size} bytes, far below the ~1 GB file`);
  writeFileSync(marker, String(size));
  const sig = readFileSync(path).subarray(0, 4);
  if (sig[1] !== 0x48 || sig[2] !== 0x44 || sig[3] !== 0x46) throw new Error(`scenario ${s.n}: not an HDF5 file`);
  fetchedBytes += size;
  return path;
}

const indexRange = (coords, lo, hi) => {
  const idx = [];
  for (let i = 0; i < coords.length; i++) if (coords[i] >= lo && coords[i] <= hi) idx.push(i);
  if (!idx.length) throw new Error(`no coordinate within [${lo}, ${hi}]`);
  if (idx.at(-1) - idx[0] + 1 !== idx.length) throw new Error("coordinates are not monotonic");
  return [idx[0], idx.at(-1) + 1];
};

/** Crops one DWR file and writes it as CF NetCDF4. Returns what the manifest records about it. */
function crop(s, path, bbox) {
  const src = new h5wasm.File(path, "r");
  const lat = Float64Array.from(src.get("lat").value);
  const lon = Float64Array.from(src.get("lon").value);
  const date = Array.from(src.get("date").value, Number);
  if (date.length !== 1461 || date.some((d, k) => d !== date[0] + k)) {
    throw new Error(`scenario ${s.n}: expected 1461 consecutive day numbers in \`date\``);
  }
  const t0 = Math.round((WINDOW.from - FILE_START) / DAY_MS);
  const t1 = Math.round((WINDOW.to - FILE_START) / DAY_MS) + 1;
  const [j0, j1] = indexRange(lat, bbox[1] - PAD_DEG, bbox[3] + PAD_DEG);
  const [i0, i1] = indexRange(lon, bbox[0] - PAD_DEG, bbox[2] + PAD_DEG);
  const nt = t1 - t0, ny = j1 - j0, nx = i1 - i0;

  const name = `${TAG}-s${String(s.n).padStart(2, "0")}.nc`;
  const outPath = join(OUT_DIR, name);
  const out = new h5wasm.File(outPath, "w");
  const time = out.create_dataset({ name: "time", data: Float64Array.from({ length: nt }, (_, k) => t0 + k), shape: [nt], dtype: "<f8" });
  time.create_attribute("units", "days since 2015-01-01");
  time.create_attribute("calendar", "standard");
  time.create_attribute("standard_name", "time");
  const latOut = out.create_dataset({ name: "lat", data: lat.slice(j0, j1), shape: [ny], dtype: "<f8" });
  latOut.create_attribute("units", "degrees_north");
  const lonOut = out.create_dataset({ name: "lon", data: lon.slice(i0, i1), shape: [nx], dtype: "<f8" });
  lonOut.create_attribute("units", "degrees_east");
  time.make_scale("time"); latOut.make_scale("lat"); lonOut.make_scale("lon");

  const stats = {};
  for (const v of VARIABLES) {
    const srcVar = src.get(v);
    const fill = Number(srcVar.attrs._FillValue?.value ?? -9999);
    const raw = srcVar.slice([[t0, t1], [j0, j1], [i0, i1]]);
    const data = new Float32Array(raw.length);
    let min = Infinity, max = -Infinity, missing = 0;
    for (let k = 0; k < raw.length; k++) {
      const x = raw[k];
      if (x === fill || Number.isNaN(x)) { data[k] = NaN; missing++; continue; }
      data[k] = x;
      if (x < min) min = x;
      if (x > max) max = x;
    }
    const dv = out.create_dataset({ name: v, data, shape: [nt, ny, nx], dtype: "<f4" });
    dv.create_attribute("units", String(srcVar.attrs.units?.value ?? ""));
    dv.create_attribute("long_name", String(srcVar.attrs["Full Name"]?.value ?? v));
    dv.attach_scale(0, "time"); dv.attach_scale(1, "lat"); dv.attach_scale(2, "lon");
    stats[v] = { min: +min.toFixed(2), max: +max.toFixed(2), missing };
  }
  out.create_attribute("source", `${DATASET_URL} (ProductA_100yr, scenario ${s.n})`);
  out.create_attribute("scenario", s.n);
  out.create_attribute("temperature_change_degC", s.dT);
  out.create_attribute("mean_precipitation_change_pct", s.pctMean);
  out.create_attribute("quantile_precipitation_change_pct", s.pctQuantile);
  out.create_attribute("history", "cropped by case-studies/build_case_study8_data.mjs; time added from the 2015-2018 file span");
  out.close();
  src.close();
  return { name, bytes: statSync(outPath).size, nt, ny, nx, index: { t: [t0, t1], lat: [j0, j1], lon: [i0, i1] }, stats };
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────────
mkdirSync(CACHE_DIR, { recursive: true });
console.log(`DWR weather generator -> case-studies/data   (${TAG})\n`);

const basinRes = await fetch(`${NLDI}/nwissite/${GAGE}/basin`);
if (!basinRes.ok) throw new Error(`NLDI basin: HTTP ${basinRes.status}`);
const basin = await basinRes.json();
const flat = basin.features[0].geometry.coordinates.flat(basin.features[0].geometry.type === "MultiPolygon" ? 2 : 1);
const bbox = [Math.min(...flat.map((p) => p[0])), Math.min(...flat.map((p) => p[1])),
              Math.max(...flat.map((p) => p[0])), Math.max(...flat.map((p) => p[1]))];
writeFileSync(join(OUT_DIR, `${TAG}-basin.geojson`), JSON.stringify(basin));
console.log(`NLDI  ${GAGE} basin bbox ${bbox.map((v) => v.toFixed(3)).join(", ")}\n`);

const files = [];
for (const s of SCENARIOS) {
  const t = Date.now();
  const path = await download(s);
  const c = crop(s, path, bbox);
  files.push({ ...s, ...c });
  console.log(`scenario ${String(s.n).padStart(2)}  +${s.dT} °C  -> ${c.name}  ${c.nt} x ${c.ny} x ${c.nx}  `
    + `${(c.bytes / 1024).toFixed(0)} kB  pr max ${c.stats.pr.max} mm  tmin ${c.stats.tmin.min}..${c.stats.tmin.max} °C  `
    + `(${((Date.now() - t) / 1000).toFixed(0)} s)`);
  if (!KEEP_DOWNLOADS) { rmSync(path, { force: true }); rmSync(`${path}.bytes`, { force: true }); }
}
if (!KEEP_DOWNLOADS) rmSync(CACHE_DIR, { recursive: true, force: true });

const manifest = {
  generated: new Date().toISOString(),
  generator: "case-studies/build_case_study8_data.mjs",
  source: DATASET_URL,
  scenario_list: SCENARIO_LIST_URL,
  product: "ProductA_100yr (statistically perturbed, detrended historical daily weather)",
  gage: GAGE,
  basin: `${TAG}-basin.geojson`,
  basin_bbox: bbox,
  pad_deg: PAD_DEG,
  window: { from: new Date(WINDOW.from).toISOString().slice(0, 10), to: new Date(WINDOW.to).toISOString().slice(0, 10) },
  date_rule: "file index k = 2015-01-01 + k days (1461 consecutive `date` values, file span 2015-2018)",
  units: { pr: "mm/day", tmin: "degC", tmax: "degC" },
  scenarios: files,
  downloaded_bytes: fetchedBytes,
};
writeFileSync(join(OUT_DIR, `${TAG}-manifest.json`), JSON.stringify(manifest, null, 1));
console.log(`\n  ${(fetchedBytes / 1073741824).toFixed(1)} GB downloaded${KEEP_DOWNLOADS ? `, kept in ${CACHE_DIR}` : " and deleted"}.`);
console.log("  Provenance belongs in data/README.txt (protocol §0.4): dataset, scenarios, file ids, accessed date.");
