// scripts/make-perf-data.mjs — writes the progressive grids test-performance.html measures against.
//
// The §4.4 and §4.5 measurements scale with cell count, so cell count has to be the controlled
// variable. The files under assets/SampleFiles cluster between 0.4 and 4.5 MB across four formats,
// which makes them the right input for a per-format table and the wrong input for a curve. This
// writes a ladder instead: one synthetic flood scene rendered at 256², 512², 1024² and 2048²,
// identical in content and geo-referencing at every rung and differing only in grid resolution.
//
// Run from the repository root:
//     node scripts/make-perf-data.mjs                  # 256, 512, 1024, 2048
//     node scripts/make-perf-data.mjs --sizes=256,512  # a subset
//     node scripts/make-perf-data.mjs --out=some/dir
//     node scripts/make-perf-data.mjs --sizes=4096,8192 --only=dep   # the ceiling rungs, one grid each
//
// Output, into case-studies/perf-data/ (add it to .gitignore — regenerate rather than commit; the
// four rungs come to about 89 MB):
//     wse-<n>.tif        float32 water surface elevation, dry cells = nodata (-99999)
//     dep-<n>.tif        float32 depth, dry cells = nodata (-99999)
//     ext-model-<n>.tif  float32 modelled extent, wet = 1, dry = 0, no nodata tag
//     ext-obs-<n>.tif    float32 observed extent, same convention
//     manifest.json      the ladder: rung, cells, wet-cell counts, file names and byte sizes
//
// The extent pair writes dry as 0 and carries no GDAL_NODATA tag, so the harness passes
// `dryValue: 0` to compareExtentMetrics and no measurement depends on how a decoder maps nodata. The
// two continuous grids keep the -99999 convention a real depth or water-surface product uses.
//
// The scene is a closed-form function of position, so the bytes are identical on every machine and
// there is no PRNG seed to record. Zones for zonalStats are built in the harness rather than written
// here, because zonalStats takes rings of [lat, lng] and a GeoJSON file would invite [lng, lat].

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const NODATA = -99999;

// Batesville, Mississippi — the bbox the interface-kit figure uses, so the synthetic scene sits
// where the real sample products sit.
const WEST = -89.97988, EAST = -89.83065, SOUTH = 34.32652, NORTH = 34.40204;

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const SIZES = arg("sizes", "256,512,1024,2048").split(",").map((s) => parseInt(s.trim(), 10));
// The ceiling run (§6: the file size at which the page stops being usable) needs one grid per rung
// rather than four, because a 8192² rung is 268 MB in all.
const ONLY = arg("only", "wse,dep,ext-model,ext-obs").split(",").map((s) => s.trim());
const OUT = resolve(arg("out", "case-studies/perf-data"));

// ── a minimal float32 GeoTIFF writer ──────────────────────────────────────────────────────────
//
// `geotiff`'s own writeArrayBuffer writes one byte per sample (dist-node/geotiffwriter.js line 230),
// so it cannot produce the float32 grids a depth or water-surface product uses. Rather than add a
// dependency for four synthetic files, this writes the TIFF directly: little-endian, uncompressed,
// one strip, one float32 band, with the three GeoTIFF keys a WGS84 grid needs. geotiff.js — the
// decoder the engine itself dispatches to — reads the output, which is the only compatibility that
// matters here.

const SHORT = 3, LONG = 4, DOUBLE = 12, ASCII = 2;
const TYPE_BYTES = { [SHORT]: 2, [LONG]: 4, [DOUBLE]: 8, [ASCII]: 1 };

function writeFloat32GeoTIFF(values, width, height, { pixelScale, tiepoint, epsg, noData }) {
  const imageBytes = width * height * 4;

  // GeoKeyDirectory: header (1, 1, 0, nKeys), then one 4-short entry per key, keys ascending.
  const geoKeys = [
    1, 1, 0, 3,
    1024, 0, 1, 2,        // GTModelTypeGeoKey  = geographic
    1025, 0, 1, 1,        // GTRasterTypeGeoKey = PixelIsArea
    2048, 0, 1, epsg,     // GeographicTypeGeoKey
  ];

  const entries = [
    { tag: 256, type: LONG, values: [width] },
    { tag: 257, type: LONG, values: [height] },
    { tag: 258, type: SHORT, values: [32] },          // BitsPerSample
    { tag: 259, type: SHORT, values: [1] },           // Compression: none
    { tag: 262, type: SHORT, values: [1] },           // PhotometricInterpretation: min is black
    { tag: 273, type: LONG, values: [0] },            // StripOffsets — patched below
    { tag: 277, type: SHORT, values: [1] },           // SamplesPerPixel
    { tag: 278, type: LONG, values: [height] },       // RowsPerStrip: one strip
    { tag: 279, type: LONG, values: [imageBytes] },   // StripByteCounts
    { tag: 339, type: SHORT, values: [3] },           // SampleFormat: IEEE float
    { tag: 33550, type: DOUBLE, values: pixelScale },
    { tag: 33922, type: DOUBLE, values: tiepoint },
    { tag: 34735, type: SHORT, values: geoKeys },
  ];
  if (noData != null) {
    entries.push({ tag: 42113, type: ASCII, values: [...`${noData}\0`].map((c) => c.charCodeAt(0)) });
  }
  entries.sort((a, b) => a.tag - b.tag);

  const ifdSize = 2 + entries.length * 12 + 4;
  let extra = 0;
  for (const e of entries) {
    const bytes = e.values.length * TYPE_BYTES[e.type];
    e.inline = bytes <= 4;
    if (!e.inline) { e.offset = 8 + ifdSize + extra; extra += bytes + (bytes % 2); }
  }
  const dataOffset = 8 + ifdSize + extra;
  entries.find((e) => e.tag === 273).values = [dataOffset];

  const buf = Buffer.alloc(dataOffset + imageBytes);
  buf.write("II", 0, "latin1");
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(8, 4);
  buf.writeUInt16LE(entries.length, 8);

  const put = (type, value, at) => {
    if (type === SHORT) buf.writeUInt16LE(value, at);
    else if (type === LONG) buf.writeUInt32LE(value, at);
    else if (type === DOUBLE) buf.writeDoubleLE(value, at);
    else buf.writeUInt8(value, at);
  };

  entries.forEach((e, i) => {
    const at = 10 + i * 12;
    buf.writeUInt16LE(e.tag, at);
    buf.writeUInt16LE(e.type, at + 2);
    buf.writeUInt32LE(e.values.length, at + 4);
    if (e.inline) e.values.forEach((v, k) => put(e.type, v, at + 8 + k * TYPE_BYTES[e.type]));
    else {
      buf.writeUInt32LE(e.offset, at + 8);
      e.values.forEach((v, k) => put(e.type, v, e.offset + k * TYPE_BYTES[e.type]));
    }
  });
  buf.writeUInt32LE(0, 10 + entries.length * 12);     // no second IFD

  for (let i = 0; i < values.length; i++) buf.writeFloatLE(values[i], dataOffset + i * 4);
  return buf;
}

// ── the scene ─────────────────────────────────────────────────────────────────────────────────

/**
 * Terrain at one cell. `u` runs west to east and `v` north to south, both in [0, 1], so the surface
 * is resolution-independent: rung 2048 is rung 256 sampled four times as finely rather than a
 * different landscape.
 */
function terrain(u, v) {
  const channel = 0.5 + 0.08 * Math.sin(u * Math.PI * 3) + 0.03 * Math.sin(u * Math.PI * 11);
  const d = Math.abs(v - channel);
  const valley = 40 * Math.min(d, 0.35);
  const ridges = 1.5 * Math.sin(u * Math.PI * 17) * Math.cos(v * Math.PI * 13);
  return 198 + valley + ridges - 6 * u;               // a downstream tilt of about 6 m
}

const waterSurface = (u) => 205.2 - 6.2 * u;          // the modelled water surface, tilted downstream

function build(n) {
  // Only the requested grids are allocated. At the 8192 rung one Float32Array is 268 MB, so building
  // all four to write one would cost a gigabyte and put the generator itself, rather than the
  // browser, at the memory ceiling the run is trying to find.
  const want = (k) => ONLY.includes(k);
  const alloc = (k) => (want(k) ? new Float32Array(n * n) : null);
  const wse = alloc("wse"), dep = alloc("dep"), extM = alloc("ext-model"), extO = alloc("ext-obs");
  let wetM = 0, wetO = 0;

  for (let row = 0; row < n; row++) {
    const v = (row + 0.5) / n;
    for (let col = 0; col < n; col++) {
      const u = (col + 0.5) / n;
      const i = row * n + col;
      const ws = waterSurface(u);
      const depth = ws - terrain(u, v);
      // The observed delineation: a water surface 0.15 m higher over a channel displaced south by
      // 0.012 of the scene height. A pure vertical offset would make one extent a subset of the
      // other, and a contingency table with no false positives tests nothing.
      const depthObs = ws + 0.15 - terrain(u, v + 0.012);
      const wet = depth > 0.05, wetObs = depthObs > 0.05;

      if (wse) wse[i] = depth > 0 ? ws : NODATA;
      if (dep) dep[i] = depth > 0 ? depth : NODATA;
      if (extM) extM[i] = wet ? 1 : 0;
      if (extO) extO[i] = wetObs ? 1 : 0;
      if (wet) wetM++;
      if (wetObs) wetO++;
    }
  }
  return { wse, dep, extM, extO, wetM, wetO };
}

const tiff = (values, n, noData) => writeFloat32GeoTIFF(values, n, n, {
  pixelScale: [(EAST - WEST) / n, (NORTH - SOUTH) / n, 0],
  tiepoint: [0, 0, 0, WEST, NORTH, 0],
  epsg: 4326,
  noData: noData ? NODATA : null,
});

// ── write ─────────────────────────────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });

const rungs = [];
for (const n of SIZES) {
  const { wse, dep, extM, extO, wetM, wetO } = build(n);
  const files = {};
  if (wse) files.wse = [`wse-${n}.tif`, tiff(wse, n, true)];
  if (dep) files.dep = [`dep-${n}.tif`, tiff(dep, n, true)];
  if (extM) files["ext-model"] = [`ext-model-${n}.tif`, tiff(extM, n, false)];
  if (extO) files["ext-obs"] = [`ext-obs-${n}.tif`, tiff(extO, n, false)];
  for (const [name, buf] of Object.values(files)) writeFileSync(join(OUT, name), buf);

  rungs.push({
    size: n,
    cells: n * n,
    wetModel: wetM,
    wetObserved: wetO,
    files: Object.fromEntries(Object.entries(files).map(([k, [name, buf]]) => [k, { name, bytes: buf.length }])),
  });
  console.log(`${n}×${n}  ${(n * n).toLocaleString()} cells  ` +
              `${(Object.values(files)[0][1].length / 1048576).toFixed(1)} MB per grid  ` +
              `wet ${((wetM / (n * n)) * 100).toFixed(1)}%`);
}

// A second pass (the ceiling rungs, say) must not drop the rungs already described, so the manifest
// merges by size rather than replacing.
const manifestPath = join(OUT, "manifest.json");
let previous = [];
if (existsSync(manifestPath)) {
  try { previous = JSON.parse(readFileSync(manifestPath, "utf8")).rungs ?? []; } catch { previous = []; }
}
const merged = [...previous.filter((r) => !SIZES.includes(r.size)), ...rungs].sort((a, b) => a.size - b.size);

writeFileSync(manifestPath, JSON.stringify({
  generated: new Date().toISOString(),
  generator: "scripts/make-perf-data.mjs",
  crs: "EPSG:4326",
  bbox: [WEST, SOUTH, EAST, NORTH],
  noData: NODATA,
  extentConvention: { wet: 1, dry: 0, noDataTag: false },
  rungs: merged,
}, null, 2));

console.log(`\nwrote ${SIZES.length * ONLY.length + 1} files to ${OUT}`);
