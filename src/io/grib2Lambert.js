// grib2Lambert.js — places GRIB2 fields on a Lambert conformal grid (grid template 3.30).
//
// SciWrid 0.1.0 decodes these pixels correctly and places them wrong. It reports a template-3.30
// grid as regular, with one latitude per row and one longitude per column interpolated between the
// corner points. Lambert rows curve, so cells between the corners move by several degrees: on the
// HRRR grid SciWrid puts the center cell at 34.5°N, and it sits at 38.5°N. io/sciwrid.js therefore
// reads SciWrid's native array and resamples it here with the grid definition from GRIB2 section 3.
//
// Scope: a spherical earth (shape-of-earth codes 0, 1 and 6), a northern-hemisphere projection
// center, and rows scanned consecutively. HRRR, NBM and RRFS all qualify. readLambertGrid throws for
// anything else, so a grid it cannot place never reaches a map.

const EARTH_RADIUS_BY_SHAPE = { 0: 6367470, 6: 6371229 };
const DEG = Math.PI / 180;

const u8 = (b, o) => b[o];
const u16 = (b, o) => (b[o] << 8) | b[o + 1];
const u32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
// GRIB2 signed integers are sign-magnitude: the top bit is the sign, the rest is the value.
const s32 = (b, o) => { const v = u32(b, o); return v & 0x80000000 ? -(v & 0x7fffffff) : v; };

/**
 * The template-3.30 section of each GRIB2 message in `bytes`, parsed; other templates give null.
 * @param {Uint8Array} bytes - one or more concatenated GRIB2 messages
 * @returns {Array<Object|null>}
 */
export function readLambertSections(bytes) {
  const out = [];
  let m = 0;
  while (m + 16 <= bytes.length) {
    if (bytes[m] !== 0x47 || bytes[m + 1] !== 0x52 || bytes[m + 2] !== 0x49 || bytes[m + 3] !== 0x42) {
      throw new Error(`GRIB2: no "GRIB" marker at byte ${m}`);
    }
    if (bytes[m + 7] !== 2) throw new Error(`GRIB2: message at byte ${m} is edition ${bytes[m + 7]}, not 2`);
    const total = u32(bytes, m + 8) * 2 ** 32 + u32(bytes, m + 12);
    let section = null;
    for (let o = m + 16; o + 5 <= m + total;) {
      if (bytes[o] === 0x37 && bytes[o + 1] === 0x37 && bytes[o + 2] === 0x37 && bytes[o + 3] === 0x37) break;
      const length = u32(bytes, o);
      if (length < 5) throw new Error(`GRIB2: section at byte ${o} reports length ${length}`);
      if (u8(bytes, o + 4) === 3) section = u16(bytes, o + 12) === 30 ? lambertTemplate(bytes, o) : null;
      o += length;
    }
    out.push(section);
    m += total;
  }
  return out;
}

// Octet n of section 3 (1-based, as WMO's template 3.30 table numbers them) is at o + n - 1.
function lambertTemplate(b, o) {
  const shape = u8(b, o + 14);
  const radius = shape === 1
    ? u32(b, o + 16) / 10 ** u8(b, o + 15)
    : EARTH_RADIUS_BY_SHAPE[shape] ?? null;
  return {
    shape, radius,
    nx: u32(b, o + 30), ny: u32(b, o + 34),
    la1: s32(b, o + 38) / 1e6, lo1: u32(b, o + 42) / 1e6,
    lad: s32(b, o + 47) / 1e6, lov: u32(b, o + 51) / 1e6,
    dx: u32(b, o + 55) / 1e3, dy: u32(b, o + 59) / 1e3,
    projectionCenter: u8(b, o + 63), scanningMode: u8(b, o + 64),
    latin1: s32(b, o + 65) / 1e6, latin2: s32(b, o + 69) / 1e6,
  };
}

/**
 * The one Lambert grid the messages in `bytes` share, checked for support, or null if none is Lambert.
 * Throws when the messages disagree on the grid, or when the grid is outside this module's scope.
 * @param {Uint8Array} bytes
 * @returns {Object|null} template-3.30 parameters, in degrees and meters
 */
export function readLambertGrid(bytes) {
  const grids = readLambertSections(bytes).filter(Boolean);
  if (!grids.length) return null;
  const key = (g) => JSON.stringify(g);
  if (grids.some((g) => key(g) !== key(grids[0]))) {
    throw new Error("GRIB2: the messages in this file use different Lambert grids, so no single grid " +
      "places them. Split the file by grid.");
  }
  const g = grids[0];
  if (g.radius == null) {
    throw new Error(`GRIB2: Lambert grid on shape-of-earth code ${g.shape} (an ellipsoid) is not ` +
      "supported; only spherical codes 0, 1 and 6 are.");
  }
  if (g.projectionCenter & 0x80) throw new Error("GRIB2: south-pole Lambert grids are not supported.");
  if (g.scanningMode & 0x30) {
    throw new Error(`GRIB2: Lambert scanning mode 0x${g.scanningMode.toString(16)} is not supported; ` +
      "rows must be scanned consecutively in one direction.");
  }
  return g;
}

/**
 * Spherical Lambert conformal conic math for one grid (Snyder, Map Projections, pp. 104-107).
 * `indexOf` gives fractional column and row in the file's own scanning order.
 * @param {Object} g - from readLambertGrid
 * @returns {{indexOf: (lon: number, lat: number) => number[], lonLatOf: (i: number, j: number) => number[]}}
 */
export function lambertProjector(g) {
  const R = g.radius;
  const p1 = g.latin1 * DEG, p2 = g.latin2 * DEG, lon0 = g.lov * DEG;
  const t = (phi) => Math.tan(Math.PI / 4 + phi / 2);
  const n = Math.abs(p1 - p2) < 1e-10 ? Math.sin(p1) : Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(t(p2) / t(p1));
  const F = (Math.cos(p1) * t(p1) ** n) / n;
  const rho = (phi) => (R * F) / t(phi) ** n;
  const wrap = (a) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));

  const forward = (lon, lat) => {
    const theta = n * wrap(lon * DEG - lon0), r = rho(lat * DEG);
    return [r * Math.sin(theta), -r * Math.cos(theta)];
  };
  // Dx and Dy are distances on the earth at latitude LaD. The projection stretches distance there by
  // k, so one grid step on the projection plane is Dx / k.
  const phiD = g.lad * DEG;
  const k = (n * rho(phiD)) / (R * Math.cos(phiD));
  const stepX = g.dx / k, stepY = g.dy / k;
  // Flag table 3.4: bit 1 set means columns run west, bit 2 set means rows run north.
  const signX = g.scanningMode & 0x80 ? -1 : 1;
  const signY = g.scanningMode & 0x40 ? 1 : -1;
  const [x0, y0] = forward(g.lo1, g.la1);

  return {
    indexOf(lon, lat) {
      const [x, y] = forward(lon, lat);
      return [signX * (x - x0) / stepX, signY * (y - y0) / stepY];
    },
    lonLatOf(i, j) {
      const x = x0 + signX * i * stepX, y = y0 + signY * j * stepY;
      const s = Math.sign(n);
      const r = s * Math.hypot(x, y);
      const theta = Math.atan2(s * x, -s * y);
      const lat = 2 * Math.atan(((R * F) / r) ** (1 / n)) - Math.PI / 2;
      const lon = wrap(lon0 + theta / n) / DEG;
      return [lon, lat / DEG];
    },
  };
}

/**
 * The lon/lat bounding box of a Lambert grid, from points sampled along its four edges.
 * @param {Object} g - from readLambertGrid
 * @returns {number[]} [minLon, minLat, maxLon, maxLat], longitudes in -180..180
 */
export function lambertBbox(g) {
  const proj = lambertProjector(g);
  const lons = [], lats = [];
  const add = (i, j) => { const [lon, lat] = proj.lonLatOf(i, j); lons.push(lon); lats.push(lat); };
  const steps = 64;
  for (let s = 0; s <= steps; s++) {
    const i = (s / steps) * (g.nx - 1), j = (s / steps) * (g.ny - 1);
    add(i, 0); add(i, g.ny - 1); add(0, j); add(g.nx - 1, j);
  }
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/**
 * Nearest-neighbor resample of a Lambert field onto a lon/lat grid, north-up and row-major.
 * Nearest neighbor matches SciWrid's own resampler, and it keeps category codes intact.
 * @param {ArrayLike<number>} native - nx * ny values in the file's scanning order, row by row
 * @param {Object} g - from readLambertGrid
 * @param {{bbox: number[], width: number, height: number}} target
 * @returns {Float32Array} NaN outside the Lambert grid
 */
export function resampleLambert(native, g, { bbox, width, height }) {
  const proj = lambertProjector(g);
  const [west, south, east, north] = bbox;
  const dLon = (east - west) / width, dLat = (north - south) / height;
  const out = new Float32Array(width * height).fill(NaN);
  for (let r = 0; r < height; r++) {
    const lat = north - (r + 0.5) * dLat;
    for (let c = 0; c < width; c++) {
      const [fi, fj] = proj.indexOf(west + (c + 0.5) * dLon, lat);
      const i = Math.round(fi), j = Math.round(fj);
      if (i >= 0 && j >= 0 && i < g.nx && j < g.ny) out[r * width + c] = native[j * g.nx + i];
    }
  }
  return out;
}
