// comparisonMetrics.js — headless flood-extent comparison (classification, visualization, stats).
//
// Four pure operations over aligned extent rasters, where a pixel is wet when its value is not
// `dryValue`. All are free of DOM and google.maps, so the math lives in the engine while
// layers/comparison.js stays a UI controller:
//
//   1. classifyExtents(pixelArrays)      per-pixel bitmask of which layers are wet, 2 to 8 layers
//   2. extentCategoriesToRgba(cats, pal) that classification as an RGBA overlay buffer
//   3. compareExtentMetrics(a, b, meta)  2x2 confusion-matrix agreement, exactly 2 layers
//   4. agreementCounts, ensembleAgreementRgba
//                                        how many members are wet per pixel, 0..N, over an N-color
//                                        ramp. Same input as 1, a different reduction: "which
//                                        subset" needs 2^N-1 colors, "how many" needs N.
//
// 1 and 2 generalize the controller's inlined two-raster combine loop to any number of layers. 3
// takes exactly 2 because a confusion matrix is a two-class construct, and an N-way version of it is
// ambiguous. All four require the inputs to share one grid, meaning equal length and equal meta.
// layers/comparison.js checks the raster dimensions before calling in.
import { SpatialFilter } from "./filter.js";
import { hexToRgb, ColorScale } from "./colorScale.js";

// Value meaning dry, or no data, in the lab's extent rasters. Shared so classifyExtents,
// combineExtentRgba and compareExtentMetrics agree on what counts as wet.
export const DRY_DEFAULT = -99999;

// The built-in 2-layer palette, keyed by bitmask category, matching the colors layers/comparison.js
// has always used: neither transparent, layer 0 only orange, layer 1 only yellow, both red.
// Bit i is set when layer i is wet, so 0b01 is the first raster only and 0b11 is both.
export const EXTENT_COMPARE_PALETTE_2 = {
  0b00: [0, 0, 0, 0],
  0b01: [247, 127, 0, 255],
  0b10: [252, 191, 73, 255],
  0b11: [214, 40, 40, 255],
};

/**
 * Classifies N aligned extent rasters pixel by pixel. `categories[i]` is a bitmask with bit L set
 * when `pixelArrays[L][i]` is wet, and `counts[cat]` is how many pixels fell in each category.
 * Generalizes the two-raster both/only-1/only-2/neither split, which is 0b00 through 0b11.
 *
 * @param {ArrayLike<number>[]} pixelArrays  2-8 equal-length band arrays sharing one grid
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

// Converts one color, given as a hex string or an [r,g,b] or [r,g,b,a] array, into [r,g,b,a].
function toRgba(c) {
  if (typeof c === "string") return [...hexToRgb(c), 255];
  if (Array.isArray(c) && c.length >= 3) return [c[0], c[1], c[2], c[3] ?? 255];
  throw new Error(`comparison color must be a hex string or [r,g,b(,a)] — got ${JSON.stringify(c)}`);
}

/**
 * Builds a bitmask palette from a flat list of `2^n - 1` colors, one per non-empty category, in
 * bitmask order from 1 upward. Category 0 means no layer is wet and is always transparent, so the
 * list omits it. Two layers take 3 colors ordered [only-1, only-2, both], three layers take 7. A
 * color is a hex string or an [r,g,b(,a)] array.
 */
export function paletteFromColors(colors) {
  const len = colors?.length ?? 0;
  const n = Math.log2(len + 1);
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(`comparison palette: expected 2^n - 1 colors (3, 7, 15, …) for n≥2 layers, got ${len}`);
  }
  const palette = { 0: [0, 0, 0, 0] };
  for (let k = 1; k <= len; k++) palette[k] = toRgba(colors[k - 1]);
  return palette;
}

/**
 * Turns a `classifyExtents` result into an RGBA buffer of 4 bytes per pixel, ready for
 * `new ImageData(...)`. `palette` maps a bitmask category to `[r,g,b,a]`. A category missing from
 * the palette stays transparent.
 */
export function extentCategoriesToRgba(categories, palette = EXTENT_COMPARE_PALETTE_2) {
  const rgba = new Uint8ClampedArray(categories.length * 4);
  for (let i = 0; i < categories.length; i++) {
    const c = palette[categories[i]];
    if (!c) continue;   // unmapped stays transparent
    rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = c[3];
  }
  return rgba;
}

/**
 * Classifies `pixelArrays` and colors them in one call. Returns the RGBA buffer and the raw
 * classification, so ComparisonLayer can draw the canvas and a legend from one pass.
 *
 * Colors are taken from `colors` first, a flat `2^n - 1` list, then `palette`, an explicit
 * category-to-[r,g,b,a] map, then the built-in 2-layer palette. With more than 2 layers and neither
 * given, it throws rather than inventing colors for a comparison it cannot name. The resolved map
 * comes back as `palette`, so ComparisonLayer.getLegend() can label what was drawn.
 */
export function combineExtentRgba(pixelArrays, { dryValue = DRY_DEFAULT, palette = null, colors = null } = {}) {
  const { categories, counts, nLayers } = classifyExtents(pixelArrays, { dryValue });
  let pal = palette;
  if (colors) {
    const need = (1 << nLayers) - 1;
    if (colors.length !== need) {
      throw new Error(`combineExtentRgba: comparing ${nLayers} layers needs ${need} colors ` +
        `(one per non-empty category), got ${colors.length}.`);
    }
    pal = paletteFromColors(colors);
  }
  pal = pal || (nLayers === 2 ? EXTENT_COMPARE_PALETTE_2 : null);
  if (!pal) {
    throw new Error(`combineExtentRgba: comparing ${nLayers} layers needs an explicit palette/colors ` +
      "(only the 2-layer case has a built-in one).");
  }
  return { rgba: extentCategoriesToRgba(categories, pal), categories, counts, nLayers, palette: pal };
}

// ---- ensemble reducer: agreement count -----------------------------------------------------------
//
// classifyExtents asks which members are wet, giving 2^N-1 non-empty subsets. This asks how many are
// wet, giving a count of 0..N per pixel, so N members need only N colors: an agreement ramp for
// counts 1..N, with count 0 dry and transparent. Align the members with geo/resample.js first, the
// same input comparison takes.

/**
 * Counts agreement over N aligned member rasters. `perPixel[i]` is how many members are wet at i,
 * from 0 to N, and `histogram` indexes those counts from 0 to N. All members must share one grid.
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

/** The default ramp: N viridis colors for agreement counts 1..N. Count 0 is transparent. */
export function defaultAgreementColors(n) {
  const cs = new ColorScale({ palette: "viridis", min: 1, max: Math.max(2, n), continuous: true });
  const out = [];
  for (let k = 1; k <= n; k++) out.push([...cs.getRgb(k), 255]);
  return out;
}

/** Colors an agreement map. Count k from 1 to N takes colors[k-1]; count 0 stays transparent. */
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
 * Counts agreement and colors it over an N-color ramp in one call. `colors` is N colors, hex or
 * [r,g,b(,a)], for agreement levels 1 to N. Omitting it falls back to a viridis ramp and adds a
 * warning, since a silent default would hide that EnsembleAggregationLayer never chose one. Returns
 * the RGBA with the raw `perPixel` counts and `histogram`, plus the resolved `colors` as
 * [r,g,b,a] rows, so EnsembleAggregationLayer.getLegend() can label what was drawn.
 */
export function ensembleAgreementRgba(pixelArrays, { dryValue = DRY_DEFAULT, colors = null } = {}) {
  const { perPixel, histogram, nLayers } = agreementCounts(pixelArrays, { dryValue });
  const warnings = [];
  let cols;
  if (colors) {
    if (colors.length !== nLayers) {
      throw new Error(`ensembleAgreementRgba: ${nLayers} members need ${nLayers} colors ` +
        `(one per agreement level 1..N), got ${colors.length}.`);
    }
    cols = colors.map(toRgba);
  } else {
    warnings.push(`No ensemble colors provided; defaulting to an ${nLayers}-step viridis agreement ramp.`);
    cols = defaultAgreementColors(nLayers);
  }
  return { rgba: agreementToRgba(perPixel, cols), perPixel, histogram, nLayers, warnings, colors: cols };
}

/**
 * Scores two aligned extent rasters against each other with a 2x2 confusion matrix.
 *
 * The two arguments are not interchangeable. `pixels1` is treated as the prediction and `pixels2` as
 * the observation, so swapping them inverts `fp` and `fn` and changes every derived score except
 * `pc` and `f`. A pixel is wet when its value is not `dryValue`.
 *
 * The four counts:
 *   tp  wet in both
 *   fp  wet in `pixels1` only, so predicted wet where the observation is dry
 *   fn  wet in `pixels2` only, so predicted dry where the observation is wet
 *   tn  dry in both
 *
 * The five scores. `pc` is always a number; the rest are null when undefined, never 0:
 *   pc  (tp+tn)/n, the proportion of pixels both rasters agree on
 *   b   (tp+fp)/(tp+fn), predicted wet area over observed wet area; 1 is unbiased, above 1
 *       over-predicts. Null when the observation has no wet pixels.
 *   h   tp/(tp+fn), the fraction of observed wet pixels the prediction also calls wet. Null on
 *       the same condition as `b`.
 *   k   Cohen's kappa, agreement corrected for what chance alone would produce. Null when both
 *       rasters put every pixel in one class, where kappa is 0/0.
 *   f   tp/(tp+fp+fn), wet pixels both agree on over wet pixels either one claims. Null when
 *       neither raster has a wet pixel.
 *   mi  h + k + f, a combined score with no separate normalization. Null when any of the three is.
 *
 * @param {ArrayLike<number>} pixels1 - the prediction, on the same grid as `pixels2`
 * @param {ArrayLike<number>} pixels2 - the observation
 * @param {{width: number, height: number, bw: number, bs: number, be: number, bn: number}} meta -
 *   the grid both rasters sit on
 * @param {Object} [opts]
 * @param {Array|null} [opts.mask] - a polygon confining the scoring to the pixels inside it. Needs
 *   at least 3 points; anything shorter is ignored.
 * @param {number} [opts.dryValue] - the value meaning dry, -99999 by default
 * @returns {{pc: number, b: number|null, h: number|null, k: number|null, f: number|null,
 *   mi: number|null, tp: number, fp: number, fn: number, tn: number, n: number}|null} null when an
 *   argument is missing or no pixel was scored, i.e. the mask covers nothing. `n` is the number of
 *   pixels scored.
 */
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
  // A zero denominator means the score has no value here, not that it scored zero. Returning 0
  // would read as "predicted nothing where there was flooding" when the truth is "there was no
  // flooding to score against", and nothing downstream could tell the two apart.
  const b = tp + fn > 0 ? (tp + fp) / (tp + fn) : null;
  const h = tp + fn > 0 ? tp / (tp + fn) : null;
  const d = n * n - ((tp + fp) * (tp + fn) + (fp + tn) * (fn + tn));
  const k = d !== 0 ? (n * (tp + tn) - ((tp + fp) * (tp + fn) + (fp + tn) * (fn + tn))) / d : null;
  const f = tp + fp + fn > 0 ? tp / (tp + fp + fn) : null;
  const mi = h == null || k == null || f == null ? null : h + k + f;
  return { pc, b, h, k, f, mi, tp, fp, fn, tn, n };
}
