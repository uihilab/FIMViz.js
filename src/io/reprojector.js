// reprojector.js — the GDAL raster reprojector for the lazy Dataset's `reproject` op.
//
// This completes the reproject seam (package/materialize.js). `ds.reproject(crs)` builds a lazy node
// that imports no GDAL; forcing it dispatches HERE. The contract is (grid, targetCrs, ctx) => RasterGrid.
//
// WHY IT LIVES IN io/, NOT package/: GDAL warps an ENCODED GeoTIFF buffer, not a decoded grid — and
// gdal3.js is BROWSER-ONLY (its Emscripten wasm loader needs a browser to actually RUN). So, like
// io/materializers.js, the heavy decoder stays out of Dataset's import graph.
//
// NOT auto-registered on import (unlike io/materializers.js) — this module, and everything it pulls
// in (geo/gdal.js, gdal3.js), should not load just because a consumer imported "fimviz"; plenty of
// consumers never touch a raster. Instead, lib.js registers THIS FILE as the reproject seam's lazy
// DEFAULT LOADER (materialize.js's registerDefaultReprojectorLoader) via a dynamic import() — a cheap
// closure reference, not an eager import. The seam only calls that closure — which is what actually
// imports this file — the first time a reproject is forced and finds no reprojector registered, so
// the whole GDAL path loads at the moment it's genuinely needed, never before. A host that wants it
// pre-warmed (e.g. to avoid a first-use delay) can still call registerGdalReprojector() explicitly.
//
// It uses the ROOT's encoded bytes (ctx.source) — a parseFile'd raster keeps them on its root `data`.
// A lazy `fromURL` root has no local bytes yet, so this reports that clearly rather than warping garbage.

import { fromArrayBuffer } from "geotiff";
import { warpTo, warpGrid } from "../geo/gdal.js";
import { RasterGrid, registerReprojector } from "../package/materialize.js";

async function gdalReproject(grid, targetCrs, ctx = {}) {
  const source = ctx.source;
  let buffer;
  if (source instanceof ArrayBuffer) {
    // warpTo returns the ORIGINAL buffer when the CRS is equivalent (e.g. NAD83↔WGS84) — a real no-op.
    ({ buffer } = await warpTo(source, ctx.name || "reproject.tif", targetCrs));
  } else if (ctx.grid) {
    // No representative encoded file (this Dataset's lineage has a real computation — combine/clip/
    // mask/reclassify/resample/rasterize — between it and its root; see Dataset.#applyOp's reproject
    // case). ctx.grid is the ACTUAL current data in that case; warp its own pixels instead of a stale
    // original file.
    ({ buffer } = await warpGrid(ctx.grid, ctx.name || "reproject.tif", targetCrs));
  } else {
    throw new Error(
      "GDAL reprojector: no source bytes AND no grid to warp — reproject a parseFile()'d raster " +
      "(its root keeps the encoded bytes), not a lazy Dataset.fromURL() root, for now.");
  }
  const image = await (await fromArrayBuffer(buffer)).getImage();
  const [west, south, east, north] = image.getBoundingBox();
  const rasters = await image.readRasters();
  const pixels = Array.isArray(rasters) ? rasters[0] : rasters;
  return new RasterGrid({
    pixels,
    width: image.getWidth(),
    height: image.getHeight(),
    bounds: { north, south, east, west },
    crs: targetCrs,
    noData: grid.noData,
    bands: image.getSamplesPerPixel(),
    // The source grid's opaque meta (GDAL legend/unit/nodata) describes the data's MEANING, not its
    // grid — the warp does not preserve those tags, so carry them forward, noting the reprojection.
    // width/height DO describe the grid and the warp changes them, so refresh them here rather than
    // leaving the pre-warp dimensions in a meta that Stats or a hover lookup might read.
    meta: { ...grid.meta, width: image.getWidth(), height: image.getHeight(), reprojectedFrom: grid.crs },
  });
}

/**
 * Wire the GDAL reprojector into the materialize seam so `ds.reproject(crs).grid()` warps in the
 * browser. Idempotent. Browser-only (pulls gdal3.js). See the module header.
 * @returns {void}
 */
export function registerGdalReprojector() {
  registerReprojector(gdalReproject);
}
