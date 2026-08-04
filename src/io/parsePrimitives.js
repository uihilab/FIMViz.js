// parsePrimitives.js — the vendored parse primitives, re-exported from one engine module.
//
// The engine is the single owner of geotiff / @tmcw/togeojson / shpjs (declared only in this
// package's package.json), so host code never names those packages directly. The public
// barrel re-exports them too — but the barrel ALSO re-exports `Loader` from
// @googlemaps/js-api-loader, which is CommonJS with no named ESM export, so importing the barrel
// from source throws in node. That makes it unusable from any app module a jsdom test pulls in.
//
// This module is the narrow seam: parse primitives with no Maps loader attached, importable from
// both webpack and `node --test`.

export { fromArrayBuffer } from "geotiff";
export { kml } from "@tmcw/togeojson";
export { default as shp } from "shpjs";
