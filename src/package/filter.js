// filter.js — a predicate over a layer's units (pixels for rasters, features for vectors),
// in the spirit of Array.prototype.filter. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 and
// docs/CLASS_DIAGRAM.md "Spatial filtering & multi-layer interaction".
//
// These are PURE predicates: `SpatialFilter` (polygon geometry) and `PredicateFilter` (a raw
// callback). They carry no view state and know nothing about the map — a consumer passes one at
// COMPUTE time (`Stats` is the main one) rather than filtering a result after the fact.

// A "unit" passed to test() is normalized by the caller:
//   raster → { value, x, y, at }   (at(x,y) reads the flat pixel array; no 2D copy)
//   vector → { feature, lat, lng }
// Spatial filters additionally read unit.lat / unit.lng (the caller supplies them for rasters
// by converting the pixel centre to lat/lng).

/**
 * @typedef {Object} FilterUnit
 * @property {number} [value] - raster: the pixel value
 * @property {number} [x] - raster: pixel x
 * @property {number} [y] - raster: pixel y
 * @property {(x: number, y: number) => number} [at] - raster: read the flat pixel array
 * @property {*} [feature] - vector: the GeoJSON feature
 * @property {number} [lat]
 * @property {number} [lng]
 */

export class Filter {
  /**
   * @param {FilterUnit} unit
   * @returns {boolean}
   */
  // eslint-disable-next-line no-unused-vars
  test(unit) { return true; }
  /** @returns {boolean} */
  isEmpty() { return false; }

  /**
   * Coerce any friendly input into a Filter.
   *   Filter-like   → returned as-is (anything with a `test(unit)` method)
   *   function      → PredicateFilter
   *   Region-like   → input.toFilter()
   *   polygon       → SpatialFilter   ([[lat,lng],…] | [{lat,lng},…] | [[ring],[ring]…])
   *
   * DUCK-TYPED, not `instanceof Filter`, for the same reason nothing in the engine does
   * `instanceof Dataset`: class identity is per-module-instance, and `fimviz` and `fimviz/ui` are
   * two separate bundles that each carry their own copy of this file. A `SpatialFilter` built by
   * `fimviz/ui`'s createRegionDraw is therefore NOT `instanceof` the engine bundle's `Filter`, so
   * `layer.getStats({ filter })` rejected the tool's own output. Testing for the method — the only
   * thing every call site actually uses — makes the seam work across bundles and lets a host pass
   * its own filter object.
   * @param {Filter|Function|{toFilter: () => Filter}|Array|null} input
   * @returns {Filter|null}
   */
  static from(input) {
    if (input == null) return null;
    // Arrays first: a polygon is an object too, and must not be mistaken for a filter-like.
    if (Array.isArray(input)) return new SpatialFilter(input);
    if (typeof input === "function") return new PredicateFilter(input);
    if (typeof input.test === "function") return input;
    if (typeof input.toFilter === "function") return input.toFilter();
    throw new Error("Filter.from: unrecognized filter input");
  }

  /**
   * Combine filters as a conjunction (AND) — the semantics of chaining applyFilter().
   * @param {Array<Filter|Function|Array|null|undefined>} filters
   * @returns {Filter|null}
   */
  static all(filters) {
    const list = (filters || []).map((f) => Filter.from(f)).filter(Boolean);
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];
    return new AllFilter(list);
  }
}

class AllFilter extends Filter {
  constructor(filters) { super(); this.filters = filters; }
  test(unit) { return this.filters.every((f) => f.test(unit)); }
  isEmpty() { return this.filters.every((f) => f.isEmpty()); }
}

export class PredicateFilter extends Filter {
  /** @param {(...args: any[]) => boolean} fn */
  constructor(fn) { super(); this.fn = fn; }
  /** @param {FilterUnit} unit @returns {boolean} */
  test(unit) {
    return unit && unit.feature !== undefined
      ? !!this.fn(unit.feature)
      : !!this.fn(unit.value, unit.x, unit.y, unit.at);
  }
}

// Ray-casting point-in-polygon — identical to ui/rasterTools.js `pointInPolygon` /
// ui/damageTools.js `_pointInPolygon` / layers/comparison.js `_cmpPointInPolygon`.
function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng, yi = ring[i].lat, xj = ring[j].lng, yj = ring[j].lat;
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

// Normalize a polygon input into an array of rings, each ring an array of { lat, lng }.
function toRings(input) {
  if (!Array.isArray(input) || input.length === 0) return [];
  const asPoint = (p) => (Array.isArray(p) ? { lat: p[0], lng: p[1] } : { lat: p.lat, lng: p.lng });
  // A ring of points looks like [{lat,lng}|[lat,lng], …]; a multi-polygon is an array of those.
  const first = input[0];
  const isPoint = (p) => Array.isArray(p)
    ? (p.length === 2 && typeof p[0] === "number")
    : (p && typeof p.lat === "number");
  if (isPoint(first)) return [input.map(asPoint)];            // single ring
  return input.map((ring) => ring.map(asPoint));             // array of rings (multi-polygon)
}

export class SpatialFilter extends Filter {
  /** @param {Array} polygon [{lat,lng}|[lat,lng]…] for one ring, or [[ring],[ring]…] for many. */
  constructor(polygon) {
    super();
    /** @type {Array<Array<{lat: number, lng: number}>>} one entry per ring */
    this.features = toRings(polygon);
  }

  /** @returns {boolean} */
  isEmpty() { return this.features.every((r) => r.length < 3); }

  /**
   * Inside ANY ring (multi-polygon union).
   * @param {number} lat
   * @param {number} lng
   * @returns {boolean}
   */
  contains(lat, lng) {
    for (const ring of this.features) {
      if (ring.length >= 3 && pointInRing(lat, lng, ring)) return true;
    }
    return false;
  }

  /** @param {FilterUnit} unit @returns {boolean} */
  test(unit) { return this.contains(unit.lat, unit.lng); }

  /**
   * Fast-reject window in pixel space (union across rings), mirroring
   * ui/rasterTools.js `polygonPixelBbox`.
   * @param {{bw: number, bs: number, be: number, bn: number, width: number, height: number}} meta
   * @returns {{x0: number, x1: number, y0: number, y1: number}}
   */
  pixelBbox(meta) {
    const { bw, bs, be, bn, width, height } = meta;
    let minPx = width, maxPx = 0, minPy = height, maxPy = 0;
    for (const ring of this.features) {
      for (const p of ring) {
        const px = Math.floor((p.lng - bw) / (be - bw) * width);
        const py = Math.floor((bn - p.lat) / (bn - bs) * height);
        if (px < minPx) minPx = px; if (px > maxPx) maxPx = px;
        if (py < minPy) minPy = py; if (py > maxPy) maxPy = py;
      }
    }
    return {
      x0: Math.max(0, minPx - 1), x1: Math.min(width - 1, maxPx + 1),
      y0: Math.max(0, minPy - 1), y1: Math.min(height - 1, maxPy + 1),
    };
  }
}
