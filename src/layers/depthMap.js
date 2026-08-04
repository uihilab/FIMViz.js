import { notifyBusy } from "../package/events.js";
import { fromArrayBuffer } from "geotiff";
import { showTifMetadata, hideTifMetadata } from "../geo/tifMeta.js";
import { ColorScale } from "../package/colorScale.js";
import { Layer, RasterLayer, registerLayerType } from "../package/layer.js";
import { FimMap, fimForMap } from "../package/fimMap.js";
import { getMapProvider } from "../package/mapProvider.js";

// The FimMap this layer last rendered onto. Bound from the provider map the render entry point
// receives (fimForMap), NOT by reaching for the default app's first map — that resolution is only
// correct while exactly one widget exists on the page.
// Callers hold either a FimMap or a raw provider map, depending on which tier they sit in.
// `instanceof` and not a duck-type: Leaflet's L.Map has its OWN addLayer/removeLayer, so a shape
// check for those silently accepts a raw Leaflet map as if it were a FimMap — after which
// `fim.app.config.provider` is undefined, the provider defaults to google, and Google's
// GroundOverlay.setMap() is handed an L.Map. The error surfaces deep in the Maps SDK.
const _resolveFim = (v) => (!v ? null : (v instanceof FimMap ? v : fimForMap(v)));

// The active provider's raster-image + mouse-move adapters (mapProvider.js). Defaults to "google"
// so a bare fim.map — no registered runtime, no explicit `provider` — still resolves an adapter.
function _rasterProvider(fim) {
  return getMapProvider(fim?.app?.config?.provider || "google");
}

// Depth is a RasterLayer (type:'depth') — the palette-canvas mechanism shared with
// ensemble/userRaster; its overlay, hover listener and pixel data/meta live on the instance.
// ONE INSTANCE PER FimMap — a module-level singleton would make a second widget on the page share
// the first's overlay, hover listener and pixel data. Keyed strongly: the set is bounded by the
// number of mounted widgets, and removeUserDepthLayer() with no argument iterates it.
//
// Event inversion: this layer names NO ui/. It emits 'rendered'/'removed' with the
// raster payload; ui/rasterTools' bindRasterLayerTools(depthLayer) — wired at boot in script.js —
// subscribes and drives the Image Tools panel. Same seam as the userRaster pilot in floodExtent.
const _layers = new Map();   // FimMap -> RasterLayer

function _layerFor(fim) {
  if (!fim) return null;
  let layer = _layers.get(fim);
  if (!layer) { layer = new RasterLayer({ type: "depth", map: fim }); _layers.set(fim, layer); }
  return layer;
}

/**
 * This map's depth layer, created on first use. Exposed so the app can bind its tools panel
 * (`bindRasterLayerTools(depthLayerFor(fim))`) without depthMap importing ui/.
 * @param {*} fimOrMap @returns {RasterLayer|null}
 */
export function depthLayerFor(fimOrMap) { return _layerFor(_resolveFim(fimOrMap)); }

// Blues colormap — breakpoints in feet and metres (FEMA/USACE standard)
const DEPTH_COLORS = ["#C6DBEF", "#9ECAE1", "#6BAED6", "#3182BD", "#08519C", "#08306B"];
const DEPTH_BREAKS = {
  ft: [0, 1,   2,   3,   5,   7.5],
  m:  [0, 0.3, 0.6, 0.9, 1.5, 2.3],
};

function isMetricUnit(unit) {
  return unit && /^m(eters?|etres?)?$/i.test(unit);
}

export function buildDefaultDepthLegend(unit) {
  const breaks = isMetricUnit(unit) ? DEPTH_BREAKS.m : DEPTH_BREAKS.ft;
  const suffix = unit ? ` ${unit}` : "";
  return breaks.map((lo, i) => {
    const hi = breaks[i + 1];
    return {
      range: [lo, hi ?? Infinity],
      color: DEPTH_COLORS[i],
      label: hi != null ? `${lo}–${hi}${suffix}` : `>${lo}${suffix}`,
    };
  });
}

export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

function decodeEntities(str) {
  return str.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function parseLegendAndUnit(xmlStr) {
  let legend = null, unit = null;
  if (!xmlStr) return { legend, unit };
  try {
    const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
    const legendItem = doc.querySelector('Item[name="LEGEND"], Item[name="legend"]');
    if (legendItem) {
      const parsed = JSON.parse(decodeEntities(legendItem.textContent.trim()));
      legend = Array.isArray(parsed) ? parsed : (parsed.groups || null);
    }
    const unitItem = doc.querySelector('Item[name="UNIT"], Item[name="unit"]');
    if (unitItem) unit = unitItem.textContent.trim();
  } catch (_) {}
  return { legend, unit };
}

export function buildLegendHtml(legend, unit) {
  if (!legend || !legend.length) return "";
  const isDiscrete = "value" in legend[0];
  let html = legend.map(g => {
    const label = g.label || (isDiscrete ? `${g.value}` : `${g.range[0]}–${g.range[1]}`);
    return `<div style="display:flex;align-items:center;gap:5px;margin:2px 0">
      <span style="background-color:${g.color};width:15px;height:15px;flex-shrink:0;display:inline-block;"></span>
      <span>${label}</span></div>`;
  }).join("");
  return html;
}

export async function renderUserDepthLayer(fileData, filename, map) {
  const fim = _resolveFim(map);
  // Shadows the former module singleton, so everything below addresses THIS map's layer.
  const _layer = _layerFor(fim);
  if (!_layer) { console.warn("[depth] no FimMap owns this map — nothing rendered"); return; }
  // Clear THIS map's previous depth overlay only. Calling this with no argument would clear every
  // mounted widget's, so rendering on one map would silently wipe another's.
  removeUserDepthLayer(fim);

  notifyBusy(true, "depth");

  try {
    const tiff = await fromArrayBuffer(fileData.data);
    const image = await tiff.getImage();

    const xmlStr = fileData.gdal_metadata ?? image.fileDirectory.GDAL_METADATA ?? null;
    let { legend, unit } = parseLegendAndUnit(xmlStr);

    let noData = -9999;
    const nd = fileData.gdal_nodata ?? image.fileDirectory.GDAL_NODATA;
    if (nd != null) noData = parseFloat(nd);

    const [bw, bs, be, bn] = image.getBoundingBox();
    const width = image.getWidth();
    const height = image.getHeight();
    const rasters = await image.readRasters();
    const pixelData = rasters[0];

    const activeLegend = legend || buildDefaultDepthLegend(unit);
    // Color the depth raster through the ColorScale engine (explicit GDAL/default-depth stops).
    // getRgb handles both the discrete (value===) and classed (unbounded last band) lookups.
    // Attached via _setColorScale (not just a local var) so _layer.colorScale/getLegend() reflect
    // what's actually drawn — same gap RasterLayer._draw()'s precedence chain closes generically;
    // this hand-rolled path predates that and needs it done explicitly.
    const cs = ColorScale.fromGdalLegend(activeLegend, unit ?? "");
    _layer._setColorScale(cs);
    const rgbaData = new Uint8ClampedArray(pixelData.length * 4);

    for (let i = 0; i < pixelData.length; i++) {
      const v = pixelData[i];
      if (isNaN(v) || Math.abs(v - noData) < 1) {
        rgbaData[i * 4 + 3] = 0;
        continue;
      }
      const rgb = cs.getRgb(v);
      if (rgb) {
        rgbaData[i * 4] = rgb[0];
        rgbaData[i * 4 + 1] = rgb[1];
        rgbaData[i * 4 + 2] = rgb[2];
        rgbaData[i * 4 + 3] = 200;
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
    const provider = _rasterProvider(fim);
    _layer.overlay = provider.addRasterImage(map, dataURL, bounds);
    provider.fitBounds(map, bounds);

    _layer.meta = { bw, bs, be, bn, width, height, noData, unit: unit ?? null };
    _layer.rasterData = pixelData;

    showTifMetadata(filename, image, { unit: unit || null, showSupp: true });

    // Emit — the layer never names the tools panel. bindRasterLayerTools(depthLayer) (wired at
    // boot) reacts and activates the Image Tools panel. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §3.2.
    _layer.emit('rendered', {
      pixelData,
      meta: _layer.meta,
      overlayHandle: _layer.overlay,
      bounds,
      originalLegend: legend,
      type: 'userDepth',
      gmap: map,
      filename,
    });

    // RasterLayer.enableHover() — standardized hover (onMapMouseMove + valueAt), replacing what used
    // to be a hand-rolled copy of the same bounds/row/col lookup here. Depth keeps two domain rules
    // valueAt() doesn't know about: a wider noData match (resampling can leave a pixel near, not
    // exactly at, the sentinel) and treating a LITERAL zero depth as "nothing to report" — both
    // expressed as options, not forked logic. Emits the reading as DATA first: a host that is not
    // this widget (or a test) can subscribe instead of being required to own a specific span id.
    _layer.enableHover({
      noDataTolerance: 1,
      isEmpty: (v) => v === 0,
      formatValue: (v) => { const u = _layer.meta?.unit; return u ? `${v.toFixed(3)} ${u}` : v.toFixed(3); },
    });

  } catch (err) {
    console.error("[depthMap] Failed to render:", err);
  } finally {
    notifyBusy(false, "depth");
  }
}

/**
 * Remove the depth overlay. Pass the FimMap (or its provider map) to target one widget; with no
 * argument every mounted widget's depth layer is removed.
 * @param {*} [fimOrMap]
 */
export function removeUserDepthLayer(fimOrMap) {
  const fim = _resolveFim(fimOrMap);
  for (const f of (fim ? [fim] : [..._layers.keys()])) {
    const _layer = _layers.get(f);
    if (!_layer) continue;
    // Synchronous 'removed' drives panel deactivation (not the map SDK's async removal) — same
    // decoupling as the userRaster path, so a depth→raster switch is deterministic.
    _layer.emit('removed');
    if (_layer.overlay) {
      _rasterProvider(f)?.removeRasterImage(f.map, _layer.overlay);
      _layer.overlay = null;
    }
    _layer.disableHover();
    _layer.rasterData = null;
    _layer.meta = null;
  }
  hideTifMetadata();
}

// Register with the Layer type registry — this map's instance, created on first use.
// fim.addLayer('depth') makes it reachable via fim.layers.
registerLayerType("depth", (fim) => _layerFor(fim));

// Wire this module's GDAL_METADATA XML parser into the ColorScale seam, so any RasterLayer (not just
// 'depth') can auto-detect an embedded legend without layer.js importing this file back (it already
// imports FROM layer.js above — importing the other way would be circular).
ColorScale.registerGdalLegendParser(parseLegendAndUnit);

// The per-user-file registry HANDLE for an uploaded depth raster — a real Layer subclass (was a bare
// `new Layer({type:'depth'})`). Rendering stays in the subsystem singleton; this owns the File Viewer
// lifecycle. Mirrors ensemble.js EnsembleLayer.
export class DepthLayer extends Layer {
  /** @param {Object} [opts] */
  constructor(opts = {}) { super({ ...opts, type: "depth" }); }

  /**
   * Render an uploaded depth GeoTIFF (delegates to the subsystem) and own its teardown.
   * @param {Object} fileData @param {*} map @returns {Promise<DepthLayer>}
   */
  async renderFile(fileData, map) {
    await renderUserDepthLayer(fileData, this._name, map);
    this._teardown = () => removeUserDepthLayer(map);   // tear down THIS map's overlay only
    this.visible = true;
    this.emit("rendered", { type: "depth" });
    return this;
  }
}
