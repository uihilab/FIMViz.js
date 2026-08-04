// stats.js — computed statistics as a PURE, TERMINAL read-model (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
//
// Extracted from ui/rasterTools.js `computeStats` (raster) and `_computeVectorMetrics` (vector).
// Enriched at compute time (histogram, area, byClass) and exposes pure derived views over what it
// holds (percentile, diff, describe, toCSV). It NEVER retains the source pixels, so it is not
// filterable after the fact — "stats then filter" is a fresh layer.getStats(filter) pass.
//
// A Filter (filter.js) scopes the computation; a ColorScale (colorScale.js) buckets `byClass`.

import { Filter } from "./filter.js";

function normalizeFilter(filter) {
  if (filter == null || filter === false) return null;
  return Array.isArray(filter) ? Filter.all(filter) : Filter.from(filter);
}

// meters² of one pixel whose centre is at `lat`, given per-pixel degree spans (equirectangular).
function pixelAreaM2(lat, dLatDeg, dLngDeg) {
  const mPerDegLat = 111320;
  return Math.abs(dLatDeg * mPerDegLat) * Math.abs(dLngDeg * mPerDegLat * Math.cos(lat * Math.PI / 180));
}

export class Stats {
  /** Not usually called directly — use the `Stats.raster()`/`Stats.vector()` factories. @param {Object} [fields] */
  constructor(fields = {}) { Object.assign(this, fields); }

  /**
   * Raster statistics over pixelData, optionally scoped by a Filter and classified by a ColorScale.
   * @param {ArrayLike<number>} pixelData
   * @param {{bw: number, bs: number, be: number, bn: number, width: number, height: number, noData?: number, unit?: string}} meta
   * @param {Object} [opts]
   * @param {import('./filter.js').Filter|Function|Array|null} [opts.filter]
   * @param {import('./colorScale.js').ColorScale|null} [opts.classify]
   * @param {boolean} [opts.skipZero]
   * @param {number} [opts.bins]
   * @returns {Stats}
   */
  static raster(pixelData, meta, { filter = null, classify = null, skipZero = false, bins = 64 } = {}) {
    const { width, height, bw, bs, be, bn } = meta;
    const noData = meta.noData ?? -9999;
    const f = normalizeFilter(filter);
    const bbox = f && typeof f.pixelBbox === "function" ? f.pixelBbox(meta) : null;
    const at = (x, y) => pixelData[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
    const unit = {};   // reused mutable unit — no per-pixel allocation

    const dLat = (bn - bs) / height, dLng = (be - bw) / width;
    const isTransparent = (v) =>
      v === undefined || isNaN(v) || Math.abs(v - noData) < 1 || (skipZero && v === 0);

    const vals = [];
    let sum = 0, vMin = Infinity, vMax = -Infinity, area = 0;

    for (let py = 0; py < height; py++) {
      if (bbox && (py < bbox.y0 || py > bbox.y1)) continue;
      const lat = bn - (py / height) * (bn - bs);
      for (let px = 0; px < width; px++) {
        if (bbox && (px < bbox.x0 || px > bbox.x1)) continue;
        const v = pixelData[py * width + px];
        if (isTransparent(v)) continue;
        if (f) {
          unit.value = v; unit.x = px; unit.y = py; unit.at = at;
          unit.lat = lat; unit.lng = bw + (px / width) * (be - bw);
          if (!f.test(unit)) continue;
        }
        vals.push(v);
        sum += v; if (v < vMin) vMin = v; if (v > vMax) vMax = v;
        area += pixelAreaM2(lat, dLat, dLng);
      }
    }

    if (!vals.length) {
      return new Stats({ kind: "raster", unit: meta.unit || "", min: 0, max: 0, mean: 0,
        median: 0, stddev: 0, sum: 0, count: 0, area: 0, histogram: { bins: [], counts: [] }, byClass: null });
    }

    const count = vals.length, mean = sum / count;
    vals.sort((a, b) => a - b);
    const mid = Math.floor(count / 2);
    const median = count % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    let variance = 0; for (const v of vals) variance += (v - mean) ** 2;
    const stddev = Math.sqrt(variance / count);

    // histogram (over sorted vals) — powers percentile()
    const edges = [], counts = new Array(bins).fill(0);
    const span = vMax - vMin || 1;
    for (let i = 0; i <= bins; i++) edges.push(vMin + (span * i) / bins);
    for (const v of vals) {
      let b = Math.floor(((v - vMin) / span) * bins);
      if (b >= bins) b = bins - 1; if (b < 0) b = 0;
      counts[b]++;
    }

    const stats = new Stats({
      kind: "raster", unit: meta.unit || "", min: vMin, max: vMax, mean, median, stddev,
      sum, count, area, histogram: { bins: edges, counts }, byClass: null,
    });
    if (classify) stats.byClass = rasterByClass(vals, area / count, classify);
    return stats;
  }

  /**
   * Vector statistics over any feature source.
   *
   * Accepts **GeoJSON** (a FeatureCollection, a single Feature, a Feature[], or the engine's
   * `VectorFeatures`) — what a headless caller and `VectorLayer.getStats()` have — **or** a
   * `google.maps.Data`-shaped layer.
   *
   * @param {*} source - GeoJSON FeatureCollection|Feature|Feature[]|VectorFeatures, or a `google.maps.Data` layer
   * @param {Object} [opts]
   * @param {import('./filter.js').Filter|Function|Array|null} [opts.filter]
   * @returns {Stats}
   */
  static vector(source, { filter = null } = {}) {
    const f = normalizeFilter(filter);
    let total = 0, nPoly = 0, nLine = 0, nPoint = 0, areaM2 = 0, lengthM = 0;
    let n = 0, s = 90, w = 180, e = -180, north = -90;   // bbox accumulate

    for (const { feature, geometry } of normalizeFeatures(source)) {
      if (!geometry) continue;
      const t = geometry.type;
      const rep = representativePoint(geometry);
      // One unit works for both kinds: PredicateFilter reads `feature`, SpatialFilter reads lat/lng.
      if (f && !f.test({ feature, lat: rep?.lat, lng: rep?.lng })) continue;
      total++;
      if (rep) { n++; if (rep.lat < s) s = rep.lat; if (rep.lat > north) north = rep.lat; if (rep.lng < w) w = rep.lng; if (rep.lng > e) e = rep.lng; }
      if (t === "Polygon" || t === "MultiPolygon") {
        nPoly++;
        // Outer ring only (index 0) — holes are not subtracted, same as before.
        const polys = t === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
        for (const poly of polys) if (poly?.[0]) areaM2 += ringArea(poly[0]);
      } else if (t === "LineString" || t === "MultiLineString") {
        nLine++;
        const lines = t === "LineString" ? [geometry.coordinates] : geometry.coordinates;
        for (const line of lines) if (line) lengthM += lineLength(line);
      } else if (t === "Point" || t === "MultiPoint") {
        nPoint++;
      }
    }

    return new Stats({
      kind: "vector", featureCount: total,
      byType: { polygon: nPoly, line: nLine, point: nPoint },
      area: areaM2, length: lengthM,
      bbox: n ? { north, south: s, east: e, west: w } : null,
      propertySummary: null,
    });
  }

  // ---- pure derived views ----

  /**
   * Approximate percentile p (0–100) from the histogram. Raster only.
   * @param {number} p
   * @returns {number|null}
   */
  percentile(p) {
    if (this.kind !== "raster" || !this.histogram?.counts?.length) return null;
    const { bins, counts } = this.histogram;
    const target = (p / 100) * this.count;
    let cum = 0;
    for (let i = 0; i < counts.length; i++) {
      if (cum + counts[i] >= target) {
        const within = counts[i] ? (target - cum) / counts[i] : 0;
        return bins[i] + within * (bins[i + 1] - bins[i]);
      }
      cum += counts[i];
    }
    return this.max;
  }

  /**
   * Deltas between two Stats of the same kind (this − other) over shared numeric fields.
   * @param {Stats} other
   * @returns {Object<string, number>}
   */
  diff(other) {
    const out = {};
    for (const k of ["min", "max", "mean", "median", "stddev", "sum", "count", "area",
                     "featureCount", "length"]) {
      if (typeof this[k] === "number" && typeof other?.[k] === "number") out["delta" + k[0].toUpperCase() + k.slice(1)] = this[k] - other[k];
    }
    return out;
  }

  /** @returns {string} */
  describe() {
    const u = this.unit ? ` ${this.unit}` : "";
    if (this.kind === "raster") {
      const km2 = this.area >= 1e6 ? `${(this.area / 1e6).toFixed(2)} km²` : `${Math.round(this.area).toLocaleString()} m²`;
      return `mean ${this.mean.toFixed(2)}${u}, range ${this.min.toFixed(2)}–${this.max.toFixed(2)}${u} over ${this.count.toLocaleString()} cells (${km2})`;
    }
    const parts = [];
    if (this.byType?.polygon) parts.push(`${this.byType.polygon} polygon(s)`);
    if (this.byType?.line) parts.push(`${this.byType.line} line(s)`);
    if (this.byType?.point) parts.push(`${this.byType.point} point(s)`);
    return `${this.featureCount.toLocaleString()} feature(s): ${parts.join(", ")}`;
  }

  /** @returns {Object} */
  toJSON() { return { ...this }; }

  /** @returns {string} */
  toCSV() {
    if (this.kind === "raster") {
      if (this.byClass?.length) {
        const rows = [["label", "count", "area_m2"]].concat(
          this.byClass.map((c) => [c.label, c.count, Math.round(c.area)]));
        return rows.map((r) => r.join(",")).join("\n");
      }
      const rows = [["metric", "value"],
        ["min", this.min], ["max", this.max], ["mean", this.mean], ["median", this.median],
        ["stddev", this.stddev], ["count", this.count], ["area_m2", Math.round(this.area)]];
      return rows.map((r) => r.join(",")).join("\n");
    }
    const rows = [["metric", "value"],
      ["featureCount", this.featureCount], ["polygons", this.byType?.polygon ?? 0],
      ["lines", this.byType?.line ?? 0], ["points", this.byType?.point ?? 0],
      ["area_m2", Math.round(this.area ?? 0)], ["length_m", Math.round(this.length ?? 0)]];
    return rows.map((r) => r.join(",")).join("\n");
  }

  /** @param {string} [name] @returns {void} */
  download(name = "stats.csv") {
    const blob = new Blob([this.toCSV()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
}

// ---- helpers ----

// area/count per ColorScale band. `perCellArea` = mean pixel area (m²) for a quick area estimate.
function rasterByClass(sortedVals, perCellArea, colorScale) {
  const stops = colorScale.getStops();
  const discrete = stops.length && "value" in stops[0];
  const last = stops.length - 1;
  const out = stops.map((s) => ({
    label: s.label, color: s.color,
    ...(discrete ? { value: s.value } : { range: [s.min, s.max] }),
    count: 0, area: 0,
  }));
  for (const v of sortedVals) {
    let idx = -1;
    if (discrete) idx = stops.findIndex((s) => s.value === v);
    else idx = stops.findIndex((s, i) => (i < last ? v >= s.min && v < s.max : v >= s.min));
    if (idx >= 0) { out[idx].count++; out[idx].area += perCellArea; }
  }
  return out;
}

// Spherical helpers — identical to ui/rasterTools.js `_ringArea` / `_lineLength`.
// ---- neutral geometry ---------------------------------------------------------------------
//
// `Stats` is part of the HEADLESS engine, so its vector path must not require a `google.maps.Data`
// layer — that was a provider leak, and it is why `VectorLayer.getStats()` could not be implemented
// (a VectorLayer renders from plain GeoJSON, `dataset.data`). Both shapes normalize to GeoJSON
// geometry (`{type, coordinates}`, `[lng, lat]`) and the math below runs once, against that.

// Google's geometry objects → GeoJSON geometry. Kept so `Stats.vector(dataLayer)` (the app's
// ui/rasterTools.js call site) keeps working unchanged.
function googleGeomToGeoJson(geom) {
  const ll = (p) => [p.lng(), p.lat()];
  const ring = (r) => (r.getArray ? r.getArray() : []).map(ll);
  try {
    switch (geom.getType()) {
      case "Point":           return { type: "Point", coordinates: ll(geom.get()) };
      case "MultiPoint":      return { type: "MultiPoint", coordinates: geom.getArray().map((p) => ll(p.get ? p.get() : p)) };
      case "LinearRing":      return { type: "LineString", coordinates: ring(geom) };
      case "LineString":      return { type: "LineString", coordinates: geom.getArray().map(ll) };
      case "MultiLineString": return { type: "MultiLineString", coordinates: geom.getArray().map((l) => l.getArray().map(ll)) };
      case "Polygon":         return { type: "Polygon", coordinates: geom.getArray().map(ring) };
      case "MultiPolygon":    return { type: "MultiPolygon", coordinates: geom.getArray().map((p) => p.getArray().map(ring)) };
      default:                return null;
    }
  } catch { return null; }
}

/**
 * Accept anything that carries features and return `[{feature, geometry}]` with GeoJSON geometry:
 * a `google.maps.Data` layer, a GeoJSON FeatureCollection / Feature / Feature[], or the engine's own
 * `VectorFeatures` wrapper. `feature` is passed through untouched so a PredicateFilter still sees
 * whatever the caller's own feature object is.
 * @internal
 */
function normalizeFeatures(input) {
  if (!input) return [];
  // google.maps.Data-shaped: iterate with forEach, features answer getGeometry().
  if (typeof input.forEach === "function" && typeof input.getFeatureById === "function") {
    const out = [];
    input.forEach((f) => {
      const g = f.getGeometry?.();
      out.push({ feature: f, geometry: g ? googleGeomToGeoJson(g) : null });
    });
    return out;
  }
  if (Array.isArray(input)) return input.map((f) => ({ feature: f, geometry: f?.geometry || null }));
  if (input.type === "FeatureCollection") return normalizeFeatures(input.features || []);
  if (input.type === "Feature") return [{ feature: input, geometry: input.geometry || null }];
  if (input.features) return normalizeFeatures(input.features);   // VectorFeatures wrapper
  return [];
}

// GeoJSON rings are closed by spec; Google's paths are not. Closing before measuring makes the two
// inputs agree (and fixes a missing final segment on the Google path).
function closeRing(r) {
  if (r.length < 2) return r;
  const a = r[0], b = r[r.length - 1];
  return (a[0] === b[0] && a[1] === b[1]) ? r : [...r, a];
}

function ringArea(coords) {
  const R = 6371000;
  const r = closeRing(coords);
  let total = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const lng1 = r[i][0] * Math.PI / 180, lat1 = r[i][1] * Math.PI / 180;
    const lng2 = r[i + 1][0] * Math.PI / 180, lat2 = r[i + 1][1] * Math.PI / 180;
    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(total * R * R / 2);
}

function lineLength(coords) {
  const R = 6371000;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const φ1 = coords[i][1] * Math.PI / 180, φ2 = coords[i + 1][1] * Math.PI / 180;
    const Δφ = φ2 - φ1, Δλ = (coords[i + 1][0] - coords[i][0]) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

// A representative lat/lng for a feature (first vertex) — used for spatial filtering of vectors.
function representativePoint(geometry) {
  let c = geometry?.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];   // descend Multi*/Polygon rings
  return (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number")
    ? { lat: c[1], lng: c[0] } : null;
}
