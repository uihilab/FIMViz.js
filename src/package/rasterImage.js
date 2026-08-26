// rasterImage.js — colorizes a raster and encodes it as an image for RasterLayer.
//
// The provider-neutral half of drawing a raster: a value grid becomes RGBA, then a canvas data URL
// that any provider's addRasterImage positions over bounds. Replaces the pipeline floodExtent,
// depthMap, ensemble, comparison and rasterTools each hand-rolled. colorizeGrid is pure and
// testable under node; the canvas encode needs a browser `document`.

import { ColorScale } from "./colorScale.js";

/**
 * Min and max over a grid's pixels, skipping noData and NaN, used to seed a default continuous
 * scale when colorizeGrid is given none. Exported so that code building its own default ColorScale,
 * such as RasterLayer._draw, ranges exactly the way colorizeGrid's fallback does.
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
 * Colorizes a RasterGrid into an RGBA buffer. Pure, with no DOM. A pixel goes transparent when it
 * is NaN, equals the grid's `noData`, equals zero and `skipZero` is set, or maps to no color.
 *
 * Without a `colorScale` it falls back to a continuous blues ramp over the grid's own min and max.
 * RasterLayer._draw() attaches a real scale first, preferring an explicit one, then a GDAL-embedded
 * legend, then this default, so only code calling colorizeGrid outside a Layer reaches it.
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

/** Encodes an RGBA buffer as a PNG data URL through an offscreen canvas. @returns {string} */
export function rgbaToDataURL(rgba, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas.toDataURL();
}

/**
 * Colorizes and encodes a RasterGrid into a PNG data URL ready for `provider.addRasterImage`.
 * @param {import('./materialize.js').RasterGrid} grid
 * @param {Object} [opts] - see colorizeGrid
 * @returns {string}
 */
export function gridToDataURL(grid, opts) {
  return rgbaToDataURL(colorizeGrid(grid, opts), grid.width, grid.height);
}
