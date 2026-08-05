import initGdalJs from "gdal3.js";
import { fromArrayBuffer } from "geotiff";
import { getGdalPath } from "../package/config.js";
import { reportError } from "../package/events.js";

let _gdalPromise = null;
let _gdalPath = null;      // the path the singleton was actually initialized with
let _warpSeq = 0;

/**
 * Initialize (once) and return the GDAL handle.
 *
 * @param {string} [gdalPath] where gdal3.js loads its wasm/data from. Defaults to the process-global
 *   `getGdalPath()` value (set from the first mounted app's config); pass it explicitly to override.
 *
 * GDAL IS PROCESS-GLOBAL: gdal3.js compiles one Emscripten module per page, so the FIRST caller's
 * path wins and there is no per-instance version of this. That is a property of the WASM runtime,
 * not a shortcut — so rather than pretend otherwise, a later mismatched path WARNS instead of
 * silently loading someone else's build. This is why `gdalPath` is the one setting the engine keeps
 * as a narrow module-level value rather than reading per-instance.
 */
export function getGdal(gdalPath = getGdalPath()) {
  if (!_gdalPromise) {
    _gdalPath = gdalPath;
    _gdalPromise = initGdalJs({ useWorker: false, path: gdalPath }).catch((e) => {
      reportError("gdal-init-failed", "GDAL failed to initialize: " + ((e && e.message) || e));
      throw e; // preserve rejection for callers (warpToEpsg4326)
    });
  } else if (gdalPath && gdalPath !== _gdalPath) {
    console.warn(
      `FimViz: GDAL is already initialized from "${_gdalPath}"; ignoring "${gdalPath}". ` +
      "gdal3.js is process-global — only the first gdalPath on a page takes effect.");
  }
  return _gdalPromise;
}

// readCrs/crsEquivalent/epsgNumber moved to geo/crs.js — they are pure (no GDAL), and keeping them
// here made every consumer of io/parse.js pull gdal3.js's glue into the initial bundle. Re-exported
// so this module's own contract is unchanged for anything already importing them from here.
import { readCrs, crsEquivalent, epsgNumber } from "./crs.js";
export { readCrs, crsEquivalent, epsgNumber };

// GDAL is initialised lazily — on the first reprojection that actually needs it — so a widget
// that never loads an unusual-projection raster does not pay the ~38 MB wasm/data download.

/**
 * Reproject a GeoTIFF to `toCrs`. A no-op (returns the original buffer) when the source is
 * already in an equivalent CRS.
 * @returns {{ buffer: ArrayBuffer, fromCrs: string|null, warped: boolean }}
 */
export async function warpTo(arrayBuffer, filename, toCrs) {
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const fromCrs = readCrs(image);
  if (crsEquivalent(fromCrs, toCrs)) return { buffer: arrayBuffer, fromCrs, warped: false };

  const Gdal = await getGdal();
  const inputFile = new File([arrayBuffer], filename, { type: "image/tiff" });
  const { datasets } = await Gdal.open(inputFile);
  const outPath = `warped_${++_warpSeq}`;
  const warpedPath = await Gdal.gdalwarp(datasets[0],
    ["-t_srs", toCrs, "-r", "bilinear", "-of", "GTiff"],
    outPath);
  await Gdal.close(datasets[0]);
  const warpedBytes = await Gdal.getFileBytes(warpedPath);
  return { buffer: warpedBytes.buffer, fromCrs, warped: true };
}

// ---- a minimal, hand-rolled GeoTIFF encoder ----
//
// geotiff.js ships a writer (writeArrayBuffer), but it's broken above 8-bit: it sizes the output
// buffer as `width*height*samplesPerPixel` BYTES regardless of BitsPerSample, and copies pixel
// values through `new Uint8Array(values)` — silently truncating anything wider than 8-bit unsigned
// to garbage. Confirmed by reading its source (node_modules/geotiff/dist-module/geotiffwriter.js)
// and by this module's own round-trip test failing (reader ran past the buffer) until this replaced
// it. So: single-band, single-strip, uncompressed GeoTIFF — just enough to hand GDAL a real, valid
// file to warp; not a general-purpose TIFF writer.

// GDAL's own raster type vocabulary (GDALDataType names) → the TIFF-side encoding. sampleFormat
// 1=unsigned int, 2=signed int, 3=IEEE float — the three the TIFF 6.0 baseline spec defines, and the
// ONLY three geotiff.js's own reader can decode (getReaderForSample in geotiffimage.js has no case
// for anything else) — which matters here because that reader decodes BOTH this file (round-trip
// tests) AND GDAL's warped output of it (the real pipeline), regardless of how correct our own
// encoder is.
const GDAL_DTYPES = {
  Byte: { bits: 8, format: 1, Ctor: Uint8Array },
  UInt16: { bits: 16, format: 1, Ctor: Uint16Array },
  Int16: { bits: 16, format: 2, Ctor: Int16Array },
  UInt32: { bits: 32, format: 1, Ctor: Uint32Array },
  Int32: { bits: 32, format: 2, Ctor: Int32Array },
  Float32: { bits: 32, format: 3, Ctor: Float32Array },
  Float64: { bits: 64, format: 3, Ctor: Float64Array },
};
// GDAL also names these — complex (interleaved real+imaginary) sample formats outside the TIFF 6.0
// baseline spec, which geotiff.js's reader cannot decode at all (see GDAL_DTYPES' comment). A TIFF
// encoded with one of these could never be read back by anything in this pipeline, so this rejects
// them explicitly (with the reason) rather than either silently mis-encoding or throwing "unknown
// dtype" as if they were just a typo.
const UNSUPPORTED_COMPLEX_DTYPES = new Set(["CInt16", "CInt32", "CFloat32", "CFloat64"]);

const TIFF_TYPE = { SHORT: 3, LONG: 4, DOUBLE: 12 };
const TIFF_TYPE_SIZE = { [TIFF_TYPE.SHORT]: 2, [TIFF_TYPE.LONG]: 4, [TIFF_TYPE.DOUBLE]: 8 };

function writeTiffValues(view, offset, type, values, littleEndian) {
  const size = TIFF_TYPE_SIZE[type];
  values.forEach((v, i) => {
    const o = offset + (i * size);
    if (type === TIFF_TYPE.SHORT) view.setUint16(o, v, littleEndian);
    else if (type === TIFF_TYPE.LONG) view.setUint32(o, v, littleEndian);
    else if (type === TIFF_TYPE.DOUBLE) view.setFloat64(o, v, littleEndian);
  });
}

/**
 * Encode a single-band grid into a minimal, valid GeoTIFF buffer — the piece of warpGrid() that's
 * pure and Node-testable (no wasm), split out so its correctness can be checked directly (round-trip
 * through geotiff.js's own reader) rather than only indirectly through a browser-only GDAL call.
 *
 * The `GeographicTypeGeoKey: 4326` written into every file is a PLACEHOLDER ONLY — just enough for an
 * opener that requires SOME CRS to be declared — never trusted for the actual math: warpGrid() passes
 * `-s_srs` to gdalwarp explicitly, so GDAL's own (robust, real EPSG database) resolution decides the
 * true source CRS rather than this function having to classify an arbitrary EPSG code as geographic-
 * vs-projected itself to pick the "right" GeoKey. ModelPixelScale/ModelTiepoint (this raster's real,
 * CRS-agnostic footprint) are NOT placeholders — computed directly from `grid.bounds`.
 * @param {{pixels: ArrayLike<number>, width: number, height: number,
 *   bounds: {north:number,south:number,east:number,west:number}}} grid
 * @param {string} filename
 * @param {{dtype?: 'Byte'|'UInt16'|'Int16'|'UInt32'|'Int32'|'Float32'|'Float64'}} [opts] - defaults to
 *   Float32, this codebase's own "computed grid" convention (rasterOps.js) — NaN round-trips through
 *   IEEE float exactly, the in-band "no value" marker every pure-JS grid op already uses. Coercing
 *   NaN into an INTEGER dtype instead silently produces 0 (standard JS numeric coercion), same as it
 *   would for any other out-of-range value — pick an integer dtype only when the source truly has no
 *   NaN/sentinel pixels to lose. The complex GDAL types (CInt16/CInt32/CFloat32/CFloat64) are
 *   recognized but rejected — see UNSUPPORTED_COMPLEX_DTYPES's comment for why.
 * @returns {ArrayBuffer}
 */
export function encodeGridAsGeoTiff({ pixels, width, height, bounds }, filename, { dtype = "Float32" } = {}) {
  if (!(width > 0 && height > 0) || !bounds) {
    throw new Error(`encodeGridAsGeoTiff: "${filename}" is missing dimensions/bounds — cannot encode it.`);
  }
  if (UNSUPPORTED_COMPLEX_DTYPES.has(dtype)) {
    throw new Error(`encodeGridAsGeoTiff: dtype "${dtype}" is a complex sample format outside the TIFF ` +
      "6.0 baseline spec, and geotiff.js's reader (which decodes BOTH this file and GDAL's warped " +
      `output of it) can't read it back either way. Real-valued types only: ${Object.keys(GDAL_DTYPES).join(", ")}.`);
  }
  const spec = GDAL_DTYPES[dtype];
  if (!spec) {
    throw new Error(`encodeGridAsGeoTiff: unknown dtype "${dtype}" — expected one of ` +
      `${Object.keys(GDAL_DTYPES).join(", ")} (or a complex variant, which is rejected — see the doc comment).`);
  }

  const n = width * height;
  const bytesPerSample = spec.bits / 8;
  const typedPixels = pixels instanceof spec.Ctor ? pixels : spec.Ctor.from(pixels);

  // IFD entries, TAG-ASCENDING (the TIFF 6.0 spec requires this order).
  const entries = [
    { tag: 256, type: TIFF_TYPE.LONG, values: [width] },                // ImageWidth
    { tag: 257, type: TIFF_TYPE.LONG, values: [height] },               // ImageLength
    { tag: 258, type: TIFF_TYPE.SHORT, values: [spec.bits] },           // BitsPerSample
    { tag: 259, type: TIFF_TYPE.SHORT, values: [1] },                   // Compression: none
    { tag: 262, type: TIFF_TYPE.SHORT, values: [1] },                   // PhotometricInterpretation: BlackIsZero
    { tag: 273, type: TIFF_TYPE.LONG, values: [0] },                    // StripOffsets — patched in below
    { tag: 277, type: TIFF_TYPE.SHORT, values: [1] },                   // SamplesPerPixel: 1 (single band)
    { tag: 278, type: TIFF_TYPE.LONG, values: [height] },               // RowsPerStrip: one strip, whole image
    { tag: 279, type: TIFF_TYPE.LONG, values: [n * bytesPerSample] },   // StripByteCounts
    { tag: 339, type: TIFF_TYPE.SHORT, values: [spec.format] },         // SampleFormat
    { tag: 33550, type: TIFF_TYPE.DOUBLE,                               // ModelPixelScaleTag
      values: [(bounds.east - bounds.west) / width, (bounds.north - bounds.south) / height, 0] },
    { tag: 33922, type: TIFF_TYPE.DOUBLE,                               // ModelTiepointTag: pixel(0,0) → (west, north)
      values: [0, 0, 0, bounds.west, bounds.north, 0] },
    { tag: 34735, type: TIFF_TYPE.SHORT,                                // GeoKeyDirectoryTag — see doc comment
      values: [1, 1, 0, 2, 1024, 0, 1, 2, 2048, 0, 1, 4326] },
  ];

  // Layout pass: header(8) + IFD(2 + 12*count + 4) + overflow values (>4 bytes, word-aligned) + pixels.
  const HEADER_SIZE = 8;
  const ifdSize = 2 + (entries.length * 12) + 4;
  let overflowOffset = HEADER_SIZE + ifdSize;
  for (const e of entries) {
    const byteLen = e.values.length * TIFF_TYPE_SIZE[e.type];
    if (byteLen > 4) {
      e.offset = overflowOffset;
      overflowOffset += byteLen + (byteLen % 2);
    }
  }
  const pixelDataOffset = overflowOffset;
  entries.find((e) => e.tag === 273).values = [pixelDataOffset];   // patch StripOffsets now it's known

  const buf = new ArrayBuffer(pixelDataOffset + (n * bytesPerSample));
  const view = new DataView(buf);
  const littleEndian = true;

  view.setUint8(0, 0x49); view.setUint8(1, 0x49);       // "II" — little-endian byte order
  view.setUint16(2, 42, littleEndian);                   // TIFF magic number
  view.setUint32(4, HEADER_SIZE, littleEndian);          // offset of the (only) IFD

  view.setUint16(HEADER_SIZE, entries.length, littleEndian);
  let entryOffset = HEADER_SIZE + 2;
  for (const e of entries) {
    view.setUint16(entryOffset, e.tag, littleEndian);
    view.setUint16(entryOffset + 2, e.type, littleEndian);
    view.setUint32(entryOffset + 4, e.values.length, littleEndian);
    const byteLen = e.values.length * TIFF_TYPE_SIZE[e.type];
    if (byteLen <= 4) {
      writeTiffValues(view, entryOffset + 8, e.type, e.values, littleEndian);
    } else {
      view.setUint32(entryOffset + 8, e.offset, littleEndian);
      writeTiffValues(view, e.offset, e.type, e.values, littleEndian);
    }
    entryOffset += 12;
  }
  view.setUint32(entryOffset, 0, littleEndian);          // no further IFDs

  // Pixel data: a raw byte copy — typed arrays use the platform's native byte order, which is
  // little-endian on every realistic JS runtime, matching the "II" declared above.
  new Uint8Array(buf, pixelDataOffset, n * bytesPerSample)
    .set(new Uint8Array(typedPixels.buffer, typedPixels.byteOffset, n * bytesPerSample));

  return buf;
}

/**
 * Warp an already-DECODED grid's own pixels — for reprojecting a Dataset whose data was actually
 * COMPUTED (combine/clip/mask/reclassify/resample/rasterize), where no encoded source file
 * represents its current pixels anymore (see Dataset.#applyOp's reproject case: only a plain
 * source, or a reproject-only chain, can reuse the chain's original file bytes — anything else
 * needs THIS instead, or reprojecting would silently discard the computation). Encodes via
 * encodeGridAsGeoTiff(), then runs the SAME gdalwarp path as warpTo() — see that function's doc
 * comment for why `-s_srs` (not a written-in GeoKey) is what actually declares the source CRS.
 * @param {{pixels: ArrayLike<number>, width: number, height: number,
 *   bounds: {north:number,south:number,east:number,west:number}, crs: string|null, noData: *}} grid
 * @param {string} filename
 * @param {string} toCrs
 * @param {{dtype?: string}} [opts] - forwarded to encodeGridAsGeoTiff (defaults to Float32)
 * @returns {Promise<{buffer: ArrayBuffer, warped: true}>}
 */
export async function warpGrid(grid, filename, toCrs, opts = {}) {
  const { crs, noData } = grid;
  if (!crs) {
    throw new Error(`warpGrid: "${filename}" has no known source CRS — cannot warp a grid whose ` +
      "current projection is unknown.");
  }
  const encoded = encodeGridAsGeoTiff(grid, filename, opts);
  // GDAL accepts the literal "nan" for -srcnodata/-dstnodata on a float raster; use the grid's own
  // sentinel when it has one (a plain decoded RasterGrid), NaN otherwise (every pure-JS grid op in
  // rasterOps.js normalizes "no value" to NaN in-band instead of a sentinel).
  const nodataArg = noData != null ? String(noData) : "nan";

  const Gdal = await getGdal();
  const inputFile = new File([encoded], filename, { type: "image/tiff" });
  const { datasets } = await Gdal.open(inputFile);
  const outPath = `warped_${++_warpSeq}`;
  const warpedPath = await Gdal.gdalwarp(datasets[0], [
    "-s_srs", crs, "-t_srs", toCrs,
    "-srcnodata", nodataArg, "-dstnodata", nodataArg,
    "-r", "bilinear", "-of", "GTiff",
  ], outPath);
  await Gdal.close(datasets[0]);
  const warpedBytes = await Gdal.getFileBytes(warpedPath);
  return { buffer: warpedBytes.buffer, warped: true };
}

/**
 * Resample a GeoTIFF buffer onto a target grid — `width`×`height`, optional target extent `bounds`
 * ({ bw,bs,be,bn } or { west,south,east,north }), with any `gdalwarp -r` method (nearest, bilinear,
 * cubic, cubicspline, lanczos, average, mode, min, max, med, q1, q3). Buffer in → buffer out, so the
 * caller decodes with geotiff.js afterward.
 *
 * This is the BUFFER-level resampling path, complementing the pure-JS pixel resamplers in
 * geo/resample.js. GDAL is async and file/buffer-oriented, which is exactly why it lives here and not
 * behind resample.js's synchronous `registerResampler` seam: comparison/ensemble resample their
 * source buffers to the common grid HERE (browser, GDAL wasm) before decoding, then run the aligned
 * pixels through the headless compute.
 *
 * @returns {Promise<ArrayBuffer>} the warped GeoTIFF bytes.
 */
export async function warpToGrid(arrayBuffer, filename, { width, height, bounds = null, method = "bilinear" } = {}) {
  if (!(width > 0 && height > 0)) throw new Error("warpToGrid: width and height must be positive");
  const Gdal = await getGdal();
  const inputFile = new File([arrayBuffer], filename || "in.tif", { type: "image/tiff" });
  const { datasets } = await Gdal.open(inputFile);
  const args = ["-of", "GTiff", "-r", method, "-ts", String(width), String(height)];
  if (bounds) {
    args.push("-te",
      String(bounds.bw ?? bounds.west), String(bounds.bs ?? bounds.south),
      String(bounds.be ?? bounds.east), String(bounds.bn ?? bounds.north));
  }
  const warpedPath = await Gdal.gdalwarp(datasets[0], args, `grid_${++_warpSeq}`);
  await Gdal.close(datasets[0]);
  const warpedBytes = await Gdal.getFileBytes(warpedPath);
  return warpedBytes.buffer;
}

/**
 * Generalized escape hatch to gdal3.js's own API: call ANY method on the initialized instance by
 * name, with whatever raw parameters THAT method's own signature requires — this package bakes in
 * no assumption about shape (dataset-in/file-out, info-object-out, coordinates-in/out, ...), so it
 * covers every gdal3.js method uniformly, including ones this file has no dedicated wrapper for and
 * ones gdal3.js adds in the future.
 *
 * gdal3.js's own methods (see its `index.d.ts`) fall into a few shapes:
 *   - lifecycle: `open(fileOrFiles, options?, VFSHandlers?)` → `{datasets, errors}`; `close(dataset)`;
 *     `getFileBytes(path)` → `Uint8Array`; `getOutputFiles()`; `getInfo(dataset)`.
 *   - dataset-based utilities — take an opened `Dataset` + a CLI-style options array, write to the
 *     virtual FS: `gdalwarp(dataset, options?, outputName?)`, `gdal_translate(...)`,
 *     `gdal_rasterize(...)`, `ogr2ogr(...)` → all resolve `{path}`, read back via `getFileBytes`.
 *   - info-only (no output file): `gdalinfo(dataset, options?)`, `ogrinfo(dataset, options?)` →
 *     resolve a plain object.
 *   - no dataset at all: `gdaltransform(coords, options)` → transformed coordinates.
 *
 * `warpTo`/`warpToGrid` above already wrap the one operation (`gdalwarp`) most callers need for
 * reproject/resample (`Dataset.reproject`/`Dataset.resampleTo`); reach for `callGdal` for a
 * DIFFERENT gdal3.js utility, or `gdalwarp` options those two don't expose.
 *
 * ```js
 * const file = new File([arrayBuffer], 'in.tif', { type: 'image/tiff' });
 * const { datasets } = await callGdal('open', file);
 * const outPath = await callGdal('gdal_translate', datasets[0], ['-of', 'GTiff', '-outsize', '50%', '50%'], 'out.tif');
 * await callGdal('close', datasets[0]);
 * const bytes = await callGdal('getFileBytes', outPath);   // Uint8Array
 * ```
 *
 * @param {string} method - a method name on the gdal3.js instance (see gdal3.js's `index.d.ts` for
 *   each one's exact parameters).
 * @param {...*} params - passed through to that method verbatim, in order.
 * @returns {Promise<*>} whatever that gdal3.js method itself resolves to.
 */
export async function callGdal(method, ...params) {
  const Gdal = await getGdal();
  if (typeof Gdal[method] !== "function") {
    const known = Object.keys(Gdal).filter((k) => typeof Gdal[k] === "function").sort().join(", ");
    throw new Error(`callGdal: gdal3.js has no "${method}" method. Available: ${known || "(none)"}.`);
  }
  return Gdal[method](...params);
}

/**
 * LEGACY shim — the pre-`Dataset.crs` contract, kept byte-compatible for the 9 call sites in
 * io/fileUpload.js and layers/floodExtent.js that still warp implicitly at upload time.
 * New code should use `warpTo` / `Dataset.reproject()` (reprojection is explicit — see
 * docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1). Returns { buffer, fromEpsg }; fromEpsg is null when no warp
 * happened (already WGS84/NAD83) or when the source CRS could not be read.
 */
export async function warpToEpsg4326(arrayBuffer, filename) {
  const { buffer, fromCrs, warped } = await warpTo(arrayBuffer, filename, "EPSG:4326");
  return { buffer, fromEpsg: warped ? epsgNumber(fromCrs) : null };
}
