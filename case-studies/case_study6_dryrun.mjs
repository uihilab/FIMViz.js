// case_study6_dryrun.mjs — Case Study 6's analytical chain, verified in Node before any page exists.
//
//     node case-studies/build_case_study6_data.mjs     # once, to mirror the inputs
//     node case-studies/case_study6_dryrun.mjs
//
// THE QUESTION. Between 7 and 16 March 2019 a bomb cyclone crossed the central Plains and fell as
// rain on a ripe snowpack over frozen ground. Eastern Nebraska flooded catastrophically. Rain-on-snow
// is not "a lot of rain": the snowpack is a reservoir that releases on the same day the rain arrives,
// so the water reaching the soil is rain PLUS melt, against soil that is already at capacity.
// This study asks how much of the water came from melt rather than rain, and how long the soil stayed
// saturated afterwards.
//
// DATA. NOAA National Water Model retrospective v2.1, 1 km, eastern Nebraska (350 x 350 km),
// 2019-03-07T03Z .. 2019-04-04T00Z. The window is the Zarr chunk containing 13 March, not a choice.
//   SNEQV     snow water equivalent (mm)          — the reservoir
//   ACSNOM    accumulated snowmelt (mm)           — what left it
//   RAINRATE  precipitation rate (mm s-1, hourly) — the driver
//   SOIL_M    top-layer soil moisture (m3 m-3)    — the response
//
// WHAT THIS FILE PINS DOWN, all found the hard way and all documented in the build script:
//   1. `.zarr.zip` ends in `.zip`, which detectFormat() routes to the SHAPEFILE reader. State it.
//   2. NWM is Lambert Conformal Conic. Its native metre coordinates make extractGrid clamp every
//      sample to one cell — a UNIFORM grid, no error. The mirror rewrites x/y to degrees.
//   3. rtout (`sfcheadsubrt`, `zwattablrt`) is unpopulated in v2.1 — constant 0 and constant 2 across
//      the whole record. There is no modelled inundation depth in this dataset to work from.

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { parseSource } from "../src/io/parse.js";
import { registerBuiltinMaterializers } from "../src/io/materializers.js";
import { Stats } from "../src/package/stats.js";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "data");

// Written by build_case_study6_data.mjs from the LCC grid — see its header for the residual.
const BBOX = [-99.4600, 38.3379, -95.2409, 41.5726];

const SAT = 0.40;          // m3 m-3 — top-layer soil moisture treated as "saturated" for duration
const ms = (t0) => `${(performance.now() - t0).toFixed(0)} ms`;
const iso = (c) => new Date(c).toISOString().slice(0, 16) + "Z";

async function open(variable) {
  const bytes = readFileSync(join(DATA, `nwm-ne-2019-${variable}.zarr.zip`));
  const ds = await parseSource(new File([bytes], `nwm-ne-2019-${variable}.zarr.zip`), {
    format: "zarr",              // .zip alone would route to the shapefile reader
    variable,
    grid: { bbox: BBOX },        // the mirror's own coords are already degrees; this labels the extent
  });
  return { ds, entries: ds.axis?.entries ?? [], mb: bytes.length / 1048576 };
}

/** Walk a series once, handing each step's pixels to `fn`. One decode per step, nothing retained. */
async function walk(ds, entries, fn) {
  for (let s = 0; s < entries.length; s++) {
    const g = await ds.select(entries[s].coord).grid();
    fn(g.pixels, s, entries[s].coord, g);
  }
}

const finite = (v, noData) => Number.isFinite(v) && v !== noData && v > -9990;

async function main() {
  registerBuiltinMaterializers();
  console.log(`Case Study 6 dry run — NWM rain-on-snow, eastern Nebraska (${process.version})\n`);

  // ── 1 · ingest ────────────────────────────────────────────────────────────────────────────────
  console.log("── 1 · ingest ────────────────────────────────────────────────────");
  let t0 = performance.now();
  const snow = await open("SNEQV");
  const melt = await open("ACSNOM");
  const soil = await open("SOIL_M");
  const rain = await open("RAINRATE");
  console.log(`   four series          ${ms(t0)}`);
  for (const [n, o] of [["SNEQV", snow], ["ACSNOM", melt], ["SOIL_M", soil], ["RAINRATE", rain]]) {
    console.log(`   ${n.padEnd(9)} ${String(o.entries.length).padStart(3)} steps`
      + `  ${iso(o.entries[0].coord)} .. ${iso(o.entries.at(-1).coord)}  ${o.mb.toFixed(1)} MB`);
  }
  const g0 = await snow.ds.select(snow.entries[0].coord).grid();
  const { width: W, height: H } = g0;
  const CELLS = W * H, CELL_KM2 = 1;
  console.log(`   grid                 ${W}x${H} @ 1 km   crs ${g0.crs}`);
  console.log(`   bounds               ${JSON.stringify(snow.ds.bounds)}`);

  // ── 2 · the reservoir empties ─────────────────────────────────────────────────────────────────
  console.log("\n── 2 · the snowpack, and what left it ────────────────────────────");
  const swe = [], meltSeries = [];
  t0 = performance.now();
  await walk(snow.ds, snow.entries, (px, s, coord, g) => {
    let sum = 0, n = 0, covered = 0;
    for (const v of px) { if (!finite(v, g.noData)) continue; n++; sum += v; if (v > 0) covered++; }
    swe.push({ coord, mean: n ? sum / n : 0, covered });
  });
  // ACSNOM is a RUNNING ACCUMULATOR, and it resets inside this window — an endpoint difference comes
  // out NEGATIVE. Melt is therefore the sum of positive per-cell increments, which is reset-safe;
  // and it has to be per CELL, because cells reset at different steps and a domain-mean series would
  // smear one cell's reset across the whole field.
  const meltCum = new Float32Array(CELLS);       // melt so far, per cell
  const meltTo16 = new Float32Array(CELLS);
  let prev = null, resets = 0;
  const CUTOFF = Date.parse("2019-03-16T00:00:00Z");
  await walk(melt.ds, melt.entries, (px, s, coord, g) => {
    let sum = 0, n = 0;
    for (let i = 0; i < px.length; i++) {
      const v = px[i];
      if (!finite(v, g.noData)) continue;
      n++; sum += v;
      if (prev) {
        const d = v - prev[i];
        if (d > 0) { meltCum[i] += d; if (coord < CUTOFF) meltTo16[i] += d; }
        else if (d < -1) resets++;               // a genuine drop, not float noise
      }
    }
    prev = Float32Array.from(px);
    meltSeries.push({ coord, mean: n ? sum / n : 0 });
  });
  console.log(`   walked 2x${snow.entries.length} steps   ${ms(t0)}`);
  const meanOf = (a) => { let s = 0, n = 0; for (const v of a) { if (Number.isFinite(v)) { s += v; n++; } } return n ? s / n : 0; };

  const sweStart = swe[0], sweMin = swe.reduce((a, b) => (b.mean < a.mean ? b : a));
  console.log(`   SWE at start         ${sweStart.mean.toFixed(1)} mm over `
    + `${(sweStart.covered * CELL_KM2).toLocaleString()} km² (${(100 * sweStart.covered / CELLS).toFixed(1)}% of domain)`);
  console.log(`   SWE minimum          ${sweMin.mean.toFixed(1)} mm at ${iso(sweMin.coord)}`);
  const meltTotal = meanOf(meltCum), meltByThe16th = meanOf(meltTo16);
  const naive = meltSeries.at(-1).mean - meltSeries[0].mean;
  console.log(`   accumulator resets   ${resets.toLocaleString()} cell-steps dropped`
    + ` — endpoint difference would give ${naive.toFixed(1)} mm, which is why melt is summed`);
  console.log(`   melt, whole window   ${meltTotal.toFixed(1)} mm (domain mean of positive increments)`);
  console.log(`   melt by 16 March     ${meltByThe16th.toFixed(1)} mm — `
    + `${(100 * meltByThe16th / meltTotal).toFixed(0)}% of the window's melt in its first 9 days`);

  // ── 3 · rain against melt ─────────────────────────────────────────────────────────────────────
  console.log("\n── 3 · how much of the water was not rain ────────────────────────");
  // RAINRATE is hourly mm s-1; a step therefore contributes rate * 3600 mm.
  let rainTotal = 0, rainTo16 = 0;
  const rainSeries = [];
  t0 = performance.now();
  await walk(rain.ds, rain.entries, (px, s, coord, g) => {
    let sum = 0, n = 0;
    for (const v of px) { if (!finite(v, g.noData)) continue; n++; sum += v; }
    const mm = (n ? sum / n : 0) * 3600;
    rainTotal += mm;
    if (coord < Date.parse("2019-03-16T00:00:00Z")) rainTo16 += mm;
    rainSeries.push({ coord, mm });
  });
  const rainMs = performance.now() - t0;
  // ~0.8 s per step, and the cost does not fall with the number of cells read: every select() appears
  // to decompress the whole 672-step chunk to hand back one slice. Walking a full series is therefore
  // O(steps x chunk), which is the single biggest constraint on what the browser page can do live.
  console.log(`   walked ${rain.entries.length} hourly steps  ${rainMs.toFixed(0)} ms`
    + `  (${(rainMs / rain.entries.length).toFixed(0)} ms/step — the whole chunk is decoded per select)`);
  console.log(`   rain, whole window   ${rainTotal.toFixed(1)} mm (domain mean)`);
  console.log(`   rain to 16 March     ${rainTo16.toFixed(1)} mm`);
  const meltShare = 100 * meltByThe16th / (meltByThe16th + rainTo16);
  console.log(`   MELT SHARE           ${meltShare.toFixed(1)}% of the water delivered to the soil`);
  console.log(`                        through 16 March came from the snowpack, not the sky.`);

  // ── 4 · the response: saturation duration and time of peak ────────────────────────────────────
  console.log("\n── 4 · soil response (duration, peak, recession) ─────────────────");
  const maxSoil = new Float32Array(CELLS).fill(-Infinity);
  const peakStep = new Int16Array(CELLS).fill(-1);
  const satSteps = new Int16Array(CELLS);
  const soilSeries = [];
  t0 = performance.now();
  await walk(soil.ds, soil.entries, (px, s, coord, g) => {
    let sum = 0, n = 0, satCells = 0;
    for (let i = 0; i < px.length; i++) {
      const v = px[i];
      if (!finite(v, g.noData)) continue;
      n++; sum += v;
      if (v > maxSoil[i]) { maxSoil[i] = v; peakStep[i] = s; }
      if (v >= SAT) { satSteps[i]++; satCells++; }
    }
    soilSeries.push({ coord, mean: n ? sum / n : 0, satCells });
  });
  console.log(`   walked ${soil.entries.length} steps        ${ms(t0)}`);

  const soilPeak = soilSeries.reduce((a, b) => (b.mean > a.mean ? b : a));
  const satPeak = soilSeries.reduce((a, b) => (b.satCells > a.satCells ? b : a));
  console.log(`   domain-mean peak     ${soilPeak.mean.toFixed(3)} m³/m³ at ${iso(soilPeak.coord)}`);
  console.log(`   peak saturated area  ${(satPeak.satCells * CELL_KM2).toLocaleString()} km²`
    + ` (${(100 * satPeak.satCells / CELLS).toFixed(1)}%) at ${iso(satPeak.coord)}`);

  let everSat = 0, maxDur = 0, sumDur = 0;
  for (let i = 0; i < satSteps.length; i++) {
    if (satSteps[i] > 0) { everSat++; sumDur += satSteps[i]; if (satSteps[i] > maxDur) maxDur = satSteps[i]; }
  }
  console.log(`   cells ever ≥ ${SAT}     ${everSat.toLocaleString()} (${(100 * everSat / CELLS).toFixed(1)}% of domain)`);
  const censored = satSteps.reduce((a, v) => a + (v === soil.entries.length ? 1 : 0), 0);
  console.log(`   longest saturation   ${maxDur * 3} h  (${(maxDur * 3 / 24).toFixed(1)} days)`);
  console.log(`   mean where saturated ${everSat ? (3 * sumDur / everSat).toFixed(0) : 0} h`);
  // A cell wet for every step was already wet when the window opened and may still be wet after it
  // closes: its duration is CENSORED by the window, not measured by it. Reporting the count keeps the
  // mean above from being read as a completed residence time.
  console.log(`   censored by window   ${censored.toLocaleString()} cells wet at every step`
    + ` (${(100 * censored / Math.max(everSat, 1)).toFixed(0)}% of the saturated ones)`);

  const peaks = [];
  for (let i = 0; i < peakStep.length; i++) if (satSteps[i] > 0 && peakStep[i] >= 0) peaks.push(peakStep[i]);
  peaks.sort((a, b) => a - b);
  const q = (p) => iso(soil.entries[peaks[Math.floor(p * (peaks.length - 1))]].coord);
  console.log(`   time-of-peak p10/p50/p90   ${q(0.1)}  |  ${q(0.5)}  |  ${q(0.9)}`);

  // ── 5 · reduce() parity — the idiomatic path against the hand-rolled one ───────────────────────
  console.log("\n── 5 · ds.reduce('max') vs the walked maximum ────────────────────");
  t0 = performance.now();
  const reduced = await soil.ds.reduce("max", { axis: 0 }).grid();
  console.log(`   reduce('max')        ${ms(t0)}   ${reduced.width}x${reduced.height}`);
  let worst = 0, checked = 0;
  for (let i = 0; i < reduced.pixels.length; i++) {
    const a = reduced.pixels[i], b = maxSoil[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    checked++;
    const d = Math.abs(a - b);
    if (d > worst) worst = d;
  }
  console.log(`   agreement            max |Δ| ${worst.toExponential(2)} over ${checked.toLocaleString()} cells`
    + `  ${worst < 1e-6 ? "— identical" : "— MISMATCH"}`);

  // ── 6 · the two curves, side by side ──────────────────────────────────────────────────────────
  console.log("\n── 6 · SWE emptying against soil filling (daily) ─────────────────");
  const sweMax = Math.max(...swe.map((d) => d.mean)) || 1;
  const soilMax = Math.max(...soilSeries.map((d) => d.mean)) || 1;
  console.log(`   date         SWE mm  soil m³/m³   ${"SWE".padEnd(22)}soil`);
  for (let s = 0; s < swe.length; s += 8) {
    const a = swe[s], b = soilSeries[s];
    const barA = "*".repeat(Math.round(20 * a.mean / sweMax)).padEnd(21);
    const barB = "#".repeat(Math.round(20 * b.mean / soilMax));
    console.log(`   ${iso(a.coord).slice(0, 13)} ${a.mean.toFixed(1).padStart(6)}`
      + `  ${b.mean.toFixed(3).padStart(9)}   ${barA}${barB}`);
  }

  // ── 7 · Stats over the peak-wetness surface ───────────────────────────────────────────────────
  console.log("\n── 7 · Stats over the peak soil-moisture surface ─────────────────");
  const clean = Float32Array.from(maxSoil, (v) => (Number.isFinite(v) ? v : NaN));
  const st = Stats.raster(clean, {
    bw: BBOX[0], bs: BBOX[1], be: BBOX[2], bn: BBOX[3],
    width: W, height: H, noData: null, unit: "m3/m3",
  }, { bins: 32 });
  console.log(`   min ${st.min.toFixed(3)}  mean ${st.mean.toFixed(3)}  median ${st.median.toFixed(3)}`
    + `  max ${st.max.toFixed(3)}   n ${st.count.toLocaleString()}`);
  console.log(`   p10 ${st.percentile(10)?.toFixed(3)}  p90 ${st.percentile(90)?.toFixed(3)}`
    + `   area ${(st.area / 1e6).toFixed(0)} km²`);

  console.log("\n── verdict ───────────────────────────────────────────────────────");
  console.log(`   The chain runs end to end on real data. ${meltShare.toFixed(0)}% of the water delivered`);
  console.log(`   through 16 March was melt, and the soil stayed at or above ${SAT} m³/m³ for a mean`);
  console.log(`   of ${everSat ? (3 * sumDur / everSat).toFixed(0) : 0} h across ${(100 * everSat / CELLS).toFixed(0)}% of the domain.`);
}

main().catch((e) => { console.error("FAILED:", e.message); console.error(e.stack); process.exitCode = 1; });
