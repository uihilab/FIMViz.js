// materialize.js — what a forced Dataset decodes into, and who decodes it.
//
// Holds two value classes, RasterGrid and VectorFeatures, plus the registries mapping a format to
// its decoder and a target CRS to its warp. Nothing heavy.
//
// This keeps `Dataset` headless: it imports these registries and value classes, never geotiff or
// GDAL. The decoders live in `io/materializers.js` and register themselves on import; geotiff
// decodes under Node, so that file is node-safe. The app's browser boot registers the GDAL
// reprojector, since GDAL is browser-only. A Node test imports the real materializers or registers
// a stub, and either way `new Dataset()` stays constructible without the toolchain, which is what
// docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 protects.
//
// registerMapProvider, registerLayerType and registerRuntime invert the same way: this file names
// the mechanism, the host supplies the implementation.

/**
 * A decoded raster: the pixel grid plus the geometry needed to place and read it. RasterLayer draws
 * one, and alignRasters and the comparison path consume one.
 */
export class RasterGrid {
  /**
   * @param {Object} init
   * @param {ArrayBufferView} init.pixels - decoded band-0 pixels
   * @param {number} init.width
   * @param {number} init.height
   * @param {{north:number,south:number,east:number,west:number}|null} [init.bounds] - in `crs`
   * @param {string|null} [init.crs]
   * @param {number|string|null} [init.noData]
   * @param {number} [init.bands]
   * @param {Object} [init.meta] - carried through from the Dataset, i.e. a GDAL legend
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
 * A decoded vector: a GeoJSON FeatureCollection plus its bounds and CRS. VectorLayer draws one.
 */
export class VectorFeatures {
  /**
   * @param {Object} init
   * @param {Object} init.features - a GeoJSON FeatureCollection or Feature
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
   * The features as a plain array, whether the payload arrived as a FeatureCollection, a lone
   * Feature or an array. Without it, the user must know which of the three it got, and write
   * `(await ds.features()).features.features` in the common case.
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
 * Registers the decoder for a `format`, i.e. 'geotiff'. io/materializers.js calls this on import,
 * and so do tests. The decoder fetches a URL root when it has one, then decodes into a RasterGrid
 * or VectorFeatures. Keeping it out of Dataset's import graph is what keeps Dataset headless.
 * @param {string} format
 * @param {Materializer} fn
 * @returns {void}
 */
export function registerMaterializer(format, fn) {
  if (typeof fn !== "function") throw new Error(`registerMaterializer("${format}"): fn must be a function`);
  _materializers.set(format, fn);
}

/**
 * The decoder for `format`, or null. Dataset.#force calls this and turns a null into a "no
 * materializer registered for '<format>'" error naming fimviz/src/io/materializers.js.
 * @param {string} format
 * @returns {Materializer|null}
 */
export function getMaterializer(format) { return _materializers.get(format) || null; }

/** Registered format names, for introspection and tests. @returns {string[]} */
export function materializerFormats() { return [..._materializers.keys()]; }

// ---- reprojector registry: async (grid, targetCrs) => RasterGrid ----
//
// One warp implementation, GDAL, so this is a single slot rather than a keyed map. It stays a
// registry instead of a direct import so Dataset never pulls in GDAL: the app registers the real
// warp at boot, which is browser-only, and tests register a stub. ds.reproject() builds a lazy node
// that touches none of this. Only forcing that node reads the slot.

/** @typedef {(grid: RasterGrid, targetCrs: string) => Promise<RasterGrid>} Reprojector */

let _reprojector = null;

/**
 * Registers the raster reprojector, the GDAL warp. The app's browser boot calls this.
 * @param {Reprojector} fn
 * @returns {void}
 */
export function registerReprojector(fn) {
  if (typeof fn !== "function") throw new Error("registerReprojector: fn must be a function");
  _reprojector = fn;
}

/** The registered reprojector, or null, in which case forcing a reproject node throws. @returns {Reprojector|null} */
export function getReprojector() { return _reprojector; }

// ---- lazy default: load the built-in GDAL warp only when needed ----
//
// A host may still call registerReprojector directly, but nothing requires it. lib.js registers a
// loader here rather than the warp itself: a closure that dynamically imports io/reprojector.js.
// Storing the closure imports nothing. resolveReprojector() invokes it at most once, the first time
// a force finds `_reprojector` null, and that import is what pulls in geo/gdal.js and gdal3.js. A
// app that never reprojects never loads GDAL; one that does loads it once, when first needed.

/** @type {(() => Promise<void>)|null} */
let _defaultLoader = null;
let _defaultLoaderPromise = null;

/**
 * Registers the fallback used when a force finds no reprojector. `fn` runs at most once, memoized,
 * and must call registerReprojector() itself before it resolves.
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
 * The reprojector to warp with, running the default loader once if nothing is registered yet.
 * Dataset's reproject force calls this rather than getReprojector(), so the lazy default gets a
 * chance before the force gives up.
 * @returns {Promise<Reprojector|null>}
 */
export async function resolveReprojector() {
  if (!_reprojector && _defaultLoader) {
    _defaultLoaderPromise ??= _defaultLoader();
    await _defaultLoaderPromise;
  }
  return _reprojector;
}
