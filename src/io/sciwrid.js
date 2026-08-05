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
 * The variable's NATIVE grid, from `scan()` — the piece that makes SciWrid usable as a materializer
 * at all. `extractGrid` is a *resample*: it makes the caller pre-commit to a bbox and an output
 * width/height, while every Dataset op (clip/mask/combine's LHS-conform) assumes a Dataset has a grid
 * of its own. So we derive the file's own grid once, here, and force through it — a Dataset then
 * behaves like any other raster, and a caller who wants a different resolution overrides `meta.grid`.
 *
 * `shape` is `'120x96x104'` (NetCDF/GRIB) or `[120, 96, 104]` (Zarr), in CF order — the two trailing
 * dimensions are (lat, lon), so height/width are the LAST two regardless of how many lead them.
 */
function nativeGridOf(scanResult, variable, override) {
  const dims = Array.isArray(variable.shape)
    ? variable.shape.map(Number)
    : String(variable.shape || "").split(/[x×,]/).map((n) => Number(n.trim()));
  let usable = dims.filter((n) => Number.isFinite(n) && n > 0);
  // GRIB2 reports no `shape` — a message IS one 2-D field, so scan() gives `nx`/`ny` (+ `messages`
  // for the count) instead. Same (height, width) order as the trailing pair of a CF shape.
  if (usable.length < 2 && Number.isFinite(variable.nx) && Number.isFinite(variable.ny)
      && variable.nx > 0 && variable.ny > 0) {
    usable = [variable.ny, variable.nx];
  }
  if (usable.length < 2) {
    throw new Error(`sciwrid: variable "${variable.name}" has no usable 2-D shape ` +
      `(shape=${JSON.stringify(variable.shape)}, nx=${variable.nx}, ny=${variable.ny}) — a griddable ` +
      "variable needs at least (lat, lon).");
  }
  const height = override?.height ?? usable.at(-2);
  const width = override?.width ?? usable.at(-1);
  const bbox = override?.bbox ?? scanResult.bbox;
  if (override?.bbox && !(Array.isArray(bbox) && bbox.length === 4 && bbox.every(Number.isFinite)
      && bbox[2] > bbox[0] && bbox[3] > bbox[1])) {
    throw new Error("sciwrid: opts.grid.bbox must be [minLon, minLat, maxLon, maxLat] with max > min " +
      `(got ${JSON.stringify(override.bbox)}).`);
  }
  const bounds = boundsOf(bbox);
  if (!bounds) {
    // We will NOT invent an extent. A guessed bbox (global, say) silently places every pixel in the
    // wrong location, which is the failure mode the CRS precondition exists to prevent — a wrong map
    // is worse than no map. So this throws, but tells the caller everything needed to supply one.
    //
    // The usual cause is a CURVILINEAR grid: scan() derives its bbox only from 1-D coordinate
    // variables, and ocean/rotated-pole products (`tos`, NEMO, CORDEX, tripolar grids) carry 2-D
    // lat(j,i)/lon(j,i) instead, which the scan skips. The pixels are still readable — only the
    // extent is unknown — so passing `grid` makes the file work.
    throw new Error(
      `sciwrid: "${variable.name}" has no geographic bbox in scan(), so its extent is unknown and it ` +
      "cannot be placed on a map. Pass one explicitly:\n" +
      `  parseSciwrid(file, { variable: ${JSON.stringify(variable.name)}, ` +
      `grid: { width: ${width}, height: ${height}, bbox: [minLon, minLat, maxLon, maxLat] } })\n` +
      "Common causes: a curvilinear/rotated grid (2-D lat(j,i)/lon(j,i) coordinates, e.g. ocean `tos` " +
      "files) or a Zarr store with no CF coordinates — scan() reads 1-D coordinate variables only. " +
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

  // The meta a child inherits: the target grid (what the materializer resamples onto) plus the
  // file-level facts a UI wants without forcing anything.
  const meta = {
    grid, variable: variable.name,
    unit: variable.units ?? null,
    timeRange: scanned.timeRange ?? null,
    sourceFormat: scanned.format,
    ...(opts.workers === undefined ? {} : { workers: opts.workers }),
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
