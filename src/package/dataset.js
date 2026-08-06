// dataset.js — a LAZY, IMMUTABLE parsed source (raster or vector) in its NATIVE CRS + metadata.
//
// See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 — it records why Dataset became a lazy op-chain
// (reversing the older "Dataset is a pure eager value; reproject lives in geo/" stance) and why each
// decision was made.
//
// A Dataset is one node in an op-chain:
//   • a ROOT wraps a source — inlined bytes/GeoJSON (the classic `data` payload), or a URI (fromURL);
//   • a DERIVED node is a parent + one op (reproject/select/…).
// Nothing is fetched, decoded or warped until a TERMINAL forces it: `load()`/`grid()`/`features()`, or
// a Layer rendering it. Ops return NEW lazy Datasets and never mutate — so one Dataset backs many
// Layers without any of them corrupting the others. `kind ∈ {raster, vector}`; the two decoded
// representations are RasterGrid / VectorFeatures (package/materialize.js).
//
// HEADLESS, STILL. `reproject` is now a method, but this file imports NO GDAL and no geotiff: building
// a reproject node is pure, and forcing it dispatches through the registered reprojector
// (package/materialize.js). Decoding dispatches through registered materializers. So `new Dataset()`
// is still constructible and node-testable without the toolchain — the property protected by keeping
// the heavy decoders in io/materializers.js, outside this import graph. (Dependencies flow
// geo/ + io/ → package/, never back.)
//
// SELECTION AXES (`axes`, optional) — unchanged: a Dataset whose payloads are ADDRESSED rather than
// inlined carries generic, format-neutral selection axes (e.g. a URL-backed stage series). `select()`
// resolves one entry into a child URL-rooted Dataset. See the axes docs below.

import {
  RasterGrid, VectorFeatures,
  getMaterializer, resolveReprojector,
  registerMaterializer, materializerFormats,
  registerReprojector, registerDefaultReprojectorLoader,
} from "./materialize.js";
import {
  maskGrid, clipGrid, reclassifyGrid, combineGrids, zonalStats,
  slopeGrid, aspectGrid, hillshadeGrid, rasterizeFeatures,
} from "./rasterOps.js";
// resampleGrid is pure JS / headless (geo/resample.js has zero imports of its own) — same status as
// rasterOps.js, which already imports it for combine()'s LHS-conform resampling. registerResampler
// (the escape hatch for GDAL-only methods) and resampleGrid itself are also barrel-exported directly
// (lib.js), so a caller can use either the Dataset op below or the raw function on pixel arrays.
import { resampleGrid, registerResampler } from "../geo/resample.js";

// A resample target is either resample.js's native meta shape already, or anything grid-shaped
// (a RasterGrid, or another Dataset's already-forced .grid() result) — normalized the same way
// rasterOps.js's internal gridMeta() does, so resampleTo() accepts what a caller actually has on hand.
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

// Infer a parse/decode format from a URL or filename extension (for fromURL / select).
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

// Is this axis-entry `ref` an in-file selector rather than a URL / named URL variants? Discriminated
// on an OBJECT-valued `select` key: named variants are string-valued throughout, so a variant literally
// named "select" (holding a URL string) is still read as a variant, not mistaken for a selector.
const isSelectorRef = (ref) =>
  !!ref && typeof ref === "object" && !!ref.select && typeof ref.select === "object";

/**
 * One entry on a selection axis. `ref` says how to GET this entry's payload, and has three forms —
 * the axis model is agnostic about which, so `select()`/`reduce()` work the same over all of them:
 *
 * - `'stage_12.tif'` — a **URL** (relative to `select`'s `base`). One file per entry: the FIM Scenario
 *   shape, where each timestep/stage is its own downloadable raster.
 * - `{ raster: 'a.tif', vector: 'a.geojson' }` — **named URL variants**; `select({ variant })` picks one.
 * - `{ select: { variable: 'TMP', date: '…' } }` — an **in-file selector**. The entry is not a separate
 *   file: it is a slice of the SAME source this Dataset already points at (a NetCDF/GRIB2/Zarr file
 *   holding every timestep). The child shares the parent's bytes/URL and carries the selector through
 *   to the materializer as `root.select`. Optional siblings `name`/`crs`/`bounds` override what the
 *   child would otherwise inherit from its parent.
 *
 * The third form is what lets one multi-dimensional file back a whole temporal axis. Without it an
 * axis entry must be separately fetchable, which is true of FIM Scenario and false of every
 * scientific multi-dim format.
 *
 * @typedef {Object} DatasetAxisEntry
 * @property {number|string} coord
 * @property {string|Object<string,string>|{select: Object, name?: string, crs?: string, bounds?: DatasetBounds}} ref
 * @property {Object} [meta]
 */
/**
 * @typedef {Object} DatasetAxis
 * @property {string} name
 * @property {string|null} [unit]
 * @property {DatasetAxisEntry[]} entries
 */
/**
 * @typedef {Object} DatasetBounds
 * @property {number} north @property {number} south @property {number} east @property {number} west
 */

export class Dataset {
  // ---- lazy-graph state (private; never enumerated, excluded from toRecord unless storeMaterialized) ----
  #url = null;          // root only: a URI source (fromURL). Mutually exclusive with inline `data`.
  #resolveUrl = null;   // url root only: an optional (url)=>string resolver (host CORS-proxy/mirror),
                        //   applied at force time. Instance-supplied, never serialized (a function).
  #selector = null;     // root only: an IN-FILE selection (e.g. { variable, date }), handed to the
                        //   materializer as `root.select`. What lets one multi-dimensional source back
                        //   a whole axis without one file per entry — see select()'s selector refs.
  #inputs = null;       // derived only: the INPUT Datasets (array — unary ops are length-1, N-ary ops
                        //   like combine/difference hold several). null on a root.
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
   *   (normally produced by `select()` off a selector ref, not passed by hand)
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
   * A URI-rooted Dataset. It fetches + decodes into a RasterGrid/VectorFeatures on FORCE — nothing
   * happens now. Format/kind are inferred from the URL when not given. This is what folds the decoded
   * Grid/Features back into Dataset: a URL Dataset IS the materialized value, lazily.
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
   * A Dataset around an ALREADY-DECODED grid (or VectorFeatures) — the way back into the op chain
   * for something you decoded yourself, computed with the standalone grid functions, or built by
   * hand. The result is pre-materialized: no decode, no fetch, no materializer needed, and
   * `load()`/`grid()` return the value handed in.
   *
   * This is what makes "ops live on Dataset" a complete story rather than a one-way door: `ds.grid()`
   * hands you a grid, and this hands it back so `clip`/`mask`/`slope`/… stay reachable.
   *
   * @param {import('./materialize.js').RasterGrid|import('./materialize.js').VectorFeatures} value
   * @param {Object} [opts] - { name?, format?, meta? }; `kind`/`crs`/`bounds` come from the value
   * @returns {Dataset}
   */
  // ---- the decode/warp seams, as statics on the type they serve ----------------------------
  //
  // These are Dataset's registries: what `load()`/`grid()` dispatch through. They live here rather
  // than as loose barrel functions because the owner was never ambiguous — a materializer decodes
  // FOR a Dataset, a reprojector warps ONE. Same functions as `package/materialize.js` exports;
  // this is where a consumer meets them.

  /**
   * Register the decoder for a `format` (e.g. 'geotiff', 'nc').
   * @param {string} format
   * @param {(root: Object, ds: Dataset) => Promise<RasterGrid|VectorFeatures>} fn
   * @returns {void}
   */
  static registerMaterializer(format, fn) { return registerMaterializer(format, fn); }

  /**
   * Every format that can be decoded right now — built-ins plus anything registered. Build a file
   * picker's `accept` list from it, or check an upload before parsing.
   * @returns {string[]}
   */
  static formats() { return materializerFormats(); }

  /**
   * Supply the ONE warp implementation `reproject()` forces through.
   * @param {(grid: RasterGrid, toCrs: string) => Promise<RasterGrid>} fn
   * @returns {void}
   */
  static registerReprojector(fn) { return registerReprojector(fn); }

  /**
   * A JIT fallback invoked at most once, on the first force that finds no reprojector registered —
   * how the GDAL warp auto-loads with no setup call.
   * @param {() => Promise<void>} fn
   * @returns {void}
   */
  static registerDefaultReprojectorLoader(fn) { return registerDefaultReprojectorLoader(fn); }

  /**
   * Supply a resampler for the methods the pure-JS path doesn't implement (cubic/lanczos/…), which
   * `resampleTo({ method })` otherwise throws on. Synchronous and pixel-level — GDAL's own richer
   * methods go through the warp seam instead (see geo/resample.js).
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
      // No source FORMAT: there are no encoded bytes here to decode, which is the whole point. A
      // format would be a claim about bytes that do not exist.
      format: opts.format ?? null,
      crs: value.crs ?? null,
      bounds: value.bounds ?? null,
      meta: opts.meta ?? value.meta ?? {},
    });
    ds.#materialized = value;   // already forced: terminals return this without touching a seam
    return ds;
  }

  /**
   * The footprint, in `crs`. Constructor-known for a root (or an op whose result is knowable upfront,
   * e.g. `clip`), `null` when it genuinely isn't (e.g. a fresh `reproject()` node — the real bounds
   * depend on what the warp actually produces). Once this node is FORCED, reads the real value off the
   * memoized result instead — so `ds.reproject(crs).grid().then(() => ds2.bounds)` (`ds2` being the
   * reprojected node) reflects the true post-warp footprint rather than staying stuck at the
   * construction-time placeholder.
   * @returns {DatasetBounds|null}
   */
  get bounds() { return this.#materialized?.bounds ?? this.#bounds; }

  /**
   * Free-form metadata (GDAL legend/unit/noData, …). Same self-updating rule as `bounds`: once forced,
   * reads off the memoized result — which matters for raster ops like `reproject` whose reprojector
   * refreshes dimension fields (`width`/`height`) that the pre-force value can't know.
   * @returns {Object}
   */
  get meta() { return this.#materialized?.meta ?? this.#meta; }

  /** The primary (first) selection axis, or null. @returns {DatasetAxis|null} */
  get axis() { return this.axes?.[0] ?? null; }

  /** Warnings collected when this node was forced (implicit reprojection, defaults, …). @returns {string[]} */
  get warnings() { return this.#warnings; }

  /** Has this node been forced (decoded/warped) yet? @returns {boolean} */
  get isMaterialized() { return this.#materialized != null; }

  // ---- OPS: sync to build, return a NEW lazy Dataset, never mutate ----

  /**
   * Reproject to `toCrs` as a LAZY op. Returns a new Dataset; the warp runs only on force, dispatched
   * through the registered reprojector (this file imports no GDAL). An exact same-CRS request is a
   * no-op that returns `this`. Rasters only (vectors are EPSG:4326 by spec).
   * @param {string} toCrs
   * @returns {Dataset}
   */
  reproject(toCrs) {
    if (!toCrs) throw new Error("reproject: a target CRS is required (e.g. 'EPSG:4326')");
    // Validate the shape AND normalize case here, at the point of the mistake — rather than storing
    // whatever string was passed and letting a case/format slip surface many frames later as a
    // confusing "cannot render CRS" from a provider check that never learns this is the SAME CRS.
    const m = /^epsg:(\d+)$/i.exec(String(toCrs).trim());
    if (!m) {
      throw new Error(`reproject: "${toCrs}" is not a recognized CRS — expected the form "EPSG:<code>" ` +
        "(e.g. 'EPSG:4326').");
    }
    const crs = `EPSG:${m[1]}`;
    if (this.crs === crs) return this;
    if (this.kind && this.kind !== "raster") {
      throw new Error(`reproject: vector reprojection is not implemented ("${this.name}"); ` +
        "geojson/kml/kmz/shp are EPSG:4326 by spec.");
    }
    return this.#derive({ op: "reproject", crs }, { crs, bounds: null });
  }

  // The first non-"reproject" op name found walking this node's ancestry back to its root, or null if
  // the whole lineage (if any) is nothing but reproject nodes. Forcing a reproject warps the CHAIN'S
  // ROOT bytes when it can (#rootData) — correct for a plain source, or a reproject-only lineage
  // (re-warping straight to the final CRS beats double-warping through an intermediate one). Anything
  // ELSE in the ancestry — combine/clip/mask/reclassify/resample/rasterize/… — means the root's bytes
  // no longer represent what this node currently IS, so #applyOp's reproject case uses this to decide:
  // reuse the root bytes (cheap), or encode+warp the actually-computed grid instead (geo/gdal.js
  // warpGrid, via the reprojector's ctx.grid) — never silently discard the computation.
  #nonReprojectAncestorOp() {
    let n = this;
    while (n.#inputs) {
      if (n.#op?.op !== "reproject") return n.#op?.op ?? "unknown";
      n = n.#inputs[0];
    }
    return null;
  }

  // ---- transformation ops (raster analysis) — lazy, pure-JS on the decoded grid (PACKAGE_ROADMAP §2) ----

  /**
   * Mask by a polygon: pixels outside the polygon become transparent (NaN) on force — or inside, with
   * `{ invert }`. Footprint unchanged. Lazy: builds a node; the transform runs at terminal.
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
   * Clip (crop) to a bbox — the footprint shrinks to the overlap, snapped to pixel edges. Lazy.
   * @param {{north:number,south:number,east:number,west:number}} bbox
   * @returns {Dataset}
   */
  clip(bbox) {
    this.#assertRasterOp("clip");
    if (!bbox || bbox.north == null) throw new Error("clip: a bbox { north, south, east, west } is required");
    return this.#derive({ op: "clip", bbox }, { bounds: bbox });
  }

  /**
   * Reclassify pixel values by `rules` (see rasterOps.reclassifyGrid) — EITHER a range-rules array
   * (`[{min?,max?,value?}]`, first-match-wins; a rule with no `value` is a "keep matched pixel's
   * value" band) OR a single callback `(value, index) => number|null|undefined` called once per
   * valid pixel with its raw value and flat row-major index (`row*width+col`), returning the new
   * value directly — not limited to a contiguous range, and skips rule-matching entirely (one call
   * per pixel instead of a per-rule scan), so it's both the more general and the cheaper form once
   * you need more than a couple of simple ranges. Either form: returning `null`/`undefined` (or no
   * rule matching) → unmatched → transparent (default) or kept. Lazy.
   *
   * ⚠️ A callback does NOT survive `toRecord()` (structured-clone can't carry functions) — forcing it
   * (`.grid()`) works fine in-session, but `toRecord()` on this node (or a descendant of it) throws
   * naming the op, rather than silently dropping it. Use range rules for a chain you need to
   * persist/reload from Storage.
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
   * Band math: combine this raster with `others` per pixel (LHS-conform — the others are resampled onto
   * THIS grid). `op`: difference/ratio (binary) or sum/mean/min/max (N-ary). Lazy N-ary op node.
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
  difference(other) { return this.combine([other], { op: "difference" }); }

  /**
   * Resample onto a specific target grid — lazy: the resample runs on force, via geo/resample.js's
   * resampleGrid (also directly barrel-exported as `resampleGrid`/`alignRasters`, so a caller can use
   * either this Dataset-shaped convenience or the raw function on pixel arrays). `target` is either a
   * resample-native meta object `{ width, height, bw, bs, be, bn }`, or anything grid-shaped —
   * `{ width, height, bounds: {north,south,east,west} }` — e.g. another (already-forced) Dataset's
   * `.grid()` result. `method` defaults to `'nearest'` (pure-JS, always available); the GDAL-only
   * methods (cubic/lanczos/mode/min/max/med/q1/q3) need a resampler registered via
   * `registerResampler` (the escape hatch) or forcing throws a clear error. The result adopts the
   * target's footprint/resolution; `crs` is unchanged (this resamples, it does not reproject).
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
   * Zonal statistics — per-zone min/max/mean/sum/count/area over this raster. A TERMINAL (forces the
   * grid); returns data, not a Dataset. @param {Array<{id?, polygon?, filter?}>} zones
   * @param {{ noData?: number }} [opts] @returns {Promise<Array>}
   */
  async zonalStats(zones, opts = {}) {
    this.#assertRasterOp("zonalStats");
    return zonalStats(await this.grid(), zones, opts);
  }

  /**
   * Slope — per-pixel terrain steepness via Horn's method, computed in pure JS on the decoded grid (no
   * GDAL — see rasterOps.slopeGrid; PACKAGE_ROADMAP §2 "terrain"). Lazy.
   * @param {{ zFactor?: number, cellsizeX?: number, cellsizeY?: number, unit?: 'degrees'|'percent' }} [opts]
   * @returns {Dataset}
   */
  slope(opts = {}) {
    this.#assertRasterOp("slope");
    return this.#derive({ op: "slope", opts });
  }

  /**
   * Aspect — the downslope compass bearing via Horn's method (rasterOps.aspectGrid). Lazy.
   * @returns {Dataset}
   */
  aspect() {
    this.#assertRasterOp("aspect");
    return this.#derive({ op: "aspect" });
  }

  /**
   * Hillshade — a shaded-relief illumination raster via Horn's method (rasterOps.hillshadeGrid). Lazy.
   * @param {{ altitude?: number, azimuth?: number, zFactor?: number, cellsizeX?: number, cellsizeY?: number }} [opts]
   * @returns {Dataset}
   */
  hillshade(opts = {}) {
    this.#assertRasterOp("hillshade");
    return this.#derive({ op: "hillshade", opts });
  }

  /**
   * Rasterize this vector Dataset onto a new grid (vector→raster, the kind-changing op —
   * PACKAGE_ROADMAP §2 "vectorize/rasterize"). `field` burns each feature's property value; omit for a
   * constant `burnValue`. Bounds default to this Dataset's own footprint; `width`/`height` are required
   * (a vector carries no inherent pixel resolution). Lazy.
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
   * Reduce this Dataset's selection axis to ONE grid — collapse a temporal/vertical stack (e.g. a
   * stage/time series) via a per-pixel reducer. Sugar over select()+combine(): resolves every axis
   * entry to a child Dataset, then LHS-conforms/reduces them exactly like combine() (PACKAGE_ROADMAP §2
   * "3-D / aggregation", the payoff of the axes model). Lazy.
   * @param {'sum'|'mean'|'min'|'max'} [op]
   * @param {{ axis?: number|string, method?: string, variant?: string }} [opts]
   * @returns {Dataset}
   */
  reduce(op = "mean", { axis = 0, method = "nearest", variant } = {}) {
    if (!["sum", "mean", "min", "max"].includes(op)) {
      throw new Error(`reduce: op must be one of sum/mean/min/max (got "${op}")`);
    }
    const ax = typeof axis === "number" ? this.axes?.[axis] : this.axes?.find((a) => a.name === axis);
    const entries = ax?.entries;
    if (!entries?.length) throw new Error("reduce: no selection-axis entries to reduce (no axis, or the named axis is empty)");
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
   * Resolve one selection-axis entry into a child Dataset (lazy). Sugar over selectAxisEntry: it picks
   * the entry, resolves its `ref`, and carries the entry's opaque `meta`. Returns null when no entry
   * matches. Kind-neutral: which variant (raster vs vector) is the caller's call.
   *
   * The `ref` decides what kind of child comes back (see {@link DatasetAxisEntry}):
   * - a **URL** (bare, or a named variant picked via `opts.variant`) → a URL-rooted child, format
   *   inferred from the URL. One file per entry.
   * - an **in-file selector** (`{ select: {…} }`) → a child rooted on the SAME source as this Dataset
   *   (its bytes or URL, plus resolver), carrying the selector for the materializer. One file, many
   *   entries — a NetCDF/GRIB2/Zarr time axis.
   *
   * Either way the child has no `axes` of its own: it is one payload, not a series, so it forces
   * through `load()`/`grid()` like any other Dataset and every op chains off it normally.
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
    const entry = this.selectAxisEntry(coord, opts);
    if (!entry) return null;
    let ref = entry.ref;

    // In-file selector: this entry is a SLICE of the source we already hold, not a separate download.
    // Checked before the variant branch because both are objects — a selector is discriminated by an
    // object-valued `select` key, while named variants are string-valued throughout.
    if (isSelectorRef(ref)) {
      if (!this.#url && this.data == null) {
        throw new Error(`select: "${this.name}"'s axis entry ${JSON.stringify(entry.coord)} is an ` +
          "in-file selector, but this Dataset has no source to select from (no data, no url).");
      }
      return new Dataset({
        name: ref.name || `${this.name}[${entry.coord}]`,
        kind: this.kind, format: this.format,
        crs: ref.crs ?? this.crs,
        bounds: ref.bounds ?? this.#bounds,
        meta: { ...(this.#meta || {}), ...(entry.meta || {}) },
        data: this.data, url: this.#url, resolveUrl: this.#resolveUrl,
        selector: ref.select,
      });
    }

    if (ref && typeof ref === "object") {
      if (!opts.variant) throw new Error(`select: entry ref has named variants (${Object.keys(ref).join(", ")}); pass { variant }`);
      ref = ref[opts.variant];
    }
    if (!ref) return null;
    const url = (opts.base || "") + ref;
    // A child axis entry inherits this Dataset's URL resolver, so a resolved (proxied) series stays
    // resolved across select() — instance-safe, since the resolver is carried, not read ambiently.
    return Dataset.fromURL(url, { name: String(ref).split("/").pop(), meta: entry.meta || {},
      resolveUrl: this.#resolveUrl });
  }

  /** The in-file selection this Dataset forces with, or null. @returns {Object|null} */
  get selector() { return this.#selector; }

  /**
   * Narrow one axis to the window `[from, to]` — a **series in, series out** operation, which is what
   * separates it from `select()`. `select(coord)` resolves to ONE payload and hands back something
   * forceable; `selectRange` hands back another selection-axis Dataset, still lazy, still unforceable
   * on its own. That is the point: everything that works on the full series works on the window,
   * `reduce()` most of all — "the mean of these six hours" is `selectRange(a, b).reduce('mean')`,
   * with no new machinery on either side.
   *
   * Both bounds are **inclusive**, and the comparison is a plain `>=`/`<=` on the entry coords, so it
   * is type-agnostic: numeric coords (epoch milliseconds, a stage in feet) compare numerically, and
   * ISO-8601 strings compare lexicographically, which for ISO-8601 is the same as chronologically.
   * Reversed bounds are swapped rather than rejected. Unlike `select()` there is no nearest-match: a
   * window is already tolerant of falling between samples, so a range narrower than the sampling
   * interval matches nothing and returns `null` — which is honest, where snapping would silently hand
   * back a wider span than asked for.
   *
   * Coords are compared as given — `Date.parse(iso)` for the epoch-millisecond axes `parseSciwrid`
   * builds. The engine stays domain-neutral about what a coordinate means.
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
    const idx = typeof axis === "number" ? axis : this.axes?.findIndex((a) => a.name === axis);
    const ax = idx >= 0 ? this.axes?.[idx] : null;
    if (!ax?.entries?.length) return null;
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    const entries = ax.entries.filter((e) => e.coord >= lo && e.coord <= hi);
    if (!entries.length) return null;
    // Every OTHER axis is carried through untouched — narrowing time must not disturb a variable or
    // ensemble axis sitting beside it.
    return new Dataset({
      name: this.name, kind: this.kind, format: this.format, crs: this.crs,
      bounds: this.#bounds, meta: this.#meta,
      data: this.data, url: this.#url, resolveUrl: this.#resolveUrl,
      axes: this.axes.map((a, i) => (i === idx ? { ...a, entries } : a)),
    });
  }

  /**
   * Look up an entry on one axis by coordinate. Exact match first; with { nearest: true } (default) and
   * a NUMERIC axis, falls back to the closest coord. `axis` selects which axis (index or name).
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
    if (!nearest || typeof coord !== "number") return null;
    let best = null, bestD = Infinity;
    for (const e of entries) {
      if (typeof e.coord !== "number") continue;
      const d = Math.abs(e.coord - coord);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  // ---- TERMINALS: async, force the chain, memoize ----

  /**
   * Force this node: decode/fetch the root (or force the parent and apply this op), memoize, return the
   * decoded RasterGrid | VectorFeatures. Repeated calls reuse the memoized result.
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

  /** Drop the memoized decode (evictable cache — the slider's stale-load guard calls this). @returns {void} */
  release() { this.#materialized = null; }

  // ---- private force helpers ----

  async #materializeRoot() {
    // A selection-axis series is not forceable, whether or not it holds bytes. That distinction used
    // to be free — a series was URL-backed and had no `data`, so the no-source branch below caught it.
    // In-file selectors changed that: a NetCDF/GRIB2/Zarr series carries the whole file, so the
    // series check has to come first and stand on `axes` alone. A node with its own `selector` is the
    // exception — it is one resolved slice, and forcing it is exactly right.
    if (this.axes?.length && !this.#selector) {
      throw new Error(`load(): "${this.name}" is a selection-axis series (${this.axes.length} ` +
        `axis/axes, ${this.axes[0]?.entries?.length ?? 0} entries on the first) — select(coord) an ` +
        "entry first, or reduce(op) to collapse the axis.");
    }
    if (!this.#url && this.data == null) {
      throw new Error(`load(): "${this.name}" has no source (no data, no url)`);
    }
    const mat = getMaterializer(this.format);
    if (!mat) {
      throw new Error(`load(): no materializer registered for format "${this.format}" — ` +
        `import "fimviz/src/io/materializers.js" (or register one) before forcing a Dataset.`);
    }
    // For a url root, apply the carried resolver (host CORS-proxy/mirror) so the materializer fetches
    // the resolved URL — keeps the resolution here (instance-supplied) and materializers dumb.
    const url = this.#url && this.#resolveUrl ? this.#resolveUrl(this.#url) : this.#url;
    const root = this.#url ? { kind: "url", url } : { kind: "inline", data: this.data };
    // An in-file selector rides on the root, so a materializer reads the source and which slice of it
    // to decode from ONE argument. Absent (the common case) the key is simply not there, so every
    // existing materializer is unaffected.
    if (this.#selector) root.select = this.#selector;
    return mat(root, this);
  }

  async #applyOp() {
    // Force every input (unary ops read bases[0]; N-ary ops read them all). Memoized ancestors make a
    // "hot-modify" that only swaps the tail op cheap — the shared parents don't re-decode.
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
        // GDAL warps an ENCODED file, not a decoded grid. The chain's root bytes (#rootData) are only
        // OFFERED when they're representative of `base` — this reproject's immediate parent is itself
        // a plain source or a reproject-only chain (#nonReprojectAncestorOp, checked on the PARENT —
        // this node's own op is "reproject", so checking `this` would always report itself). `base`
        // (just forced, above) is ALWAYS passed too, as the fallback the reprojector uses when source
        // bytes aren't offered (a real computation sits in the ancestry — combine/clip/…) or aren't
        // available at all (a lazy fromURL root with no local bytes) — encoding+warping the actually-
        // decoded grid directly rather than either reprojecting a stale file or failing outright.
        const parent = this.#inputs[0];
        const rootRepresentsBase = !parent.#nonReprojectAncestorOp();
        const out = await warp(base, this.#op.crs, {
          source: rootRepresentsBase ? this.#rootData() : null,
          grid: base,
          name: this.name,
        });
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
        // A hole this call actually created (a previously-VALID pixel matched no rule and became
        // no-data) — not pre-existing noData, which reclassifyGrid never even evaluates against the
        // rules. Usually means the rules' ranges don't fully cover this raster's real value range.
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

  // Walk to the chain's root and return its inline encoded bytes (an ArrayBuffer), or null. The GDAL
  // reprojector warps these; parseFile roots carry them, lazy fromURL roots do not (yet).
  #rootData() {
    let n = this;
    while (n.#inputs) n = n.#inputs[0];
    return n.data instanceof ArrayBuffer ? n.data : null;
  }

  // Build a derived child sharing identity metadata, overriding what the op changes. `inputs` defaults
  // to [this] (a unary op); an N-ary op passes the full input list.
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
   * A structured-cloneable record for Storage.put(). Default: the SOURCE + op recipe (small) — a root
   * inline Dataset still serializes with `data` and round-trips exactly as before (back-compat); a URL
   * root carries `url`; a derived node nests its INPUT records under `inputs` with its `op`. Pass
   * { storeMaterialized: true } to also embed the decoded RasterGrid/VectorFeatures (the node must be
   * materialized already — call `await ds.load()` first).
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
    // A selector root round-trips as a root + its in-file selection. Only present when set, so an
    // ordinary record is byte-identical to what it was before selectors existed.
    if (!this.#inputs && this.#selector) base.selector = this.#selector;
    if (opts.storeMaterialized) {
      if (!this.isMaterialized) throw new Error("toRecord({storeMaterialized}): call await ds.load() first");
      base.materialized = { ...this.#materialized };   // plain snapshot; revived by kind in fromRecord
    }
    return base;
  }

  /**
   * Rehydrate a record (recipe or materialized). Structured clone drops prototypes, so this is required.
   * @param {Object} record
   * @returns {Dataset|null}
   */
  static fromRecord(record) {
    if (!record) return null;
    let ds;
    if (record.op && record.inputs) {          // derived: rebuild inputs, replay the op
      const inputs = record.inputs.map((r) => Dataset.fromRecord(r));
      // Unary ops (reproject/select/mask/clip/reclassify) replay off inputs[0]; the N-ary `combine`
      // reads all inputs. #applyOpDescriptor takes the full input list for that case.
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

  // Replay a stored op descriptor onto this node (fromRecord).
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
   * Save the original bytes/content to disk. Inline roots only (a URL root has no local bytes yet).
   * `document` is ambient, so this costs nothing in the import graph.
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
   * Metadata view (without the heavy `data` payload). Axes are lightweight (URLs), so they stay.
   * @returns {Object}
   */
  toJSON() {
    const { id, name, kind, format, crs, bounds, meta, axes } = this;
    return { id, name, kind, format, crs, bounds, meta, axes };
  }
}
