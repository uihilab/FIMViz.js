// tifMeta.js — GeoTIFF metadata as DATA. Headless.
//
// Computing raster metadata is engine work; choosing a panel to draw it in is HOST policy. So this
// module computes rows and emits them — it must never reach for a panel or a DOM id, both of which
// belong to the host's markup. The host subscribes and renders.

import { emitHost } from "../package/events.js";

const SAMPLE_FORMAT = { 1: "UInt", 2: "Int", 3: "Float" };

/**
 * Pure: a GeoTIFF image → its metadata as [label, value] rows. No DOM, no events — this is the
 * part that is genuinely engine work, and it is separately testable because nothing else is
 * entangled with it.
 * @returns {Array<[string, string]>}
 */
export function describeTif(image, { unit = null, extraRows = [] } = {}) {
  const width = image.getWidth();
  const height = image.getHeight();
  const [bw, bs, be, bn] = image.getBoundingBox();
  const fd = image.fileDirectory;

  const noData = fd.GDAL_NODATA != null ? String(parseFloat(fd.GDAL_NODATA)) : "—";
  const bps = Array.isArray(fd.BitsPerSample) ? fd.BitsPerSample[0] : (fd.BitsPerSample || null);
  const sf = Array.isArray(fd.SampleFormat) ? fd.SampleFormat[0] : (fd.SampleFormat || null);
  const dataType = bps ? `${SAMPLE_FORMAT[sf] || ""}${bps}` : "—";

  return [
    ["Dimensions",    `${width} × ${height} px`],
    ["CRS",           "EPSG:4326 (WGS84)"],
    ["West / East",   `${bw.toFixed(4)}° / ${be.toFixed(4)}°`],
    ["South / North", `${bs.toFixed(4)}° / ${bn.toFixed(4)}°`],
    ...(unit ? [["Unit", unit]] : []),
    ["Data type",     dataType],
    ["No-data",       noData],
    ...extraRows,
  ];
}

/**
 * Compute this raster's metadata and hand it to the host → 'raster:metadata'.
 *
 * Payload carries BOTH shapes so the host can render either without recomputing:
 *   rows     — [[label, value], …]         (the flat form, for a plain listing)
 *   specRows — [{ k, v, num? }, …]         (the File Spec form the Layer Panel consumes)
 * `num: true` marks the numeric fields so they render as metrics, matching the prior layout.
 */
export function showTifMetadata(title, image, { unit = null, extraRows = [], showSupp = false } = {}) {
  const rows = describeTif(image, { unit, extraRows });
  const dispName = title.replace(/\.[^.]+$/, "");
  const specRows = [
    { k: "File", v: dispName },
    { k: "Type", v: "GeoTIFF" },
    ...rows.map(([k, v]) => ({ k, v, num: true })),
  ];
  emitHost("raster:metadata", { title, name: dispName, rows, specRows, showSupp });
}

/** The active raster's metadata is no longer current → 'raster:metadata-hidden'. */
export function hideTifMetadata() {
  emitHost("raster:metadata-hidden", {});
}
