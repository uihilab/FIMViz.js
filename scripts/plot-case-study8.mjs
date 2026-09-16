// plot-case-study8.mjs — draws figures/fig-5-2b-phase.svg from a Case Study 8 results.csv.
//
// Usage:  node scripts/plot-case-study8.mjs [case-studies/cs8-results.csv]
//
// The bars are the basin mean precipitation of the 59-day window, split into rain and snow by the
// study's phase rule. The dashed rule is the baseline total, so the rise in precipitation across
// scenarios 11-15 is visible against the fall in snow. Every number is read from the CSV.

import { readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(process.argv[2] ?? join(ROOT, "case-studies", "cs8-results.csv"));
const OUT = join(ROOT, "figures", "fig-5-2b-phase.svg");

const W = 1160, H = 520;
const PAD = { l: 96, r: 248, t: 40, b: 78 };
const INK = "#5b6570", AXIS = "#b8c0c8", GRID = "#e8ecf0";
const RAIN = "#1f4e79", SNOW = "#cfe0ef", SNOW_EDGE = "#4a7fb0";

function readRows(path) {
  const [head, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]*)/g).filter((_, i) => i % 2 === 0);
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? "").replace(/^"|"$/g, "")]));
  });
}

const rows = readRows(SRC).filter((r) => r.study === "8").sort((a, b) => a.dT_degC - b.dT_degC);
if (!rows.length) throw new Error(`${SRC}: no study 8 rows`);
const win = rows[0].window, days = rows[0].days, cells = rows[0].basin_cells, thr = rows[0].threshold_degC;
if (rows.some((r) => r.window !== win || r.basin_cells !== cells || r.threshold_degC !== thr)) {
  throw new Error("rows mix windows, basin cell counts or thresholds; the figure would compare unlike totals");
}

const yMax = Math.ceil(Math.max(...rows.map((r) => +r.pr_mm)) / 200) * 200;
const x0 = PAD.l, x1 = W - PAD.r, y0 = H - PAD.b, y1 = PAD.t;
const bw = Math.min(96, ((x1 - x0) / rows.length) * 0.56);
const cx = (i) => x0 + ((i + 0.5) * (x1 - x0)) / rows.length;
const y = (v) => y0 - (v / yMax) * (y0 - y1);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const p = [];

p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"`);
p.push(`     font-family="Helvetica, Arial, sans-serif">`);
p.push(`  <title>Basin precipitation split into rain and snow, by scenario</title>`);
p.push(`  <desc>Stacked bars of basin mean precipitation for ${rows.length} scenarios over ${days} days.`);
p.push(`        Snow falls from ${(+rows[0].snow_mm).toFixed(1)} to ${(+rows.at(-1).snow_mm).toFixed(1)} mm while the total rises.</desc>`);
p.push(`  <defs><pattern id="sn" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`);
p.push(`    <rect width="7" height="7" fill="${SNOW}"/><line x1="0" y1="0" x2="0" y2="7" stroke="${SNOW_EDGE}" stroke-width="1.6"/>`);
p.push(`  </pattern></defs>`);
p.push(`  <rect width="${W}" height="${H}" fill="#ffffff"/>`);

for (let v = 0; v <= yMax; v += 200) {
  p.push(`  <line x1="${x0}" x2="${x1}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${GRID}"/>`
    + `<text x="${x0 - 12}" y="${(y(v) + 5).toFixed(1)}" text-anchor="end" font-size="15" fill="${INK}">${v}</text>`);
}
p.push(`  <line x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}" stroke="${AXIS}" stroke-width="1.2"/>`);
p.push(`  <line x1="${x0}" x2="${x0}" y1="${y1}" y2="${y0}" stroke="${AXIS}" stroke-width="1.2"/>`);
p.push(`  <text x="${x0 - 12}" y="${y1 - 14}" text-anchor="end" font-size="14" fill="${INK}">mm</text>`);

const base = +rows[0].pr_mm;
p.push(`  <line x1="${x0}" x2="${x1}" y1="${y(base).toFixed(1)}" y2="${y(base).toFixed(1)}" stroke="${INK}"`
  + ` stroke-width="1.3" stroke-dasharray="6 4"/>`);
p.push(`  <text x="${x1 + 10}" y="${(y(base) + 5).toFixed(1)}" font-size="13" fill="${INK}">baseline total ${base.toFixed(1)} mm</text>`);

rows.forEach((r, i) => {
  const rain = +r.rain_mm, snow = +r.snow_mm, tot = +r.pr_mm;
  const f1 = (v) => v.toFixed(1);
  const l = (cx(i) - bw / 2).toFixed(1);
  p.push(`  <rect x="${l}" y="${y(tot).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(rain) - y(tot)).toFixed(1)}" fill="url(#sn)" stroke="${SNOW_EDGE}" stroke-width="1.2"/>`);
  p.push(`  <rect x="${l}" y="${y(rain).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y0 - y(rain)).toFixed(1)}" fill="${RAIN}"/>`);
  p.push(`  <text x="${cx(i).toFixed(1)}" y="${(y(tot) - 24).toFixed(1)}" text-anchor="middle" font-size="14" fill="${SNOW_EDGE}">${f1(snow)} mm snow</text>`);
  p.push(`  <text x="${cx(i).toFixed(1)}" y="${(y(tot) - 8).toFixed(1)}" text-anchor="middle" font-size="13" fill="${INK}">${f1(+r.rain_share_pct)} % rain</text>`);
  p.push(`  <text x="${cx(i).toFixed(1)}" y="${(y0 + 26).toFixed(1)}" text-anchor="middle" font-size="16" fill="#2b3440">+${r.dT_degC} °C</text>`);
  p.push(`  <text x="${cx(i).toFixed(1)}" y="${(y0 + 46).toFixed(1)}" text-anchor="middle" font-size="13" fill="${INK}">scenario ${r.scenario}</text>`);
});

const lx = x1 + 16, ly = y1 + 24;
p.push(`  <rect x="${lx}" y="${ly}" width="18" height="18" fill="${RAIN}"/>`);
p.push(`  <text x="${lx + 26}" y="${ly + 14}" font-size="15" fill="#2b3440">rain</text>`);
p.push(`  <rect x="${lx}" y="${ly + 28}" width="18" height="18" fill="url(#sn)" stroke="${SNOW_EDGE}" stroke-width="1.2"/>`);
p.push(`  <text x="${lx + 26}" y="${ly + 42}" font-size="15" fill="#2b3440">snow</text>`);
p.push(`  <text x="${lx}" y="${ly + 96}" font-size="13" fill="${INK}">basin mean over ${cells} cells</text>`);
p.push(`  <text x="${lx}" y="${ly + 114}" font-size="13" fill="${INK}">${days} days, ${esc(win.replace("/", " to "))}</text>`);
p.push(`  <text x="${lx}" y="${ly + 132}" font-size="13" fill="${INK}">rain when the daily mean</text>`);
p.push(`  <text x="${lx}" y="${ly + 150}" font-size="13" fill="${INK}">temperature &gt; ${thr} °C</text>`);
p.push(`  <text x="${x0}" y="${H - 16}" font-size="13" fill="${INK}">Scenarios 11-15 raise the precipitation quantile term by 7 %, so the total rises as the snow falls.</text>`);
p.push(`</svg>`);

writeFileSync(OUT, p.join("\n") + "\n");
console.log(`${OUT}  <- ${SRC}  (${rows.length} scenarios, ${days} days, ${cells} basin cells)`);
