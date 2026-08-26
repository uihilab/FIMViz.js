// parsePrimitives.js — the vendored parse primitives, from one module.
//
// The engine is the single owner of geotiff, @tmcw/togeojson and shpjs: only this package's
// package.json declares them, so one copy of geotiff exists and a decoded grid's typed arrays keep
// passing `instanceof` in host code. Host code imports them here rather than naming the packages.
//
// Reachable as "fimviz/src/io/parsePrimitives.js", through the "./src/*" subpath in package.json.
// Not on the `fimviz` barrel: parseFile covers the formats, these serve the cases it does not, and
// docs/PACKAGE_ROADMAP.md §"fimviz/core" excludes them from the core entry for the same reason.
//
// What each one is for, given parseFile already decodes all three formats:
//   fromArrayBuffer  io/materializers.js keeps band 0 of image 0 and discards the rest. Use this
//                    for a second band, a second image, a windowed read of a large COG, or the
//                    TIFF tag dictionary. docs/CASE_STUDIES.md notes range reads as a known gap.
//   shp              io/parse.js flattens a multi-layer zip into one FeatureCollection. Use this
//                    to keep the layers apart.
//   kml              takes a DOM Document, not bytes. parseFile handles .kml and .kmz, so this
//                    only helps when you already hold a parsed Document.

export { fromArrayBuffer } from "geotiff";
export { kml } from "@tmcw/togeojson";

/**
 * Converts a zipped shapefile (.shp, .dbf, .shx) to GeoJSON. Same arguments as shpjs's default
 * export, which is also async, but it imports the module on first call rather than statically.
 * shpjs pulls in proj4 to read a .prj, around 300 KB, and only this one format needs it.
 * io/parse.js defers it the same way.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<Object|Object[]>} a GeoJSON FeatureCollection, or one per layer
 */
export async function shp(buffer) {
  const mod = await import("shpjs");
  return (mod.default ?? mod)(buffer);
}
