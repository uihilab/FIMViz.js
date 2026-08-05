// crs.js — pure CRS reading/comparison. NO GDAL, no network, no third-party import.
//
// These three live apart from geo/gdal.js on purpose. `readCrs` is the detector `Dataset.crs` is
// populated from, so io/parse.js and io/materializers.js — the modules every consumer of the barrel
// reaches — call it on every geotiff. While it sat in geo/gdal.js (whose first line is
// `import initGdalJs from "gdal3.js"`), importing anything from "fimviz" pulled ~190 KB of gdal3.js
// glue into the initial bundle, for a function that reads geokeys off an already-decoded image and
// touches no GDAL at all. The wasm was always lazy; the JS wrapper around it was not.
//
// geo/gdal.js imports what it needs from here and re-exports all three, so the GDAL path is
// unchanged — only the direction of the dependency moved (gdal.js → crs.js, never the reverse).

/**
 * The raster's declared CRS, read from its GeoTIFF geokeys. → 'EPSG:26915' | null (unknown).
 * Pure: no GDAL, no network. This is the detector `Dataset.crs` is populated from.
 * @param {{getGeoKeys: () => Object}} image - a geotiff.js image
 * @returns {string|null}
 */
export function readCrs(image) {
  const geoKeys = image.getGeoKeys();
  if (!geoKeys || Object.keys(geoKeys).length === 0) return null;
  const modelType = geoKeys.GTModelTypeGeoKey;
  const code = modelType === 2
    ? (geoKeys.GeographicTypeGeoKey || null)     // geographic
    : modelType === 1
      ? (geoKeys.ProjectedCSTypeGeoKey || null)  // projected
      : null;
  return code ? `EPSG:${code}` : null;
}

// CRS pairs treated as interchangeable, so a reprojection between them is a no-op.
// NAD83 (4269) ≈ WGS84 (4326): they differ by ~1-2 m — below the resolution these rasters are
// rendered at. This is an APPROXIMATION, not an identity; it preserves the long-standing
// isAlreadyWgs84() behaviour this function replaces.
const EQUIVALENT = [["EPSG:4326", "EPSG:4269"]];

/**
 * True if a warp between `a` and `b` would be a no-op. Unknown CRS (null) is never equivalent.
 * @param {string|null} a
 * @param {string|null} b
 * @returns {boolean}
 */
export function crsEquivalent(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return EQUIVALENT.some((set) => set.includes(a) && set.includes(b));
}

/**
 * 'EPSG:26915' → 26915. Anything unparseable (incl. null/'') → null, never 0.
 * @param {string|null} crs
 * @returns {number|null}
 */
export function epsgNumber(crs) {
  const m = /^EPSG:(\d+)$/i.exec(String(crs ?? "").trim());
  return m ? Number(m[1]) : null;
}
