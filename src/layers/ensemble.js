import { notifyBusy } from "../package/events.js";
import { fromArrayBuffer } from "geotiff";
import { showTifMetadata, hideTifMetadata } from "../geo/tifMeta.js";
import { Layer, RasterLayer, registerLayerType } from "../package/layer.js";
import { ColorScale } from "../package/colorScale.js";
import { FimMap, fimForMap } from "../package/fimMap.js";
import { getMapProvider } from "../package/mapProvider.js";

// Ensemble is a RasterLayer (type:'ensemble') — the same palette-canvas mechanism as
// depth/userRaster, distinguished by type, not a subclass.
//
// ONE INSTANCE PER FimMap. A module-level singleton would mean a second widget on the page shares
// the first's overlay, stale-load counter and ColorScale — rendering into whichever map happened to
// render last. Keyed strongly because the set is bounded by the number of mounted widgets and we
// need to iterate it (see removeEnsembleLayer with no argument).
const _layers = new Map();   // FimMap -> RasterLayer

function _layerFor(fim) {
  if (!fim) return null;
  let layer = _layers.get(fim);
  if (!layer) { layer = new RasterLayer({ type: "ensemble", map: fim }); _layers.set(fim, layer); }
  return layer;
}

// Callers hold either a FimMap or a raw provider map, depending on which tier they sit in.
// `instanceof` and not a duck-type: Leaflet's L.Map has its OWN addLayer/removeLayer, so a shape
// check for those silently accepts a raw Leaflet map as if it were a FimMap — after which
// `fim.app.config.provider` is undefined, the provider defaults to google, and Google's
// GroundOverlay.setMap() is handed an L.Map. The error surfaces deep in the Maps SDK.
const _resolveFim = (v) => (!v ? null : (v instanceof FimMap ? v : fimForMap(v)));

// The active provider's raster-image adapter — google.maps.GroundOverlay or L.imageOverlay behind
// one contract (mapProvider.js). Defaults to "google" so a bare fim.map (no registered runtime,
// no explicit `provider` option) still resolves an adapter.
function _rasterProvider(fim) {
  return getMapProvider(fim?.app?.config?.provider || "google");
}

/** This map's ensemble layer, created on first use. @param {*} fimOrMap @returns {RasterLayer|null} */
export function ensembleLayerFor(fimOrMap) { return _layerFor(_resolveFim(fimOrMap)); }

function decodeEntities(str) {
  return str.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function parseLegendAndUnit(xmlStr) {
  let legend = null, unit = null;
  if (!xmlStr) return { legend, unit };
  try {
    const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
    const legendItem = doc.querySelector('Item[name="LEGEND"], Item[name="legend"]');
    if (legendItem) {
      // GDAL double-encodes quotes: &amp;quot; in raw bytes → &quot; after DOMParser → needs one more decode
      const jsonStr = decodeEntities(legendItem.textContent.trim());
      const parsed = JSON.parse(jsonStr);
      // LEGEND can be a bare array or {"groups": [...]}
      legend = Array.isArray(parsed) ? parsed : (parsed.groups || null);
    }
    const unitItem = doc.querySelector('Item[name="UNIT"], Item[name="unit"]');
    if (unitItem) unit = unitItem.textContent.trim();
  } catch (_) {}
  return { legend, unit };
}

function buildFallbackLegend(uniqueValues) {
  const n = uniqueValues.length;
  return uniqueValues.map((v, i) => {
    const ratio = n > 1 ? i / (n - 1) : 0;
    const r = Math.round(ratio * 255);
    const g = Math.round((1 - ratio) * 128);
    const hex = "#" + [r, g, 0].map(x => x.toString(16).padStart(2, "0")).join("");
    return { value: v, color: hex, label: `${v}` };
  });
}

/**
 * Remove the ensemble overlay. Pass the FimMap (or its provider map) to target one widget; with no
 * argument every mounted widget's ensemble layer is removed, which is what the single-widget
 * callers expect and is a harmless no-op for a map that has none.
 * @param {*} [fimOrMap]
 */
export function removeEnsembleLayer(fimOrMap) {
  const fim = _resolveFim(fimOrMap);
  for (const f of (fim ? [fim] : [..._layers.keys()])) {
    const layer = _layers.get(f);
    if (!layer) continue;
    if (layer.overlay) {
      _rasterProvider(f)?.removeRasterImage(f.map, layer.overlay);
      layer.overlay = null;
    }
    f.emit('ensemble:removed');
  }
  hideTifMetadata();
}

export const removeUserEnsembleLayer = removeEnsembleLayer;

export async function renderUserEnsembleLayer(fileData, filename, map) {
  const fim = _resolveFim(map);
  removeEnsembleLayer(fim);
  // Shadows the former module singleton, so everything below addresses THIS map's layer.
  const _layer = _layerFor(fim);
  if (!_layer) { console.warn("[ensemble] no FimMap owns this map — nothing rendered"); return; }
  const mySeq = ++_layer.loadSeq;

  notifyBusy(true, "ensemble");

  try {
    const xmlStr = fileData.gdal_metadata ?? null;
    let { legend, unit } = parseLegendAndUnit(xmlStr);
    let noData = -99999;
    try {
      const nd = fileData.gdal_nodata;
      if (nd != null) noData = parseFloat(nd);
    } catch (_) {}

    const tiff = await fromArrayBuffer(fileData.data);
    const image = await tiff.getImage();

    const [bw, bs, be, bn] = image.getBoundingBox();
    const width = image.getWidth();
    const height = image.getHeight();
    const data = await image.readRasters();
    const pixelData = data[0];

    const legendWasEmbedded = legend != null;
    if (!legend) {
      const seen = new Set();
      for (let i = 0; i < pixelData.length; i++) {
        const v = pixelData[i];
        if (Math.abs(v - noData) > 1 && !isNaN(v)) seen.add(v);
      }
      legend = buildFallbackLegend([...seen].sort((a, b) => a - b));
    }

    // Color through the ColorScale engine (same mechanism depthMap.js uses), not a hand-rolled
    // hexToRgb lookup — this is a "collection of colors" scale (one color per discrete legend entry,
    // keyed by an exact value or a range), not a continuous ramp, so it's built straight from the
    // legend's own stops; getRgb handles both the discrete and ranged cases. Attached via
    // _setColorScale so _layer.colorScale/getLegend() reflect what's actually drawn. `source` tags
    // whether the legend was truly GDAL-embedded or our own generated fallback, so introspection
    // isn't misleadingly labeled "gdal" when it's a fallback we invented.
    const cs = legendWasEmbedded
      ? ColorScale.fromGdalLegend(legend, unit ?? "")
      : new ColorScale({ stops: legend, unit: unit ?? "", source: "ensemble-fallback" });
    _layer._setColorScale(cs);
    const rgbaData = new Uint8ClampedArray(pixelData.length * 4);

    for (let i = 0; i < pixelData.length; i++) {
      const v = pixelData[i];
      if (Math.abs(v - noData) < 1 || isNaN(v)) { rgbaData[i * 4 + 3] = 0; continue; }
      const color = cs.getRgb(v);
      if (color) {
        rgbaData[i * 4] = color[0]; rgbaData[i * 4 + 1] = color[1];
        rgbaData[i * 4 + 2] = color[2]; rgbaData[i * 4 + 3] = 200;
      } else {
        rgbaData[i * 4 + 3] = 0;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d").putImageData(new ImageData(rgbaData, width, height), 0, 0);
    const dataURL = canvas.toDataURL();

    // Neutral bounds — both providers' addRasterImage/fitBounds accept this shape directly.
    const bounds = { north: bn, south: bs, east: be, west: bw };

    if (mySeq !== _layer.loadSeq) return;
    const provider = _rasterProvider(fim);
    _layer.overlay = provider.addRasterImage(map, dataURL, bounds);
    provider.fitBounds(map, bounds);

    showTifMetadata(filename, image, { unit: unit || null });
    fim?.emit('ensemble:activated', { filename, legend, unit });

  } catch (e) {
    console.error("[ensemble] Failed to render layer:", e);
  } finally {
    notifyBusy(false, "ensemble");
  }
}

// Register with the Layer type registry — this map's instance, created on first use.
// fim.addLayer('ensemble') makes it reachable via fim.layers.
registerLayerType("ensemble", (fim) => _layerFor(fim));

// The per-user-file registry HANDLE for an uploaded ensemble raster — a real Layer subclass (was a
// bare `new Layer({type:'ensemble'})` in the app). The heavy rendering stays in the subsystem
// singleton `_layer`; this handle OWNS the lifecycle for the File Viewer: renderFile() drives the
// subsystem and installs the teardown so `layer.remove()` cleans up + fires 'removed'. This is what
// proves every user-file layer type is a proper child of Layer.
export class EnsembleLayer extends Layer {
  /** @param {Object} [opts] */
  constructor(opts = {}) { super({ ...opts, type: "ensemble" }); }

  /**
   * Render an uploaded ensemble GeoTIFF (delegates to the subsystem singleton) and take ownership of
   * teardown. `this._name` (the filename) must be set first — registerNamedLayer does that.
   * @param {Object} fileData @param {*} map @returns {Promise<EnsembleLayer>}
   */
  async renderFile(fileData, map) {
    await renderUserEnsembleLayer(fileData, this._name, map);
    this._teardown = () => removeUserEnsembleLayer(map);   // tear down THIS map's overlay only
    this.visible = true;
    this.emit("rendered", { type: "ensemble" });
    return this;
  }
}
