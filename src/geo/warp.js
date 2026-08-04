// warp.js — EAGER, explicit CRS transformation of a Dataset.
//
// NAMING: this is `warp(ds, crs)` and NOT `reproject` on purpose. `Dataset.reproject(crs)` is the
// LAZY op — it returns an unforced node and warps nothing until a terminal (grid()/load()) forces
// it. This function warps IMMEDIATELY and returns an already-materialized Dataset. One name must
// never mean both; see docs/usage/USAGE.md.
//
// This lives in geo/ rather than on Dataset so the MODEL LAYER STAYS FREE OF INFRASTRUCTURE:
// `Dataset` is a pure value object with zero imports — constructible, serializable and testable
// without dragging in the GDAL toolchain. Dependencies flow geo/ → package/, never back.
//
// Ergonomic wrappers belong on the object that owns the services (FimMap), not on the value
// object — e.g. fim.addDataset(src, { reproject }) / fim.addLayer(t, { autoReproject }). This mirrors
// how fim.storage is a getter onto app.storage. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1.
//
// There is exactly ONE warp implementation (GDAL), so this is a plain function — no strategy, no
// registry. (io/fileUpload.js's proj4 use is NOT a second implementation: getTifWgs84Bounds
// transforms the bounding-box corners only, leaving pixels in their native projection, and its
// proj4 branch is unreachable in practice because every caller warps with GDAL first.)

import { fromArrayBuffer } from "geotiff";
import { warpTo, crsEquivalent } from "./gdal.js";
import { Dataset } from "../package/dataset.js";

/**
 * Reproject `ds` to `toCrs` (e.g. 'EPSG:4326'). Returns a NEW Dataset — value semantics — with a
 * new id, since reprojected pixels are a new value rather than an edit of the old one. Returns
 * `ds` unchanged when it is already in an equivalent CRS (no copy, no GDAL).
 *
 * Rasters only: geojson/kml/kmz/shp are EPSG:4326 by spec, so the vector path has no consumer and
 * would mean running proj4 over every coordinate.
 *
 * @param {Dataset} ds
 * @param {string} toCrs
 * @returns {Promise<Dataset>}
 */
export async function warp(ds, toCrs) {
  if (!ds) throw new Error("warp: a Dataset is required");
  if (!toCrs) throw new Error("warp: a target CRS is required (e.g. 'EPSG:4326')");
  if (crsEquivalent(ds.crs, toCrs)) return ds;
  if (ds.kind !== "raster") {
    throw new Error(
      `warp: vector reprojection is not implemented ` +
      `("${ds.name}": ${ds.crs || "unknown"} → ${toCrs}). ` +
      `geojson/kml/kmz/shp sources are EPSG:4326 by spec.`);
  }

  const { buffer } = await warpTo(ds.data, ds.name, toCrs);
  const image = await (await fromArrayBuffer(buffer)).getImage();
  const [west, south, east, north] = image.getBoundingBox();

  return new Dataset({
    name: ds.name,
    kind: ds.kind,
    format: ds.format,
    crs: toCrs,
    bounds: { north, south, east, west },
    // The ORIGINAL's GDAL_METADATA/noData carry forward deliberately: the warp does not preserve
    // those tags, and they describe the data's meaning (legend/unit/nodata), not its grid.
    meta: { ...ds.meta, width: image.getWidth(), height: image.getHeight(), reprojectedFrom: ds.crs },
    data: buffer,
  });
}
