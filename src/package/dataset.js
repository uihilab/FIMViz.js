// dataset.js — a lazy, immutable parsed source, raster or vector, in its native CRS with metadata.
//
// docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 records why Dataset became a lazy op chain and
// what each decision traded away.
//
// A Dataset is one node in an op chain. A root wraps a source, either inlined bytes or GeoJSON in
// `data`, or a URI through fromURL. A derived node is a parent plus one op such as reproject or
// select. Nothing is fetched, decoded or warped until a terminal forces it: `load()`, `grid()`,
// `features()`, or a Layer rendering it. An op returns a new lazy Dataset and mutates nothing, so
// one Dataset backs many Layers without any of them corrupting the others. `kind` is raster or
// vector, decoding to a RasterGrid or VectorFeatures (package/materialize.js).
//
// This file stays headless. `reproject` is a method, but nothing here imports GDAL or geotiff:
// building a reproject node is pure, and forcing it dispatches through the registered reprojector
// (package/materialize.js), just as decoding dispatches through the registered materializers. So
// `new Dataset()` is constructible and testable under node without the toolchain, which is why the
// heavy decoders live in io/materializers.js, outside this import graph. Dependencies flow from geo/
// and io/ into package/, never back.
//
// A Dataset whose payloads are addressed rather than inlined carries format-neutral selection axes
// in `axes`, i.e. a URL-backed stage series. `select()` resolves one entry into a child Dataset. The
// axes docs below cover the details.

import {
  RasterGrid, VectorFeatures,
  getMaterializer, resolveReprojector,
  registerMaterializer, materializerFormats,
  registerReprojector, registerDefaultReprojectorLoader,
} from "./materialize.js";
import {
  maskGrid, clipGrid, reclassifyGrid, combineGrids, zonalStats,
  slopeGrid, aspectGrid, hillshadeGrid, rasterizeFeatures, groupByGrid, gridMeta,
} from "./rasterOps.js";
import { Stats } from "./stats.js";
// resampleGrid is pure JS and headless, since geo/resample.js imports nothing, the same as
// rasterOps.js which already imports it for combine()'s resampling. lib.js exports resampleGrid and
// registerResampler directly too, so the user can take either the Dataset op below or the raw
// function over pixel arrays.
import { resampleGrid, registerResampler } from "../geo/resample.js";
import { notifyBusy } from "./events.js";

// A resample target is either resample.js's own meta layout or anything grid-shaped, i.e. a
// RasterGrid or another Dataset's forced .grid() result. Normalized the way rasterOps.js's gridMeta()
// does, so resampleTo() takes whatever the user already holds.
function toResampleMeta(t) {
  if (!t) return null;
  if (typeof t.bw === "number" && typeof t.width === "number") return t;
  if (t.bounds && typeof t.width === "number" && typeof t.height === "number") {
    const b = t.bounds;
    return { width: t.width, height: t.height, bw: b.west, bs: b.south, be: b.east, bn: b.north };
  }
  return null;
}

let _seq = 0;
function nextId() {
  return `ds_${Date.now().toString(36)}_${(++_seq).toString(36)}`;
}

// Infers a decode format from a URL or filename extension, for fromURL and select.
function formatFromName(name) {
  const ext = (String(name).split("?")[0].split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "geojson": case "json": return "geojson";
    case "tif": case "tiff": return "geotiff";
    case "kml": return "kml";
    case "kmz": return "kmz";
    case "zip": case "shp": return "shp";
    default: return null;
  }
}
const kindOfFormat = (fmt) => (fmt === "geotiff" ? "raster" : fmt ? "vector" : null);

// True when this axis entry's `ref` is an in-file selector rather than a URL or named URL variants.
// An object-valued `select` key tells them apart: named variants hold strings throughout, so a
// variant actually named "select", holding a URL string, still reads as a variant.
const isSelectorRef = (ref) =>
  !!ref && typeof ref === "object" && !!ref.select && typeof ref.select === "object";

/**
 * One entry on a selection axis. `ref` says how to get this entry's payload and takes three forms.
 * The axis model does not care which, so `select()` and `reduce()` work the same over all three.
 *
 * - `'stage_12.tif'`, a URL relative to `select`'s `base`. One file per entry, which is the FIM
 *   Scenario layout where each stage is its own downloadable raster.
 * - `{ raster: 'a.tif', vector: 'a.geojson' }`, named URL variants, picked by `select({ variant })`.
 * - `{ select: { variable: 'TMP', date: '…' } }`, an in-file selector. The entry is not a separate
 *   file but a slice of the source this Dataset already points at, i.e. a NetCDF file holding every
 *   timestep. The child shares the parent's bytes or URL and passes the selector to the materializer
 *   as `root.select`. Optional `name`, `crs` and `bounds` siblings override what the child would
 *   otherwise inherit.
 *
 * The third form is what lets one multi-dimensional file back a whole temporal axis. Without it an
 * axis entry has to be separately fetchable, which holds for FIM Scenario and for no scientific
 * multi-dimensional format.
 *
 * @typedef {Object} DatasetAxisEntry
 * @property {number|string} coord
 * @property {string|Object<string,string>|{select: Object, name?: string, crs?: string, bounds?: DatasetBounds}} ref
 * @property {Object} [meta]
 */
/**
 * A selection axis and the operations it permits. Which verbs are legal belongs to the axis rather
 * than to the verb, so a band, variable or ensemble axis is safe by construction.
 *
 * The two flags are independent, which is why there are two. An ensemble member axis is unordered,
 * since member 3 is not between 2 and 4, yet fully reducible, since the members are one quantity
 * realized differently. A band axis is the reverse: ordered by index, but a mean of red and
 * near-infrared means nothing.
 *
 * | axis | `ordered` | `commensurable` |
 * |---|---|---|
 * | time, level, stage, depth | ✅ | ✅ |
 * | ensemble member | ✗ | ✅ |
 * | band (R/G/B) | ✅ | ✗ |
 * | variable (Rainf/Tair) | ✗ | ✗ |
 *
 * Both default to `true`, matching the axes that existed before the flags did: FIM Scenario's stage
 * and the NetCDF, GRIB2 and Zarr time axes are all ordered and commensurable.
 *
 * @typedef {Object} DatasetAxis
 * @property {string} name
 * @property {string|null} [unit]
 * @property {boolean} [ordered=true] - do the coords have a magnitude, so that "between" and
 *   whether "nearest" means anything here. Gates `selectRange` and selectAxisEntry's nearest match,
 *   which would otherwise snap `select(1.5)` to band 2.
 * @property {boolean} [commensurable=true] - do the entries measure the same quantity in the same
 *   whether the entries share units, so averaging across them means something. Gates `reduce`.
 * @property {DatasetAxisEntry[]} entries
 */
/**
 * @typedef {Object} DatasetBounds
 * @property {number} north @property {number} south @property {number} east @property {number} west
 */

export class Dataset {
  // ---- lazy-graph state: private, never enumerated, and out of toRecord unless storeMaterialized ----
  #url = null;          // root only: a URI source (fromURL). Mutually exclusive with inline `data`.
  #resolveUrl = null;   // url root only: an optional (url)=>string resolver (host CORS-proxy/mirror),
                        //   applied at force time. Supplied per instance, and never serialized.
  #selector = null;     // root only: an IN-FILE selection (e.g. { variable, date }), handed to the
                        //   materializer as `root.select`. This is what lets one multi-dimensional
                        //   source back a whole axis; see select()'s selector refs.
  #inputs = null;       // derived only: the INPUT Datasets (array — unary ops are length-1, N-ary ops
                        //   such as combine hold several. null on a root.
  #op = null;           // derived only: a declarative op descriptor, e.g. { op:'reproject', crs }
  #materialized = null; // memoized force result (RasterGrid|VectorFeatures)
  #warnings = [];       // collected at FORCE time (a lazy op can't warn at construction)
  #bounds;               // constructor-known value; the `bounds` getter below prefers #materialized's
  #meta;                 // constructor-known value; the `meta` getter below prefers #materialized's

  /**
   * @param {Object} [init]
   * @param {string} [init.id]
   * @param {string} [init.name]
   * @param {'raster'|'vector'|null} [init.kind]
   * @param {'geotiff'|'geojson'|'kml'|'kmz'|'shp'|'hazus'|null} [init.format]
   * @param {string|null} [init.crs] - native CRS; `null` when unknown
   * @param {DatasetBounds|null} [init.bounds] - expressed in `crs`
   * @param {Object} [init.meta]
   * @param {ArrayBuffer|Object|null} [init.data] - inlined payload only (raster bytes or parsed GeoJSON)
   * @param {string|null} [init.url] - a URI root (set via Dataset.fromURL); leaves `data` null
   * @param {((url: string) => string)|null} [init.resolveUrl] - url root only: resolver applied to the URL at force time
   * @param {DatasetAxis|null} [init.axis] - 1-D sugar for a single selection axis
   * @param {DatasetAxis[]|null} [init.axes]
   * @param {Object|null} [init.selector] - an in-file selection passed to the materializer as `root.select`
   *   normally produced by `select()` from a selector ref rather than passed by hand
   */
  constructor({ id, name, kind = null, format = null, crs = null,
                bounds = null, meta = {}, data = null, url = null, resolveUrl = null,
                selector = null, axis = null, axes = null } = {}) {
    this.id = id || nextId();
    this.name = name || this.id;
    this.kind = kind;
    this.format = format;
    this.crs = crs;
    this.#bounds = bounds;
    this.#meta = meta;
    this.data = data;                  // inlined payload (root). null for url roots + derived nodes.
    this.#url = url;
    this.#resolveUrl = resolveUrl;
    this.#selector = selector;
    this.axes = axes ?? (axis ? [axis] : null);
  }

  /**
   * A URI-rooted Dataset. It fetches and decodes into a RasterGrid or VectorFeatures on force, and
   * does nothing before then. Format and kind come from the URL when not given.
   * @param {string} url
   * @param {Object} [opts]
   * @param {'geotiff'|'geojson'|'kml'|'kmz'|'shp'|'hazus'} [opts.format] - inferred from the URL's extension when omitted
   * @param {string} [opts.name] - defaults to the URL's filename
   * @param {'raster'|'vector'} [opts.kind] - inferred from `format` when omitted
   * @param {string} [opts.crs] - defaults to `'EPSG:4326'` for vector formats, `null` (unknown) for raster
   * @param {DatasetBounds} [opts.bounds]
   * @param {Object} [opts.meta]
   * @param {(url: string) => string} [opts.resolveUrl] - a resolver (host CORS-proxy/mirror) applied to the URL at force time
   * @returns {Dataset}
   */
  static fromURL(url, opts = {}) {
    if (typeof url !== "string" || !url) throw new Error("Dataset.fromURL: a URL string is required");
    const name = opts.name || url.split("/").pop().split("?")[0] || "download";
    const format = opts.format || formatFromName(name);
    return new Dataset({
      url, name, format,
      kind: opts.kind || kindOfFormat(format),
      crs: opts.crs ?? (kindOfFormat(format) === "vector" ? "EPSG:4326" : null),
      bounds: opts.bounds ?? null,
      meta: opts.meta ?? {},
      resolveUrl: opts.resolveUrl ?? null,
    });
  }

  /**
   * Wraps an already-decoded grid or VectorFeatures, which is the way back into the op chain for
   * something decoded elsewhere, computed with the standalone grid functions, or built by hand. The
   * result is already materialized: no decode, no fetch, no materializer, and `load()` and `grid()`
   * return the value passed in.
   *
   * This is what keeps the op chain two-way. `ds.grid()` hands out a grid and this takes one back, so
   * `clip`, `mask` and `slope` stay reachable.
   *
   * @param {import('./materialize.js').RasterGrid|import('./materialize.js').VectorFeatures} value
   * @param {Object} [opts] - { name?, format?, meta? }; `kind`/`crs`/`bounds` come from the value
   * @returns {Dataset}
   */
  // ---- the decode and warp registries, as statics on the type they serve -------------------
  //
  // `load()` and `grid()` dispatch through these. They live here rather than as loose exports
  // because the owner was never in doubt: a materializer decodes for a Dataset and a reprojector
  // warps one. They are the same functions `package/materialize.js` exports.

  /**
   * Registers the decoder for a `format`, i.e. 'geotiff'.
   * @param {string} format
   * @param {(root: Object, ds: Dataset) => Promise<RasterGrid|VectorFeatures>} fn
   * @returns {void}
   */
  static registerMaterializer(format, fn) { return registerMaterializer(format, fn); }

  /**
   * The formats that can be decoded right now, built-in and registered. Build a file picker's
   * `accept` list from it, or check an upload before parsing.
   * @returns {string[]}
   */
  static formats() { return materializerFormats(); }

  /**
   * Supplies the single warp implementation `reproject()` forces through.
   * @param {(grid: RasterGrid, toCrs: string) => Promise<RasterGrid>} fn
   * @returns {void}
   */
  static registerReprojector(fn) { return registerReprojector(fn); }

  /**
   * A fallback run at most once, on the first force that finds no reprojector registered. This is
   * how the GDAL warp loads itself with no setup call.
   * @param {() => Promise<void>} fn
   * @returns {void}
   */
  static registerDefaultReprojectorLoader(fn) { return registerDefaultReprojectorLoader(fn); }

  /**
   * Supplies a resampler for the methods the pure-JS path does not implement, i.e. cubic, which
   * `resampleTo({ method })` otherwise throws on. Synchronous and pixel-level. GDAL's own richer
   * methods go through the reprojector instead (see geo/resample.js).
   * @param {Function} fn
   * @returns {void}
   */
  static registerResampler(fn) { return registerResampler(fn); }

  static fromGrid(value, opts = {}) {
    if (!value || (value.kind !== "raster" && value.kind !== "vector")) {
      throw new Error("Dataset.fromGrid: expected a RasterGrid or VectorFeatures (a decoded value with a .kind)");
    }
    const ds = new Dataset({
      name: opts.name || "grid",
      kind: value.kind,
      // No format, because there are no encoded bytes here to decode. A format would claim
      // something about bytes that do not exist.
      format: opts.format ?? null,
      crs: value.crs ?? null,
      bounds: value.bounds ?? null,
      meta: opts.meta ?? value.meta ?? {},
    });
    ds.#materialized = value;   // already forced, so a terminal returns this without decoding
    return ds;
  }

  /**
   * The footprint, in `crs`. Known at construction for a root, and for an op whose result is
   * predictable such as `clip`. Null when it genuinely is not, i.e. a fresh `reproject()` node, whose
   * real bounds depend on what the warp produces. Once this node is forced it reads the value off
   * the memoized result instead, so the reprojected node's `bounds` reports the true post-warp
   * footprint rather than the construction-time placeholder.
   * @returns {DatasetBounds|null}
   */
  get bounds() { return this.#materialized?.bounds ?? this.#bounds; }

  /**
   * Free-form metadata, i.e. a GDAL legend. Updates itself the way `bounds` does: once forced it
   * reads off the memoized result, which matters for an op like `reproject` whose reprojector
   * refreshes `width` and `height` that the pre-force value cannot know.
   * @returns {Object}
   */
  get meta() { return this.#materialized?.meta ?? this.#meta; }

  /** The primary (first) selection axis, or null. @returns {DatasetAxis|null} */
  get axis() { return this.axes?.[0] ?? null; }

  /** Warnings collected when this node was forced (implicit reprojection, defaults, …). @returns {string[]} */
  get warnings() { return this.#warnings; }

  /** Has this node been forced (decoded/warped) yet? @returns {boolean} */
  get isMaterialized() { return this.#materialized != null; }

  // ---- ops: synchronous to build, returning a new lazy Dataset, never mutating ----
  //
  // The rule dividing this class: a SYNCHRONOUS method builds a lazy node and returns a Dataset, an
  // ASYNC method is a terminal that forces the chain and returns data. Nothing in this section
  // awaits, so nothing in it computes. test/datasetOps.test.mjs enforces both halves.

  /**
   * Builds a lazy reproject to `toCrs` and returns a new Dataset. The warp runs on force, through
   * the registered reprojector, since this file imports no GDAL. Requesting the CRS it already has
   * returns `this` unchanged. Rasters only, as vectors are EPSG:4326 by spec.
   * @param {string} toCrs
   * @returns {Dataset}
   */
  reproject(toCrs) {
    if (!toCrs) throw new Error("reproject: a target CRS is required (e.g. 'EPSG:4326')");
    // Validate and normalize case here, where the mistake is made. Storing the string as passed
    // would let a case or format slip appear many frames later as a confusing "cannot render CRS"
    // from a provider check that never learns it is the same CRS.
    const m = /^epsg:(\d+)$/i.exec(String(toCrs).trim());
    if (!m) {
      throw new Error(`reproject: "${toCrs}" is not a recognized CRS — expected the form "EPSG:<code>" ` +
        "(e.g. 'EPSG:4326').");
    }
    const crs = `EPSG:${m[1]}`;
    if (this.crs === crs) return this;
    if (this.kind && this.kind !== "raster") {
      throw new Error(`reproject: vector reprojection is not implemented ("${this.name}", ` +
        `${this.crs || "unknown CRS"}). geojson is EPSG:4326 by spec (RFC 7946), and kml/kmz are ` +
        "WGS84 by spec. A shapefile with a .prj can be in any CRS, and that case is not handled " +
        "yet — reproject it before parsing, or rasterize() and reproject the raster.");
    }
    return this.#derive({ op: "reproject", crs }, { crs, bounds: null });
  }

  // The first op name other than "reproject" found walking this node's ancestry to its root, or null
  // when the lineage holds nothing but reproject nodes.
  //
  // Forcing a reproject warps the chain's root bytes when it can, through #rootData. That is right
  // for a plain source and for a reproject-only lineage, where warping straight to the final CRS
  // beats warping twice through an intermediate one. Any other op in the ancestry, i.e. clip, means
  // the root's bytes no longer represent what this node is. #applyOp's reproject case reads this to
  // choose between reusing the root bytes, which is cheap, and encoding and warping the computed
  // grid through geo/gdal.js warpGrid via the reprojector's ctx.grid. It never discards the
  // computation.
  #nonReprojectAncestorOp() {
    let n = this;
    while (n.#inputs) {
      if (n.#op?.op !== "reproject") return n.#op?.op ?? "unknown";
      n = n.#inputs[0];
    }
    return null;
  }

  // ---- raster analysis ops: lazy, pure JS over the decoded grid (PACKAGE_ROADMAP §2) ----

  /**
   * Masks by a polygon. On force, pixels outside it become transparent, or inside it with
   * `{ invert }`. The footprint does not change. Lazy: this builds a node and the terminal runs it.
   * @param {import('./filter.js').SpatialFilter|Array} polygon - a SpatialFilter, or a ring/multi-ring of {lat,lng}|[lat,lng]
   * @param {{ invert?: boolean }} [opts]
   * @returns {Dataset}
   */
  mask(polygon, { invert = false } = {}) {
    this.#assertRasterOp("mask");
    const rings = polygon?.features || polygon;      // accept a SpatialFilter or raw rings (kept cloneable)
    return this.#derive({ op: "mask", polygon: rings, invert: !!invert });
  }

  /**
   * Crops to a bbox, shrinking the footprint to the overlap and snapping to pixel edges. Lazy.
   * @param {{north:number,south:number,east:number,west:number}} bbox
   * @returns {Dataset}
   */
  clip(bbox) {
    this.#assertRasterOp("clip");
    if (!bbox || bbox.north == null) throw new Error("clip: a bbox { north, south, east, west } is required");
    return this.#derive({ op: "clip", bbox }, { bounds: bbox });
  }

  /**
   * Remaps pixel values by `rules` (see rasterOps.reclassifyGrid), in one of two forms.
   *
   * A range-rules array `[{min?,max?,value?}]`, first match wins, where a rule with no `value` keeps
   * the matched pixel's own value.
   *
   * A callback `(value, index) => number|null|undefined`, run once per valid pixel with its raw
   * value and flat row-major index `row*width+col`, returning the new value directly. It is not
   * limited to a contiguous range and skips rule matching, one call per pixel instead of a
   * scan per rule, so past a couple of simple ranges it is both more general and cheaper.
   *
   * Either form: returning `null` or `undefined`, or matching no rule, leaves the pixel unmatched,
   * which becomes transparent by default or is kept. Lazy.
   *
   * A callback does not survive `toRecord()`, since structured clone cannot carry a function.
   * Forcing it with `.grid()` works in-session, but `toRecord()` on this node or a descendant throws
   * and names the op rather than dropping it. Use range rules for a chain that has to persist to
   * Storage and reload.
   * @param {Array<{min?:number,max?:number,value?:number}>|((value:number,index:number)=>number|null|undefined)} rules
   * @param {{ unmatched?: 'nodata'|'keep' }} [opts]
   * @returns {Dataset}
   */
  reclassify(rules, { unmatched = "nodata" } = {}) {
    this.#assertRasterOp("reclassify");
    const isFn = typeof rules === "function";
    if (!isFn && (!Array.isArray(rules) || !rules.length)) {
      throw new Error("reclassify: a non-empty rules array, or a (value, index) => value callback, is required");
    }
    return this.#derive({ op: "reclassify", rules, unmatched });
  }

  /**
   * Combines this raster with `others` pixel by pixel, resampling them onto this grid first. `op` is
   * difference or ratio for two rasters, or sum, mean, min or max for any number. Lazy.
   * @param {Dataset|Dataset[]} others
   * @param {{ op?: string, method?: string }} [opts]
   * @returns {Dataset}
   */
  combine(others, { op = "difference", method = "nearest" } = {}) {
    this.#assertRasterOp("combine");
    const list = Array.isArray(others) ? others : [others];
    if (!list.length) throw new Error("combine: at least one other Dataset is required");
    return this.#derive({ op: "combine", reducer: op, method }, { bounds: this.bounds }, [this, ...list]);
  }

  /** Sugar: this − other, per pixel (LHS-conform). @param {Dataset} other @returns {Dataset} */
  /** `combine([other], { op: "difference" })`. @param {Dataset} other @returns {Dataset} */
  difference(other) { return this.combine([other], { op: "difference" }); }

  /** `combine([other], { op: "ratio" })`. @param {Dataset} other @returns {Dataset} */
  ratio(other) { return this.combine([other], { op: "ratio" }); }

  // The two binary reducers get a shorthand; the N-ary four (sum/mean/min/max) deliberately do not.
  // `ds.min(others)` and `ds.mean(others)` would read as "this raster's minimum" and "this raster's
  // mean", which are `(await ds.stats()).min` and `.mean` — a different number entirely. Call
  // combine({ op }) for those, where the word sits next to its operand list.

  /**
   * Resamples onto a target grid on force, through geo/resample.js's resampleGrid. lib.js also
   * exports resampleGrid and alignRasters directly, so either this Dataset op or the raw function
   * over pixel arrays works.
   *
   * `target` is either resample's own meta object `{ width, height, bw, bs, be, bn }` or anything
   * grid-shaped, `{ width, height, bounds: {north,south,east,west} }`, i.e. another forced Dataset's
   * `.grid()` result. `method` defaults to `'nearest'`, which is pure JS and always available. The
   * GDAL-only methods (cubic, lanczos, mode, min, max, med, q1, q3) need a resampler from
   * `Dataset.registerResampler`, or forcing throws. The result takes the target's footprint and
   * resolution, and `crs` does not change: this resamples, it does not reproject.
   * @param {{width:number,height:number,bw:number,bs:number,be:number,bn:number}|{width:number,height:number,bounds:{north:number,south:number,east:number,west:number}}} target
   * @param {{ method?: string, noData?: number }} [opts]
   * @returns {Dataset}
   */
  resampleTo(target, { method = "nearest", noData = null } = {}) {
    this.#assertRasterOp("resampleTo");
    const targetMeta = toResampleMeta(target);
    if (!targetMeta) {
      throw new Error("resampleTo: target must be { width, height, bw, bs, be, bn }, or grid-shaped " +
        "{ width, height, bounds: {north,south,east,west} } (e.g. another Dataset's .grid()).");
    }
    const bounds = { north: targetMeta.bn, south: targetMeta.bs, east: targetMeta.be, west: targetMeta.bw };
    return this.#derive({ op: "resample", targetMeta, method, noData }, { bounds });
  }

  /**
   * Per-pixel terrain steepness by Horn's method, in pure JS over the decoded grid with no GDAL.
   * See rasterOps.slopeGrid and PACKAGE_ROADMAP §2 "terrain". Lazy.
   * @param {{ zFactor?: number, cellsizeX?: number, cellsizeY?: number, unit?: 'degrees'|'percent' }} [opts]
   * @returns {Dataset}
   */
  slope(opts = {}) {
    this.#assertRasterOp("slope");
    return this.#derive({ op: "slope", opts });
  }

  /**
   * The downslope compass bearing by Horn's method (rasterOps.aspectGrid). Lazy.
   * @returns {Dataset}
   */
  aspect() {
    this.#assertRasterOp("aspect");
    return this.#derive({ op: "aspect" });
  }

  /**
   * A shaded-relief illumination raster by Horn's method (rasterOps.hillshadeGrid). Lazy.
   * @param {{ altitude?: number, azimuth?: number, zFactor?: number, cellsizeX?: number, cellsizeY?: number }} [opts]
   * @returns {Dataset}
   */
  hillshade(opts = {}) {
    this.#assertRasterOp("hillshade");
    return this.#derive({ op: "hillshade", opts });
  }

  /**
   * Rasterizes this vector Dataset onto a new grid, the one op that changes a Dataset's kind
   * (PACKAGE_ROADMAP §2). `field` burns each feature's property value; omit it for a constant
   * `burnValue`. Bounds default to this Dataset's footprint. `width` and `height` are required,
   * because a vector carries no pixel resolution. Lazy.
   * @param {{ width: number, height: number, bounds?: DatasetBounds, field?: string, burnValue?: number }} opts
   * @returns {Dataset}
   */
  rasterize({ width, height, bounds, field, burnValue = 1 } = {}) {
    this.#assertVectorOp("rasterize");
    if (!width || !height) throw new Error("rasterize: { width, height } are required");
    const targetBounds = bounds || this.bounds;
    if (!targetBounds) throw new Error("rasterize: no bounds available (pass { bounds }, or set them on the source)");
    return this.#derive(
      { op: "rasterize", width, height, bounds: targetBounds, field, burnValue },
      { kind: "raster", format: null, bounds: targetBounds },
    );
  }

  /**
   * Collapses this Dataset's selection axis into one grid with a per-pixel reducer, i.e. a stage or
   * time series. Shorthand for select() then combine(): it resolves each axis entry to a child
   * Dataset, then conforms and reduces them as combine() does (PACKAGE_ROADMAP §2). Lazy.
   * @param {'sum'|'mean'|'min'|'max'} [op]
   * @param {{ axis?: number|string, method?: string, variant?: string }} [opts]
   * @returns {Dataset}
   */
  reduce(op = "mean", { axis = 0, method = "nearest", variant } = {}) {
    if (!["sum", "mean", "min", "max"].includes(op)) {
      throw new Error(`reduce: op must be one of sum/mean/min/max (got "${op}")`);
    }
    const { ax } = this.#requireAxis(axis);
    if (ax.commensurable === false) {
      throw new Error(`reduce: axis "${ax.name}" is not commensurable — its entries measure different ` +
        "quantities (a variable or band axis), so averaging across them has no meaning. select() one " +
        "entry, or reduce a different axis.");
    }
    const entries = ax.entries;
    const datasets = entries.map((e) => this.select(e.coord, { axis, variant }));
    if (datasets.some((d) => !d)) throw new Error("reduce: an axis entry failed to resolve to a Dataset");
    return datasets[0].combine(datasets.slice(1), { op, method });
  }

  #assertRasterOp(name) {
    if (this.kind && this.kind !== "raster") {
      throw new Error(`${name}: raster-only op ("${this.name}" is a ${this.kind} dataset)`);
    }
  }

  #assertVectorOp(name) {
    if (this.kind && this.kind !== "vector") {
      throw new Error(`${name}: vector-only op ("${this.name}" is a ${this.kind} dataset)`);
    }
  }

  /**
   * Resolves one selection-axis entry into a lazy child Dataset. Shorthand for selectAxisEntry: it
   * picks the entry, resolves its `ref` and carries the entry's opaque `meta`. Returns null when no
   * entry matches. The user chooses the variant, raster or vector.
   *
   * The `ref` decides what kind of child comes back (see {@link DatasetAxisEntry}). A URL, bare or a
   * named variant chosen with `opts.variant`, gives a URL-rooted child whose format comes from the
   * URL, one file per entry. An in-file selector, `{ select: {…} }`, gives a child rooted on this
   * Dataset's own source, its bytes or URL plus the resolver, carrying the selector for the
   * materializer: one file with many entries, i.e. a NetCDF time axis.
   *
   * Either way the child has no `axes` of its own. It is one payload rather than a series, so it
   * forces through `load()` and `grid()` like any Dataset and every op chains off it.
   *
   * @param {number|string} coord
   * @param {Object} [opts]
   * @param {number|string} [opts.axis=0] - which axis (index or name) to look up on
   * @param {boolean} [opts.nearest=true] - fall back to the closest numeric coord on a miss
   * @param {string} [opts.variant] - required when the matched entry's `ref` has named URL variants (e.g. `{raster, vector}`)
   * @param {string} [opts.base] - URL prefix prepended to a resolved URL `ref` (ignored by selector refs)
   * @returns {Dataset|null}
   */
  select(coord, opts = {}) {
    const { idx } = this.#requireAxis(opts.axis ?? 0);
    const entry = this.selectAxisEntry(coord, opts);
    if (!entry) return null;
    let ref = entry.ref;

    // An in-file selector means this entry is a slice of the source already held, not a download.
    // Checked before the variant branch because both are objects: a selector carries an
    // object-valued `select` key, where named variants hold strings throughout.
    if (isSelectorRef(ref)) {
      if (!this.#url && this.data == null) {
        throw new Error(`select: "${this.name}"'s axis entry ${JSON.stringify(entry.coord)} is an ` +
          "in-file selector, but this Dataset has no source to select from (no data, no url).");
      }
      // Selecting peels one axis: the chosen coordinate folds into the selector, that axis drops,
      // and the others stay. So on a time-by-member series, select(t) leaves a member series rather
      // than a payload and a second select() finishes the job. That is what makes axes a model for
      // any number of extra dimensions rather than a special case for one. The selector merges for
      // the same reason: {t} then {m} must reach the decoder as {t, m}.
      const remaining = (this.axes || []).filter((_, i) => i !== idx);
      return new Dataset({
        name: ref.name || `${this.name}[${entry.coord}]`,
        kind: this.kind, format: this.format,
        crs: ref.crs ?? this.crs,
        bounds: ref.bounds ?? this.#bounds,
        meta: { ...(this.#meta || {}), ...(entry.meta || {}) },
        data: this.data, url: this.#url, resolveUrl: this.#resolveUrl,
        selector: { ...(this.#selector || {}), ...ref.select },
        axes: remaining.length ? remaining : null,
      });
    }

    if (ref && typeof ref === "object") {
      if (!opts.variant) throw new Error(`select: entry ref has named variants (${Object.keys(ref).join(", ")}); pass { variant }`);
      ref = ref[opts.variant];
    }
    if (!ref) return null;
    const url = (opts.base || "") + ref;
    // A child inherits this Dataset's URL resolver, so a proxied series stays resolved across
    // select(). The resolver is carried rather than read ambiently, so it stays per instance.
    return Dataset.fromURL(url, { name: String(ref).split("/").pop(), meta: entry.meta || {},
      resolveUrl: this.#resolveUrl });
  }

  /**
   * The named variants available at one axis coordinate, or `null` when that entry has none.
   *
   * Variants are not an axis, so they need their own way to be discovered. Otherwise the only way to
   * learn an entry has them is to call `select()` without one and read the thrown error, which is no
   * way to build a picker.
   *
   * They are not an axis because a variant switches the Dataset's kind: `.tif` gives a raster in an
   * unknown CRS and `.kmz` a vector in EPSG:4326, where a real axis preserves kind, CRS and bounds.
   * A variant chooses an encoding of the same datum rather than a coordinate in the data. See
   * DECISIONS §1.1.
   *
   * ```js
   * ds.variantsAt(19.5);                       // → ['raster', 'vector']  (or null)
   * ds.select(19.5, { variant: 'raster' });
   * ```
   * @param {number|string} coord
   * @param {{ axis?: number|string, nearest?: boolean }} [opts]
   * @returns {string[]|null}
   */
  variantsAt(coord, opts = {}) {
    const ref = this.selectAxisEntry(coord, opts)?.ref;
    if (!ref || typeof ref !== "object" || isSelectorRef(ref)) return null;
    const names = Object.keys(ref).filter((k) => typeof ref[k] === "string");
    return names.length ? names : null;
  }

  /** The in-file selection this Dataset forces with, or null. @returns {Object|null} */
  get selector() { return this.#selector; }

  /**
   * Resolves an axis by index or name for `select`, `selectRange` and `reduce`, throwing when it
   * does not exist.
   *
   * Asking for an axis that is not there is a programming error, since the code believed this
   * Dataset was a series and it is not. Asking for a coordinate no entry carries is a data
   * condition, and stays `null`. Before this split, the same missing-axis case returned `null` from
   * `select` and threw from `reduce`, so one mistake appeared two ways. The lookup,
   * `selectAxisEntry`, still returns `null` throughout: finding nothing is not a mistake.
   * @param {number|string} axis
   * @returns {{ ax: DatasetAxis, idx: number }}
   */
  #requireAxis(axis) {
    const idx = typeof axis === "number" ? axis : (this.axes?.findIndex((a) => a.name === axis) ?? -1);
    const ax = idx >= 0 ? this.axes?.[idx] : null;
    if (!ax?.entries?.length) {
      throw new Error(`"${this.name}": no selection axis ${JSON.stringify(axis)} — ` + (this.axes?.length
        ? `available: ${this.axes.map((a, i) => `${i}:${a.name ?? "?"}(${a.entries?.length ?? 0})`).join(", ")}`
        : "this Dataset has no axes at all (a plain parsed file has none, and neither has a fully " +
          "selected one). Check `ds.axes` before offering a slider."));
    }
    return { ax, idx };
  }

  /**
   * Narrows one axis to the window `[from, to]`, taking a series and returning a series. That is
   * what separates it from `select()`, which resolves to one payload and returns something
   * forceable. `selectRange` returns another selection-axis Dataset, still lazy and still not
   * forceable on its own, so everything that works on the full series works on the window.
   * `reduce()` most of all: the mean of six hours is `selectRange(a, b).reduce('mean')`, with no new
   * machinery.
   *
   * Both bounds are inclusive and compared with plain `>=` and `<=` against the entry coords, so the
   * type does not matter. Numeric coords such as epoch milliseconds or a stage in feet compare
   * numerically, and ISO-8601 strings compare lexicographically, which for ISO-8601 matches
   * chronological order. Reversed bounds are swapped rather than rejected.
   *
   * There is no nearest match, unlike `select()`. A window already tolerates falling between
   * samples, so a range narrower than the sampling interval matches nothing and returns `null`.
   * Snapping instead would hand back a wider span than was asked for.
   *
   * Coords compare as given, so use `Date.parse(iso)` for the epoch-millisecond axes `parseSciwrid`
   * builds. The engine stays neutral about what a coordinate means.
   *
   * ```js
   * const storm = ds.selectRange(Date.parse('2023-08-29T00:00Z'), Date.parse('2023-08-30T00:00Z'));
   * storm.axis.entries.length;          // just that day's steps
   * await storm.reduce('max').grid();    // peak rainfall WITHIN the window
   * storm.select(coord);                  // and one step out of it, as usual
   * ```
   *
   * @param {number|string} from - inclusive lower bound
   * @param {number|string} to - inclusive upper bound
   * @param {Object} [opts]
   * @param {number|string} [opts.axis=0] - which axis (index or name) to narrow
   * @returns {Dataset|null} a Dataset whose chosen axis holds only the matching entries; `null` when
   *   the axis is missing/empty or nothing falls inside the window
   */
  selectRange(from, to, { axis = 0 } = {}) {
    const { ax, idx } = this.#requireAxis(axis);
    if (ax.ordered === false) {
      throw new Error(`selectRange: axis "${ax.name}" is unordered — its coords are identities, not ` +
        "magnitudes, so there is no \"between\" to select. Use select(coord) per entry.");
    }
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    const entries = ax.entries.filter((e) => e.coord >= lo && e.coord <= hi);
    if (!entries.length) return null;
    // The other axes carry through untouched: narrowing time must not disturb a variable or
    // ensemble axis beside it.
    return new Dataset({
      name: this.name, kind: this.kind, format: this.format, crs: this.crs,
      bounds: this.#bounds, meta: this.#meta,
      data: this.data, url: this.#url, resolveUrl: this.#resolveUrl,
      axes: this.axes.map((a, i) => (i === idx ? { ...a, entries } : a)),
    });
  }

  /**
   * Looks up an entry on one axis by coordinate. Tries an exact match first, then the closest coord
   * when `{ nearest: true }`, the default, and the axis is numeric. `axis` takes an index or a name.
   * @param {number|string} coord
   * @param {Object} [opts]
   * @param {number|string} [opts.axis=0] - which axis (index or name) to look up on
   * @param {boolean} [opts.nearest=true] - fall back to the closest numeric coord on a miss
   * @returns {DatasetAxisEntry|null}
   */
  selectAxisEntry(coord, { axis = 0, nearest = true } = {}) {
    const ax = typeof axis === "number" ? this.axes?.[axis] : this.axes?.find((a) => a.name === axis);
    const entries = ax?.entries;
    if (!entries?.length) return null;
    const exact = entries.find((e) => e.coord === coord);
    if (exact) return exact;
    // Nearest compares magnitudes, so on an unordered axis closest means nothing. Snapping
    // select(1.5) to band 2 would be a confident wrong answer rather than a miss.
    if (!nearest || ax.ordered === false || typeof coord !== "number") return null;
    let best = null, bestD = Infinity;
    for (const e of entries) {
      if (typeof e.coord !== "number") continue;
      const d = Math.abs(e.coord - coord);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  // ---- terminals: async, force the chain, return data rather than a Dataset ----
  //
  // load/grid/features return the decoded value and memoize it. stats/zonalStats/groupBy force the
  // chain and return a Stats or a table, so nothing chains off them. They used to sit among the
  // lazy raster ops, where being async was the only thing marking them apart.

  /**
   * Forces this node. Fetches and decodes the root, or forces the parent and applies this op, then
   * memoizes and returns the RasterGrid or VectorFeatures. A repeat call reuses the memoized result.
   * @returns {Promise<RasterGrid|VectorFeatures>}
   */
  async load() {
    if (this.#materialized) return this.#materialized;
    this.#materialized = this.#inputs ? await this.#applyOp() : await this.#materializeRoot();
    return this.#materialized;
  }

  /** Force + assert raster. @returns {Promise<RasterGrid>} */
  async grid() {
    const m = await this.load();
    if (m.kind !== "raster") throw new Error(`grid(): "${this.name}" is a ${m.kind} dataset, not a raster`);
    return m;
  }

  /** Force + assert vector. @returns {Promise<VectorFeatures>} */
  async features() {
    const m = await this.load();
    if (m.kind !== "vector") throw new Error(`features(): "${this.name}" is a ${m.kind} dataset, not a vector`);
    return m;
  }

  /**
   * Statistics over this Dataset's own values: min, max, mean, median, stddev, sum, count, area and
   * a histogram. A terminal, so it forces the chain and returns a `Stats`, not a Dataset.
   *
   * Rasters read the decoded pixels; vectors read the features, giving counts by geometry type plus
   * total area, length and bbox. `RasterLayer.getStats()` and `VectorLayer.getStats()` return the
   * same thing for a rendered layer, so this is the headless route to it.
   *
   * @param {Object} [opts]
   * @param {import('./filter.js').Filter|Function|Array|null} [opts.filter] - scopes the computation
   * @param {import('./colorScale.js').ColorScale|null} [opts.classify] - buckets values into `byClass`
   * @param {string|null} [opts.classifyBy] - vector only: the property `classify` reads
   * @param {boolean} [opts.skipZero] - raster only: treat 0 as absent
   * @param {number} [opts.bins] - raster only: histogram bin count
   * @returns {Promise<import('./stats.js').Stats>}
   */
  async stats(opts = {}) {
    const value = await this.load();
    if (value.kind === "vector") return Stats.vector(value, opts);
    return Stats.raster(value.pixels, gridMeta(value), opts);
  }

  /**
   * Per-zone min, max, mean, sum, count and area over this raster. Forces the chain and returns
   * one row per zone, so nothing chains off it.
   * @param {Array<{id?: any, polygon?: Array, filter?: import('./filter.js').SpatialFilter}>} zones
   * @param {{ noData?: number }} [opts]
   * @returns {Promise<Array>}
   */
  async zonalStats(zones, opts = {}) {
    this.#assertRasterOp("zonalStats");
    return zonalStats(await this.grid(), zones, opts);
  }

  /**
   * Reduces this raster's pixels grouped by another raster's values. A terminal returning a table
   * rather than a Dataset, and the third kind of reduction here:
   *
   * | verb | collapses | grouped by | returns |
   * |---|---|---|---|
   * | `reduce(op)` | a selection axis | — | a Dataset (one grid) |
   * | `zonalStats(zones)` | space | geometry | a table |
   * | `groupBy(by)` | space | **another raster's values** | a table |
   *
   * This is one variable as a series against another: mean depth per land-use class, rainfall
   * binned by elevation, a rating curve. It is its own verb rather than an overload because the
   * grouping key comes from data, not from the axis model or from geometry.
   *
   * `by` is resampled onto this Dataset's grid, the way `combine` conforms its inputs, and a pixel
   * counts only where both rasters hold a value.
   *
   * ```js
   * await depth.groupBy(landuse);                  // one row per distinct land-use code
   * await rain.groupBy(dem, { bins: 10 });          // ten equal-width elevation bands
   * await rain.groupBy(dem, { bins: [0, 100, 500, 2000] });
   * ```
   * @param {Dataset} by - a raster Dataset whose values define the groups
   * @param {{ bins?: number|number[], method?: string, noData?: number, byNoData?: number }} [opts]
   * @returns {Promise<Array<Object>>}
   */
  async groupBy(by, opts = {}) {
    this.#assertRasterOp("groupBy");
    if (!by || typeof by.grid !== "function") {
      throw new Error("groupBy: `by` must be a raster Dataset whose values define the groups");
    }
    const [mine, theirs] = await Promise.all([this.grid(), by.grid()]);
    return groupByGrid(mine, theirs, opts);
  }

  /**
   * Drop the memoized decode (evictable cache — the slider's stale-load guard calls this).
   *
   * A VALUE ROOT is exempt. `Dataset.fromGrid` builds a root that holds no bytes and no URL: its
   * memoized value is the data, not a cache of it, so `#materializeRoot` has nothing to read a
   * second time. Freeing it would leave a Dataset that can never be forced again, and the failure
   * surfaces far from here — a layer op releases the old sources after a successful swap, and the
   * next `reset()` or re-force of a derived node throws "has no source (no data, no url)".
   * Everything else is safe to drop, because the root can be fetched or decoded again.
   * @returns {void}
   */
  release() {
    if (!this.#inputs && !this.#url && this.data == null) return;   // value root — the cache IS the data
    this.#materialized = null;
  }

  // ---- private force helpers ----

  async #materializeRoot() {
    // A selection-axis series is not forceable, with or without bytes. That used to follow for free,
    // because a series was URL-backed and had no `data`, so the no-source branch below caught it.
    // In-file selectors changed that: a NetCDF series carries the whole file, so this check comes
    // first and stands on `axes` alone. A node with its own `selector` is the exception, being one
    // resolved slice, and forcing it is right.
    //
    // Any axis still present means unresolved. `select()` peels one axis at a time, so a partially
    // selected node carries both a selector and the axes still outstanding. Keying this off a
    // missing selector would let that node through and decode an incomplete selection.
    if (this.axes?.length) {
      throw new Error(`load(): "${this.name}" is a selection-axis series — ` +
        `${this.axes.map((a) => `${a.name || "?"}(${a.entries?.length ?? 0})`).join(", ")} ` +
        "still unresolved. select(coord) each remaining axis, or reduce(op) to collapse one.");
    }
    if (!this.#url && this.data == null) {
      throw new Error(`load(): "${this.name}" has no source (no data, no url)`);
    }
    const mat = getMaterializer(this.format);
    if (!mat) {
      throw new Error(`load(): no materializer registered for format "${this.format}" — ` +
        `import "fimviz/src/io/materializers.js" (or register one) before forcing a Dataset.`);
    }
    // For a url root, apply the carried resolver, the host's CORS proxy or mirror, so the
    // materializer fetches the resolved URL. Resolution stays here and materializers stay simple.
    const url = this.#url && this.#resolveUrl ? this.#resolveUrl(this.#url) : this.#url;
    const root = this.#url ? { kind: "url", url } : { kind: "inline", data: this.data };
    // An in-file selector rides on the root, so a materializer reads the source and which slice to
    // decode from one argument. In the common case the key is absent, so existing materializers are
    // unaffected.
    if (this.#selector) root.select = this.#selector;
    return mat(root, this);
  }

  async #applyOp() {
    // Force each input. A one-input op reads bases[0] and an N-ary op reads them all. Memoized
    // ancestors make swapping only the tail op cheap, since the shared parents do not re-decode.
    const bases = await Promise.all(this.#inputs.map((d) => d.load()));
    const base = bases[0];
    switch (this.#op.op) {
      case "reproject": {
        if (base.kind !== "raster") throw new Error("reproject: not a raster");
        if (base.crs === this.#op.crs) return base;   // parent already there (e.g. equivalent CRS)
        const warp = await resolveReprojector();
        if (!warp) {
          throw new Error(`reproject: no reprojector registered — the app registers the GDAL warp at ` +
            `boot (registerReprojector / registerGdalReprojector). ${base.crs || "unknown"} → ${this.#op.crs}.`);
        }
        // GDAL warps an encoded file rather than a decoded grid. The chain's root bytes, #rootData,
        // are offered only when they represent `base`, meaning this reproject's parent is a plain
        // source or a reproject-only chain. #nonReprojectAncestorOp is checked on the parent, since
        // this node's own op is "reproject" and checking `this` would always report itself.
        //
        // `base`, forced just above, is always passed too. The reprojector falls back to it when the
        // source bytes are not offered, because a real computation such as clip sits in the
        // ancestry, or are not available at all, because a lazy fromURL root holds no local bytes. It
        // then encodes and warps the decoded grid rather than reprojecting a stale file or failing.
        const parent = this.#inputs[0];
        const rootRepresentsBase = !parent.#nonReprojectAncestorOp();
        // The longest operation in the library: the first warp pulls ~38 MB of GDAL wasm and data
        // from a CDN before computing anything. A host showing no indicator through that looks hung,
        // so this is the one op that announces itself.
        notifyBusy(true, "reproject");
        let out;
        try {
          out = await warp(base, this.#op.crs, {
            source: rootRepresentsBase ? this.#rootData() : null,
            grid: base,
            name: this.name,
          });
        } finally {
          notifyBusy(false, "reproject");
        }
        this.#warnings.push(`Reprojected "${this.name}" ${base.crs || "unknown"} → ${this.#op.crs}.`);
        return out;
      }
      case "mask":
        if (base.kind !== "raster") throw new Error("mask: not a raster");
        return maskGrid(base, this.#op.polygon, { invert: this.#op.invert });
      case "clip":
        if (base.kind !== "raster") throw new Error("clip: not a raster");
        return clipGrid(base, this.#op.bbox);
      case "reclassify": {
        if (base.kind !== "raster") throw new Error("reclassify: not a raster");
        const out = reclassifyGrid(base, this.#op.rules, { unmatched: this.#op.unmatched });
        // Counts holes this call created, meaning a previously valid pixel matched no rule and
        // became no-data. Pre-existing noData does not count, since reclassifyGrid never evaluates
        // it against the rules. It usually means the rules do not cover this raster's value range.
        if (out.meta?.unmatchedCount > 0) {
          this.#warnings.push(`Reclassify: ${out.meta.unmatchedCount} pixel(s) on "${this.name}" matched ` +
            "no rule and became no-data — the rules don't fully cover this raster's value range. Pass " +
            "{ unmatched: 'keep' } to keep the original value instead of dropping them.");
        }
        return out;
      }
      case "combine": {
        if (bases.some((b) => b.kind !== "raster")) throw new Error("combine: all inputs must be rasters");
        const out = combineGrids(bases, { op: this.#op.reducer, method: this.#op.method });
        if (bases.length > 1) this.#warnings.push(`combine("${this.#op.reducer}"): ${bases.length - 1} input(s) resampled onto "${this.name}"'s grid.`);
        return out;
      }
      case "resample": {
        if (base.kind !== "raster") throw new Error("resample: not a raster");
        const baseMeta = { width: base.width, height: base.height,
          bw: base.bounds.west, bs: base.bounds.south, be: base.bounds.east, bn: base.bounds.north };
        const tgt = this.#op.targetMeta;
        const noData = this.#op.noData ?? base.noData;
        const pixels = resampleGrid(base.pixels, baseMeta, tgt, { method: this.#op.method, noData });
        this.#warnings.push(`Resampled "${this.name}" (${this.#op.method}) onto a ${tgt.width}x${tgt.height} grid.`);
        return new RasterGrid({
          pixels, width: tgt.width, height: tgt.height,
          bounds: { north: tgt.bn, south: tgt.bs, east: tgt.be, west: tgt.bw },
          crs: base.crs, noData, bands: base.bands, meta: base.meta,
        });
      }
      case "slope":
        if (base.kind !== "raster") throw new Error("slope: not a raster");
        return slopeGrid(base, this.#op.opts);
      case "aspect":
        if (base.kind !== "raster") throw new Error("aspect: not a raster");
        return aspectGrid(base);
      case "hillshade":
        if (base.kind !== "raster") throw new Error("hillshade: not a raster");
        return hillshadeGrid(base, this.#op.opts);
      case "rasterize": {
        if (base.kind !== "vector") throw new Error("rasterize: not a vector");
        return rasterizeFeatures(base.features, this.#op.bounds, {
          width: this.#op.width, height: this.#op.height, field: this.#op.field, burnValue: this.#op.burnValue,
        });
      }
      default:
        throw new Error(`Dataset: unknown op "${this.#op.op}".`);
    }
  }

  // Walks to the chain's root and returns its inline encoded bytes as an ArrayBuffer, or null. The
  // GDAL reprojector warps these. A parseFile root carries them; a lazy fromURL root does not yet.
  #rootData() {
    let n = this;
    while (n.#inputs) n = n.#inputs[0];
    return n.data instanceof ArrayBuffer ? n.data : null;
  }

  // Builds a derived child sharing identity metadata, overriding what the op changes. `inputs`
  // defaults to [this] for a one-input op; an N-ary op passes the full list.
  #derive(op, overrides = {}, inputs = [this]) {
    const child = new Dataset({
      name: this.name,
      kind: "kind" in overrides ? overrides.kind : this.kind,
      format: "format" in overrides ? overrides.format : this.format,
      crs: overrides.crs ?? this.crs,
      bounds: "bounds" in overrides ? overrides.bounds : this.bounds,
      meta: this.meta, axes: this.axes,
    });
    child.#inputs = inputs;
    child.#op = op;
    child.data = null;
    return child;
  }

  // ---- persistence / export ----

  /**
   * A structured-cloneable record for Storage.put(). By default it stores the source and the op
   * recipe, which is small: an inline root still serializes with `data` and round-trips as before, a
   * URL root carries `url`, and a derived node nests its input records under `inputs` beside its
   * `op`. Pass `{ storeMaterialized: true }` to embed the decoded RasterGrid or VectorFeatures too,
   * which requires the node to be materialized already, so call `await ds.load()` first.
   * @param {Object} [opts]
   * @param {boolean} [opts.storeMaterialized=false] - also embed the decoded RasterGrid/VectorFeatures snapshot
   * @returns {Object}
   */
  toRecord(opts = {}) {
    const base = {
      id: this.id, name: this.name, kind: this.kind, format: this.format,
      crs: this.crs, bounds: this.bounds, meta: this.meta, axes: this.axes,
    };
    if (this.#inputs) {                       // derived node: nest the input records + this op
      if (this.#op.op === "reclassify" && typeof this.#op.rules === "function") {
        throw new Error(`toRecord: "${this.name}"'s reclassify uses a callback, which can't survive ` +
          "storage (structured-clone can't carry functions). Use {min,max,value} range rules instead " +
          "for a Dataset chain that needs to persist/reload.");
      }
      base.inputs = this.#inputs.map((d) => d.toRecord());
      base.op = this.#op;
    } else if (this.#url) {                    // url root
      base.url = this.#url;
      base.data = null;
    } else {                                   // inline root — classic shape (with data)
      base.data = this.data;
    }
    // A selector root round-trips as a root plus its in-file selection. Written only when set, so an
    // ordinary record is byte-identical to what it was before selectors existed.
    if (!this.#inputs && this.#selector) base.selector = this.#selector;
    if (opts.storeMaterialized) {
      if (!this.isMaterialized) throw new Error("toRecord({storeMaterialized}): call await ds.load() first");
      base.materialized = { ...this.#materialized };   // plain snapshot; revived by kind in fromRecord
    }
    return base;
  }

  /**
   * Rebuilds a Dataset from a record, recipe or materialized. Structured clone drops prototypes, so
   * a stored record cannot be used directly.
   * @param {Object} record
   * @returns {Dataset|null}
   */
  static fromRecord(record) {
    if (!record) return null;
    let ds;
    if (record.op && record.inputs) {          // derived: rebuild inputs, replay the op
      const inputs = record.inputs.map((r) => Dataset.fromRecord(r));
      // A one-input op such as clip replays off inputs[0], where the N-ary `combine` reads them all.
      // #applyOpDescriptor takes the full input list to cover both.
      ds = inputs[0].#applyOpDescriptor(record.op, inputs);
      ds.id = record.id || ds.id;
      ds.name = record.name ?? ds.name;
      ds.#meta = record.meta ?? ds.#meta;
    } else {                                    // root (inline or url)
      ds = new Dataset(record);
    }
    if (record.materialized) ds.#materialized = Dataset.#reviveMaterialized(record.materialized);
    return ds;
  }

  // Replays a stored op descriptor onto this node, for fromRecord.
  #applyOpDescriptor(op, inputs = [this]) {
    switch (op.op) {
      case "reproject": return this.reproject(op.crs);
      case "select": return this.select(op.coord, op.opts || {});
      case "mask": return this.mask(op.polygon, { invert: op.invert });
      case "clip": return this.clip(op.bbox);
      case "reclassify": return this.reclassify(op.rules, { unmatched: op.unmatched });
      case "combine": return this.combine(inputs.slice(1), { op: op.reducer, method: op.method });
      case "resample": return this.resampleTo(op.targetMeta, { method: op.method, noData: op.noData });
      case "slope": return this.slope(op.opts);
      case "aspect": return this.aspect();
      case "hillshade": return this.hillshade(op.opts);
      case "rasterize": return this.rasterize({ width: op.width, height: op.height, bounds: op.bounds, field: op.field, burnValue: op.burnValue });
      default: throw new Error(`Dataset.fromRecord: unknown op "${op.op}"`);
    }
  }

  static #reviveMaterialized(m) {
    return m?.kind === "raster" ? new RasterGrid(m) : m?.kind === "vector" ? new VectorFeatures(m) : null;
  }

  /**
   * Saves the original bytes to disk. Inline roots only, since a URL root holds no local bytes yet.
   * `document` is ambient, so this adds nothing to the import graph.
   * @returns {void}
   */
  download() {
    const blob = this.data instanceof ArrayBuffer
      ? new Blob([this.data])
      : new Blob([JSON.stringify(this.data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = this.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * The metadata without the heavy `data` payload. Axes are small, holding URLs, so they stay.
   * @returns {Object}
   */
  toJSON() {
    const { id, name, kind, format, crs, bounds, meta, axes } = this;
    return { id, name, kind, format, crs, bounds, meta, axes };
  }
}
