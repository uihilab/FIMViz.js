// tifBounds.js — GeoTIFF GeoKeys → WGS84 bounds, with CRS validation. Headless.
//
// Extracted from io/fileUpload.js so the engine keeps the geo maths and the app keeps the upload
// UI. Nothing here touches the DOM or app state, which is what makes it testable at all.
//
// ⚠️ THIS DOES NOT REPROJECT THE RASTER. It proj4-transforms the bounding-box CORNERS only, leaving
// pixels in their native projection — a non-affine approximation that is wrong in the interior over
// large areas. In practice the proj4 branch is UNREACHABLE: every call site runs warpToEpsg4326()
// first, so the image arrives already EPSG:4326/4269 and the raw bbox is returned. It is a vestige
// the GDAL warp made obsolete, not a "fast path for common EPSG codes". Kept because the CRS
// VALIDATION above it is load-bearing — it produces the user-facing "unsupported coordinate system"
// errors — and removing the transform is a separate change needing a browser pass.

import proj4 from "proj4";

const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";

/**
 * proj4 string for a projected EPSG code.
 * → null  for geographic codes we treat as WGS84 (no transform needed)
 * → undefined for codes we do not support (the caller turns this into a user-facing error)
 */
export function getProj4String(epsg) {
  if (epsg === 4326 || epsg === 4269) return null; // geographic, treat as WGS84
  if (epsg >= 26901 && epsg <= 26923) return `+proj=utm +zone=${epsg - 26900} +datum=NAD83 +units=m +no_defs`;
  if (epsg >= 32601 && epsg <= 32660) return `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs`;
  if (epsg >= 32701 && epsg <= 32760) return `+proj=utm +zone=${epsg - 32700} +south +datum=WGS84 +units=m +no_defs`;
  if (epsg === 3857 || epsg === 900913) return "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs";
  if (epsg === 5070) return "+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs";
  if (epsg === 102039) return "+proj=aea +lat_0=40 +lon_0=-96 +lat_1=20 +lat_2=60 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs";
  return undefined;
}

/*
 * Supported GeoTIFF types:
 *   Single-band or multi-band raster — if multi-band, only the first band is used (user is notified)
 *
 *   Extensions accepted: .tif, .tiff, .geotif, .geotiff
 *
 *   Coordinate systems supported (reprojected to WGS84 automatically):
 *     Geographic:
 *       EPSG:4326  WGS84                        (no reprojection needed)
 *       EPSG:4269  NAD83                        (treated as WGS84, <1m error in US)
 *     Projected — UTM:
 *       EPSG:26901-26923  NAD83 / UTM zones 1N-23N   (US coverage)
 *       EPSG:32601-32660  WGS84 / UTM zones 1N-60N
 *       EPSG:32701-32760  WGS84 / UTM zones 1S-60S
 *     Projected — National:
 *       EPSG:3857   Web Mercator                (web/GIS server exports)
 *       EPSG:5070   NAD83 / Conus Albers        (USGS/NOAA national datasets)
 *       EPSG:102039 USA Contiguous Albers EA    (FEMA/HAZUS outputs)
 *
 *   Not supported (will show an error):
 *     Multi-band TIFs (RGB, RGBA, satellite composites)
 *     Plain TIFF with no spatial reference (no GeoKeys)
 *     NAD27 or other older geographic datums
 *     State Plane coordinate systems
 *     Any projected CRS not in the list above
 */

/**
 * Reads GeoKeys from a geotiff image → { west, south, east, north } in WGS84.
 * Throws a user-facing Error when the CRS is missing or unsupported.
 */
export function getTifWgs84Bounds(image) {
  const geoKeys = image.getGeoKeys();
  if (!geoKeys || Object.keys(geoKeys).length === 0)
    throw new Error("This file has no spatial reference information. Please export it as a GeoTIFF with a coordinate system defined.");

  const modelType = geoKeys.GTModelTypeGeoKey;
  let proj4Str = null;

  if (modelType === 2) {
    // Geographic CRS
    const geogEpsg = geoKeys.GeographicTypeGeoKey;
    if (geogEpsg !== 4326 && geogEpsg !== 4269)
      throw new Error(`Unsupported geographic coordinate system (EPSG:${geogEpsg}).\n\nSupported geographic: WGS84 (EPSG:4326), NAD83 (EPSG:4269).`);
  } else if (modelType === 1) {
    // Projected CRS
    const projEpsg = geoKeys.ProjectedCSTypeGeoKey;
    if (!projEpsg)
      throw new Error("This projected GeoTIFF is missing its EPSG code. Re-export with an explicit coordinate system authority.");
    proj4Str = getProj4String(projEpsg);
    if (proj4Str === undefined)
      throw new Error(
        `Unsupported projected coordinate system (EPSG:${projEpsg}).\n\n` +
        "Supported projected systems:\n" +
        "  • NAD83 / UTM zones 1N–23N  (EPSG 26901–26923)\n" +
        "  • WGS84 / UTM zones 1N–60N  (EPSG 32601–32660)\n" +
        "  • WGS84 / UTM zones 1S–60S  (EPSG 32701–32760)\n" +
        "  • Web Mercator               (EPSG 3857)\n" +
        "  • NAD83 / Conus Albers       (EPSG 5070)\n" +
        "  • USA Albers Equal Area      (EPSG 102039)"
      );
  } else {
    throw new Error("Unrecognized coordinate system type. Only geographic and projected GeoTIFFs are supported.");
  }

  const [west, south, east, north] = image.getBoundingBox();
  if (!proj4Str) return { west, south, east, north };

  const [w, s] = proj4(proj4Str, WGS84, [west, south]);
  const [e, n] = proj4(proj4Str, WGS84, [east, north]);
  return { west: w, south: s, east: e, north: n };
}
