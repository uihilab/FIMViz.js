// rasterImage.js — headless raster COLORIZE + image encoding for RasterLayer rendering.
//
// The provider-neutral half of drawing a raster (the pipeline the app hand-rolled in ~6 places:
// floodExtent, depthMap, ensemble, comparison, rasterTools): a value grid → RGBA → a canvas data URL
// that ANY provider's addRasterImage positions over bounds. `colorizeGrid` is PURE (node-testable, no
// DOM); the canvas encode is browser-only (ambient `document`, like Dataset.download — no import cost).

import { ColorScale } from "./colorScale.js";

/**
 * Min/max over a grid's pixels, skipping noData/NaN — to seed a default continuous scale when the
 * caller attaches none. Exported so a caller building its own default ColorScale (e.g.
 * RasterLayer._draw's precedence chain) matches colorizeGrid's own fallback ranging exactly.
 * @param {import('./materialize.js').RasterGrid} grid
 * @returns {{min: number, max: number}}
 */
export function rangeOf(grid) {
  const { pixels, noData } = grid;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (Number.isNaN(v) || (noData != null && v === noData)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return Number.isFinite(min) ? { min, max } : { min: 0, max: 1 };
}

/**
 * Colorize a RasterGrid to an RGBA buffer (PURE — no DOM). A pixel becomes transparent when it is
 * NaN, equal to the grid's `noData`, optionally zero (`skipZero`), or unmapped by the scale. With no
 * `colorScale`, a continuous blues ramp (ColorScale's own default palette) over the grid's own
 * min/max is used — this is the last-resort fallback; RasterLayer._draw() builds and ATTACHES a real
 * ColorScale before ever reaching here (explicit → GDAL-embedded legend → this default), so a caller
 * going through RasterLayer never actually exercises this branch. A caller using colorizeGrid
 * directly, without a Layer, still gets a sensible default.
 * @param {import('./materialize.js').RasterGrid} grid
 * @param {Object} [opts] - { colorScale?, alpha?, skipZero?, noData? } (noData overrides grid.noData)
 * @returns {Uint8ClampedArray} width*height*4 RGBA
 */
export function colorizeGrid(grid, { colorScale = null, alpha = 255, skipZero = false, noData: noDataOpt } = {}) {
  const { pixels, width, height } = grid;
  const noData = noDataOpt ?? grid.noData;
  const cs = colorScale || new ColorScale({ continuous: true, ...rangeOf(grid) });
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (Number.isNaN(v) || (noData != null && v === noData) || (skipZero && v === 0)) continue;
    const c = cs.getRgb(v);
    if (!c) continue;
    rgba[i * 4] = c[0];
    rgba[i * 4 + 1] = c[1];
    rgba[i * 4 + 2] = c[2];
    rgba[i * 4 + 3] = alpha;
  }
  return rgba;
}

/** RGBA buffer → PNG data URL via an offscreen canvas (browser). @returns {string} */
export function rgbaToDataURL(rgba, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas.toDataURL();
}

/**
 * Colorize + encode: a RasterGrid → a PNG data URL ready for `provider.addRasterImage`.
 * @param {import('./materialize.js').RasterGrid} grid
 * @param {Object} [opts] - see colorizeGrid
 * @returns {string}
 */
export function gridToDataURL(grid, opts) {
  return rgbaToDataURL(colorizeGrid(grid, opts), grid.width, grid.height);
}
