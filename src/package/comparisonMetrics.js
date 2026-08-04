// comparisonMetrics.js — headless flood-extent comparison (classification, visualization, stats).
//
// Three pure operations over aligned extent rasters, where a pixel is "wet" when its value is not
// `dryValue`. All are DOM-free and google.maps-free, extracted from the layers/comparison.js UI
// controller so the valuable math STAYS in the engine while the controller lives in the ui/ tier:
//
//   1. classifyExtents(pixelArrays)      — per-pixel bitmask of WHICH layers are wet (N-ary).
//   2. extentCategoriesToRgba(cats, pal) — that classification → an RGBA overlay buffer (N-ary).
//   3. compareExtentMetrics(a, b, meta)  — 2×2 confusion-matrix agreement (2-ary; PC/B/H/K/F/MI).
//   4. agreementCounts / ensembleAgreementRgba — the ENSEMBLE reducer: HOW MANY members are wet per
//      pixel (0..N) → an N-colour agreement ramp. Same aligned-rasters input as comparison, a
//      different reduction: "which subset" (2^N-1 colours) collapses to "how many" (N colours).
//
// (1)+(2) generalize the controller's inlined "combine two rasters into a coloured overlay" loop to
// any number of layers; (3) is deliberately 2-ary — the confusion matrix is a two-class construct,
// which is where an N-way statistic gets ambiguous. All three assume the inputs share ONE grid
// (same length / same meta): the controller enforces equal raster dimensions before calling in.
import { SpatialFilter } from "./filter.js";
import { hexToRgb, ColorScale } from "./colorScale.js";

// Value meaning "no data / dry" in the lab's extent rasters. Kept as the shared default so the
// classification, the RGBA combine, and the metrics all agree on what counts as wet.
export const DRY_DEFAULT = -99999;

// The built-in 2-layer palette, keyed by bitmask category, reproducing the controller's long-standing
// colours EXACTLY: neither → transparent, layer-0-only → orange, layer-1-only → yellow, both → red.
// (bit i set ⇔ layer i is wet, so 0b01 = first raster only, 0b10 = second only, 0b11 = both.)
export const EXTENT_COMPARE_PALETTE_2 = {
  0b00: [0, 0, 0, 0],
  0b01: [247, 127, 0, 255],
  0b10: [252, 191, 73, 255],
  0b11: [214, 40, 40, 255],
};

/**
 * Classify N aligned extent rasters pixel-by-pixel. Returns `categories[i]` = a bitmask where bit L
 * is set when `pixelArrays[L][i]` is wet (!== dryValue), plus `counts[cat]` = how many pixels fell in
 * each category. This is the generalized form of the two-raster "both / only-1 / only-2 / neither"
 * split: with 2 layers the categories are exactly 0b00/0b01/0b10/0b11.
 *
 * @param {ArrayLike<number>[]} pixelArrays  2–8 equal-length band arrays sharing one grid.
 * @param {{ dryValue?: number }} [opts]
 * @returns {{ categories: Uint8Array, counts: Uint32Array, nLayers: number }}
 */
export function classifyExtents(pixelArrays, { dryValue = DRY_DEFAULT } = {}) {
  const n = pixelArrays?.length ?? 0;
  if (n < 2) throw new Error("classifyExtents: need at least 2 rasters to compare");
  if (n > 8) throw new Error("classifyExtents: at most 8 layers (one bit per layer in a byte)");
  const len = pixelArrays[0].length;
  for (let L = 1; L < n; L++) {
    if (pixelArrays[L].length !== len) {
      throw new Error("classifyExtents: all rasters must share one grid (equal pixel counts); " +
        `layer 0 has ${len}, layer ${L} has ${pixelArrays[L].length}. Resample before comparing.`);
    }
  }
  const categories = new Uint8Array(len);
  const counts = new Uint32Array(1 << n);
  for (let i = 0; i < len; i++) {
    let cat = 0;
    for (let L = 0; L < n; L++) {
      if (pixelArrays[L][i] !== dryValue) cat |= 1 << L;
    }
    categories[i] = cat;
    counts[cat]++;
  }
  return { categories, counts, nLayers: n };
}

// Coerce one colour (hex string | [r,g,b] | [r,g,b,a]) → [r,g,b,a].
function toRgba(c) {
  if (typeof c === "string") return [...hexToRgb(c), 255];
  if (Array.isArray(c) && c.length >= 3) return [c[0], c[1], c[2], c[3] ?? 255];
  throw new Error(`comparison colour must be a hex string or [r,g,b(,a)] — got ${JSON.stringify(c)}`);
}

/**
 * Build a bitmask palette from a flat list of `2^n - 1` colours — one per NON-EMPTY category, in
 * bitmask order (category 1, 2, 3, … up to 2^n-1). Category 0 (no layer wet) is always transparent,
 * which is why the list omits it. So a 2-layer override is 3 colours [only-1, only-2, both]; 3 layers
 * is 7; etc. Colours may be hex strings or [r,g,b(,a)] arrays.
 */
export function paletteFromColors(colors) {
  const len = colors?.length ?? 0;
  const n = Math.log2(len + 1);
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(`comparison palette: expected 2^n - 1 colours (3, 7, 15, …) for n≥2 layers, got ${len}`);
  }
  const palette = { 0: [0, 0, 0, 0] };
  for (let k = 1; k <= len; k++) palette[k] = toRgba(colors[k - 1]);
  return palette;
}

/**
 * Turn a `classifyExtents` result into an RGBA buffer (4 bytes/pixel, `Uint8ClampedArray` ready for
 * `new ImageData(...)`). `palette` maps a category (bitmask) → `[r,g,b,a]`; any category absent from
 * the palette is left transparent.
 */
export function extentCategoriesToRgba(categories, palette = EXTENT_COMPARE_PALETTE_2) {
  const rgba = new Uint8ClampedArray(categories.length * 4);
  for (let i = 0; i < categories.length; i++) {
    const c = palette[categories[i]];
    if (!c) continue;   // unmapped → transparent (a === 0)
    rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = c[3];
  }
  return rgba;
}

/**
 * One-call combine for the overlay: classify `pixelArrays` and colour them. Returns the RGBA buffer
 * plus the raw classification so a caller can drive both the canvas and a legend from one pass.
 *
 * Colours, in priority order: `colors` (a flat `2^n - 1` list, the caller-facing override) →
 * `palette` (an explicit category→[r,g,b,a] map) → the built-in 2-layer palette. For N>2 with none
 * supplied it throws — the engine will not invent colours for a comparison it can't name.
 */
export function combineExtentRgba(pixelArrays, { dryValue = DRY_DEFAULT, palette = null, colors = null } = {}) {
  const { categories, counts, nLayers } = classifyExtents(pixelArrays, { dryValue });
  let pal = palette;
  if (colors) {
    const need = (1 << nLayers) - 1;
    if (colors.length !== need) {
      throw new Error(`combineExtentRgba: comparing ${nLayers} layers needs ${need} colours ` +
        `(one per non-empty category), got ${colors.length}.`);
    }
    pal = paletteFromColors(colors);
  }
  pal = pal || (nLayers === 2 ? EXTENT_COMPARE_PALETTE_2 : null);
  if (!pal) {
    throw new Error(`combineExtentRgba: comparing ${nLayers} layers needs an explicit palette/colors ` +
      "(only the 2-layer case has a built-in one).");
  }
  return { rgba: extentCategoriesToRgba(categories, pal), categories, counts, nLayers };
}

// ---- ensemble reducer: agreement count (the "n colours" reduction) --------------------------------
//
// Where classifyExtents asks "WHICH members are wet" (2^N-1 non-empty subsets), the ensemble asks
// "HOW MANY are wet" — a count 0..N per pixel. That is why an ensemble of N members needs only N
// colours (an agreement ramp for counts 1..N; count 0 = dry = transparent), not 2^N-1. Same aligned
// input as comparison (align the members with geo/resample.js first), a different reduction.

/**
 * Per-pixel agreement over N aligned member rasters: `perPixel[i]` = how many members are wet at i
 * (0..N), plus a `histogram` of counts (index 0..N). All members must share one grid.
 */
export function agreementCounts(pixelArrays, { dryValue = DRY_DEFAULT } = {}) {
  const n = pixelArrays?.length ?? 0;
  if (n < 2) throw new Error("agreementCounts: need at least 2 members to form an ensemble");
  const len = pixelArrays[0].length;
  for (let L = 1; L < n; L++) {
    if (pixelArrays[L].length !== len) {
      throw new Error("agreementCounts: all members must share one grid (equal pixel counts); " +
        "align them with geo/resample.js first.");
    }
  }
  const perPixel = new Uint8Array(len);
  const histogram = new Uint32Array(n + 1);
  for (let i = 0; i < len; i++) {
    let c = 0;
    for (let L = 0; L < n; L++) if (pixelArrays[L][i] !== dryValue) c++;
    perPixel[i] = c;
    histogram[c]++;
  }
  return { perPixel, histogram, nLayers: n };
}

/** N colours for agreement counts 1..N (count 0 is transparent) — a viridis ramp, the default. */
export function defaultAgreementColors(n) {
  const cs = new ColorScale({ palette: "viridis", min: 1, max: Math.max(2, n), continuous: true });
  const out = [];
  for (let k = 1; k <= n; k++) out.push([...cs.getRgb(k), 255]);
  return out;
}

/** Colour an agreement map: count k (1..N) → colours[k-1]; count 0 → transparent. */
export function agreementToRgba(perPixel, colors) {
  const rgba = new Uint8ClampedArray(perPixel.length * 4);
  for (let i = 0; i < perPixel.length; i++) {
    const c = perPixel[i];
    if (c <= 0) continue;
    const col = colors[c - 1];
    if (!col) continue;
    rgba[i * 4] = col[0]; rgba[i * 4 + 1] = col[1]; rgba[i * 4 + 2] = col[2]; rgba[i * 4 + 3] = col[3] ?? 255;
  }
  return rgba;
}

/**
 * One-call ensemble combine: agreement count → RGBA over an N-colour ramp. `colors` is N colours
 * (hex or [r,g,b(,a)]) for agreement 1..N; omitted → a default viridis ramp AND a warning (a silent
 * default hides that the caller never chose one — same contract as ComparisonLayer). Returns the
 * RGBA plus the raw `perPixel` counts and `histogram` so a caller can drive a legend too.
 */
export function ensembleAgreementRgba(pixelArrays, { dryValue = DRY_DEFAULT, colors = null } = {}) {
  const { perPixel, histogram, nLayers } = agreementCounts(pixelArrays, { dryValue });
  const warnings = [];
  let cols;
  if (colors) {
    if (colors.length !== nLayers) {
      throw new Error(`ensembleAgreementRgba: ${nLayers} members need ${nLayers} colours ` +
        `(one per agreement level 1..N), got ${colors.length}.`);
    }
    cols = colors.map(toRgba);
  } else {
    warnings.push(`No ensemble colours provided; defaulting to an ${nLayers}-step viridis agreement ramp.`);
    cols = defaultAgreementColors(nLayers);
  }
  return { rgba: agreementToRgba(perPixel, cols), perPixel, histogram, nLayers, warnings };
}

export function compareExtentMetrics(pixels1, pixels2, meta, { mask = null, dryValue = DRY_DEFAULT } = {}) {
  if (!pixels1 || !pixels2 || !meta) return null;
  const { width, height, bw, bs, be, bn } = meta;
  const filter = mask && mask.length >= 3 ? new SpatialFilter(mask) : null;
  const bbox = filter ? filter.pixelBbox(meta) : null;

  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      if (filter) {
        if (px < bbox.x0 || px > bbox.x1 || py < bbox.y0 || py > bbox.y1) continue;
        const lat = bn - (py / height) * (bn - bs);
        const lng = bw + (px / width) * (be - bw);
        if (!filter.contains(lat, lng)) continue;
      }
      const i = py * width + px;
      const wet1 = pixels1[i] !== dryValue;
      const wet2 = pixels2[i] !== dryValue;
      if (!wet1 && !wet2) tn++;
      else if (wet1 && wet2) tp++;
      else if (wet1) fp++;   // wet in 1 only
      else fn++;             // wet in 2 only
    }
  }

  const n = tp + fn + fp + tn;
  if (n === 0) return null;
  const pc = (tp + tn) / n;
  const b = tp + fn > 0 ? (tp + fp) / (tp + fn) : 0;
  const h = tp + fn > 0 ? tp / (tp + fn) : 0;
  const d = n * n - ((tp + fp) * (tp + fn) + (fp + tn) * (fn + tn));
  const k = d !== 0 ? (n * (tp + tn) - ((tp + fp) * (tp + fn) + (fp + tn) * (fn + tn))) / d : 0;
  const f = tp + fp + fn > 0 ? tp / (tp + fp + fn) : 0;
  return { pc, b, h, k, f, mi: h + k + f, tp, fp, fn, tn, n };
}
