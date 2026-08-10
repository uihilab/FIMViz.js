// netcdf3.js — a standalone reader for the NetCDF-3 HEADER, and for the small 1-D coordinate
// variables a header points at. Nothing else in FIMViz reads a container format directly; this is the
// deliberate exception, and it is worth being explicit about why.
//
// WHY THIS EXISTS. `io/sciwrid.js`'s reader decodes NetCDF3 pixels correctly but reports **no extent
// and no timestamps** for the format — not because the files lack them, but because SciWrid populates
// those only on its netcdf4/zarr/parquet paths. So every NetCDF3 file demanded a hand-supplied
// `grid.bbox`, and its time axis arrived as bare integer positions, when the file itself carries
// `lon`/`lat`/`time` coordinate variables with CF `units` right there in the header. This module reads
// exactly those, and nothing more.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not decode data variables — no pixels, no slicing, no
// second decoder. `readValues` handles 1-D numeric variables only, which is what a coordinate axis is;
// point it at a 3-D field and it refuses. The division of labour is unchanged: SciWrid decodes,
// FIMViz models, and this fills in metadata SciWrid does not surface.
//
// SCOPE. NetCDF-3 **classic** (`CDF\x01`) and **64-bit offset** (`CDF\x02`). NetCDF-4 is an HDF5
// container and is not attempted — `readNetcdf3Header` returns null on a magic it does not recognise,
// which makes the whole module self-limiting: it either understands the bytes completely or declines.
// The format is small, frozen, and fully specified (Unidata's "NetCDF Classic Format Specification"),
// which is what makes this a bounded job rather than the start of a parser collection.
//
// Everything is big-endian and padded to 4-byte boundaries.

const NC_DIMENSION = 0x0A, NC_VARIABLE = 0x0B, NC_ATTRIBUTE = 0x0C;

// type tag → [name, bytes]. NC_CHAR is decoded as text; the rest are numeric.
const TYPES = {
  1: ["byte", 1], 2: ["char", 1], 3: ["short", 2],
  4: ["int", 4], 5: ["float", 4], 6: ["double", 8],
};

const pad4 = (n) => (n + 3) & ~3;

/** A cursor over a DataView, in the one byte order the format uses. */
class Reader {
  constructor(view) { this.v = view; this.p = 0; }
  i32() { const x = this.v.getInt32(this.p); this.p += 4; return x; }
  i64() { const x = Number(this.v.getBigInt64(this.p)); this.p += 8; return x; }
  text(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.v.getUint8(this.p + i));
    this.p += pad4(n);
    return s;
  }
  name() { return this.text(this.i32()); }
  /** One value of `type` at absolute offset `at` — used for both attributes and coordinate data. */
  static value(view, type, at) {
    switch (type) {
      case 1: return view.getInt8(at);
      case 3: return view.getInt16(at);
      case 4: return view.getInt32(at);
      case 5: return view.getFloat32(at);
      case 6: return view.getFloat64(at);
      default: return view.getUint8(at);
    }
  }
}

function readAttrs(r) {
  const tag = r.i32(), n = r.i32();
  const out = {};
  if (tag !== NC_ATTRIBUTE) return out;      // ABSENT is (0, 0)
  for (let i = 0; i < n; i++) {
    const name = r.name(), type = r.i32(), nvals = r.i32();
    const [tname, size] = TYPES[type] || ["byte", 1];
    if (tname === "char") {
      // Trailing NULs are conventional in CF attribute strings and are not part of the value.
      out[name] = r.text(nvals).replace(/\0+$/, "");
    } else {
      const vals = [];
      for (let k = 0; k < nvals; k++) vals.push(Reader.value(r.v, type, r.p + k * size));
      r.p += pad4(nvals * size);
      out[name] = vals.length === 1 ? vals[0] : vals;
    }
  }
  return out;
}

/**
 * Parse a NetCDF-3 header.
 *
 * @param {ArrayBuffer|ArrayBufferView} source
 * @returns {{version: number, numrecs: number, recSize: number, attrs: Object,
 *   dims: Array<{name: string, size: number, unlimited: boolean}>,
 *   variables: Array<{name: string, dims: string[], shape: number[], type: number, typeName: string,
 *     begin: number, vsize: number, record: boolean, attrs: Object}>,
 *   view: DataView}|null} null when the bytes are not NetCDF-3 (a NetCDF-4/HDF5 file, say)
 */
export function readNetcdf3Header(source) {
  const buf = source instanceof ArrayBuffer ? source : source.buffer;
  const off = source instanceof ArrayBuffer ? 0 : source.byteOffset;
  const len = source instanceof ArrayBuffer ? source.byteLength : source.byteLength;
  if (len < 8) return null;
  const view = new DataView(buf, off, len);
  if (view.getUint8(0) !== 0x43 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x46) return null;  // 'CDF'
  const version = view.getUint8(3);
  if (version !== 1 && version !== 2) return null;   // 5 is CDF-5 (64-bit data); not attempted

  const r = new Reader(view);
  r.p = 4;
  const numrecs = r.i32();          // 0xFFFFFFFF means "streaming"; treated as 0 below
  const offset = version === 2 ? () => r.i64() : () => r.i32();

  // --- dimensions
  let tag = r.i32(), n = r.i32();
  const dims = [];
  if (tag === NC_DIMENSION) {
    for (let i = 0; i < n; i++) {
      const name = r.name(), size = r.i32();
      dims.push({ name, size, unlimited: size === 0 });
    }
  }
  const attrs = readAttrs(r);       // global attributes

  // --- variables
  tag = r.i32(); n = r.i32();
  const variables = [];
  if (tag === NC_VARIABLE) {
    for (let i = 0; i < n; i++) {
      const name = r.name(), nd = r.i32(), ids = [];
      for (let d = 0; d < nd; d++) ids.push(r.i32());
      const vattrs = readAttrs(r);
      const type = r.i32(), vsize = r.i32(), begin = offset();
      const record = ids.some((id) => dims[id]?.unlimited);
      variables.push({
        name, type, typeName: (TYPES[type] || [])[0] ?? "byte", vsize, begin, record,
        dims: ids.map((id) => dims[id]?.name),
        // An unlimited dimension is declared as 0; its real length is `numrecs`.
        shape: ids.map((id) => (dims[id]?.unlimited ? numrecs : dims[id]?.size)),
        attrs: vattrs,
      });
    }
  }

  // Record variables are INTERLEAVED, not contiguous: record r of variable v sits at
  // `v.begin + r * recSize`, where recSize is the total per-record footprint of every record
  // variable. Summing the file's own declared `vsize` sidesteps the spec's padding special-case
  // (a lone byte/char/short record variable is not padded) — the file already told us the answer.
  const recSize = variables.filter((v) => v.record).reduce((s, v) => s + v.vsize, 0);

  return { version, numrecs: numrecs === 0xFFFFFFFF ? 0 : numrecs, recSize, dims, attrs, variables, view };
}

/**
 * The values of a 1-D NUMERIC variable — a coordinate axis. Refuses anything else: this module reads
 * coordinates, not data (see the header).
 * @param {Object} header - from `readNetcdf3Header`
 * @param {Object} variable - one entry of `header.variables`
 * @returns {number[]|null}
 */
export function readValues(header, variable) {
  if (!variable || variable.dims.length !== 1) return null;
  if (variable.typeName === "char") return null;
  const [, size] = TYPES[variable.type] || [];
  if (!size) return null;
  const n = variable.shape[0];
  if (!Number.isFinite(n) || n <= 0) return null;

  const out = [];
  for (let i = 0; i < n; i++) {
    // Contiguous for a fixed variable; one stride of recSize per record for a record variable.
    const at = variable.record ? variable.begin + i * header.recSize : variable.begin + i * size;
    if (at + size > header.view.byteLength) return null;      // truncated file — report nothing
    out.push(Reader.value(header.view, variable.type, at));
  }
  // CF packing, applied when declared. Rare on a coordinate axis, cheap to honour, wrong to ignore.
  const scale = variable.attrs.scale_factor, add = variable.attrs.add_offset;
  if (typeof scale === "number" || typeof add === "number") {
    return out.map((v) => v * (scale ?? 1) + (add ?? 0));
  }
  return out;
}

// --- CF interpretation -----------------------------------------------------------------

const LON_UNITS = /^degrees?_?(east|e)$/i;
const LAT_UNITS = /^degrees?_?(north|n)$/i;

/** A variable is a COORDINATE variable when it is 1-D and named for its own dimension (CF §5). */
const isCoordVar = (v) => v.dims.length === 1 && v.dims[0] === v.name;

function findAxis(header, unitsRe, names) {
  const vars = header.variables.filter(isCoordVar);
  // Units first — that is what CF actually defines the axis by, and it catches files whose
  // coordinate is named something local. Names are the fallback for files that omit units.
  return vars.find((v) => unitsRe.test(String(v.attrs.units || "")))
    ?? vars.find((v) => names.includes(v.name.toLowerCase()))
    ?? null;
}

/**
 * Cell EDGES for a coordinate axis, not centres — an extent has to cover the cells, and using centres
 * loses half a cell at each end (a whole 2° on a coarse global grid).
 *
 * Prefers an explicit CF `bounds` variable when the file has one, since that is exact and handles
 * irregular spacing. Otherwise extends by half the local spacing at each end, which is exact for the
 * regular grids this applies to and close for anything else.
 */
function edgesOf(header, axisVar) {
  const centres = readValues(header, axisVar);
  if (!centres || centres.length === 0) return null;

  const boundsName = axisVar.attrs.bounds;
  if (boundsName) {
    const bv = header.variables.find((v) => v.name === boundsName);
    // A bounds variable is (axis, 2) — 2-D, so readValues declines it; read it flat instead. Only the
    // extremes are wanted, and those are its min and max whatever the vertex order.
    if (bv && bv.dims.length === 2 && !bv.record) {
      const [, size] = TYPES[bv.type] || [];
      const n = (bv.shape[0] || 0) * (bv.shape[1] || 0);
      if (size && n > 0 && bv.begin + n * size <= header.view.byteLength) {
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < n; i++) {
          const x = Reader.value(header.view, bv.type, bv.begin + i * size);
          if (!Number.isFinite(x)) continue;
          if (x < min) min = x;
          if (x > max) max = x;
        }
        if (Number.isFinite(min) && Number.isFinite(max) && max > min) return { min, max };
      }
    }
  }

  if (centres.length === 1) return null;      // a single cell of unknown width places nothing
  const first = centres[0], last = centres.at(-1);
  const dFirst = centres[1] - centres[0];
  const dLast = last - centres.at(-2);
  const lo = first - dFirst / 2, hi = last + dLast / 2;
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };   // latitude often runs north→south
}

/**
 * The geographic extent declared by the file's own coordinate variables.
 * @param {Object} header
 * @returns {{bbox: number[], lon: string, lat: string}|null}
 */
export function geographicExtent(header) {
  const lonVar = findAxis(header, LON_UNITS, ["lon", "longitude", "x"]);
  const latVar = findAxis(header, LAT_UNITS, ["lat", "latitude", "y"]);
  if (!lonVar || !latVar) return null;
  const x = edgesOf(header, lonVar), y = edgesOf(header, latVar);
  if (!x || !y) return null;
  // A projected file (x/y in metres) can carry axes named x/y with no degree units — the caller
  // range-checks, but refusing obvious non-degrees here keeps a wrong extent from travelling at all.
  if (Math.abs(y.min) > 90 || Math.abs(y.max) > 90 || Math.abs(x.min) > 360 || Math.abs(x.max) > 360) {
    return null;
  }
  return { bbox: [x.min, y.min, x.max, y.max], lon: lonVar.name, lat: latVar.name };
}

// CF: "<unit> since <reference datetime>". The reference is ISO-ish but rarely strictly ISO —
// '2020-01-01 00:00:00', '2001-1-1', '1900-01-01 0:0:0' are all legal and all appear in real files.
const SINCE = /^\s*(\w+)\s+since\s+(.+?)\s*$/i;
const UNIT_MS = {
  second: 1000, seconds: 1000, sec: 1000, secs: 1000, s: 1000,
  minute: 60000, minutes: 60000, min: 60000, mins: 60000,
  hour: 3600000, hours: 3600000, hr: 3600000, hrs: 3600000, h: 3600000,
  day: 86400000, days: 86400000, d: 86400000,
  millisecond: 1, milliseconds: 1, msec: 1, msecs: 1, ms: 1,
};
// Calendars whose arithmetic a JS Date can actually do. `360_day`, `noleap`/`365_day`, `all_leap`
// and `julian` cannot be — a 360-day year has no Gregorian instants to map onto, and inventing them
// would misdate every step. Such a file still gets a usable axis, just not a calendar one: the RAW
// offsets are returned instead (monotonic, meaningful in the file's own units, and selectable), which
// is strictly better than falling all the way back to bare positions.
const GREGORIAN = new Set(["standard", "gregorian", "proleptic_gregorian", "none", ""]);

/** Parse a CF reference datetime into epoch ms. Returns NaN when it is not one. */
function parseReference(s) {
  const m = /^(\d{1,4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?)?/.exec(s.trim());
  if (!m) return NaN;
  const [, Y, Mo, D, h = 0, mi = 0, se = 0] = m;
  // The trailing zone, when present, is almost always 'Z'/'UTC'/'+0:00' — all of which mean UTC, and
  // a bare reference is UTC by CF convention too. So UTC is the only reading applied.
  return Date.UTC(+Y, +Mo - 1, +D, +h, +mi, Math.floor(+se), Math.round((+se % 1) * 1000));
}

/**
 * The file's own time axis — the thing SciWrid's NetCDF3 path cannot yet supply.
 *
 * `values` (ISO strings) is present only when the calendar is one a real timestamp can be computed
 * for. `offsets` — the numbers as the file stores them — is always present, so a 360-day or noleap
 * file still gets a real, ordered axis in its own units rather than being demoted to positions.
 * @param {Object} header
 * @returns {{values: string[]|null, offsets: number[], unitsRaw: string, calendar: string,
 *   gregorian: boolean, name: string}|null}
 */
export function timeAxis(header) {
  const candidates = header.variables.filter((v) => isCoordVar(v) && SINCE.test(String(v.attrs.units || "")));
  const tv = candidates.find((v) => /^(time|t)$/i.test(v.name)) ?? candidates[0];
  if (!tv) return null;

  const unitsRaw = String(tv.attrs.units);
  const [, unit, ref] = SINCE.exec(unitsRaw);
  const perUnit = UNIT_MS[unit.toLowerCase()];
  const epoch = parseReference(ref);
  const calendar = String(tv.attrs.calendar ?? "standard").toLowerCase();

  const offsets = readValues(header, tv);
  if (!offsets || offsets.length === 0) return null;

  const gregorian = !!perUnit && Number.isFinite(epoch) && GREGORIAN.has(calendar);
  let values = null;
  if (gregorian) {
    values = offsets.map((o) => new Date(epoch + o * perUnit).toISOString());
    if (values.some((v) => !v || v === "Invalid Date")) values = null;
  }
  return { values, offsets, unitsRaw, calendar, gregorian: !!values, name: tv.name };
}

/**
 * Everything this module can tell you about a NetCDF-3 file, in one call — the shape `io/sciwrid.js`
 * consumes. Returns null for bytes that are not NetCDF-3, so a caller can try it unconditionally.
 * @param {ArrayBuffer|ArrayBufferView} source
 * @returns {{bbox: number[]|null, times: string[]|null, offsets: number[]|null, timeUnits: string|null,
 *   calendar: string|null, gregorian: boolean, lon: string|null, lat: string|null, dims: Object,
 *   variables: string[]}|null}
 */
export function describeNetcdf3(source) {
  let header;
  try {
    header = readNetcdf3Header(source);
  } catch {
    return null;      // a truncated or malformed header is a "we know nothing", never a throw:
  }                   // this is a best-effort supplement, and the caller has a working decoder already
  if (!header) return null;

  let extent = null, time = null;
  try { extent = geographicExtent(header); } catch { /* leave null */ }
  try { time = timeAxis(header); } catch { /* leave null */ }

  return {
    bbox: extent?.bbox ?? null,
    lon: extent?.lon ?? null,
    lat: extent?.lat ?? null,
    times: time?.values ?? null,
    offsets: time?.offsets ?? null,
    timeUnits: time?.unitsRaw ?? null,
    calendar: time?.calendar ?? null,
    gregorian: !!time?.gregorian,
    dims: Object.fromEntries(header.dims.map((d) => [d.name, d.unlimited ? header.numrecs : d.size])),
    variables: header.variables.map((v) => v.name),
  };
}
