// build_case_study6_page_data.mjs — re-chunk the analysis mirrors into something a BROWSER can walk.
//
//     node case-studies/build_case_study6_data.mjs        # first: the analysis mirrors
//     node case-studies/build_case_study6_page_data.mjs   # then: the page mirrors
//
// WHY A SECOND MIRROR EXISTS.
//
// The NWM store chunks time in blocks of 224 — the right shape for "one cell, forty years", the wrong
// shape for "one map, next map". Every `select()` decompresses the WHOLE chunk to return one slice, so
// the dry run measured ~776 ms per step and a 672-step walk took 8.7 minutes. That cost is a property
// of the chunking, not of the data volume: a page cannot animate a series stored this way.
//
// So the page mirror re-chunks to ONE STEP PER CHUNK — `chunks: [1, ny, nx]` — which is what makes a
// slider and a full-series walk viable in a browser. It also crops to the Platte/Elkhorn corner of the
// domain, because 350 x 350 km at 1 km is far more raster than the question needs.
//
// Chunks are written UNCOMPRESSED and the zip's deflate does the work: that avoids needing a blosc
// encoder here, and on smooth fields it costs little.
//
// The decode side runs through the ENGINE, not SciWrid directly — which is the point. If the engine
// can read these back the way this script wrote them, the page can too.

import JSZip from "jszip";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { parseSource } from "../src/io/parse.js";
import { registerBuiltinMaterializers } from "../src/io/materializers.js";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "data");
const SRC_BBOX = [-99.4600, 38.3379, -95.2409, 41.5726];   // the analysis mirror's extent
const SRC_W = 350, SRC_H = 350;

// The whole analysis domain, 350 x 350 km. An earlier version cropped to a 140 km corner around the
// Platte, but the crop was never what made the page fast — the re-chunking below was. Decode cost is
// dominated by the SOURCE select (which decompresses a whole 224-step chunk regardless of how much of
// it we keep), so cropping bought build time, not page time.
const COL0 = 0, ROW0 = 0, NX = 350, NY = 350;

// The EVENT window, not the chunk window. The analysis mirrors carry all 224 three-hourly steps
// (2019-03-07T03Z .. 04-04T00Z) and the dry run reports over all of them; a slider with 224 positions
// is not a control anyone drags. The page gets 10-17 March — antecedent snowpack, the bomb cyclone,
// the soil peak on the 13th, and the first days of recession — which is 57 steps.
//
// The cost of the shorter window is that saturation durations are MORE censored, not less: a cell wet
// on 10 March and still wet on the 17th reports 7 days when the truth is longer. The page has to say
// so; it is measured over the event, not over the residence time.
const T0 = 23, T1 = 79;                    // inclusive step indices into the 224-step analysis mirror

const VARS = [
  { variable: "SNEQV",    stride: 1, note: "snow water equivalent, mm" },
  { variable: "ACSNOM",   stride: 1, note: "accumulated snowmelt, mm" },
  { variable: "SOIL_M",   stride: 1, note: "top-layer soil moisture, m3/m3" },
  // RAINRATE is hourly (672 steps); every third hour puts it on the same 3-hourly axis as the rest.
  { variable: "RAINRATE", stride: 3, note: "precipitation rate, mm/s" },
];

const lerp = (a, b, t) => a + (b - a) * t;
function subBbox() {
  const [w, s, e, n] = SRC_BBOX;
  return [
    lerp(w, e, COL0 / SRC_W), lerp(n, s, (ROW0 + NY) / SRC_H),
    lerp(w, e, (COL0 + NX) / SRC_W), lerp(n, s, ROW0 / SRC_H),
  ];
}

const spec = (shape, chunks, dtype, fill) =>
  ({ zarr_format: 2, shape, chunks, dtype, compressor: null, fill_value: fill, order: "C", filters: null });
const rawBytes = (a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

async function rechunk({ variable, stride, note }) {
  const bytes = readFileSync(join(DATA, `nwm-ne-2019-${variable}.zarr.zip`));
  const ds = await parseSource(new File([bytes], `${variable}.zarr.zip`), {
    format: "zarr", variable, grid: { bbox: SRC_BBOX },
  });
  // RAINRATE is hourly, so its indices run at 3x the others — scale the window to its own axis.
  const all = ds.axis.entries;
  const lo = T0 * stride, hi = T1 * stride;
  const entries = all.filter((_, i) => i >= lo && i <= hi && (i - lo) % stride === 0);

  const OUT_BBOX = subBbox();
  const zip = new JSZip();
  const zmeta = {};
  const put = (p, b) => { zip.file(p, b); if (/\.z(array|attrs)$/.test(p)) zmeta[p] = JSON.parse(b); };
  zip.file(".zgroup", JSON.stringify({ zarr_format: 2 }));

  if (!entries.length) throw new Error(`${variable}: window [${lo}..${hi}] selected no steps`);
  const t0 = performance.now();
  const times = new Float64Array(entries.length);
  for (let s = 0; s < entries.length; s++) {
    const g = await ds.select(entries[s].coord).grid();
    const out = new Float32Array(NX * NY);
    for (let r = 0; r < NY; r++) {
      const src = (ROW0 + r) * SRC_W + COL0;
      for (let c = 0; c < NX; c++) out[r * NX + c] = g.pixels[src + c];
    }
    zip.file(`${variable}/${s}.0.0`, rawBytes(out));      // one chunk per step — the whole point
    times[s] = entries[s].coord;
  }
  const decodeMs = performance.now() - t0;

  put(`${variable}/.zarray`, JSON.stringify(
    spec([entries.length, NY, NX], [1, NY, NX], "<f4", null)));
  put(`${variable}/.zattrs`, JSON.stringify({
    _ARRAY_DIMENSIONS: ["time", "y", "x"], long_name: note,
    note: "re-chunked to one step per chunk by build_case_study6_page_data.mjs",
  }));

  // Time as CF hours, so the axis decodes the same way the source's did.
  const EPOCH = Date.UTC(1979, 1, 1, 3, 0, 0);
  const hours = Float64Array.from(times, (t) => (t - EPOCH) / 3.6e6);
  put("time/.zarray", JSON.stringify(spec([entries.length], [entries.length], "<f8", null)));
  put("time/.zattrs", JSON.stringify({
    _ARRAY_DIMENSIONS: ["time"], standard_name: "time",
    units: "hours since 1979-02-01T03:00:00", calendar: "proleptic_gregorian",
  }));
  zip.file("time/0", rawBytes(hours));

  const xs = new Float64Array(NX), ys = new Float64Array(NY);
  for (let i = 0; i < NX; i++) xs[i] = lerp(OUT_BBOX[0], OUT_BBOX[2], (i + 0.5) / NX);
  for (let j = 0; j < NY; j++) ys[j] = lerp(OUT_BBOX[3], OUT_BBOX[1], (j + 0.5) / NY);
  for (const [name, arr, len] of [["x", xs, NX], ["y", ys, NY]]) {
    put(`${name}/.zarray`, JSON.stringify(spec([len], [len], "<f8", null)));
    put(`${name}/.zattrs`, JSON.stringify({ _ARRAY_DIMENSIONS: [name], units: "degrees" }));
    zip.file(`${name}/0`, rawBytes(arr));
  }

  zip.file(".zmetadata", JSON.stringify({ zarr_consolidated_format: 1,
    metadata: { ".zgroup": { zarr_format: 2 }, ...zmeta } }, null, 1));

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE",
                                        compressionOptions: { level: 9 } });
  const out = join(DATA, `cs6-${variable}.zarr.zip`);
  writeFileSync(out, buf);
  console.log(`  ${variable.padEnd(9)} ${String(entries.length).padStart(3)} steps`
    + ` x ${NY}x${NX}   decode ${(decodeMs / 1000).toFixed(0)}s`
    + `   -> ${(buf.length / 1048576).toFixed(2)} MB`);
  return { variable, steps: entries.length, bytes: buf.length, bbox: OUT_BBOX };
}

async function main() {
  registerBuiltinMaterializers();
  const b = subBbox();
  console.log(`Case Study 6 page mirrors — ${NY}x${NX} @ 1 km, one chunk per step`);
  console.log(`  window  steps ${T0}..${T1} of the analysis mirror (${T1 - T0 + 1} steps, 3-hourly)`);
  console.log(`  bbox  W ${b[0].toFixed(4)}  S ${b[1].toFixed(4)}  E ${b[2].toFixed(4)}  N ${b[3].toFixed(4)}\n`);
  let total = 0;
  for (const v of VARS) total += (await rechunk(v)).bytes;
  console.log(`\n  ${(total / 1048576).toFixed(1)} MB total for the page.`);
  console.log(`  BBOX for the page: [${b.map((v) => v.toFixed(4)).join(", ")}]`);
}

main().catch((e) => { console.error("FAILED:", e.message); console.error(e.stack); process.exitCode = 1; });
