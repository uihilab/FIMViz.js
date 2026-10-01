// build_case_study10_data.mjs — riverine flood hazard for one state, today and in 2050, for case_study10.html.
//
// Usage:  node case-studies/build_case_study10_data.mjs [--country USA] [--adm1 Louisiana] [--unit parish] [--full]
//
// The defaults build Louisiana. Any geoBoundaries country and first-level unit works: --country PAK
// --adm1 Sindh --unit district builds the lower Indus, and the page reads either with ?region=<slug>.
//
// Writes into case-studies/data/ (git-ignored, see data/.gitignore), with <slug> the lower-cased --adm1:
//   <slug>-flood/hist-rpNNNNN.tif      historical (WATCH, 1980) riverine depth, one file per return period
//   <slug>-flood/rcp85-2050-<gcm>.tif  RCP8.5 2050 riverine depth at the 100-year return period, one per GCM
//   <slug>-flood/pop-2020.tif          WorldPop 2020 population count, 1 km
//   <slug>-units.geojson               geoBoundaries ADM2 units whose label point falls in the ADM1 unit
//   <slug>-outline.geojson             geoBoundaries ADM1 outline
//   <slug>-flood-manifest.json         sources, licenses, crop, and what each file holds
//
// Sources.
//   WRI Aqueduct Floods v2 (riverine), 30 arc-seconds, depth in meters:
//     https://wri-projects.s3.amazonaws.com/AqueductFloodTool/download/v2/<name>.tif
//     "available without restriction on use or distribution", attribution to WRI requested.
//   WorldPop 2020 population counts, 1 km aggregated, CC BY 4.0:
//     https://data.worldpop.org/GIS/Population/Global_2000_2020_1km/2020/<ISO3>/<iso3>_ppp_2020_1km_Aggregated.tif
//   geoBoundaries gbOpen ADM1 and ADM2, license as the API reports it (recorded in the manifest):
//     https://www.geoboundaries.org/api/current/gbOpen/<ISO3>/ADM{1,2}/
//
// Why the rasters are cropped. The Aqueduct files are global (43200 x 21600 cells), which the page
// could not read whole. The crop is read with HTTP range requests through geotiff.js, so only the
// strips or tiles over the state are fetched; --full downloads each file whole instead, for a host that
// refuses range requests. The crop keeps the source grid: no resampling, only a window.
//
// Why nodata becomes NaN. The page opens these files as URL roots (Dataset.fromURL and URL-backed
// axes), and that path does not apply a file's GDAL_NODATA tag (Section 4.1). NaN needs no tag.

import { mkdirSync, writeFileSync, existsSync, readFileSync, createWriteStream, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { fromUrl, fromFile } from "geotiff";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const FULL = process.argv.includes("--full");
const COUNTRY = arg("country", "USA").toUpperCase();
const ADM1 = arg("adm1", "Louisiana");
const UNIT = arg("unit", COUNTRY === "USA" && /louisiana/i.test(ADM1) ? "parish" : "county");
const SLUG = ADM1.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");
const TAG = `${SLUG}-flood`;
const FILE_DIR = join(OUT_DIR, TAG);
const CACHE_DIR = join(OUT_DIR, `.${SLUG}-downloads`);

// The three bases can be overridden from the environment, which the offline test harness uses.
// Two hosts have served the same Aqueduct file names; the first that answers is used and recorded.
const AQ_BASES = process.env.CS10_AQ ? [process.env.CS10_AQ] : [
  "https://wri-projects.s3.amazonaws.com/AqueductFloodTool/download/v2",
  "https://aqueduct.wridata.org/AqueductFloods20",
];
let AQ = AQ_BASES[0];
const RETURN_PERIODS = [2, 5, 10, 25, 50, 100, 250, 500, 1000];
// The riverine GCMs as the Aqueduct file names spell them. A model the server lacks is recorded and
// skipped; the page needs at least three.
const GCMS = ["00000NorESM1-M", "0000GFDL-ESM2M", "0000HadGEM2-ES", "00IPSL-CM5A-LR", "MIROC-ESM-CHEM"];
const FUTURE = { scenario: "rcp8p5", year: 2050, rp: 100 };
const WORLDPOP = process.env.CS10_WORLDPOP
  ?? `https://data.worldpop.org/GIS/Population/Global_2000_2020_1km/2020/${COUNTRY}/${COUNTRY.toLowerCase()}_ppp_2020_1km_Aggregated.tif`;
const GB = process.env.CS10_GB ?? `https://www.geoboundaries.org/api/current/gbOpen/${COUNTRY}`;
const PAD_DEG = 0.1;
const WET_M = 0.05;                // for the summary counts only; the page sets its own threshold

const rp5 = (rp) => String(rp).padStart(5, "0");
const aqName = (scen, model, year, rp) => `inunriver_${scen}_${model}_${year}_rp${rp5(rp)}.tif`;

// ── vector helpers ──────────────────────────────────────────────────────────────────────────────
const partsOf = (g) => (g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]);
function bboxOf(g) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const rings of partsOf(g)) for (const [x, y] of rings[0]) {
    if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y;
  }
  return [w, s, e, n];
}
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Inside a polygon: inside an outline and outside that part's holes. */
const inGeom = (x, y, g) => partsOf(g).some((rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((h) => inRing(x, y, h)));
/** Area-weighted centroid of the largest part's outline, which lies inside for the district shapes here. */
function labelPoint(g) {
  let best = null, bestA = 0;
  for (const rings of partsOf(g)) {
    const r = rings[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
      a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
    }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
  }
  return best;
}

async function boundaries(level) {
  const res = await fetch(`${GB}/ADM${level}/`);
  if (!res.ok) throw new Error(`geoBoundaries ADM${level}: HTTP ${res.status}`);
  const meta = await res.json();
  const url = meta.simplifiedGeometryGeoJSON || meta.gjDownloadURL;
  if (!url) throw new Error(`geoBoundaries ADM${level}: no GeoJSON URL in the API response`);
  const gj = await (await fetch(url)).json();
  return { meta, url, gj };
}

// ── GeoTIFF writer ──────────────────────────────────────────────────────────────────────────────
// geotiff.js writes 8-bit samples only, so depths and population counts need their own writer. This
// is the smallest valid one: little-endian, one uncompressed strip, float32, EPSG:4326 GeoKeys.
function writeFloat32GeoTiff(px, width, height, { west, north, resX, resY }) {
  const entries = [                                  // [tag, type, count, value(s)]; types: 3 SHORT, 4 LONG, 12 DOUBLE
    [256, 4, 1, [width]], [257, 4, 1, [height]], [258, 3, 1, [32]], [259, 3, 1, [1]], [262, 3, 1, [1]],
    [273, 4, 1, [0]], [277, 3, 1, [1]], [278, 4, 1, [height]], [279, 4, 1, [width * height * 4]],
    [284, 3, 1, [1]], [339, 3, 1, [3]],
    [33550, 12, 3, [resX, resY, 0]],
    [33922, 12, 6, [0, 0, 0, west, north, 0]],
    // GeoKeyDirectory: version 1.1.0, three keys: model geographic, raster pixel-is-area, EPSG:4326.
    [34735, 3, 16, [1, 1, 0, 3, 1024, 0, 1, 2, 1025, 0, 1, 1, 2048, 0, 1, 4326]],
  ];
  const size = { 3: 2, 4: 4, 12: 8 };
  const ifdOffset = 8, ifdBytes = 2 + entries.length * 12 + 4;
  let extra = ifdOffset + ifdBytes;
  const extraOf = entries.map(([, type, count]) => {
    const n = size[type] * count;
    if (n <= 4) return null;
    const at = extra; extra += n + (n % 2); return at;
  });
  const dataOffset = extra + (extra % 4 ? 4 - (extra % 4) : 0);
  entries[5][3] = [dataOffset];                      // StripOffsets
  const buf = new ArrayBuffer(dataOffset + width * height * 4);
  const dv = new DataView(buf);
  dv.setUint8(0, 0x49); dv.setUint8(1, 0x49); dv.setUint16(2, 42, true); dv.setUint32(4, ifdOffset, true);
  dv.setUint16(ifdOffset, entries.length, true);
  const put = (at, type, v) => (type === 3 ? dv.setUint16(at, v, true) : type === 4 ? dv.setUint32(at, v, true) : dv.setFloat64(at, v, true));
  entries.forEach(([tag, type, count, vals], k) => {
    const e = ifdOffset + 2 + k * 12;
    dv.setUint16(e, tag, true); dv.setUint16(e + 2, type, true); dv.setUint32(e + 4, count, true);
    if (extraOf[k] == null) vals.forEach((v, i) => put(e + 8 + i * size[type], type, v));
    else { dv.setUint32(e + 8, extraOf[k], true); vals.forEach((v, i) => put(extraOf[k] + i * size[type], type, v)); }
  });
  dv.setUint32(ifdOffset + 2 + entries.length * 12, 0, true);   // no next IFD
  new Float32Array(buf, dataOffset, width * height).set(px);
  return buf;
}

// ── raster crop ─────────────────────────────────────────────────────────────────────────────────
async function download(url, path) {
  const marker = `${path}.bytes`;
  if (existsSync(path) && existsSync(marker) && statSync(path).size === Number(readFileSync(marker, "utf8"))) return path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
  writeFileSync(marker, String(statSync(path).size));
  return path;
}

async function head(url) {
  const res = await fetch(url, { method: "HEAD", headers: { Origin: "https://example.org" } });
  return { status: res.status, bytes: Number(res.headers.get("content-length")) || null,
           accept_ranges: res.headers.get("accept-ranges"), allow_origin: res.headers.get("access-control-allow-origin") };
}

/**
 * Reads the window of `url` that covers `aoi` and writes it as a float32 GeoTIFF in EPSG:4326 with
 * NaN for nodata. Returns what the manifest records.
 */
async function crop(url, aoi, outPath, { name }) {
  const probe = await head(url);
  if (probe.status !== 200) return { url, status: probe.status, skipped: true };
  // Range reads first. A host that answers HEAD but fails ranged GETs (WorldPop did) gets the whole
  // file downloaded into the cache instead, which --full forces for every file.
  const whole = async () => { mkdirSync(CACHE_DIR, { recursive: true }); return fromFile(await download(url, join(CACHE_DIR, url.split("/").pop()))); };
  let tiff, mode = FULL ? "download" : "range";
  if (FULL) tiff = await whole();
  else {
    try { tiff = await fromUrl(url); await tiff.getImage(); }
    catch (e) {
      console.log(`  ${name}: range reads failed (${e.message}); downloading ${probe.bytes ? `${(probe.bytes / 1048576).toFixed(0)} MiB` : "the whole file"}`);
      tiff = await whole(); mode = "download";
    }
  }
  const img = await tiff.getImage();
  const [ox, oy] = img.getOrigin();
  const [rx, ry] = img.getResolution();           // ry is negative for a north-up grid
  const W = img.getWidth(), H = img.getHeight();
  if (ry >= 0) throw new Error(`${name}: expected a north-up grid (negative y resolution), got ${ry}`);
  const geoKeys = img.getGeoKeys() || {};
  const epsg = geoKeys.GeographicTypeGeoKey ?? geoKeys.ProjectedCSTypeGeoKey ?? null;
  if (epsg !== 4326 && !(geoKeys.GTModelTypeGeoKey === 2)) {
    throw new Error(`${name}: expected geographic WGS 84, got GeoKeys ${JSON.stringify(geoKeys)}`);
  }
  const x0 = Math.max(0, Math.floor((aoi[0] - ox) / rx));
  const x1 = Math.min(W, Math.ceil((aoi[2] - ox) / rx));
  const y0 = Math.max(0, Math.floor((oy - aoi[3]) / -ry));
  const y1 = Math.min(H, Math.ceil((oy - aoi[1]) / -ry));
  const [band] = await img.readRasters({ window: [x0, y0, x1, y1] });
  const nd = img.getGDALNoData();
  const w = x1 - x0, h = y1 - y0;
  const px = new Float32Array(w * h);
  let nodata = 0, min = Infinity, max = -Infinity, sum = 0, wet = 0;
  for (let i = 0; i < px.length; i++) {
    const v = Number(band[i]);
    // Depth and population are never negative, so a negative value is a fill value whether or not
    // the file declares it (a missing GDAL_NODATA tag would otherwise let -99999 through as data).
    if (!Number.isFinite(v) || (nd != null && v === nd) || v < 0) { px[i] = NaN; nodata++; continue; }
    px[i] = v;
    if (v < min) min = v; if (v > max) max = v; sum += v; if (v > WET_M) wet++;
  }
  const west = ox + x0 * rx, north = oy + y0 * ry;
  const buf = writeFloat32GeoTiff(px, w, h, { west, north, resX: rx, resY: -ry });
  writeFileSync(outPath, Buffer.from(buf));
  return {
    url, read_mode: mode, source_bytes: probe.bytes, accept_ranges: probe.accept_ranges, allow_origin: probe.allow_origin,
    source_size: [W, H], source_nodata: nd, tiled: img.isTiled, compression: img.fileDirectory?.Compression ?? null,
    window: [x0, y0, x1, y1], width: w, height: h, bounds: { west, north, east: west + w * rx, south: north + h * ry },
    res_deg: [rx, -ry], nodata_cells: nodata, min: +min.toFixed(3), max: +max.toFixed(3),
    sum: +sum.toFixed(1), cells_above_0_05m: wet, bytes: statSync(outPath).size,
  };
}

// ── run ─────────────────────────────────────────────────────────────────────────────────────────
mkdirSync(FILE_DIR, { recursive: true });
if (FULL) mkdirSync(CACHE_DIR, { recursive: true });
console.log(`${ADM1} (${COUNTRY}) riverine flood hazard -> case-studies/data/${TAG}\n`);

const adm1 = await boundaries(1);
const want = new RegExp(`^${ADM1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
const region = adm1.gj.features.find((f) => want.test((f.properties?.shapeName ?? "").trim()));
if (!region) throw new Error(`geoBoundaries ${COUNTRY} ADM1: no unit named ${ADM1} (have ${adm1.gj.features.map((f) => f.properties?.shapeName).join(", ")})`);
const sb = bboxOf(region.geometry);
const AOI = [sb[0] - PAD_DEG, sb[1] - PAD_DEG, sb[2] + PAD_DEG, sb[3] + PAD_DEG];
writeFileSync(join(OUT_DIR, `${SLUG}-outline.geojson`), JSON.stringify({ type: "FeatureCollection", features: [region] }));
console.log(`geoBoundaries ADM1 ${ADM1}  bbox ${sb.map((v) => v.toFixed(3)).join(", ")}  (${adm1.meta.boundaryLicense ?? "license n/a"})`);

const adm2 = await boundaries(2);
const districts = adm2.gj.features.filter((f) => { const p = labelPoint(f.geometry); return p && inGeom(p[0], p[1], region.geometry); })
  .map((f) => ({ type: "Feature", properties: { name: f.properties.shapeName, id: f.properties.shapeID }, geometry: f.geometry }));
if (districts.length < 10) throw new Error(`only ${districts.length} ADM2 units fall in ${ADM1}; expected more`);
writeFileSync(join(OUT_DIR, `${SLUG}-units.geojson`), JSON.stringify({ type: "FeatureCollection", features: districts }));
console.log(`geoBoundaries ADM2  ${districts.length} ${UNIT} units in ${ADM1}  (${adm2.meta.boundaryLicense ?? "license n/a"})\n`);

for (const base of AQ_BASES) {
  const r = await head(`${base}/${aqName("historical", "000000000WATCH", 1980, 100)}`).catch(() => ({ status: 0 }));
  if (r.status === 200) { AQ = base; break; }
  console.log(`Aqueduct host ${base}: HTTP ${r.status}, trying the next`);
}
console.log(`Aqueduct host: ${AQ}\n`);

const hist = [];
for (const rp of RETURN_PERIODS) {
  const name = `hist-rp${rp5(rp)}.tif`;
  const r = await crop(`${AQ}/${aqName("historical", "000000000WATCH", 1980, rp)}`, AOI, join(FILE_DIR, name), { name });
  if (r.skipped) throw new Error(`historical RP${rp}: HTTP ${r.status}; every return period is required`);
  hist.push({ rp, file: `${TAG}/${name}`, ...r, all_dry: r.cells_above_0_05m === 0 });
  console.log(`historical RP${String(rp).padStart(4)}  ${r.width}x${r.height}  max ${r.max} m  cells > ${WET_M} m: ${r.cells_above_0_05m}  ranges ${r.accept_ranges ?? "?"}  CORS ${r.allow_origin ?? "none"}`);
}

const future = [], missing = [];
for (const gcm of GCMS) {
  const label = gcm.replace(/^0+/, "");
  const name = `rcp85-2050-${label}.tif`;
  const r = await crop(`${AQ}/${aqName(FUTURE.scenario, gcm, FUTURE.year, FUTURE.rp)}`, AOI, join(FILE_DIR, name), { name });
  if (r.skipped) { missing.push({ gcm, status: r.status }); console.log(`RCP8.5 2050 ${label}: HTTP ${r.status}, skipped`); continue; }
  future.push({ gcm: label, file: `${TAG}/${name}`, ...r });
  console.log(`RCP8.5 2050 RP100 ${label.padEnd(16)} max ${r.max} m  cells > ${WET_M} m: ${r.cells_above_0_05m}`);
}
if (future.length < 3) throw new Error(`only ${future.length} GCMs available; the ensemble needs at least 3`);

const pop = await crop(WORLDPOP, AOI, join(FILE_DIR, "pop-2020.tif"), { name: "pop-2020.tif" });
if (pop.skipped) throw new Error(`WorldPop: HTTP ${pop.status}`);
console.log(`\nWorldPop 2020 1 km  ${pop.width}x${pop.height}  population in the crop ${Math.round(pop.sum).toLocaleString()}`);

const manifest = {
  generated: new Date().toISOString(),
  generator: "case-studies/build_case_study10_data.mjs",
  region: { country: COUNTRY, adm1: ADM1, slug: SLUG, unit: UNIT },
  aoi: AOI, pad_deg: PAD_DEG,
  sources: {
    aqueduct: { base: AQ, product: "Aqueduct Floods v2, riverine inundation depth (m), 30 arc-seconds",
      license: "WRI: available without restriction on use or distribution; attribution to WRI requested",
      citation: "World Resources Institute (2020) Aqueduct Floods Hazard Maps, version 2" },
    worldpop: { url: WORLDPOP, product: "WorldPop 2020 unconstrained population counts, 1 km aggregated", license: "CC BY 4.0" },
    geoboundaries: { adm1: adm1.url, adm2: adm2.url, license_adm1: adm1.meta.boundaryLicense ?? null,
      license_adm2: adm2.meta.boundaryLicense ?? null, source_adm2: adm2.meta.boundarySource ?? null },
  },
  future_scenario: FUTURE,
  historical: hist, future, missing_gcms: missing, population: { file: `${TAG}/pop-2020.tif`, ...pop },
  districts: `${SLUG}-units.geojson`, outline: `${SLUG}-outline.geojson`, n_districts: districts.length,
};
writeFileSync(join(OUT_DIR, `${TAG}-manifest.json`), JSON.stringify(manifest, null, 1));
console.log(`\nwrote ${TAG}-manifest.json`);
console.log("Provenance belongs in data/README.txt (protocol §0.4): sources, licenses, accessed date.");
