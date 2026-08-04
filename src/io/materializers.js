// materializers.js — the built-in decoders that turn a Dataset root into a decoded RasterGrid /
// VectorFeatures. Registered on import.
//
// These live OUTSIDE package/ (and outside Dataset's import graph) on purpose: this module imports
// `geotiff`, and Dataset must not. Importing this file wires the 'geotiff' + vector decoders into the
// materialize.js registry; the app does so at its composition root, and a Node test imports it when it
// wants real decoding (geotiff decodes fine in Node — parse.js already relies on that). The GDAL
// REPROJECTOR is registered elsewhere (browser boot) because GDAL is browser-only. See
// docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1.

import { fromArrayBuffer } from "geotiff";
import { readCrs } from "../geo/gdal.js";
import { boundsOf } from "./parse.js";
import {
  RasterGrid, VectorFeatures, registerMaterializer,
} from "../package/materialize.js";

// Resolve a root's bytes: a URL root fetches; an inline root already holds the ArrayBuffer/object.
async function rootArrayBuffer(root, name) {
  if (root.kind === "url") {
    const res = await fetch(root.url);
    if (!res.ok) throw new Error(`materialize: fetch failed (${res.status}) for ${root.url}`);
    return await res.arrayBuffer();
  }
  if (root.data instanceof ArrayBuffer) return root.data;
  if (ArrayBuffer.isView(root.data)) return root.data.buffer;
  throw new Error(`materialize: root for '${name}' has no raster bytes`);
}

async function rootJson(root, name) {
  if (root.kind === "url") {
    const res = await fetch(root.url);
    if (!res.ok) throw new Error(`materialize: fetch failed (${res.status}) for ${root.url}`);
    return await res.json();
  }
  if (root.data && typeof root.data === "object") return root.data;
  throw new Error(`materialize: root for '${name}' has no GeoJSON`);
}

// --- geotiff: decode band-0 pixels + the geometry needed to place/read them -----------------------
async function geotiffMaterializer(root, ds) {
  const buffer = await rootArrayBuffer(root, ds.name);
  const image = await (await fromArrayBuffer(buffer)).getImage();
  const [west, south, east, north] = image.getBoundingBox();
  const rasters = await image.readRasters();          // band arrays (interleaved: rasters[0] = band 0)
  const pixels = Array.isArray(rasters) ? rasters[0] : rasters;
  return new RasterGrid({
    pixels,
    width: image.getWidth(),
    height: image.getHeight(),
    bounds: { north, south, east, west },
    // Prefer the Dataset's declared CRS (parse.js already read it); fall back to the geokeys.
    crs: ds.crs || readCrs(image),
    noData: ds.meta?.noData ?? null,
    bands: image.getSamplesPerPixel(),
    meta: ds.meta || {},
  });
}

// --- vector (geojson/kml/kmz/shp/hazus): the payload is already a GeoJSON object -------------------
// parse.js decodes kml/kmz/shp to GeoJSON up front, so by the time a Dataset exists the vector data is
// GeoJSON regardless of source format — one materializer covers all vector formats.
async function vectorMaterializer(root, ds) {
  const features = await rootJson(root, ds.name);
  // An INLINE-parsed root already has real bounds (parse.js computes them from the same features at
  // parse time — ds.bounds is set). A lazily-rooted Dataset (fromURL/select()) does not: nothing reads
  // the URL's content until this materializer runs, so ds.bounds is still the constructor-time `null`.
  // Compute it from what we just decoded, same as the inline path, rather than leaving it unknown.
  const bounds = ds.bounds || boundsOf(features) || null;
  return new VectorFeatures({ features, bounds, crs: ds.crs || "EPSG:4326", meta: ds.meta || {} });
}

/**
 * Register the built-in decoders into the materialize seam. Idempotent. Called once on import (so a
 * node test that `import`s this file — or any consumer of the barrel — gets them), and exported so a
 * raw-browser page using the dist bundle can call it explicitly. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1.
 * @returns {void}
 */
export function registerBuiltinMaterializers() {
  registerMaterializer("geotiff", geotiffMaterializer);
  for (const fmt of ["geojson", "kml", "kmz", "shp", "hazus", "csv", "xyz"]) registerMaterializer(fmt, vectorMaterializer);
}

registerBuiltinMaterializers();   // auto-register on import
