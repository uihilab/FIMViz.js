// stats.js — computed statistics, pure and terminal (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
//
// Replaces computeStats and _computeVectorMetrics in ui/rasterTools.js. Computes the histogram,
// area and byClass up front, then derives percentile, diff, describe and toCSV from what it holds.
// It never keeps the source pixels, so it cannot be filtered afterwards: filtering means a fresh
// layer.getStats(filter) pass.
//
// A Filter (filter.js) scopes the computation, and a ColorScale (colorScale.js) buckets `byClass`.

import { Filter } from "./filter.js";

function normalizeFilter(filter) {
  if (filter == null || filter === false) return null;
  return Array.isArray(filter) ? Filter.all(filter) : Filter.from(filter);
}

// Square meters of one pixel centered at `lat`, from its degree spans. Equirectangular.
function pixelAreaM2(lat, dLatDeg, dLngDeg) {
  const mPerDegLat = 111320;
  return Math.abs(dLatDeg * mPerDegLat) * Math.abs(dLngDeg * mPerDegLat * Math.cos(lat * Math.PI / 180));
}

export class Stats {
  /** Use `Stats.raster()` or `Stats.vector()` instead of calling this. @param {Object} [fields] */
  constructor(fields = {}) { Object.assign(this, fields); }

  /**
   * Raster statistics over pixelData. A Filter scopes it and a ColorScale classifies it.
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
    const unit = {};   // one mutable unit, reused so the loop allocates nothing per pixel

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

    // Histogram over the sorted values. percentile() reads it.
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
    if (classify) stats.byClass = byClassBuckets(vals, area / count, classify);
    return stats;
  }

  /**
   * Vector statistics over any feature source.
   *
   * Takes GeoJSON as a FeatureCollection, a Feature, a Feature array or the engine's
   * `VectorFeatures`, which is what `VectorLayer.getStats()` and headless code hold. Also takes a
   * `google.maps.Data`-shaped layer.
   *
   * @param {*} source - GeoJSON FeatureCollection|Feature|Feature[]|VectorFeatures, or a `google.maps.Data` layer
   * @param {Object} [opts]
   * @param {import('./filter.js').Filter|Function|Array|null} [opts.filter]
   * @param {import('./colorScale.js').ColorScale|null} [opts.classify] - buckets features into
   *   `byClass` by the scale that colors them, so they line up with the legend as a raster's do.
   *   Needs `classifyBy` to know which property holds the value. `VectorLayer.getStats()` passes
   *   both from the layer.
   * @param {string|null} [opts.classifyBy] - the feature property `classify` reads
   * @returns {Stats}
   */
  static vector(source, { filter = null, classify = null, classifyBy = null } = {}) {
    const f = normalizeFilter(filter);
    const graded = classify && classifyBy ? [] : null;   // the values that will fall into buckets
    let total = 0, nPoly = 0, nLine = 0, nPoint = 0, areaM2 = 0, lengthM = 0;
    let n = 0, s = 90, w = 180, e = -180, north = -90;   // bbox accumulators

    for (const { feature, geometry } of normalizeFeatures(source)) {
      if (!geometry) continue;
      const t = geometry.type;
      const rep = representativePoint(geometry);
      // One unit serves both: PredicateFilter reads `feature`, SpatialFilter reads lat and lng.
      if (f && !f.test({ feature, lat: rep?.lat, lng: rep?.lng })) continue;
      total++;
      if (rep) { n++; if (rep.lat < s) s = rep.lat; if (rep.lat > north) north = rep.lat; if (rep.lng < w) w = rep.lng; if (rep.lng > e) e = rep.lng; }
      if (t === "Polygon" || t === "MultiPolygon") {
        nPoly++;
        // Outer ring only, at index 0. Holes are not subtracted.
        const polys = t === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
        for (const poly of polys) if (poly?.[0]) areaM2 += ringArea(poly[0]);
      } else if (t === "LineString" || t === "MultiLineString") {
        nLine++;
        const lines = t === "LineString" ? [geometry.coordinates] : geometry.coordinates;
        for (const line of lines) if (line) lengthM += lineLength(line);
      } else if (t === "Point" || t === "MultiPoint") {
        nPoint++;
      }
      if (graded) {
        const raw = feature?.properties?.[classifyBy];
        const v = raw == null || raw === "" ? NaN : Number(raw);
        // A feature with no usable value counts toward featureCount but enters no bucket, so a
        // missing value is never graded as a real number. The render path agrees: it leaves such a
        // feature at its base style rather than coloring it.
        if (Number.isFinite(v)) graded.push(v);
      }
    }

    const stats = new Stats({
      kind: "vector", featureCount: total,
      byType: { polygon: nPoly, line: nLine, point: nPoint },
      area: areaM2, length: lengthM,
      bbox: n ? { north, south: s, east: e, west: w } : null,
      propertySummary: null,
    });
    // The bucketing the raster path uses, so one `byClass` layout serves both kinds. Per-class area
    // means nothing for features, so only the counts are filled.
    if (graded) stats.byClass = byClassBuckets(graded.sort((a, b) => a - b), 0, classify);
    return stats;
  }

  // ---- pure derived views ----

  /**
   * Approximates percentile p, from 0 to 100, from the histogram. Raster only.
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
   * Subtracts `other` from this, field by field, over the numeric fields both kinds share.
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

// Counts values and sums area per ColorScale band. `perCellArea` is the mean pixel area in m2,
// which gives a rough area estimate.
function byClassBuckets(sortedVals, perCellArea, colorScale) {
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

// ---- provider-neutral geometry --------------------------------------------------------------
//
// The spherical helpers below match _ringArea and _lineLength in ui/rasterTools.js.
//
// Stats belongs to the headless engine, so its vector path must not require a `google.maps.Data`
// layer. That requirement leaked a provider into the engine and blocked VectorLayer.getStats(),
// since a VectorLayer renders from plain GeoJSON in `dataset.data`. Both inputs normalize to GeoJSON
// geometry, `{type, coordinates}` with `[lng, lat]`, and the math below runs once against that.

// Converts Google's geometry objects to GeoJSON geometry, so `Stats.vector(dataLayer)` still works
// for the ui/rasterTools.js call site.
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
 * Takes anything carrying features and returns `[{feature, geometry}]` with GeoJSON geometry. That
 * covers a `google.maps.Data` layer, a GeoJSON FeatureCollection, Feature or Feature array, and the
 * engine's `VectorFeatures`. `feature` passes through untouched, so a PredicateFilter still sees
 * the original feature object.
 * @internal
 */
function normalizeFeatures(input) {
  if (!input) return [];
  // google.maps.Data-shaped: iterated with forEach, and its features answer getGeometry().
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

// GeoJSON rings are closed by spec and Google's paths are not. Closing before measuring makes both
// agree, and adds the final segment the Google path would otherwise drop.
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

// One lat/lng standing in for a feature, its first vertex. SpatialFilter tests against it.
function representativePoint(geometry) {
  let c = geometry?.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];   // descend Multi*/Polygon rings
  return (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number")
    ? { lat: c[1], lng: c[0] } : null;
}
