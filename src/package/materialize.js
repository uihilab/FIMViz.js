// materialize.js — the decoded-data seam for Dataset.
//
// Two things live here and NOTHING heavy: (1) the two materialized representations a forced Dataset
// produces — RasterGrid and VectorFeatures — and (2) the REGISTRIES that map a format to the code
// that decodes it and a target CRS to the code that warps it.
//
// The whole point of this module is to keep `Dataset` headless. `Dataset` imports THIS (registries +
// value classes only, zero infrastructure), NOT geotiff/GDAL. The actual decoders live in
// `io/materializers.js` (node-safe: geotiff decodes in Node) and register themselves on import; the
// GDAL reprojector is registered by the app/browser boot (GDAL is browser-only). A Node test either
// imports the real materializers or registers a stub — either way `new Dataset()` stays constructible
// without dragging in the toolchain, which is the property docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 protects.
//
// Same registered-seam inversion the codebase already uses for registerMapProvider / registerLayerType
// / registerRuntime: the model names a mechanism, the host supplies the implementation.

/**
 * A decoded raster: the pixel grid plus the geometry needed to place and read it. This is what a
 * RasterLayer draws and what alignRasters/comparison consume — the anonymous `{ pixels, meta }` shape
 * that was already passed around everywhere, now a named value type.
 */
export class RasterGrid {
  /**
   * @param {Object} init
   * @param {ArrayBufferView} init.pixels - the decoded band-0 pixel array (typed array)
   * @param {number} init.width
   * @param {number} init.height
   * @param {{north:number,south:number,east:number,west:number}|null} [init.bounds] - in `crs`
   * @param {string|null} [init.crs]
   * @param {number|string|null} [init.noData]
   * @param {number} [init.bands]
   * @param {Object} [init.meta] - carried through from the Dataset (GDAL legend/unit, …)
   */
  constructor({ pixels, width, height, bounds = null, crs = null, noData = null, bands = 1, meta = {} } = {}) {
    this.kind = "raster";
    this.pixels = pixels;
    this.width = width;
    this.height = height;
    this.bounds = bounds;
    this.crs = crs;
    this.noData = noData;
    this.bands = bands;
    this.meta = meta;
  }
}

/**
 * A decoded vector: a GeoJSON FeatureCollection plus its frame. What a VectorLayer draws.
 */
export class VectorFeatures {
  /**
   * @param {Object} init
   * @param {Object} init.features - a GeoJSON FeatureCollection (or Feature)
   * @param {{north:number,south:number,east:number,west:number}|null} [init.bounds]
   * @param {string|null} [init.crs]
   * @param {Object} [init.meta]
   */
  constructor({ features, bounds = null, crs = null, meta = {} } = {}) {
    this.kind = "vector";
    this.features = features;
    this.bounds = bounds;
    this.crs = crs;
    this.meta = meta;
  }

  /**
   * The features as a plain array, whatever shape the payload arrived in — a FeatureCollection, a
   * lone Feature, or an array. Without this, reading them means knowing which of those you got and
   * writing `(await ds.features()).features.features` for the common case.
   * @returns {Object[]} GeoJSON Features, in document order
   */
  toArray() {
    const f = this.features;
    if (!f) return [];
    if (Array.isArray(f)) return f;
    if (Array.isArray(f.features)) return f.features;
    if (f.type === "Feature") return [f];
    return [];
  }

  /** How many features this holds. @returns {number} */
  get count() { return this.toArray().length; }

  /** `for (const feature of await ds.features())`. @returns {Iterator<Object>} */
  [Symbol.iterator]() { return this.toArray()[Symbol.iterator](); }
}

// ---- materializer registry: format -> async (root, ds) => RasterGrid | VectorFeatures ----

/** @typedef {(root: {kind:'inline'|'url', data?: any, url?: string}, ds: import('./dataset.js').Dataset) => Promise<RasterGrid|VectorFeatures>} Materializer */

const _materializers = new Map();

/**
 * Register the decoder for a `format` (e.g. 'geotiff', 'geojson'). Called by io/materializers.js on
 * import (and by tests). The decoder fetches (for a URL root) and decodes into a RasterGrid/
 * VectorFeatures. Keeping this out of Dataset's import graph is what preserves headlessness.
 * @param {string} format
 * @param {Materializer} fn
 * @returns {void}
 */
export function registerMaterializer(format, fn) {
  if (typeof fn !== "function") throw new Error(`registerMaterializer("${format}"): fn must be a function`);
  _materializers.set(format, fn);
}

/**
 * The decoder for `format`, or null. Dataset.#force uses this; a null result becomes a clear
 * "no materializer registered for '<format>' — import fimviz/src/io/materializers.js" error.
 * @param {string} format
 * @returns {Materializer|null}
 */
export function getMaterializer(format) { return _materializers.get(format) || null; }

/** Registered materializer format names (introspection/tests). @returns {string[]} */
export function materializerFormats() { return [..._materializers.keys()]; }

// ---- reprojector registry: async (grid, targetCrs) => RasterGrid ----
//
// Exactly ONE warp implementation (GDAL), so this is a single slot, not a keyed map. It is a registry
// rather than a direct import purely so Dataset stays GDAL-free: the app registers the real warp at
// boot (browser-only), tests register a stub. reproject() as a Dataset OP builds a lazy node with no
// dependency here; only FORCING a reproject node reaches for this.

/** @typedef {(grid: RasterGrid, targetCrs: string) => Promise<RasterGrid>} Reprojector */

let _reprojector = null;

/**
 * Register the raster reprojector (the GDAL warp). Called by the app/browser boot.
 * @param {Reprojector} fn
 * @returns {void}
 */
export function registerReprojector(fn) {
  if (typeof fn !== "function") throw new Error("registerReprojector: fn must be a function");
  _reprojector = fn;
}

/** The registered reprojector, or null (forcing a reproject node then throws a clear error). @returns {Reprojector|null} */
export function getReprojector() { return _reprojector; }

// ---- lazy default (JIT-load the built-in GDAL warp only when actually needed) ----
//
// A host can call registerReprojector directly, but nothing requires that anymore: lib.js registers
// the built-in GDAL warp here as a LOADER — a closure that dynamically import()s io/reprojector.js —
// not the warp itself. Storing a closure is free (no import happens yet); resolveReprojector() only
// invokes it, at most once, the first time a force finds `_reprojector` still null. That import is
// what actually pulls in geo/gdal.js/gdal3.js, so a consumer who never reprojects anything never pays
// for GDAL at all, and one who does pays for it exactly once, exactly when it's first needed.

/** @type {(() => Promise<void>)|null} */
let _defaultLoader = null;
let _defaultLoaderPromise = null;

/**
 * Register the fallback used when a force finds no reprojector registered yet. `fn` is invoked AT
 * MOST ONCE (memoized) and is expected to call registerReprojector() itself before resolving.
 * @param {(() => Promise<void>)|null} fn
 * @returns {void}
 */
export function registerDefaultReprojectorLoader(fn) {
  if (fn != null && typeof fn !== "function") {
    throw new Error("registerDefaultReprojectorLoader: fn must be a function");
  }
  _defaultLoader = fn;
}

/**
 * The reprojector to warp with, running the default loader (once, memoized) if nothing is registered
 * yet. Dataset's reproject force calls this instead of getReprojector() so the JIT default gets a
 * chance before giving up.
 * @returns {Promise<Reprojector|null>}
 */
export async function resolveReprojector() {
  if (!_reprojector && _defaultLoader) {
    _defaultLoaderPromise ??= _defaultLoader();
    await _defaultLoaderPromise;
  }
  return _reprojector;
}
