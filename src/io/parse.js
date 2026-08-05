// parse.js — pure, headless parsing of a source into a Dataset.
//
// The composable-core parser (FimViz.parseFile / fim.addDataset). It is transport-agnostic
// (File | Blob | ArrayBuffer | URL string) and intent-free: detect format, parse, and return a
// Dataset — no DOM, no app state. This is a NEW value-returning path; the DOM-coupled
// parseUploadedFile in fileUpload.js is left untouched.
//
// PARSING NEVER REPROJECTS. A Dataset comes back in its native CRS (`ds.crs`) with bounds
// expressed in that CRS; callers warp deliberately via `ds.reproject(toCrs)`. Implicit
// reprojection made parse non-deterministic in cost (the first warp lazily pulls ~38 MB of GDAL
// wasm/data from a CDN) and forced a defensive double-read of the original buffer to rescue the
// GDAL_METADATA/nodata tags the warp destroys. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1.
//
// Implemented: geotiff, geojson (+ HAZUS damage), kml, kmz, shp.

import { bbox } from "@turf/turf";
import { kml } from "@tmcw/togeojson";
import { fromArrayBuffer } from "geotiff";
import { readCrs } from "../geo/crs.js";
import { Dataset } from "../package/dataset.js";

// jszip (~95 KB) and shpjs (~16 KB, but it drags proj4 + wkt-parser + mgrs ≈ 300 KB) are loaded
// ON DEMAND, not at module scope: only a caller who actually opens a .kmz or a zipped shapefile
// pays for them. Both branches below are already async, so the dynamic import costs nothing else.
// Every other format — geojson, geotiff, kml, csv, xyz — stays free of them entirely.
const loadJSZip = () => import("jszip").then((m) => m.default ?? m);
const loadShp = () => import("shpjs").then((m) => m.default ?? m);

// geojson/kml/kmz/shp are WGS84 by specification (RFC 7946 / OGC KML); shpjs reprojects to it.
const VECTOR_CRS = "EPSG:4326";

// --- source + format normalization ----------------------------------------------------

function extOf(name) {
  return (String(name).split("?")[0].split(".").pop() || "").toLowerCase();
}

function detectFormat(name) {
  switch (extOf(name)) {
    case "geojson": return "geojson";
    case "json": return "geojson";   // plain .json is treated as GeoJSON (may be a FeatureCollection)
    case "tif": case "tiff": return "geotiff";
    case "kml": return "kml";
    case "kmz": return "kmz";
    case "zip": case "shp": return "shp";
    case "csv": return "csv";
    case "xyz": return "xyz";
    default: return null;
  }
}

// Normalize any accepted source to { blob, name }.
async function toBlobAndName(source, options = {}) {
  if (typeof source === "string") {
    // Apply the host's URL resolver (CORS proxy / mirror / auth) if one was threaded in. It is a bound
    // `(url) => string` — `fim.addDataset` binds it from the owning instance's `config.resolveUrl`, so
    // this stays instance-safe (no ambient config read). The name/error still use the ORIGINAL source.
    const url = typeof options.resolveUrl === "function" ? options.resolveUrl(source) : source;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`parseFile: fetch failed (${res.status}) for ${source}`);
    const blob = await res.blob();
    const name = options.name || source.split("/").pop().split("?")[0] || "download";
    return { blob, name };
  }
  if (source instanceof ArrayBuffer) {
    return { blob: new Blob([source]), name: options.name || "buffer" };
  }
  // File or Blob
  return { blob: source, name: options.name || source.name || "blob" };
}

/**
 * Parse a source into a Dataset. This is the implementation behind the public `FimViz.parseFile`/
 * `fim.addDataset` — use those; this export exists for the composition root and tests.
 * @internal
 * @param {File|Blob|ArrayBuffer|string} source
 * @param {{ format?: string, name?: string }} [options] - format/name auto-detected when omitted
 * @returns {Promise<import('../package/dataset.js').Dataset>}
 */
export async function parseSource(source, options = {}) {
  const { blob, name } = await toBlobAndName(source, options);
  const format = options.format || detectFormat(name);
  switch (format) {
    case "geojson": return parseGeoJSON(blob, name);
    case "kml": return parseKML(blob, name);
    case "kmz": return parseKMZ(blob, name);
    case "shp": return parseShapefile(blob, name);
    case "geotiff": return parseGeoTIFF(blob, name);
    case "csv": return parseCSV(blob, name, options);
    case "xyz": return parseXYZ(blob, name, options);
    default:
      throw new Error(`parseFile: unsupported or undetected format for '${name}'. ` +
        `Supported: geotiff, geojson, kml, kmz, shp, csv, xyz.`);
  }
}

// --- geojson --------------------------------------------------------------------------

async function parseGeoJSON(blob, name) {
  const json = JSON.parse(await blob.text());

  // HAZUS damage: a root `buildings` array of { lat, lng, ... } points (not a FeatureCollection).
  const b0 = json?.buildings?.[0];
  if (Array.isArray(json?.buildings) && b0?.lat != null && b0?.lng != null) {
    return parseHazusDamage(json, name);
  }

  return buildVectorDataset(json, name, "geojson");
}

// Build a vector Dataset from a GeoJSON object (shared by geojson/kml/kmz/shp).
function buildVectorDataset(json, name, format) {
  const bounds = boundsOf(json);
  const features = json.type === "FeatureCollection" ? (json.features || [])
    : json.type === "Feature" ? [json]
      : [];
  const meta = {
    featureCount: features.length,
    geometryTypes: [...new Set(features.map((f) => f?.geometry?.type).filter(Boolean))],
    properties: features[0]?.properties ? Object.keys(features[0].properties) : [],
  };
  return new Dataset({ name, kind: "vector", format, crs: VECTOR_CRS, bounds, meta, data: json });
}

// --- kml / kmz ------------------------------------------------------------------------

const getDom = (xml) => new DOMParser().parseFromString(xml, "text/xml");

async function parseKML(blob, name) {
  const geojson = kml(getDom(await blob.text()));
  return buildVectorDataset(geojson, name, "kml");
}

async function parseKMZ(blob, name) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(blob);
  let kmlText = null;
  for (const path of Object.keys(zip.files)) {
    if (path.toLowerCase().endsWith(".kml")) {
      kmlText = await zip.files[path].async("string");
      break;
    }
  }
  if (kmlText == null) throw new Error(`parseFile: no .kml entry found inside ${name}`);
  const geojson = kml(getDom(kmlText));
  return buildVectorDataset(geojson, name, "kmz");
}

// --- shapefile ------------------------------------------------------------------------

async function parseShapefile(blob, name) {
  // shpjs accepts a zipped shapefile (.shp/.dbf/.shx) as an ArrayBuffer and returns a
  // FeatureCollection — or an array of them when the zip holds multiple layers, which we
  // merge into one. A non-shapefile zip (e.g. a mixed bundle) rejects here with shpjs's error.
  let result;
  try {
    const shp = await loadShp();
    result = await shp(await blob.arrayBuffer());
  } catch (e) {
    throw new Error(`parseFile: '${name}' is not a valid shapefile (.zip must contain ` +
      `.shp/.dbf/.shx). ${e?.message || e}`);
  }
  const geojson = Array.isArray(result)
    ? { type: "FeatureCollection", features: result.flatMap((fc) => fc.features || []) }
    : result;
  return buildVectorDataset(geojson, name, "shp");
}

// --- geotiff --------------------------------------------------------------------------

async function parseGeoTIFF(blob, name) {
  const data = await blob.arrayBuffer();
  const image = await (await fromArrayBuffer(data)).getImage();
  const [west, south, east, north] = image.getBoundingBox();
  const meta = {
    width: image.getWidth(),
    height: image.getHeight(),
    bands: image.getSamplesPerPixel(),
    noData: cleanNoData(image.fileDirectory.GDAL_NODATA),
    gdalMetadata: image.fileDirectory.GDAL_METADATA ?? null,  // raw XML; parsed in geo/tifMeta
  };
  return new Dataset({
    name, kind: "raster", format: "geotiff",
    crs: readCrs(image),                     // native; null when the geokeys don't declare one
    bounds: { north, south, east, west },    // expressed in `crs` — NOT necessarily WGS84
    meta, data,
  });
}

// GDAL_NODATA is a string that often carries a trailing NUL ("-99999\0"); strip it and
// coerce to a number when possible.
function cleanNoData(v) {
  if (v == null) return null;
  const s = String(v).replace(/\0/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

// HAZUS damage estimation: point buildings with per-structure damage fields. kind 'vector',
// format 'hazus'; bounds are the extent of the building points. meta.damage flags it for a
// DamageLayer. (The old parseUploadedFile special-cased this same shape.)
function parseHazusDamage(json, name) {
  const buildings = json.buildings;
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  for (const p of buildings) {
    if (p.lat > north) north = p.lat;
    if (p.lat < south) south = p.lat;
    if (p.lng > east) east = p.lng;
    if (p.lng < west) west = p.lng;
  }
  const bounds = Number.isFinite(north) ? { north, south, east, west } : null;
  const meta = {
    damage: true,
    buildingCount: buildings.length,
    location: json.location,
    model: json.model,
    stage: json.stage,
    discharge: json.discharge,
    annualChance: json.annual_chance,
    properties: Object.keys(buildings[0] || {}).filter((k) => k !== "lat" && k !== "lng"),
  };
  return new Dataset({ name, kind: "vector", format: "hazus", crs: VECTOR_CRS, bounds, meta, data: json });
}

// --- csv ------------------------------------------------------------------------------
//
// A CSV row becomes a Feature: either a lat/lng COLUMN PAIR (→ a Point) or one GEOMETRY column
// (WKT or a JSON-encoded GeoJSON geometry, → whatever type that row carries) — the caller picks
// which via { latField, lngField } | { geometryField }. Every other column becomes `properties`.
// Common column names are auto-detected when no mapping is given; on failure the thrown Error
// carries `.columns` (the detected headers) so a host can present a mapping UI reactively, and
// `csvHeaders()` is exported so a host can build that picker BEFORE calling parseFile/parseSource.

const LAT_NAMES = ["lat", "latitude", "y"];
const LNG_NAMES = ["lng", "lon", "long", "longitude", "x"];
const GEOM_NAMES = ["geometry", "geom", "wkt", "the_geom"];

// RFC4180-ish: quoted fields, embedded delimiters/newlines inside quotes, "" as an escaped quote.
function parseCSVRows(text, delimiter = ",") {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false; }
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * The header row of a CSV text, trimmed — lets a host build a column-mapping UI (which column is
 * latitude/longitude/geometry?) BEFORE calling parseFile/parseSource with { latField, lngField } or
 * { geometryField }.
 * @param {string} text
 * @param {{ delimiter?: string }} [opts]
 * @returns {string[]}
 */
export function csvHeaders(text, { delimiter = "," } = {}) {
  const rows = parseCSVRows(text, delimiter);
  return (rows[0] || []).map((h) => h.trim());
}

function detectField(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c);
    if (i !== -1) return headers[i];
  }
  return null;
}

// --- WKT → GeoJSON geometry (the 6 core OGC types; no Z/M, no GEOMETRYCOLLECTION) -----------------

const parseCoordPair = (s) => s.trim().split(/\s+/).map(Number);
const parseCoordList = (s) => s.split(",").map(parseCoordPair);
const stripParens = (s) => s.trim().replace(/^\(/, "").replace(/\)$/, "");

// Split on top-level commas only (depth 0) — the group separator inside nested "(a),(b)" WKT bodies.
function splitTopLevel(s) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim());
}

/**
 * Parse a WKT geometry string into GeoJSON geometry. Supports POINT/MULTIPOINT/LINESTRING/
 * MULTILINESTRING/POLYGON/MULTIPOLYGON (2-D only). Throws on anything else.
 * @param {string} wkt
 * @returns {{type: string, coordinates: Array}}
 */
export function wktToGeometry(wkt) {
  const m = /^\s*([A-Za-z]+)\s*\(([\s\S]*)\)\s*$/.exec(String(wkt).trim());
  if (!m) throw new Error(`wktToGeometry: not recognized as WKT: "${wkt}"`);
  const type = m[1].toUpperCase(), body = m[2];
  switch (type) {
    case "POINT": return { type: "Point", coordinates: parseCoordPair(body) };
    case "MULTIPOINT": return { type: "MultiPoint", coordinates: splitTopLevel(body).map((s) => parseCoordPair(stripParens(s))) };
    case "LINESTRING": return { type: "LineString", coordinates: parseCoordList(body) };
    case "MULTILINESTRING": return { type: "MultiLineString", coordinates: splitTopLevel(body).map((s) => parseCoordList(stripParens(s))) };
    case "POLYGON": return { type: "Polygon", coordinates: splitTopLevel(body).map((s) => parseCoordList(stripParens(s))) };
    case "MULTIPOLYGON": return {
      type: "MultiPolygon",
      coordinates: splitTopLevel(body).map((poly) => splitTopLevel(stripParens(poly)).map((ring) => parseCoordList(stripParens(ring)))),
    };
    default: throw new Error(`wktToGeometry: unsupported WKT type "${type}" ` +
      "(POINT/MULTIPOINT/LINESTRING/MULTILINESTRING/POLYGON/MULTIPOLYGON only)");
  }
}

async function parseCSV(blob, name, options = {}) {
  const text = await blob.text();
  const delimiter = options.delimiter || ",";
  const rows = parseCSVRows(text, delimiter);
  if (!rows.length) throw new Error(`parseFile: '${name}' is empty`);
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);

  let { latField, lngField, geometryField } = options;
  if (!geometryField && !(latField && lngField)) {
    geometryField = detectField(headers, GEOM_NAMES);
    if (!geometryField) {
      latField = latField || detectField(headers, LAT_NAMES);
      lngField = lngField || detectField(headers, LNG_NAMES);
    }
  }
  if (!geometryField && !(latField && lngField)) {
    const err = new Error(
      `parseFile: '${name}' — couldn't detect coordinate columns among [${headers.join(", ")}]. ` +
      "Pass { latField, lngField } (a coordinate pair) or { geometryField } (WKT or GeoJSON geometry per row).");
    err.columns = headers;
    throw err;
  }

  const latIdx = latField ? headers.indexOf(latField) : -1;
  const lngIdx = lngField ? headers.indexOf(lngField) : -1;
  const geomIdx = geometryField ? headers.indexOf(geometryField) : -1;
  if (latField && latIdx === -1) throw new Error(`parseFile: '${name}' has no column "${latField}" (columns: ${headers.join(", ")})`);
  if (lngField && lngIdx === -1) throw new Error(`parseFile: '${name}' has no column "${lngField}" (columns: ${headers.join(", ")})`);
  if (geometryField && geomIdx === -1) throw new Error(`parseFile: '${name}' has no column "${geometryField}" (columns: ${headers.join(", ")})`);

  const features = [];
  for (const row of dataRows) {
    if (row.length === 1 && row[0] === "") continue;      // trailing blank line
    const properties = {};
    headers.forEach((h, i) => { if (i !== latIdx && i !== lngIdx && i !== geomIdx) properties[h] = row[i]; });
    let geometry = null;
    if (geomIdx !== -1) {
      const raw = (row[geomIdx] || "").trim();
      if (raw) {
        try { const j = JSON.parse(raw); if (j?.type) geometry = j; } catch { /* not JSON — try WKT */ }
        if (!geometry) { try { geometry = wktToGeometry(raw); } catch { geometry = null; } }
      }
    } else {
      const lat = parseFloat(row[latIdx]), lng = parseFloat(row[lngIdx]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) geometry = { type: "Point", coordinates: [lng, lat] };
    }
    if (geometry) features.push({ type: "Feature", geometry, properties });   // malformed rows are skipped, not fatal
  }
  return buildVectorDataset({ type: "FeatureCollection", features }, name, "csv");
}

// --- xyz (headerless x,y,z point files — LiDAR-derived elevation exports, survey dumps) -----------

async function parseXYZ(blob, name, options = {}) {
  const text = await blob.text();
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error(`parseFile: '${name}' is empty`);
  const swapXY = !!options.swapXY;   // some exports order rows northing/easting first (y, x, z)
  const features = [];
  for (const line of lines) {
    const parts = line.split(/[\s,]+/).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) continue;   // malformed rows are skipped, not fatal
    const [a, b, z, ...rest] = parts;
    const [lng, lat] = swapXY ? [b, a] : [a, b];
    const properties = { z };
    rest.forEach((v, i) => { properties[`z${i + 2}`] = v; });
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties });
  }
  return buildVectorDataset({ type: "FeatureCollection", features }, name, "xyz");
}

// bbox → { north, south, east, west }; null if the input isn't valid GeoJSON geometry. Exported for
// io/materializers.js's vectorMaterializer, which needs the same computation for a lazily-rooted
// (fromURL/select()) vector Dataset — the inline parse path below already gets bounds for free here.
export function boundsOf(geojson) {
  try {
    const [west, south, east, north] = bbox(geojson);
    if ([west, south, east, north].some((n) => !Number.isFinite(n))) return null;
    return { north, south, east, west };
  } catch {
    return null;
  }
}
