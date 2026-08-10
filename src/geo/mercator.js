// mercator.js — the projection step between a plate-carrée grid and a Web Mercator map, plus the
// heuristic that decides when one baked image stops being the right way to draw it.
//
// THE DEFECT THIS EXISTS TO FIX. `RasterLayer._draw` colorizes a grid to an image and hands it to the
// provider's `addRasterImage`, which is `L.imageOverlay` / `GroundOverlay`. Both stretch that image
// LINEARLY IN WEB MERCATOR SCREEN SPACE, while our grid's rows are evenly spaced in LATITUDE. The two
// agree only near the equator. On a regional flood map (~12° tall) the error is ~0.19° / 21 km, which
// is why it went unnoticed for so long; on a −80…90 global field it is ~25.7° / 2850 km.
//
// The fix is to resample the grid's ROWS onto Mercator-even spacing before colorizing. Columns are
// untouched — longitude is linear in Mercator. The overlay's lat/lng box is unchanged (beyond polar
// clamping), so nothing downstream in the render path changes, and the SOURCE grid is untouched, so
// hover/Stats/filters keep reading real data at real coordinates.
//
// WHY THIS AND NOT `reproject()`. Warping to EPSG:3857 is refused before it draws — both providers
// declare `acceptsCRS` as the WGS84 family only — and `addRasterImage` takes lat/lng bounds while a
// 3857 grid's are metres. `geo/resample.js` cannot help either: it interpolates linearly in lat/lng by
// construction, so it is a plate-carrée→plate-carrée resampler. See
// docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md.
//
// THIS IS THE INTERIM FIX, AND IT IS HONEST ABOUT BEING ONE. A baked image is correct for the extent
// but fixed in resolution: zoom past what it was sized for and you are magnifying pixels. Tiles
// (`L.GridLayer#createTile` / `ImageMapType`) resample per viewport and are the real answer —
// `rasterRenderPlan` below already returns `mode: 'tiles'` when a raster outgrows the image path, so
// the decision point exists before the backend does.

/**
 * The latitude where Web Mercator is conventionally cut off (y = ±π). The projection is defined up to
 * but not including the poles — y(90°) is 37.3 against 3.14 here — so a grid reaching further has to
 * be clipped rather than squeezed.
 */
export const MERCATOR_MAX_LAT = 85.0511287798066;

/** Defaults for `rasterRenderPlan`. Every one is overridable per layer; see the JSDoc there. */
export const RASTER_LIMITS = {
  // ~16 megapixels ≈ 64 MB of RGBA — comfortably drawable, and well under the point where browsers
  // start refusing canvases. A raster wanting more than this is asking for tiles.
  maxPixels: 16e6,
  // Chrome/Firefox refuse canvases past ~16k–32k on a side depending on platform and memory; 8192 is
  // the largest value that is safe everywhere, including mobile.
  maxDimension: 8192,
  // The standard slippy-map tile edge. Only consulted once the tile backend exists; carried in the
  // plan now so the decision and its parameters live in one place.
  tileSize: 256,
};

const D2R = Math.PI / 180;

/** Web Mercator y for a latitude in degrees (earth radii; the constant factor cancels out here). */
export const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));

/** Latitude in degrees for a Web Mercator y — the inverse of `mercY`. */
export const invMercY = (y) => (2 * Math.atan(Math.exp(y))) / D2R - 90;

const clampLat = (lat) => Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, lat));

/**
 * How a raster grid should be drawn on a Web Mercator map.
 *
 * The row count is not a guess. Mercator's row spacing in latitude is `dy·cos φ`, so it is **sparsest
 * at the equator** — that is where detail would be lost, and it sets the requirement
 * `dy ≤ dlat_source`, i.e. `height × (Δy / Δφ_radians)`. The stretch factor is therefore modest even
 * for a global field: ~1.94× for −80…85, ~1.26× for a mid-latitude regional extent. (An earlier guess
 * of ~11× came from reading the POLE as the binding constraint; at the pole the output oversamples,
 * which costs nothing.)
 *
 * @param {{width: number, height: number, bounds: {north: number, south: number, east: number, west: number}}} grid
 * @param {Object} [opts]
 * @param {'auto'|'image'|'tiles'} [opts.strategy='auto'] - force a backend instead of deciding by size
 * @param {boolean} [opts.mercator=true] - false for a provider that draws in plate carrée already, in
 *   which case the grid is passed through untouched
 * @param {number} [opts.maxPixels] - image-path budget in output pixels
 * @param {number} [opts.maxDimension] - image-path budget on either side
 * @param {number} [opts.tileSize] - tile edge, carried through to the (future) tile backend
 * @returns {{mode: 'image'|'tiles', reason: string, tileSize: number, capped: boolean,
 *   image: {width: number, height: number, bounds: Object, mercator: boolean, clipped: boolean},
 *   ideal: {width: number, height: number}, stretch: number}}
 */
export function rasterRenderPlan(grid, opts = {}) {
  const { width, height, bounds } = grid;
  const maxPixels = opts.maxPixels ?? RASTER_LIMITS.maxPixels;
  const maxDimension = opts.maxDimension ?? RASTER_LIMITS.maxDimension;
  const tileSize = opts.tileSize ?? RASTER_LIMITS.tileSize;
  const strategy = opts.strategy ?? "auto";

  const passthrough = (reason) => ({
    mode: strategy === "tiles" ? "tiles" : "image",
    reason, tileSize, capped: false,
    image: { width, height, bounds, mercator: false, clipped: false },
    ideal: { width, height }, stretch: 1,
  });

  if (opts.mercator === false) return passthrough("mercator disabled — grid passed through as-is");
  if (!bounds || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return passthrough("no usable bounds or dimensions");
  }

  // Rows outside the Mercator cutoff cannot be drawn at all, so they are CLIPPED — and the overlay's
  // box must shrink to match, or the remaining rows land in the wrong place, which is the very bug
  // being fixed.
  const north = clampLat(bounds.north), south = clampLat(bounds.south);
  if (!(north > south)) return passthrough("extent has no height inside the Mercator cutoff");
  const clipped = north !== bounds.north || south !== bounds.south;
  const outBounds = clipped ? { ...bounds, north, south } : bounds;

  const stretch = (mercY(north) - mercY(south)) / ((north - south) * D2R);
  // Only the rows that survive clipping carry into the output.
  const keptRows = height * ((north - south) / (bounds.north - bounds.south));
  const idealHeight = Math.max(1, Math.ceil(keptRows * stretch));
  const ideal = { width, height: idealHeight };

  // Under a degree of stretch and nothing clipped, the remap would be a no-op — skip the copy.
  if (!clipped && stretch < 1.001 && strategy !== "tiles") {
    return passthrough("extent is equatorial enough that Mercator and plate carrée agree");
  }

  // Fit the ideal image inside both budgets, preserving aspect.
  const byPixels = Math.sqrt(maxPixels / (ideal.width * ideal.height));
  const byDim = Math.min(maxDimension / ideal.width, maxDimension / ideal.height);
  const scale = Math.min(1, byPixels, byDim);
  const capped = scale < 1;
  const outWidth = Math.max(1, Math.floor(ideal.width * scale));
  const outHeight = Math.max(1, Math.floor(ideal.height * scale));

  // The heuristic: an image that had to be shrunk to be drawn is one whose detail a single baked
  // image can no longer carry, which is exactly when a tile backend earns its complexity. Until that
  // backend exists the caller still draws the capped image — degraded, but correct in placement, and
  // it says so rather than pretending.
  const mode = strategy === "auto" ? (capped ? "tiles" : "image") : strategy;
  const reason = capped
    ? `${ideal.width}x${ideal.height} exceeds the single-image budget ` +
      `(${maxPixels} px / ${maxDimension} per side); drawn at ${outWidth}x${outHeight}`
    : `${outWidth}x${outHeight} fits the single-image budget`;

  return {
    mode, reason, tileSize, capped,
    image: { width: outWidth, height: outHeight, bounds: outBounds, mercator: true, clipped },
    ideal, stretch,
  };
}

/**
 * Resample a plate-carrée grid onto the plan's Mercator-spaced rows.
 *
 * Pure and headless — no canvas, no DOM. Columns map linearly (longitude is linear in Mercator);
 * rows go through `invMercY`. `nearest` is the default for the same reason `resampleGrid` uses it:
 * interpolating a classified raster (flood-extent codes 1/2/3) invents values between the classes.
 *
 * @param {import('../package/materialize.js').RasterGrid|{pixels: *, width: number, height: number, bounds: Object}} grid
 * @param {ReturnType<typeof rasterRenderPlan>} plan
 * @param {Object} [opts]
 * @param {'nearest'|'linear'} [opts.method='nearest'] - `linear` interpolates between the two
 *   bracketing source rows, falling back to nearest wherever either is nodata/NaN
 * @param {number|null} [opts.noData=null]
 * @returns {{pixels: *, width: number, height: number, bounds: Object}} the grid to colorize
 */
export function toMercatorRows(grid, plan, { method = "nearest", noData = null } = {}) {
  const { pixels, width: sw, height: sh, bounds: src } = grid;
  const { width: dw, height: dh, bounds: dst, mercator } = plan.image;
  if (!mercator || (dw === sw && dh === sh && dst === src)) {
    return { pixels, width: sw, height: sh, bounds: src };
  }

  const out = new pixels.constructor(dw * dh);
  const yN = mercY(dst.north), yS = mercY(dst.south);
  const latSpan = src.north - src.south;
  const missing = (v) => Number.isNaN(v) || (noData != null && v === noData);

  // Column mapping is independent of the row, so it is computed once rather than per pixel.
  const colOf = new Int32Array(dw);
  for (let dx = 0; dx < dw; dx++) {
    colOf[dx] = Math.min(sw - 1, Math.max(0, Math.round(((dx + 0.5) * sw) / dw - 0.5)));
  }

  for (let dy = 0; dy < dh; dy++) {
    const lat = invMercY(yN + ((dy + 0.5) / dh) * (yS - yN));
    // Source row as a FRACTION — row 0 is the northernmost, matching RasterGrid's north-up convention.
    const fy = ((src.north - lat) / latSpan) * sh - 0.5;
    const row = dy * dw;

    if (method === "linear") {
      const y0 = Math.floor(fy), t = fy - y0;
      const r0 = Math.min(sh - 1, Math.max(0, y0)) * sw;
      const r1 = Math.min(sh - 1, Math.max(0, y0 + 1)) * sw;
      for (let dx = 0; dx < dw; dx++) {
        const c = colOf[dx];
        const a = pixels[r0 + c], b = pixels[r1 + c];
        out[row + dx] = (missing(a) || missing(b)) ? (t < 0.5 ? a : b) : a + (b - a) * t;
      }
    } else {
      const sy = Math.min(sh - 1, Math.max(0, Math.round(fy))) * sw;
      for (let dx = 0; dx < dw; dx++) out[row + dx] = pixels[sy + colOf[dx]];
    }
  }
  return { pixels: out, width: dw, height: dh, bounds: dst };
}
