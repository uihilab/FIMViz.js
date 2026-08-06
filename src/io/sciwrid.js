// Multi-dimensional scientific formats (NetCDF4/HDF5 today; GRIB2/NetCDF3/Zarr next), read through
// SciWrid Toolkit. See docs/PACKAGE_ROADMAP.md §8 for the design and the rejected alternatives.
//
// THIS MODULE IS OPT-IN. `io/materializers.js` does NOT import it and does not auto-register these
// formats, because SciWrid pulls a ~193 KB wasm (plus lazily h5wasm/numcodecs/...) that would
// otherwise land in every consumer's initial bundle and undo the §6 payload work. A host that wants
// these formats imports this module and calls `registerSciwridFormats()`; everyone else pays nothing.
// SciWrid itself is reached through a dynamic `import()`, the same deferral GDAL uses in geo/warp.js,
// so even a host that imports this module downloads the wasm only when a Dataset is actually forced.
//
// The division of labour: SciWrid decodes and resamples; FIMViz owns the model. We take its readers
// and NOT its renderers (`gridToImageData`/`RAMPS`/`gridToGeoTIFF` duplicate colorizeGrid/ColorScale,
// and ours are the ones wired into Legend/Stats/LayerSettings).

import { Dataset } from "../package/dataset.js";
import { RasterGrid } from "../package/materialize.js";

/** Formats this adapter can decode. Registered by `registerSciwridFormats()`. @type {string[]} */
export const SCIWRID_FORMATS = ["netcdf4", "netcdf3", "grib2", "zarr"];

/**
 * Formats for which `scan()` NEVER reports a bbox, so an extent must always be supplied.
 *
 * Not a property of any particular file: SciWrid assigns its internal `_geoBbox` only on the
 * netcdf4, zarr and parquet paths, and never on the WASM-backed ones — so a perfectly rectilinear
 * GRIB2 is as extent-less as a polar-stereographic one. Worth naming explicitly, because the
 * alternative reading ("this file must be curvilinear") sends you looking at the wrong thing.
 * @type {Set<string>}
 */
const NO_BBOX_FORMATS = new Set(["grib2", "netcdf3"]);

let _mod = null;
/** Load SciWrid once, lazily. The whole point of the dynamic import — see the header. */
async function sciwrid() {
  if (!_mod) {
    try {
      _mod = await import("sciwrid-toolkit");
    } catch (e) {
      throw new Error("sciwrid: the 'sciwrid-toolkit' package is not installed — it is vendored as " +
        "vendor/sciwrid-toolkit-<version>.tgz and installed by `npm install` (see README). " +
        `Underlying error: ${e.message}`);
    }
  }
  return _mod;
}

const boundsOf = (bbox) =>
  (Array.isArray(bbox) && bbox.length === 4
    ? { west: bbox[0], south: bbox[1], east: bbox[2], north: bbox[3] }
    : null);

/**
 * Why this bbox cannot be WGS84 degrees, or `null` if it is plausible.
 *
 * The guard exists because a wrong extent is worse than a missing one: a missing one throws, a wrong
 * one places every pixel confidently somewhere it isn't. `scan()` derives its bbox from the min/max of
 * whatever 1-D variables are *named* like coordinates — including `x`/`y` and `rlat`/`rlon` — so a
 * PROJECTED file (HRRR/RAP/NAM/WRF, x/y in metres) yields something like
 * `[-2699020, -1588806, 2697980, 1588806]`: four finite numbers, max > min, and utterly not degrees.
 * Range-checking is what turns that from a silently wrong map into the same actionable "supply an
 * extent" error a curvilinear file already gets.
 *
 * Longitudes allow ±360 because both the −180..180 and 0..360 conventions are in wide use.
 *
 * KNOWN GAP: a **rotated-pole** grid (CORDEX/COSMO — `rlat`/`rlon` in rotated degrees) passes this
 * check, because its numbers genuinely are small degree-like values; they simply are not geographic
 * ones. Detecting that needs the variable's `grid_mapping` attribute, which `scan()` does not surface.
 * @param {*} bbox
 * @returns {string|null}
 */
function geographicBboxProblem(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) {
    return "it is not four finite numbers";
  }
  const [w, s, e, n] = bbox;
  if (!(e > w) || !(n > s)) return "max is not greater than min";
  if (Math.abs(s) > 90 || Math.abs(n) > 90) {
    return `its latitudes are out of range (${s}, ${n} — |lat| must be <= 90), which usually means a ` +
      "projected grid whose y axis is in metres, not degrees";
  }
  if (Math.abs(w) > 360 || Math.abs(e) > 360) {
    return `its longitudes are out of range (${w}, ${e} — |lon| must be <= 360), which usually means a ` +
      "projected grid whose x axis is in metres, not degrees";
  }
  return null;
}

/**
 * The variable's NATIVE grid, from `scan()` — the piece that makes SciWrid usable as a materializer
 * at all. `extractGrid` is a *resample*: it makes the caller pre-commit to a bbox and an output
 * width/height, while every Dataset op (clip/mask/combine's LHS-conform) assumes a Dataset has a grid
 * of its own. So we derive the file's own grid once, here, and force through it — a Dataset then
 * behaves like any other raster, and a caller who wants a different resolution overrides `meta.grid`.
 *
 * `shape` is `'120x96x104'` (NetCDF/GRIB) or `[120, 96, 104]` (Zarr), in CF order — the two trailing
 * dimensions are (lat, lon), so height/width are the LAST two regardless of how many lead them.
 */
/**
 * A variable's dimension lengths, in CF order — `'120x96x104'` (NetCDF/GRIB string) or
 * `[120, 96, 104]` (Zarr array), falling back to GRIB2's `nx`/`ny`, which is all it reports.
 * @param {Object} variable
 * @returns {number[]}
 */
function usableDims(variable) {
  const dims = Array.isArray(variable.shape)
    ? variable.shape.map(Number)
    : String(variable.shape || "").split(/[x×,]/).map((n) => Number(n.trim()));
  const usable = dims.filter((n) => Number.isFinite(n) && n > 0);
  // GRIB2 reports no `shape` — a message IS one 2-D field, so scan() gives `nx`/`ny` (+ `messages`
  // for the count) instead. Same (height, width) order as the trailing pair of a CF shape.
  if (usable.length < 2 && Number.isFinite(variable.nx) && Number.isFinite(variable.ny)
      && variable.nx > 0 && variable.ny > 0) {
    return [variable.ny, variable.nx];
  }
  return usable;
}

function nativeGridOf(scanResult, variable, override) {
  const usable = usableDims(variable);
  if (usable.length < 2) {
    throw new Error(`sciwrid: variable "${variable.name}" has no usable 2-D shape ` +
      `(shape=${JSON.stringify(variable.shape)}, nx=${variable.nx}, ny=${variable.ny}) — a griddable ` +
      "variable needs at least (lat, lon).");
  }
  const height = override?.height ?? usable.at(-2);
  const width = override?.width ?? usable.at(-1);
  const bbox = override?.bbox ?? scanResult.bbox;
  const problem = bbox == null ? "none was found" : geographicBboxProblem(bbox);
  if (override?.bbox && problem) {
    throw new Error("sciwrid: opts.grid.bbox must be [minLon, minLat, maxLon, maxLat] in WGS84 " +
      `degrees — ${problem} (got ${JSON.stringify(override.bbox)}).`);
  }
  const bounds = problem ? null : boundsOf(bbox);
  if (!bounds) {
    // We will NOT invent an extent. A guessed bbox (global, say) silently places every pixel in the
    // wrong location, which is the failure mode the CRS precondition exists to prevent — a wrong map
    // is worse than no map. So this throws, but tells the caller everything needed to supply one.
    //
    // The usual cause is a CURVILINEAR grid: scan() derives its bbox only from 1-D coordinate
    // variables, and ocean/rotated-pole products (`tos`, NEMO, CORDEX, tripolar grids) carry 2-D
    // lat(j,i)/lon(j,i) instead, which the scan skips. The pixels are still readable — only the
    // extent is unknown — so passing `grid` makes the file work.
    const cause = bbox == null
      ? (NO_BBOX_FORMATS.has(scanResult.format)
        ? `scan() never derives an extent for ${scanResult.format} at all — SciWrid populates a bbox ` +
          "only on its netcdf4/zarr/parquet paths, so EVERY file of this format needs one supplied, " +
          "whatever its grid geometry"
        : "scan() derived no bbox — it reads 1-D coordinate variables only, so a CURVILINEAR grid " +
          "(2-D lat(j,i)/lon(j,i): ocean `tos` products, NEMO, tripolar and rotated grids) or a Zarr " +
          "store with no CF coordinates leaves nothing to place the data with")
      : `scan() reported ${JSON.stringify(bbox)}, which was REJECTED because ${problem}`;
    throw new Error(
      `sciwrid: "${variable.name}" has no usable geographic extent, so it cannot be placed on a map. ` +
      `${cause}. The pixels are readable — only the extent is unknown — so pass one explicitly:\n` +
      `  parseSciwrid(file, { variable: ${JSON.stringify(variable.name)}, ` +
      `grid: { bbox: [minLon, minLat, maxLon, maxLat] } })   // ${width}x${height} dims stay native\n` +
      `Scan reported: format=${scanResult.format}, shape=${JSON.stringify(variable.shape)}, ` +
      `variables=[${(scanResult.variable_names || []).join(", ")}].`);
  }
  // `bbox` (possibly overridden), never scanResult.bbox — the materializer resamples onto grid.bbox,
  // so shipping the native one here while `bounds` carried the override made the two disagree and the
  // decoded grid silently land on the file's own extent instead of the requested one.
  return { height, width, bbox, bounds };
}

/** The decoded time axis for a variable — hoisted to the file when every variable shares one. */
const timesOf = (scanResult, variable) =>
  (variable?.times ?? scanResult.times)?.values ?? [];

/**
 * The materializer. Reads `root.select` — the in-file selection an axis entry produced — and decodes
 * exactly that slice. `root.select` is absent only when the source has no time axis at all, in which
 * case the Dataset carries its own `selector` from parse time.
 * @param {{kind: 'inline'|'url', data?: ArrayBuffer, url?: string, select?: Object}} root
 * @param {Dataset} ds
 * @returns {Promise<RasterGrid>}
 */
async function materializeSciwrid(root, ds) {
  const select = root.select || ds.selector || {};
  const grid = ds.meta?.grid;
  // Validated BEFORE the dynamic import: a misconfigured Dataset should fail immediately rather than
  // pull a ~193 KB chunk (and a wasm compile) only to throw.
  if (!select.variable) {
    throw new Error(`sciwrid: "${ds.name}" has no variable to decode — build it with parseSciwrid(), ` +
      "which records the variable on each axis entry.");
  }
  if (!grid?.width || !grid?.height || !grid?.bbox) {
    throw new Error(`sciwrid: "${ds.name}" has no target grid on meta.grid ({width, height, bbox}) — ` +
      "extractGrid resamples, so it cannot be called without one. parseSciwrid() derives it from scan().");
  }
  const { extractGrid } = await sciwrid();
  const source = root.kind === "url" ? root.url : new Uint8Array(root.data);
  const opts = {
    variable: select.variable,
    time: select.time ?? 0,
    bbox: grid.bbox, width: grid.width, height: grid.height,
  };
  // extractGrid fans out over Web Workers (SciWrid's default: 5) — the point of it in a browser, and
  // a HANG under Node, where there is no Worker global and the pool never resolves (no error, just an
  // unsettled promise). So force inline off-browser. `meta.workers` overrides either way.
  const workers = ds.meta?.workers ?? (typeof Worker === "undefined" ? 0 : undefined);
  if (workers !== undefined) opts.workers = workers;
  const out = await extractGrid(source, opts);
  // extractGrid is row-major north-up (row 0 = maxLat) with NaN for missing — the same convention
  // RasterGrid uses throughout, so pixels transfer with no re-ordering and no nodata sentinel.
  return new RasterGrid({
    pixels: out.data, width: out.width, height: out.height,
    bounds: boundsOf(out.bbox) || grid.bounds,
    crs: "EPSG:4326",       // extractGrid resamples onto a geographic bbox — already renderable
    noData: null,           // missing is NaN, which colorize/Stats already treat as absent
    meta: {
      unit: out.units ?? null,
      variable: select.variable,
      time: ds.meta?.time ?? out.time ?? null,
    },
  });
}

/**
 * Register the SciWrid-backed decoders. Idempotent; call once at boot before forcing any Dataset of
 * these formats. `parseSciwrid()` calls it for you, so an app that always goes through the parser
 * never needs this — it exists for rehydrating a stored Dataset (`Dataset.fromRecord`), which skips
 * the parser entirely.
 * @param {string[]} [formats=SCIWRID_FORMATS]
 * @returns {void}
 */
export function registerSciwridFormats(formats = SCIWRID_FORMATS) {
  for (const f of formats) Dataset.registerMaterializer(f, materializeSciwrid);
}

/**
 * Read a multi-dimensional scientific file into a `Dataset` with a real temporal axis.
 *
 * Nothing is decoded here — `scan()` reads metadata only, and the returned Dataset is a lazy series.
 * Each axis entry is an **in-file selector** (`ref: { select: { variable, time } }`), so selecting a
 * timestep costs no second fetch: the child shares this Dataset's bytes and decodes one slice on
 * force. Every op, `Stats`, `ColorScale` and `RasterLayer` then work on it unchanged.
 *
 * ```js
 * const ds = await parseSciwrid(file);           // a 120-step NetCDF4 → a time axis
 * const t  = ds.select(Date.parse('2023-08-28T06:00:00Z'));   // → one grid, lazily
 * await fim.addLayer(t);
 * await ds.reduce('mean').grid();                 // temporal mean over the whole axis
 * ```
 *
 * **Axis coordinates are epoch milliseconds**, not ISO strings, so `select()`'s nearest-match works
 * (it is numeric-only) — which is what a time slider needs. The ISO string is kept on each entry's
 * `meta.time`. This deliberately differs from the WaterML/NWIS adapter's string coords, where exact
 * match was acceptable because `latest()` covered the common case.
 *
 * One variable per Dataset: call it once per variable you want. (Folding variable in as a second axis
 * is roadmapped — §8 — but a variable axis cannot be `reduce()`d meaningfully, so it needs a guard
 * this first slice does not yet have.)
 *
 * @param {ArrayBuffer|ArrayBufferView|Blob|File|URL|string} source
 * @param {Object} [opts]
 * @param {string} [opts.variable] - which variable; defaults to the first `supported` one
 * @param {string} [opts.name] - Dataset name; defaults to the filename/URL tail
 * @param {{width?: number, height?: number, bbox?: number[]}} [opts.grid] - PARTIAL override of the
 *   native grid; anything omitted comes from the variable's own shape / `scan().bbox`. Pass `bbox`
 *   alone for a file whose extent scan() could not derive (2-D curvilinear coordinates — ocean
 *   `tos`-style products, rotated poles, Zarr with no CF coords); pass `width`/`height` alone to
 *   decode coarser than native
 * @param {number} [opts.workers] - extractGrid's worker count; defaults to SciWrid's own in a browser
 *   and to `0` (inline) under Node, where the worker pool never resolves
 * @param {boolean} [opts.allowExtraDims=false] - proceed with a variable carrying dimensions beyond
 *   (lat, lon) + time — a vertical level, ensemble member or band. Off by default: the reader collapses
 *   them with no say from the caller, so this is an acknowledgement, not a fix. Recorded on
 *   `meta.extraDims`
 * @param {(url: string) => string} [opts.resolveUrl] - host CORS-proxy/mirror, applied at force time
 * @returns {Promise<Dataset>}
 */
export async function parseSciwrid(source, opts = {}) {
  const sw = await sciwrid();
  registerSciwridFormats();

  const isUrl = typeof source === "string" || source instanceof URL;
  let data = null, url = null;
  if (isUrl) {
    url = String(source);
  } else if (source instanceof ArrayBuffer) {
    data = source;
  } else if (ArrayBuffer.isView(source)) {
    data = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  } else if (typeof source?.arrayBuffer === "function") {   // File | Blob
    data = await source.arrayBuffer();
  } else {
    throw new Error("parseSciwrid: source must be an ArrayBuffer, TypedArray, Blob/File, URL or URL string");
  }

  const scanned = await sw.scan(isUrl ? url : new Uint8Array(data));

  const vars = scanned.variables || [];
  const variable = opts.variable
    ? vars.find((v) => v.name === opts.variable)
    : vars.find((v) => v.supported) || vars[0];
  if (!variable) {
    throw new Error(`parseSciwrid: variable "${opts.variable}" not found in ${scanned.format} — ` +
      `available: ${(scanned.variable_names || []).join(", ") || "(none)"}`);
  }

  // `opts.grid` is a partial override, not a replacement: supply just `bbox` for a file whose extent
  // scan() could not derive (curvilinear coords) and the pixel dims still come from the variable's
  // own shape; supply width/height alone to decode coarser than native.
  const grid = nativeGridOf(scanned, variable, opts.grid);

  const name = opts.name || (isUrl ? url.split("/").pop().split("?")[0] : null) ||
    `${variable.name}.${scanned.format}`;
  const times = timesOf(scanned, variable);

  // A variable with MORE dimensions than (lat, lon) + an optional time is carrying something we do
  // not model — a vertical level, an ensemble member, a spectral band. `T(time, level, lat, lon)` is
  // ordinary in ERA5/GFS/CMIP output, and left alone it fails the worst way available: a normal-looking
  // time scrubber over a level nobody chose. Not a placement error (the lat/lon are right), but still
  // "confidently answering a question that wasn't asked".
  //
  // We cannot resolve it either — extractGrid's options are variable/time/date/bbox/width/height, with
  // no way to pick a level — so this throws rather than pretending. `allowExtraDims` is the
  // acknowledgement: proceed, and let the reader collapse the dimension however it does, with the fact
  // recorded on meta rather than lost.
  const dims = usableDims(variable);
  const modelled = 2 + (times.length ? 1 : 0);
  const extraDims = dims.length - modelled;
  if (extraDims > 0 && !opts.allowExtraDims) {
    throw new Error(
      `sciwrid: "${variable.name}" has ${dims.length} dimensions (${JSON.stringify(variable.shape)}) ` +
      `but only ${modelled} are modelled — (lat, lon)${times.length ? " + time" : ""}. The extra ` +
      `${extraDims} (a vertical level, ensemble member or spectral band) would be collapsed by the ` +
      "reader with no say from you, and no indication of which slice you got.\n" +
      "  parseSciwrid(file, { allowExtraDims: true })   // accept the reader's choice, recorded on meta\n" +
      "A real second axis needs a level/member selector the decoder does not currently expose — see " +
      "docs/PACKAGE_ROADMAP.md §8.");
  }

  // The meta a child inherits: the target grid (what the materializer resamples onto) plus the
  // file-level facts a UI wants without forcing anything.
  const meta = {
    grid, variable: variable.name,
    unit: variable.units ?? null,
    timeRange: scanned.timeRange ?? null,
    sourceFormat: scanned.format,
    ...(opts.workers === undefined ? {} : { workers: opts.workers }),
    // Recorded, not silent: which slice of these the reader picked is its business, but a consumer
    // can at least see that a dimension was collapsed.
    ...(extraDims > 0 ? { extraDims, shape: variable.shape } : {}),
  };

  const base = {
    name, kind: "raster", format: scanned.format, crs: "EPSG:4326",
    bounds: grid.bounds, meta, data, url, resolveUrl: opts.resolveUrl ?? null,
  };

  // No time axis → a plain single-grid Dataset that forces directly, carrying its own selector.
  if (!times.length) {
    return new Dataset({ ...base, selector: { variable: variable.name, time: 0 } });
  }

  return new Dataset({
    ...base,
    axis: {
      name: "time",
      unit: "ms",   // epoch milliseconds — numeric, so select()'s nearest-match applies
      entries: times.map((iso, i) => ({
        coord: Date.parse(iso),
        ref: { select: { variable: variable.name, time: i }, name: `${variable.name} @ ${iso}` },
        meta: { time: iso, index: i },
      })),
    },
  });
}
