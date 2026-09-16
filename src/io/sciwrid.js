// Multi-dimensional scientific formats (netcdf4/netcdf3/grib2/zarr), read through SciWrid Toolkit.
// See docs/PACKAGE_ROADMAP.md §8 for the design and the rejected alternatives.
//
// THIS MODULE IS AN IMPLEMENTATION DETAIL, not an API. Callers reach these formats the same way they
// reach a GeoTIFF — `fim.addDataset(file)` / `FimViz.parseFile(file)` — and `io/parse.js` routes here
// on extension. Nothing user-facing says "sciwrid": the vendor is our choice of reader, not a fact
// about the caller's data, and the thrown errors name the public call instead (see the messages
// below). `parseSciwrid` stays exported for the composition root and tests, exactly like `parseSource`.
//
// STILL NEVER STATICALLY IMPORTED. `io/materializers.js` does not touch it, and parse.js reaches it
// through a dynamic `import()`, because SciWrid pulls a ~193 KB wasm (plus lazily h5wasm/numcodecs/…)
// that would otherwise land in every consumer's initial bundle and undo the §6 payload work. Two
// deferrals stack: parse.js keeps this adapter out of the initial bundle, and the `sciwrid()` import
// below keeps the READER out until a Dataset is actually forced — the same deferral GDAL uses in
// io/reprojector.js. The webpack build additionally marks `sciwrid-toolkit` external, so the wasm never
// enters dist at all.
//
// The division of labour: SciWrid decodes and resamples; FIMViz owns the model. We take its readers
// and NOT its renderers (`gridToImageData`/`RAMPS`/`gridToGeoTIFF` duplicate colorizeGrid/ColorScale,
// and ours are the ones wired into Legend/Stats/LayerSettings).

import { Dataset } from "../package/dataset.js";
import { RasterGrid } from "../package/materialize.js";
// The one place FIMViz reads a container format itself — and only its HEADER, for the extent and
// timestamps SciWrid's NetCDF3 path does not surface. Pure, dependency-free, and self-limiting: it
// declines any bytes that are not NetCDF-3 classic. See io/netcdf3.js's header for the full rationale.
import { describeNetcdf3 } from "./netcdf3.js";
// SciWrid misplaces GRIB2 Lambert conformal grids (template 3.30). io/grib2Lambert.js reads the grid
// definition and places the native array instead.
import { readLambertGrid, lambertBbox, resampleLambert } from "./grib2Lambert.js";

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
      // The one message that must name the reader, because the fix is to make that exact specifier
      // resolve. It is external to our bundle by design (see webpack.config.cjs), so this fires for a
      // browser page with no import map entry as often as for a missing install.
      throw new Error("parseFile: this format needs the 'sciwrid-toolkit' reader, which could not be " +
        "loaded. Under Node/a bundler it is vendored as vendor/sciwrid-toolkit-<version>.tgz and " +
        "installed by `npm install`; in a raw browser page it needs an import map entry pointing at " +
        "node_modules/sciwrid-toolkit/dist/index.js (see examples/04-temporal.html). " +
        `Underlying error: ${e.message}`);
    }
  }
  return _mod;
}

let _wasm = null;
/**
 * A `wasmFactory` that hands every SciWrid call the same wasm instance.
 *
 * SciWrid's `scan()` and `extractGrid()` build a new reader per call, and the reader's `init()`
 * instantiates a new Emscripten module before it reads the format. The browser frees that module's
 * memory only on garbage collection, so forcing a few hundred slices in a row (a time-series loop or
 * axis playback) fails with "Cannot allocate Wasm memory for new instance". A reader's `close()`
 * frees only its own scan, so readers can share one module; SciWrid's GRIB2 range path does the same.
 * @param {Object} sw - the loaded sciwrid-toolkit module
 * @returns {() => Promise<Object>}
 */
function sharedWasm(sw) {
  return () => (_wasm ||= (async () => {
    const holder = new sw.SciWridToolkit();
    await holder.init();
    return holder.wasm;
  })().catch((e) => { _wasm = null; throw e; }));
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

function nativeGridOf(scanResult, variable, override, dimOrder = "yx", header = null) {
  const usable = usableDims(variable);
  if (usable.length < 2) {
    throw new Error(`parseFile: variable "${variable.name}" has no usable 2-D shape ` +
      `(shape=${JSON.stringify(variable.shape)}, nx=${variable.nx}, ny=${variable.ny}) — a griddable ` +
      "variable needs at least (lat, lon).");
  }
  // CF order puts (lat, lon) last, which is what 'yx' means and what almost every file uses. `'xy'`
  // is for the exception — a variable declared (…, lon, lat). This ONLY decides which trailing number
  // is the native height and which the width: `extractGrid` resamples onto whatever we ask for, so
  // getting it backwards does not mislocate data, it just decodes at a transposed resolution.
  const [nativeH, nativeW] = dimOrder === "xy"
    ? [usable.at(-1), usable.at(-2)]
    : [usable.at(-2), usable.at(-1)];
  const height = override?.height ?? nativeH;
  const width = override?.width ?? nativeW;
  // The file's own coordinate variables are the LAST resort, not the first: `scan()` speaks for the
  // formats it covers, and only where it says nothing does reading the header ourselves add anything.
  const bbox = override?.bbox ?? scanResult.bbox ?? header?.bbox ?? null;
  const problem = bbox == null ? "none was found" : geographicBboxProblem(bbox);
  if (override?.bbox && problem) {
    throw new Error("parseFile: the grid.bbox option must be [minLon, minLat, maxLon, maxLat] in " +
      `WGS84 degrees — ${problem} (got ${JSON.stringify(override.bbox)}).`);
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
      `parseFile: "${variable.name}" has no usable geographic extent, so it cannot be placed on a map. ` +
      `${cause}. The pixels are readable — only the extent is unknown — so pass one explicitly:\n` +
      `  addDataset(file, { variable: ${JSON.stringify(variable.name)}, ` +
      `grid: { bbox: [minLon, minLat, maxLon, maxLat] } })   // ${width}x${height} dims stay native\n` +
      `Scan reported: format=${scanResult.format}, shape=${JSON.stringify(variable.shape)}, ` +
      `variables=[${(scanResult.variable_names || []).join(", ")}].`);
  }
  // `bbox` (possibly overridden), never scanResult.bbox — the materializer resamples onto grid.bbox,
  // so shipping the native one here while `bounds` carried the override made the two disagree and the
  // decoded grid silently land on the file's own extent instead of the requested one.
  return { height, width, bbox, bounds };
}

/** The CF-decoded time axis for a variable — hoisted to the file when every variable shares one. */
const timesOf = (scanResult, variable) =>
  (variable?.times ?? scanResult.times)?.values ?? [];

// --- the series axis -------------------------------------------------------------------
//
// WHAT IS AND IS NOT SELECTABLE HERE, because the constraint is not ours and is easy to mistake for
// an oversight. `scan()` reports a variable's `shape` as bare NUMBERS ('24x170x180') with no dimension
// NAMES, and `extractGrid` exposes exactly one index knob, `time`. So the series axis is always the
// file's OUTERMOST non-spatial dimension — the only one the reader can index. A caller can say how
// long it is, what its coordinates mean, and what to call it; a caller cannot point at a different
// dimension, because nothing downstream could act on the answer. See PACKAGE_ROADMAP.md §8.

/** A coordinate as a sortable number: Date/ISO string → epoch ms, anything else → Number. */
function toCoord(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? Number(v) : t;
  }
  return Number(v);
}

const isDateLike = (v) => v instanceof Date || (typeof v === "string" && !Number.isNaN(Date.parse(v)));

/**
 * The series axis to build, or `null` for a single-grid Dataset.
 *
 * Four sources, in priority order:
 *
 * 1. **`series.coords`** — the caller knows, and always wins.
 * 2. **`scan()`'s CF times** — netcdf4/grib2/zarr decode them.
 * 3. **The file's own header** (`io/netcdf3.js`) — NetCDF3 carries a `time` coordinate variable with
 *    CF `units` that SciWrid does not surface. Real timestamps when the calendar is one a JS `Date`
 *    can express; otherwise the RAW offsets in the file's own units, which are still ordered and
 *    meaningful (a 360-day calendar has no Gregorian instants, but "day 45 since 2001-1-1" is exact).
 * 4. **Synthesized integer indices** over the leading dimension. Not a guess about the data: the
 *    dimension is declared in the variable's own shape and `extractGrid` demonstrably indexes it.
 *    Only what each step *means* is unknown — which is what `series.coords` is for.
 *
 * @param {Object} scanResult
 * @param {Object} variable
 * @param {number[]} dims - the variable's declared dimension lengths
 * @param {Object|false} [opt] - `false` disables the axis entirely (single grid)
 * @param {Object|null} [header] - `describeNetcdf3()` output, when the bytes were NetCDF-3
 * @returns {{name: string, unit: string, coords: number[], labels: Array<*>, source: string}|null}
 */
function seriesOf(scanResult, variable, dims, opt, header) {
  if (opt === false) return null;
  const o = opt || {};
  const cfTimes = timesOf(scanResult, variable);
  // A leading dimension exists whenever the variable declares more than (lat, lon).
  const leading = dims.length > 2 ? dims[0] : 0;
  // Only trust the header's axis when it is as long as the dimension being indexed — a mismatch means
  // it describes a different variable, and a mislabelled axis is worse than an unlabelled one.
  const headerTimes = header && (!leading || (header.times ?? header.offsets)?.length === leading)
    ? header
    : null;

  let labels, unit, source;
  if (o.coords != null) {
    const n = o.length ?? (cfTimes.length || headerTimes?.offsets?.length || leading);
    labels = typeof o.coords === "function"
      ? Array.from({ length: n }, (_, i) => o.coords(i, n))
      : o.coords;
    source = "caller";
  } else if (cfTimes.length) {
    labels = cfTimes;
    source = "scan";
  } else if (headerTimes?.times) {
    labels = headerTimes.times;
    source = "header";
  } else if (headerTimes?.offsets) {
    // A non-Gregorian calendar: keep the file's own numbers and say what they mean, rather than
    // pretending they are instants or throwing them away for bare positions.
    labels = headerTimes.offsets;
    unit = headerTimes.timeUnits;
    source = "header";
  } else if (leading > 1) {
    labels = Array.from({ length: o.length ?? leading }, (_, i) => i);
    unit = "index";     // the honest signal that these coordinates are positions, not timestamps
    source = "index";
  } else {
    return null;
  }
  if (o.length != null && labels.length !== o.length) labels = labels.slice(0, o.length);
  if (labels.length < 2) return null;

  // A caller who supplied real dates for an unlabelled file gets a real time axis — same 'ms'
  // coordinates, and therefore the same nearest-match select(), as a NetCDF4 file's.
  return {
    name: o.name ?? "time",
    unit: o.unit ?? unit ?? (labels.some(isDateLike) ? "ms" : "index"),
    coords: labels.map(toCoord),
    labels,
    source,
  };
}

// --- longitude convention --------------------------------------------------------------
//
// A file on 0..360 (ocean/global products, and the `tos` sample in particular) renders badly on a map
// that expects -180..180, and the reverse happens too. THE READER CANNOT DO THIS FOR US: asking
// extractGrid for [-180,…,180] on a 0..360 file returns the file's own data with the requested bbox
// echoed back verbatim — same pixels, new label — which would place the Pacific where the Atlantic
// belongs. So we decode on the file's native convention and roll the decoded grid ourselves. That is
// arithmetic on our own RasterGrid, not a second decoder.

/**
 * How to re-express `bounds` in the requested longitude convention.
 *
 * Returns the new bounds plus the column shift the decoded grid needs. A pure relabel (a regional
 * extent moved by a whole 360°) comes back with `shiftCols: 0` and no pixel work.
 * @param {{west: number, east: number, north: number, south: number}} bounds
 * @param {'native'|'-180..180'|'0..360'} mode
 * @param {number} width
 * @returns {{bounds: Object, shiftCols: number}|null} null when `mode` is 'native' or already satisfied
 */
function lonConvention(bounds, mode, width) {
  if (!mode || mode === "native") return null;
  const span = bounds.east - bounds.west;
  const global = Math.abs(span - 360) < 1e-6;
  const target = mode === "0..360" ? 0 : -180;

  let west;
  if (global) {
    west = target;
  } else {
    // Move the western edge into the target window by WHOLE TURNS only, so the pixels are untouched
    // and nothing but the label changes. (This is why there is no "partial shift" case to handle: the
    // offset is always a multiple of 360 by construction.)
    const lo = target, hi = target + 360;
    west = bounds.west;
    while (west < lo) west += 360;
    while (west >= hi) west -= 360;
    // …but a relabelled regional extent can still fall off the far edge of the window, which is a
    // real extent crossing the antimeridian (or the prime meridian, for '0..360'). `bounds` cannot
    // express east < west, and splitting the grid into two pieces is a different operation from
    // re-labelling one — so this is refused rather than silently wrapped.
    if (west + span > hi + 1e-9) {
      throw new Error(`parseFile: the extent [${bounds.west}, ${bounds.east}] cannot be expressed in ` +
        `${mode} — it is neither global nor a whole 360° turn away from that window, so it crosses ` +
        `the ${mode === "0..360" ? "prime meridian" : "antimeridian"} and the grid would have to be ` +
        "split and re-joined rather than relabelled. Decode it with lon: 'native' and clip to the " +
        "window you want instead.");
    }
  }
  if (Math.abs(west - bounds.west) < 1e-9) return null;   // already in the requested convention

  // For a global grid the shift IS a roll: column j of the output reads column (j + shiftCols) of the
  // native grid, modulo width. For a relabel the shift is a whole turn and this comes out 0.
  const degPerCol = span / width;
  const shiftCols = global
    ? ((Math.round((bounds.west - west) / degPerCol) % width) + width) % width
    : 0;
  return { bounds: { ...bounds, west, east: west + span }, shiftCols };
}

/** Roll a row-major grid horizontally by `shiftCols` columns (wrapping). Pure array work. */
function rollColumns(pixels, width, height, shiftCols) {
  if (!shiftCols) return pixels;
  const out = new pixels.constructor(pixels.length);
  for (let r = 0; r < height; r++) {
    const row = r * width;
    for (let c = 0; c < width; c++) out[row + c] = pixels[row + ((c + shiftCols) % width)];
  }
  return out;
}

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
    throw new Error(`parseFile: "${ds.name}" has no variable to decode — build it with addDataset()/` +
      "parseFile(), which records the variable on each axis entry.");
  }
  if (!grid?.width || !grid?.height || !grid?.bbox) {
    throw new Error(`parseFile: "${ds.name}" has no target grid on meta.grid ({width, height, bbox}) — ` +
      "the reader resamples, so it cannot run without one. addDataset() derives it from the file's scan.");
  }
  const sw = await sciwrid();
  if (ds.meta?.gridTemplate === 30) return materializeLambert(sw, root, ds, select, grid);
  const source = root.kind === "url" ? root.url : new Uint8Array(root.data);
  const opts = {
    variable: select.variable,
    time: select.time ?? 0,
    bbox: grid.bbox, width: grid.width, height: grid.height,
    wasmFactory: sharedWasm(sw),
  };
  // extractGrid fans out over Web Workers (SciWrid's default: 5) — the point of it in a browser, and
  // a HANG under Node, where there is no Worker global and the pool never resolves (no error, just an
  // unsettled promise). So force inline off-browser. `meta.workers` overrides either way.
  const workers = ds.meta?.workers ?? (typeof Worker === "undefined" ? 0 : undefined);
  if (workers !== undefined) opts.workers = workers;
  const out = await sw.extractGrid(source, opts);
  // The longitude re-expression, applied HERE rather than by asking the reader for a shifted bbox —
  // that request comes back as the same pixels wearing a different label (see lonConvention above).
  // `meta.lon` carries the {bounds, shiftCols} computed once at parse time, so every timestep of a
  // series rolls identically and the cost is one array copy per decoded slice.
  const lon = ds.meta?.lon;
  const pixels = lon?.shiftCols
    ? rollColumns(out.data, out.width, out.height, lon.shiftCols)
    : out.data;
  // extractGrid is row-major north-up (row 0 = maxLat) with NaN for missing — the same convention
  // RasterGrid uses throughout, so pixels transfer with no re-ordering and no nodata sentinel.
  return new RasterGrid({
    pixels, width: out.width, height: out.height,
    bounds: lon?.bounds || boundsOf(out.bbox) || grid.bounds,
    crs: "EPSG:4326",       // extractGrid resamples onto a geographic bbox — already renderable
    noData: null,           // missing is NaN, which colorize/Stats already treat as absent
    meta: {
      // extractGrid returns "" for units it does not surface, so fall back to the parse-time unit.
      unit: out.units || ds.meta?.unit || null,
      variable: select.variable,
      time: ds.meta?.time ?? out.time ?? null,
    },
  });
}

/**
 * Forces one slice of a GRIB2 field on a Lambert conformal grid.
 *
 * SciWrid's extractGrid would place these pixels by interpolating between the grid corners, which
 * moves cells between them by several degrees. This reads SciWrid's native array and hands it to
 * resampleLambert, which projects each output pixel with the grid definition from section 3.
 * @param {Object} sw - the loaded sciwrid-toolkit module
 * @param {{kind: 'inline'|'url', data?: ArrayBuffer, url?: string}} root
 * @param {Dataset} ds
 * @param {{variable: string, time?: number}} select
 * @param {{bbox: number[], width: number, height: number}} grid
 * @returns {Promise<RasterGrid>}
 */
async function materializeLambert(sw, root, ds, select, grid) {
  let bytes;
  if (root.kind === "url") {
    const res = await fetch(root.url);
    if (!res.ok) throw new Error(`parseFile: fetch failed (${res.status}) for ${root.url}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    bytes = new Uint8Array(root.data);
  }
  // parseSciwrid records the grid for inline bytes. A URL source is read here, from the fetched bytes.
  const lambert = ds.meta.lambert ?? readLambertGrid(bytes);
  if (!lambert) {
    throw new Error(`parseFile: "${ds.name}" was scanned as grid template 3.30, but no message carries one.`);
  }
  const reader = new sw.SciWridToolkit({ wasmFactory: sharedWasm(sw) });
  try {
    await reader.read(bytes);
    const variable = reader.vars.find((v) => v.name === select.variable);
    if (!variable) throw new Error(`parseFile: variable "${select.variable}" not found in "${ds.name}"`);
    // `_extractArrays` is SciWrid's internal native-array read, present in the vendored 0.1.0.
    if (typeof reader._extractArrays !== "function") {
      throw new Error("parseFile: the installed GRIB2 reader has no native-array read, which Lambert " +
        "conformal grids need.");
    }
    const native = await reader._extractArrays(variable, select.time ?? 0);
    if (native.nx !== lambert.nx || native.ny !== lambert.ny) {
      throw new Error(`parseFile: "${ds.name}" decoded to ${native.nx} x ${native.ny}, but its GRIB2 ` +
        `section 3 declares ${lambert.nx} x ${lambert.ny}.`);
    }
    // resampleLambert indexes the array in the file's scanning order. SciWrid keeps that order, and
    // its first row and column carry the first grid point, La1 and Lo1. Check both before trusting it.
    const lonGap = Math.abs((((native.lons[0] - lambert.lo1) % 360) + 540) % 360 - 180);
    if (Math.abs(native.lats[0] - lambert.la1) > 1e-3 || lonGap > 1e-3) {
      throw new Error(`parseFile: the decoded array for "${ds.name}" does not start at the first grid point ` +
        `(${lambert.la1}, ${lambert.lo1}), so the Lambert resample cannot index it.`);
    }
    const resampled = resampleLambert(native.sliceData, lambert, grid);
    const lon = ds.meta?.lon;
    const pixels = lon?.shiftCols ? rollColumns(resampled, grid.width, grid.height, lon.shiftCols) : resampled;
    return new RasterGrid({
      pixels, width: grid.width, height: grid.height,
      bounds: lon?.bounds || boundsOf(grid.bbox),
      crs: "EPSG:4326",
      noData: null,
      meta: { unit: native.units || ds.meta?.unit || null, variable: select.variable, time: ds.meta?.time ?? null },
    });
  } finally {
    try { reader.close(); } catch { /* the slice is already copied out */ }
  }
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
 * Read a multi-dimensional scientific file into a `Dataset` with a real temporal axis. This is the
 * implementation behind `FimViz.parseFile`/`fim.addDataset` for `.nc`/`.grib2`/`.zarr` — **use those**;
 * this export exists for the composition root and tests, exactly like `parseSource`. Every option
 * documented below is passed straight through from them.
 *
 * Nothing is decoded here — `scan()` reads metadata only, and the returned Dataset is a lazy series.
 * Each axis entry is an **in-file selector** (`ref: { select: { variable, time } }`), so selecting a
 * timestep costs no second fetch: the child shares this Dataset's bytes and decodes one slice on
 * force. Every op, `Stats`, `ColorScale` and `RasterLayer` then work on it unchanged.
 *
 * ```js
 * const ds = await fim.addDataset(file);         // a 120-step NetCDF4 → a time axis
 * const t  = ds.select(Date.parse('2023-08-28T06:00:00Z'));   // → one grid, lazily
 * await fim.addLayer(t);
 * await ds.reduce('mean').grid();                 // temporal mean over the whole axis
 * ```
 *
 * **Axis coordinates are numbers**, not ISO strings, so `select()`'s nearest-match works (it is
 * numeric-only) — which is what a time slider needs. Epoch milliseconds (`axis.unit === 'ms'`) when the
 * file carries CF times or the caller supplies dates; plain **positions** (`'index'`) when the file
 * declares a leading dimension but no labels for it, which is the NetCDF3 case. The original label is
 * kept on each entry's `meta.time`. This deliberately differs from the WaterML/NWIS adapter's string
 * coords, where exact match was acceptable because `latest()` covered the common case.
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
 * @param {false|{coords?: Array<number|string|Date>|Function, length?: number, name?: string,
 *   unit?: string}} [opts.series] - the series (time) axis. Omit for the default: the file's CF times
 *   when it has them, otherwise integer indices over its leading dimension. `false` forces a single
 *   grid. `coords` is an array of one coordinate per step, or a generator `(i, n) => coord`; ISO
 *   strings and `Date`s become epoch ms, so an unlabelled file gains a REAL time axis —
 *   `{ series: { coords: i => new Date(Date.UTC(2001, i, 1)) } }`. `length` caps the step count
 *   (default: the leading dimension), `name` defaults to `'time'`, and `unit` defaults to `'ms'` for
 *   dates or `'index'` for synthesized positions
 * @param {{order?: 'yx'|'xy'}} [opts.dims] - which trailing pair of the shape is (lat, lon). `'yx'`
 *   (CF order, the default) or `'xy'` for a variable declared (…, lon, lat). Decides native
 *   height/width only — `extractGrid` resamples onto whatever is requested
 * @param {'native'|'-180..180'|'0..360'} [opts.lon='native'] - re-express the extent in a longitude
 *   convention. A global grid is genuinely **rolled** (the reader cannot do this — asking it for a
 *   shifted bbox returns the same pixels relabelled); a regional extent a whole turn away is
 *   relabelled with no pixel work; anything else throws rather than splitting the grid
 * @param {number} [opts.workers] - extractGrid's worker count; defaults to SciWrid's own in a browser
 *   and to `0` (inline) under Node, where the worker pool never resolves
 * @param {boolean} [opts.allowExtraDims=false] - proceed with a variable carrying dimensions beyond
 *   (lat, lon) + the series axis — a vertical level, ensemble member or band. Off by default: the
 *   reader collapses them with no say from the caller, so this is an acknowledgement, not a fix.
 *   Recorded on `meta.extraDims`
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
    throw new Error("parseFile: source must be an ArrayBuffer, TypedArray, Blob/File, URL or URL string");
  }

  // scan() fetches too, so it must go through the host's URL resolver (CORS proxy/mirror/auth) the
  // same way `parseSource`'s fetch does. The Dataset below keeps the ORIGINAL url plus the resolver,
  // because dataset.js applies it again at force time — resolving here as well would double-wrap it.
  const scanUrl = isUrl && typeof opts.resolveUrl === "function" ? opts.resolveUrl(url) : url;
  const scanned = await sw.scan(isUrl ? scanUrl : new Uint8Array(data), { wasmFactory: sharedWasm(sw) });

  const vars = scanned.variables || [];
  const variable = opts.variable
    ? vars.find((v) => v.name === opts.variable)
    : vars.find((v) => v.supported) || vars[0];
  if (!variable) {
    throw new Error(`parseFile: variable "${opts.variable}" not found in ${scanned.format} — ` +
      `available: ${(scanned.variable_names || []).join(", ") || "(none)"}`);
  }

  // `opts.grid` is a partial override, not a replacement: supply just `bbox` for a file whose extent
  // scan() could not derive (curvilinear coords) and the pixel dims still come from the variable's
  // own shape; supply width/height alone to decode coarser than native.
  // What the file's own header knows and `scan()` does not. Inline bytes only: a URL source is
  // deliberately never fetched here — the whole point of the URL path is that nothing is downloaded
  // until a slice is forced, and a coordinate variable can sit anywhere in the file, so there is no
  // useful range request to make. `header: false` opts out entirely.
  const header = (opts.header === false || !data) ? null : describeNetcdf3(data);

  // A Lambert conformal GRIB2 grid carries its definition in each message's section 3. From inline
  // bytes it is read now, and it gives the extent scan() never reports for GRIB2.
  const lambert = scanned.format === "grib2" && variable.grid_template === 30 && data
    ? readLambertGrid(new Uint8Array(data))
    : null;
  const gridOption = lambert && !opts.grid?.bbox ? { ...opts.grid, bbox: lambertBbox(lambert) } : opts.grid;
  const grid = nativeGridOf(scanned, variable, gridOption, opts.dims?.order, header);

  const name = opts.name || (isUrl ? url.split("/").pop().split("?")[0] : null) ||
    `${variable.name}.${scanned.format}`;

  const dims = usableDims(variable);
  const series = seriesOf(scanned, variable, dims, opts.series, header);

  // The NetCDF4 decoder selects a step through the file's CF time coordinate. Without one it decodes
  // step 0 for any index it is given, so a series over such a file would show its first step at every
  // position. `series.coords` cannot help, because the labels are not what the decoder indexes.
  if (series && scanned.format === "netcdf4" && timesOf(scanned, variable).length === 0) {
    throw new Error(
      `parseFile: "${variable.name}" has ${dims[0]} steps along its leading dimension, but the file has ` +
      "no CF time coordinate (a variable with `units` like \"days since 2015-01-01\"), and a NetCDF4 " +
      "step can only be selected through one. Every step would decode as the first. Either add a CF " +
      "time coordinate to the file, or read the first step alone on purpose:\n" +
      "  addDataset(file, { series: false, allowExtraDims: true })");
  }

  // Re-express the extent in the requested longitude convention. Computed once here so that every
  // timestep of a series rolls identically; the materializer applies it to each decoded grid.
  const lon = lonConvention(grid.bounds, opts.lon, grid.width);

  // A variable with MORE dimensions than (lat, lon) + the series axis is carrying something we do not
  // model — a vertical level, an ensemble member, a spectral band. `T(time, level, lat, lon)` is
  // ordinary in ERA5/GFS/CMIP output, and left alone it fails the worst way available: a normal-looking
  // scrubber over a level nobody chose. Not a placement error (the lat/lon are right), but still
  // "confidently answering a question that wasn't asked".
  //
  // We cannot resolve it either — extractGrid's options are variable/time/date/bbox/width/height, with
  // no way to pick a level — so this throws rather than pretending. `allowExtraDims` is the
  // acknowledgement: proceed, and let the reader collapse the dimension however it does, with the fact
  // recorded on meta rather than lost.
  //
  // The arithmetic is on the DECLARED shape, never on what the reader admits to. That is what made it
  // catch NetCDF3's invisible time dimension; now that such a dimension becomes a synthesized index
  // axis, `modelled` counts it, and a 3-D NetCDF3 variable is fully modelled rather than needing an
  // acknowledgement. A 4-D one still trips, which is correct — the second extra dimension is still
  // unreachable.
  const modelled = 2 + (series ? 1 : 0);
  const extraDims = dims.length - modelled;
  if (extraDims > 0 && !opts.allowExtraDims) {
    throw new Error(
      `parseFile: "${variable.name}" has ${dims.length} dimensions (${JSON.stringify(variable.shape)}) ` +
      `but only ${modelled} are modelled — (lat, lon)${series ? ` + ${series.name}` : ""}. The extra ` +
      `${extraDims} (a vertical level, ensemble member or spectral band) would be collapsed by the ` +
      "reader with no say from you, and no indication of which slice you got.\n" +
      "  addDataset(file, { allowExtraDims: true })   // accept the reader's choice, recorded on meta\n" +
      "A real second axis needs a level/member selector the decoder does not currently expose — see " +
      "docs/PACKAGE_ROADMAP.md §8.");
  }

  // The meta a child inherits: the target grid (what the materializer resamples onto) plus the
  // file-level facts a UI wants without forcing anything.
  const meta = {
    grid, variable: variable.name,
    // zarr and netcdf4 scans report the CF `units` attribute under `attrs`, not as `units`.
    unit: variable.units ?? variable.attrs?.units ?? null,
    timeRange: scanned.timeRange ?? null,
    sourceFormat: scanned.format,
    // The materializer routes grid template 30 through materializeLambert.
    ...(variable.grid_template == null ? {} : { gridTemplate: variable.grid_template }),
    ...(lambert ? { lambert } : {}),
    ...(opts.workers === undefined ? {} : { workers: opts.workers }),
    ...(lon ? { lon } : {}),
    // Recorded, not silent: which slice of these the reader picked is its business, but a consumer
    // can at least see that a dimension was collapsed.
    ...(extraDims > 0 ? { extraDims, shape: variable.shape } : {}),
    // Equally not silent: where the axis came from. A UI formatting a slider needs to distinguish
    // timestamps the file declared ('scan'/'header') from bare positions we counted ('index'), and a
    // caller reading `unit` alone cannot tell which.
    ...(series ? { axisSource: series.source } : {}),
    ...(series?.source === "index" ? { synthesizedAxis: true } : {}),
  };

  const base = {
    name, kind: "raster", format: scanned.format, crs: "EPSG:4326",
    bounds: lon?.bounds ?? grid.bounds, meta, data, url, resolveUrl: opts.resolveUrl ?? null,
  };

  // No series at all (a genuinely 2-D variable, or `series: false`) → a plain single-grid Dataset
  // that forces directly, carrying its own selector.
  if (!series) {
    return new Dataset({ ...base, selector: { variable: variable.name, time: 0 } });
  }

  return new Dataset({
    ...base,
    axis: {
      name: series.name,
      unit: series.unit,   // 'ms' or 'index' — numeric either way, so select()'s nearest-match applies
      entries: series.coords.map((coord, i) => ({
        coord,
        ref: { select: { variable: variable.name, time: i },
          name: `${variable.name} @ ${series.labels[i]}` },
        meta: { time: series.labels[i], index: i },
      })),
    },
  });
}
