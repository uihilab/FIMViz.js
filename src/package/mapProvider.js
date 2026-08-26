// mapProvider.js — creating the underlying map. The one place the engine constructs one.
//
// Booting a map, meaning loading the SDK and making a Map centered somewhere at some zoom, is
// generic engine work. What is app-specific is the widget around it: panels, layer controllers,
// custom styling. Handing boot to the host would force anyone who only wants a plain map to import
// the Maps Loader and pass the result back.
//
// So `mount()` boots a map itself, and `registerRuntime()` overrides that for a host that needs to
// control boot because it builds a whole widget around the map.
//
// `provider` is a registry rather than a hardcoded branch, so a second backend needs no change to
// mount() or to anyone's options. `requiresApiKey` belongs to the provider, since Google needs one
// and Leaflet does not, so mount() demands an apiKey only when the chosen provider declares it.
//
// A provider covers four things. The map itself. Vectors, through addVector, removeVector and
// fitBounds, which both providers implement, so `fim.addLayer('vector', ...)` works on either.
// Static raster images, through addRasterImage, removeRasterImage, setRasterImageOpacity and
// setRasterImageUrl: one pre-rendered image over geographic bounds, swappable for a live repaint.
// And map mouse-move, through onMapMouseMove normalized to `{lat,lng}`, which drives hover readouts.
//
// Five things stay Google-only. Velocity's continuously animated canvas, which runs its own
// viewport-driven repaint loop rather than showing a static image. The raster draw and measurement
// tool, built directly on `google.maps.event` and `getProjection()`. The comparison draw-mask tool.
// HAZUS damage markers, which use `AdvancedMarkerElement`. And `FloodDepthLayer`'s ArcGIS MapServer
// tiles, a vendored Google-only library. Each needs its own per-provider work; see
// docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §2.1.

import { fimError, reportError } from "./events.js";

// @googlemaps/js-api-loader is a dual-package hazard — webpack resolves it as ESM (named `Loader`),
// node resolves the CJS build, which has no named export. A static import commits to one shape and
// breaks the other. Loading it lazily inside the google provider's create() avoids that: the
// dynamic-import namespace works under both resolvers, and node tests importing this module never
// resolve the loader at all, since they register a fake provider instead.
async function loadGoogleLoader() {
  const ns = await import("@googlemaps/js-api-loader");
  return ns.Loader ?? ns.default?.Loader ?? ns.default;
}

const _providers = new Map();

/**
 * What a map backend must implement to register through `registerMapProvider(name, impl)`. Every
 * method but `create` takes identical parameters on both built-in providers, which is what lets
 * VectorLayer, RasterLayer and the engine's event dispatch call them without knowing which provider
 * is underneath. `create()`'s `options` is the one provider-specific piece; see
 * `GoogleCreateOptions` and `LeafletCreateOptions`.
 * @typedef {Object} MapProviderImpl
 * @property {boolean} [requiresApiKey] - does `create()` need `options.apiKey`? (google: true, leaflet: false)
 * @property {(crs: string|null) => boolean} [acceptsCRS] - can this provider render content in `crs`?
 *   Layer's render precondition asks this before drawing. Omitting it accepts anything.
 * @property {(el: Element, options: (GoogleCreateOptions|LeafletCreateOptions)) => Promise<any>} create -
 *   builds the map in `el` and returns the provider's native map object, exposed as `fim.map`.
 * @property {(map: any, geojson: Object, opts?: { style?: (NeutralStyle|string|((ctx: {feature: Object, index: number}) => (NeutralStyle|string|null))) }) => any} addVector -
 *   renders a GeoJSON FeatureCollection or Feature onto `map` and returns an opaque handle.
 * @property {(map: any, handle: any) => void} removeVector - tear a vector handle down.
 * @property {(map: any, bounds: {north: number, south: number, east: number, west: number}) => void} fitBounds -
 *   fits the map's viewport to `bounds`.
 * @property {(map: any, opts?: { timeout?: number }) => Promise<void>} [whenIdle] - resolve once the
 *   camera has settled. Always safe to await: it resolves on a timeout when the map is already
 *   still, so it cannot hang. Anything reading the projection right after a `fitBounds` must await
 *   it first, since a click resolved mid-animation gives the wrong coordinates.
 * @property {(map: any, on: boolean) => void} [setDraggable] - turn pan-by-drag on or off. Drag-based
 *   the selection tools suppress it while drawing, since tracing a stroke and panning the map are
 *   the same gesture.
 * @property {(map: any) => ({metresPerPixel: number, width: number, height: number}|null)} [viewMetrics] -
 *   ground meters per screen pixel, with the map's pixel size. A tool sizes itself in screen units
 *   from these, i.e. a brush that keeps its width as the user zooms, without touching a map SDK.
 * @property {(map: any, handles: any[]) => any[]} [applyLayerOrder] - restack overlays to match
 *   `handles`, ordered bottom to top, and returns them. A provider may have replaced some, since
 *   the Google raster path recreates them, so use the returned array from then on.
 * @property {(map: any, dataUrl: string, bounds: {north: number, south: number, east: number, west: number}, opts?: { opacity?: number, interactive?: boolean }) => any} addRasterImage -
 *   positions a pre-rendered image, a data URL or any image URL, over `bounds` and returns an
 *   opaque handle. Non-interactive by default, so map events reach the engine's own hit-testing.
 *   Pass `{ interactive: true }` to give this overlay direct SDK interaction.
 * @property {(map: any, handle: any) => void} removeRasterImage - tear a raster-image handle down.
 * @property {(handle: any, opacity: number) => void} setRasterImageOpacity -
 *   changes a raster-image handle's opacity, from 0 to 1.
 * @property {(map: any, handle: any, dataUrl: string, bounds: {north: number, south: number, east: number, west: number}, opts?: { opacity?: number, interactive?: boolean }) => any} setRasterImageUrl -
 *   swaps a raster-image handle's image, i.e. for a palette repaint. Use the returned handle from
 *   then on: google cannot swap the image in place and recreates the overlay instead.
 * @property {(map: any, cb: (pt: {lat: number, lng: number}) => void) => (() => void)} onMapMouseMove -
 *   subscribes to mouse-move on the map, normalized to `{lat, lng}`, and returns an unsubscribe.
 * @property {(map: any, type: ('click'|'hover'|'dblclick'|'mousedown'|'mouseup'|'rightclick'), cb: (evt: {type: string, lat: number, lng: number, originalEvent: (MouseEvent|null)}) => void) => (() => void)} onMapEvent -
 *   subscribes to a normalized map event and returns an unsubscribe. `hover` becomes the
 *   provider's own mousemove.
 */

/**
 * The provider a detached layer resolves against, meaning one built without a mounted app and so
 * with no `config.provider` to read: a unit test's stub, or a Layer constructed directly. Not a
 * config default, since `mount()` requires an explicit `provider` and throws `config-invalid`
 * without one, so a real mounted map never uses this. It is leaflet because leaflet needs no key.
 * @type {string}
 */
export const DEFAULT_PROVIDER = "leaflet";

// Ground meters per screen pixel in Web Mercator. The equator is one 256 px tile at zoom 0, and a
// degree of longitude shortens by cos(lat). Both providers tile the same way, so the math is the
// same; they differ only in how each spells "give me the zoom and the center".
const EQUATOR_M = 40075016.686;
function metresPerPixelAt(lat, zoom) {
  return (EQUATOR_M * Math.cos((lat * Math.PI) / 180)) / (256 * Math.pow(2, zoom));
}

/**
 * Registers a map backend.
 * @param {string} name
 * @param {MapProviderImpl} provider
 */
export function registerMapProvider(name, provider) {
  if (!name || typeof provider?.create !== "function") {
    throw new Error("registerMapProvider(name, { create }): a name and a create() are required");
  }
  _providers.set(name, { requiresApiKey: false, ...provider });
}

/**
 * @param {string} name
 * @returns {MapProviderImpl|null}
 */
export function getMapProvider(name) {
  return _providers.get(name) || null;
}

/** @returns {string[]} */
export function mapProviderNames() {
  return [..._providers.keys()];
}

// ---- neutral vector style vocabulary ------------------------------------------------------------
//
// This is what makes VectorLayer provider-agnostic. The user describes a vector's look once in a
// neutral vocabulary and each provider translates it into its own SDK: Google wants `strokeWeight`
// and `strokeColor` where Leaflet wants `weight` and `color`. Without it, a page targeting both
// backends would pass two style objects and track which map is which.
//
// The neutral keys, all optional:
//   fillColor, fillOpacity, strokeColor, strokeWidth, strokeOpacity
//
// Any other key passes through untouched, so someone on one provider can hand through a native
// option, i.e. Leaflet's `dashArray`. It simply will not be portable. The neutral names buy
// portability; nothing enforces it.
//
// `style` may also be a function `({ feature, index }) => result`, run once per GeoJSON feature, so
// coloring can branch on `feature.properties`, on coordinates or on the index. The result is either
// a neutral style object, using the vocabulary above, or a bare color string, which is shorthand
// expanded to `{ fillColor, strokeColor }`. The callback sees the original GeoJSON feature and the
// same 0-based index on both providers, because each adapter maps its own SDK feature back to that
// (see addVector below and resolveFeatureStyle).
//
// Point geometry is what the path vocabulary above cannot express on either provider: a
// google.maps.Data point draws an `icon` rather than a filled path, and Leaflet's default point is
// an L.marker whose Icon.Default ignores path options too, so `fillColor` and `strokeColor` did
// nothing for points on both. Each adapter now translates the neutral style into its own circle,
// a google symbol icon or an L.circleMarker, so a styled point looks the same on either.
// `pointRadius` sizes it, in px.
/**
 * @typedef {Object} NeutralStyle
 * @property {string} [fillColor]
 * @property {number} [fillOpacity]
 * @property {string} [strokeColor]
 * @property {number} [strokeWidth]
 * @property {number} [strokeOpacity]
 * @property {number} [pointRadius] - radius in px for Point/MultiPoint features (default 6)
 */

/** Default point radius in px, shared so a point is the same size on both providers. */
export const DEFAULT_POINT_RADIUS = 6;

// A unit-radius circle as an SVG path, scaled by `pointRadius`. Written out rather than using
// google.maps.SymbolPath.CIRCLE so the translation stays pure and testable under Node, where the
// google namespace does not exist.
const UNIT_CIRCLE_PATH = "M 0,-1 A 1,1 0 1,0 0,1 A 1,1 0 1,0 0,-1 Z";

/**
 * Converts a point feature's neutral style into a `google.maps.Symbol` for
 * `Data.StyleOptions.icon`.
 * @param {NeutralStyle} [s]
 * @returns {Object} a google.maps.Symbol
 */
export function styleToGooglePoint(s = {}) {
  const { fillColor, fillOpacity, strokeColor, strokeWidth, strokeOpacity, pointRadius } = s;
  return {
    path: UNIT_CIRCLE_PATH,
    scale: pointRadius ?? DEFAULT_POINT_RADIUS,
    // A symbol defaults to fillOpacity 0, invisible, where a path does not. So a fillColor implies
    // a fully opaque fill unless an explicit opacity says otherwise.
    ...(fillColor != null ? { fillColor, fillOpacity: fillOpacity ?? 1 } : {}),
    ...(strokeColor != null ? { strokeColor } : {}),
    ...(strokeWidth != null ? { strokeWeight: strokeWidth } : {}),
    ...(strokeOpacity != null ? { strokeOpacity } : {}),
  };
}

/**
 * @param {NeutralStyle} [s]
 * @returns {Object} a `google.maps.Data` style object
 */
export function styleToGoogle(s = {}) {
  const { strokeColor, strokeWidth, strokeOpacity, fillColor, fillOpacity, pointRadius, ...rest } = s;
  void pointRadius;                                                // point-only; see styleToGooglePoint
  return {
    ...rest,                                                       // provider-native extras (icon, …)
    ...(fillColor != null ? { fillColor } : {}),
    ...(fillOpacity != null ? { fillOpacity } : {}),
    ...(strokeColor != null ? { strokeColor } : {}),
    ...(strokeWidth != null ? { strokeWeight: strokeWidth } : {}), // px width → Google's name
    ...(strokeOpacity != null ? { strokeOpacity } : {}),
  };
}
/**
 * @param {NeutralStyle} [s]
 * @returns {Object} Leaflet path options
 */
export function styleToLeaflet(s = {}) {
  const { strokeColor, strokeWidth, strokeOpacity, fillColor, fillOpacity, pointRadius, ...rest } = s;
  return {
    ...rest,                                                       // provider-native extras (dashArray, …)
    ...(fillColor != null ? { fillColor, fill: true } : {}),
    ...(fillOpacity != null ? { fillOpacity } : {}),
    ...(strokeColor != null ? { color: strokeColor } : {}),       // stroke color → Leaflet's `color`
    ...(strokeWidth != null ? { weight: strokeWidth } : {}),      // px width → Leaflet's `weight`
    ...(strokeOpacity != null ? { opacity: strokeOpacity } : {}),
    ...(pointRadius != null ? { radius: pointRadius } : {}),      // L.circleMarker's `radius`
  };
}

// The features of any accepted GeoJSON, in document order: a FeatureCollection's array, a lone
// Feature as a one-element list, or [] for a bare geometry. The addVector adapters use it to give a
// per-feature `style` callback the original feature and its index.
/**
 * @param {Object} geojson
 * @returns {Object[]}
 */
export function featuresOf(geojson) {
  if (!geojson) return [];
  if (geojson.type === "FeatureCollection") return geojson.features || [];
  if (geojson.type === "Feature") return [geojson];
  return [];
}

// Resolves `style` for one feature into a neutral style object for styleToGoogle or styleToLeaflet.
//   object          used as-is for each feature, the non-callback path
//   function        called as `({ feature, index })`, returning a neutral style object or a color
//                   string, which is shorthand for { fillColor, strokeColor }
//   nullish result  {}, so the provider styles that feature itself
/**
 * @param {NeutralStyle|((ctx: {feature: Object, index: number}) => (NeutralStyle|string|null))|null} style
 * @param {Object} feature
 * @param {number} index
 * @returns {NeutralStyle}
 */
export function resolveFeatureStyle(style, feature, index) {
  const r = typeof style === "function" ? style({ feature, index }) : style;
  if (r == null) return {};
  if (typeof r === "string") return { fillColor: r, strokeColor: r };
  return r;
}

// ---- built-in: google ---------------------------------------------------------------------------

// Defaults chosen so a bare `mount(el, { apiKey })` gives a usable map. `mapOptions` merges last
// and overrides any of them.
const GOOGLE_DEFAULTS = {
  center: { lat: 39.8097343, lng: -98.5556199 },   // continental US
  zoom: 5,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
};

// Google calls this global when the key is invalid or unauthorized. It is a Google concept, so it
// lives in this provider, and it reaches the active app's error bus as 'invalid-api-key'. Installed
// on first create(), so registering the provider touches no global.
function installGmAuthFailure() {
  if (typeof window === "undefined" || window.gm_authFailure) return;
  window.gm_authFailure = () =>
    reportError("invalid-api-key", "Google Maps rejected the API key (gm_authFailure).");
}

// The CRS the Google JS API can place an overlay in, which is WGS84 lat/lng. NAD83, EPSG:4269,
// differs from WGS84 by 1 to 2 m, below render resolution, so it is accepted as-is, matching
// geo/reproject.js where NAD83 to WGS84 does nothing. Anything else must be reprojected before a
// Layer renders it; the render precondition asks acceptsCRS (see Layer.#checkProviderCRS).
const WGS84_FAMILY = new Set(["EPSG:4326", "EPSG:4269"]);

/**
 * `create()` options for the built-in `"google"` provider.
 * @typedef {Object} GoogleCreateOptions
 * @property {string} apiKey - Google Maps JS API key (required — this provider's `requiresApiKey` is `true`).
 * @property {string} [version='weekly'] - the Maps JS API version channel.
 * @property {string[]} [libraries] - additional Maps JS API libraries to load (e.g. `['visualization']`).
 * @property {{lat: number, lng: number}} [center] - initial map center; defaults to the continental US.
 * @property {number} [zoom] - initial zoom level; defaults to `5`.
 * @property {string} [mapId] - a Google Cloud-configured Map ID (cloud-based styling / Advanced Markers).
 * @property {Object} [mapOptions] - raw `google.maps.MapOptions`, merged LAST — wins over every default/derived option above.
 */

registerMapProvider("google", {
  requiresApiKey: true,

  // A null or unknown CRS is accepted, since the engine cannot prove it wrong and many sources
  // arrive in 4326 without declaring geokeys. Only a known non-WGS84 CRS blocks the render.
  acceptsCRS: (crs) => crs == null || WGS84_FAMILY.has(String(crs).toUpperCase()),

  /**
   * @param {Element} el
   * @param {GoogleCreateOptions} [options]
   * @returns {Promise<any>} a `google.maps.Map`
   */
  async create(el, options = {}) {
    const { apiKey, version = "weekly", libraries, center, zoom, mapId, mapOptions = {} } = options;
    installGmAuthFailure();

    const Loader = await loadGoogleLoader();
    const loader = new Loader({ apiKey, version, ...(libraries ? { libraries } : {}) });
    const { Map } = await loader.importLibrary("maps");

    return new Map(el, {
      ...GOOGLE_DEFAULTS,
      ...(center != null ? { center } : {}),
      ...(zoom != null ? { zoom } : {}),
      ...(mapId != null ? { mapId } : {}),
      ...mapOptions,          // host overrides win
    });
  },

  // ---- vector rendering ----
  // VectorLayer calls these. The google.maps.Data code lives here in the adapter, so the Layer model
  // stays provider-neutral.

  /** Renders a GeoJSON FeatureCollection and returns an opaque handle the engine holds. */
  addVector(map, geojson, { style } = {}) {
    // eslint-disable-next-line no-undef
    const data = new google.maps.Data();
    const added = data.addGeoJson(geojson);   // Data.Feature[] in document order
    if (style) {
      // google.maps.Data.setStyle takes a per-feature function but passes it a Data.Feature rather
      // than the GeoJSON feature, so map it back by add order and the callback sees the original
      // properties and geometry. Always a function, even for a static style object, because the
      // geometry type decides whether the style becomes path options or a point symbol and only the
      // callback sees the type.
      const feats = featuresOf(geojson);
      const indexOf = new Map(added.map((df, i) => [df, i]));
      data.setStyle((df) => {
        const i = indexOf.get(df) ?? 0;
        const neutral = typeof style === "function" ? resolveFeatureStyle(style, feats[i], i) : style;
        const out = styleToGoogle(neutral);
        // A point draws an icon rather than a path, so translate the neutral style into a circle
        // symbol, unless a native `icon` was passed, which `rest` preserved.
        if (out.icon == null && /Point$/.test(df.getGeometry?.()?.getType?.() || "")) {
          out.icon = styleToGooglePoint(neutral);
        }
        return out;
      });
    }
    data.setMap(map);
    return data;
  },

  /** Removes a vector handle from the map. */
  removeVector(_map, handle) {
    handle?.setMap(null);
  },

  /** Fits the map to { north, south, east, west }. */
  fitBounds(map, bounds) {
    if (bounds) map.fitBounds(bounds);   // LatLngBoundsLiteral
  },

  // ---- static raster-image rendering ----
  // The engine's raster overlays already do the provider-neutral work themselves: decode the
  // GeoTIFF, color it, build a canvas and take a data URL. A provider only has to put that image
  // over the given geographic bounds. GroundOverlay does exactly that as a built-in Maps object,
  // with no OverlayView subclass and no manual draw() repositioning on pan or zoom, so this
  // simplifies the google path rather than merely accommodating Leaflet.

  /**
   * Positions a pre-rendered image, a data URL or any image URL, over bounds and returns an opaque
   * handle. Raster overlays are non-interactive by default, so the overlay does not swallow map
   * mouse events over its rectangle: the engine's dispatch attaches to the map and hit-tests layers
   * itself (PACKAGE_ROADMAP §1), so events must still fire over the raster. Pass
   * `{ interactive: true }` to give one overlay direct SDK interaction.
   */
  addRasterImage(map, dataUrl, bounds, { opacity, interactive } = {}) {
    // eslint-disable-next-line no-undef
    const overlay = new google.maps.GroundOverlay(dataUrl, bounds, { opacity: opacity ?? 1, clickable: !!interactive });
    overlay.setMap(map);
    return overlay;
  },

  /** Removes a raster-image handle from the map. */
  removeRasterImage(_map, handle) {
    handle?.setMap(null);
  },

  /** Changes a raster-image handle's opacity, from 0 to 1. */
  setRasterImageOpacity(handle, opacity) {
    handle?.setOpacity?.(opacity);
  },

  // GroundOverlay documents no way to swap its image after construction, where Leaflet has
  // ImageOverlay#setUrl. So a live repaint, i.e. switching palettes in the Layer Settings panel,
  // means removing and recreating it here. Use the returned handle from then on, not the one passed
  // in, which is why this returns a handle rather than mutating in place.
  /** Swaps a raster-image handle's image. Returns the handle to use next. */
  setRasterImageUrl(map, handle, dataUrl, bounds, { opacity, interactive } = {}) {
    handle?.setMap(null);
    // Keep the same interactivity across the repaint; addRasterImage defaults to non-interactive.
    // eslint-disable-next-line no-undef
    const next = new google.maps.GroundOverlay(dataUrl, bounds, { opacity: opacity ?? 1, clickable: !!interactive });
    next.setMap(map);
    return next;
  },

  // ---- map mouse-move (hover-value readouts) ----

  /**
   * Subscribes to mouse-move on the map, normalized to `{lat, lng}`.
   * @returns {() => void} an unsubscribe function
   */
  onMapMouseMove(map, cb) {
    // eslint-disable-next-line no-undef
    const listener = google.maps.event.addListener(map, "mousemove", (e) =>
      cb({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
    // eslint-disable-next-line no-undef
    return () => google.maps.event.removeListener(listener);
  },

  /**
   * Turns pan-by-drag on or off. Without it, freehand and brush selection are unusable: the gesture
   * that traces the stroke also pans the map, so the stroke is drawn against a moving projection and
   * ends up far from where the user drew it.
   * @param {any} map @param {boolean} on
   */
  setDraggable(map, on) { map?.setOptions?.({ draggable: !!on }); },

  /**
   * What one screen pixel covers on the ground right now, with the map's pixel size. A tool sizes
   * itself in screen units from these, i.e. a brush that keeps its width as the user zooms, without
   * touching a map SDK.
   * @param {any} map @returns {{metresPerPixel: number, width: number, height: number}|null}
   */
  viewMetrics(map) {
    const zoom = map?.getZoom?.(), center = map?.getCenter?.();
    if (zoom == null || !center) return null;
    const div = map.getDiv?.();
    return {
      metresPerPixel: metresPerPixelAt(center.lat(), zoom),
      width: div?.offsetWidth ?? 0,
      height: div?.offsetHeight ?? 0,
    };
  },

  /** @returns {Promise<void>} resolves once the camera has settled. */
  whenIdle(map, { timeout = 400 } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // eslint-disable-next-line no-undef
        google.maps.event.removeListener(listener);
        resolve();
      };
      // eslint-disable-next-line no-undef
      const listener = google.maps.event.addListenerOnce(map, "idle", finish);
      // 'idle' does not fire for a map that is already idle, so the timer is what makes this always
      // safe to await. Without it, `await whenIdle()` on a still map would hang.
      const timer = setTimeout(finish, timeout);
    });
  },

  /**
   * Restacks overlays to match `handles`, ordered bottom to top, and returns them. Some may have
   * been replaced, as described below, so use the returned array from then on.
   *
   * Google's `GroundOverlay` exposes no z-index at all: its constructor takes only
   * `{ opacity, clickable, map }` and offers no public reorder. So restacking a raster means
   * removing and re-adding it in order, which is why the handle changes. That costs a flicker and an
   * image re-fetch per reorder. The alternative, replacing GroundOverlay with an OverlayView whose
   * DOM node this file owns, would rewrite the working raster path on the least-tested provider.
   * Both sit behind this one method, so that upgrade stays available without changing any call site.
   *
   * Known limit: `google.maps.Data` vectors always draw above ground overlays in Google's stacking,
   * and putting a raster over a vector would mean setting every feature's `zIndex` and overwriting
   * the host's own style function. So on Google a raster never goes over a vector: rasters restack
   * among themselves and vectors stay on top.
   */
  applyLayerOrder(map, handles = []) {
    const rasters = handles.filter((h) => h && typeof h.getUrl === "function");
    return handles.map((h) => {
      if (!rasters.includes(h)) return h;               // vectors: nothing to do (see the limit above)
      const url = h.getUrl(), bounds = h.getBounds();
      const opacity = h.get?.("opacity") ?? 1;
      const clickable = !!h.get?.("clickable");
      h.setMap(null);
      // eslint-disable-next-line no-undef
      const next = new google.maps.GroundOverlay(url, bounds, { opacity, clickable });
      next.setMap(map);
      return next;
    });
  },

  // ---- normalized map events (PACKAGE_ROADMAP §1) ----
  /**
   * Subscribes to a normalized map event. `type` is one of click, hover, dblclick, mousedown,
   * mouseup or rightclick. The callback receives `{ type, lat, lng, originalEvent }`, where
   * originalEvent is the DOM MouseEvent, for a UI that positions itself at the pointer. `hover`
   * becomes Google's `mousemove`.
   * @returns {() => void} an unsubscribe function
   */
  onMapEvent(map, type, cb) {
    const name = type === "hover" ? "mousemove" : type === "contextmenu" ? "rightclick" : type;
    // eslint-disable-next-line no-undef
    const listener = google.maps.event.addListener(map, name, (e) => {
      if (!e?.latLng) return;
      cb({ type, lat: e.latLng.lat(), lng: e.latLng.lng(), originalEvent: e.domEvent || null });
    });
    // eslint-disable-next-line no-undef
    return () => google.maps.event.removeListener(listener);
  },
});

// ---- built-in: leaflet --------------------------------------------------------------------------

// Leaflet is a real dependency, imported dynamically inside create(), so a google-only app never
// downloads it: webpack splits it into its own async chunk. Node tests importing this module do not
// trigger it either.
//
// requiresApiKey is false, which is why apiKey belongs to the provider rather than to config.
//
// Implements the same map, vector and static raster-image methods the google provider does. The
// note at the top of this file lists what stays Google-only.
//
// Leaflet needs leaflet.css for correct tile and marker layout. In a bundler, add
// `import "leaflet/dist/leaflet.css"`; in a raw-browser page, add a <link>. This provider injects no
// stylesheet, so no CDN URL is baked into the library.
const LEAFLET_DEFAULTS = {
  center: { lat: 39.8097343, lng: -98.5556199 },
  zoom: 5,
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileOptions: { attribution: "© OpenStreetMap contributors" },
};

// `import("leaflet")` returns the same module every time, so create() stores it here and the
// synchronous vector methods below need not await the import. A map is always created before any
// addVector, so this is set by the time they run.
let _leaflet = null;

/**
 * `create()` options for the built-in `"leaflet"` provider.
 * @typedef {Object} LeafletCreateOptions
 * @property {{lat: number, lng: number}} [center] - initial map center; defaults to the continental US.
 * @property {number} [zoom] - initial zoom level; defaults to `5`.
 * @property {string|null} [tileUrl] - basemap tile URL template; pass `null` to opt out of the default
 *   OpenStreetMap tile layer, i.e. to add your own with `L.tileLayer`.
 * @property {Object} [tileOptions] - options passed to `L.tileLayer` (e.g. `attribution`).
 * @property {Object} [mapOptions] - raw Leaflet `L.Map` options, passed straight to `L.map(el, mapOptions)`.
 */

registerMapProvider("leaflet", {
  requiresApiKey: false,

  // L.imageOverlay and L.geoJSON position content by lat/lng, so Leaflet renders the same WGS84
  // family google does. Reprojected basemaps in another CRS are a separate matter.
  acceptsCRS: (crs) => crs == null || WGS84_FAMILY.has(String(crs).toUpperCase()),

  /**
   * @param {Element} el
   * @param {LeafletCreateOptions} [options]
   * @returns {Promise<any>} an `L.Map` instance
   */
  async create(el, options = {}) {
    // Leaflet needs its own CSS, where google.maps' script Loader pulls its own in, so a host would
    // otherwise have to remember a <link> tag. Imported dynamically alongside the JS for the same
    // reason: a google-only app downloads neither. webpack's style-loader, configured in this
    // package's build, injects it as a bundled <style> tag on first evaluation, so there is no CDN
    // request and no separate asset. ES module caching makes a second create() a no-op re-import
    // rather than a duplicate injection.
    await import("leaflet/dist/leaflet.css");
    const ns = await import("leaflet");
    const L = (_leaflet = ns.default ?? ns);

    const center = options.center ?? LEAFLET_DEFAULTS.center;
    const zoom = options.zoom ?? LEAFLET_DEFAULTS.zoom;

    const map = L.map(el, options.mapOptions || {}).setView([center.lat, center.lng], zoom);

    // A basemap tile layer, unless the host passes `tileUrl: null` to add its own.
    const tileUrl = options.tileUrl !== undefined ? options.tileUrl : LEAFLET_DEFAULTS.tileUrl;
    if (tileUrl) {
      L.tileLayer(tileUrl, options.tileOptions || LEAFLET_DEFAULTS.tileOptions).addTo(map);
    }
    return map;
  },

  // ---- vector rendering: the same methods the google provider implements ----
  // VectorLayer calls these without knowing which provider it is on, and the neutral style becomes
  // Leaflet path options here. One Layer and one style vocabulary work on any provider implementing
  // addVector, removeVector and fitBounds.

  /** Renders a GeoJSON FeatureCollection through L.geoJSON and returns the handle. */
  addVector(map, geojson, { style } = {}) {
    const L = _leaflet;
    if (!L) throw new Error("leaflet provider: addVector called before a leaflet map was created");
    // L.geoJSON's style callback receives the GeoJSON feature but no index, so recover it from a
    // lookup map. L.geoJSON keeps the original feature object as layer.feature.
    const indexOf = typeof style === "function"
      ? new Map(featuresOf(geojson).map((f, i) => [f, i]))
      : null;
    const neutralFor = (feature) => (typeof style === "function"
      ? resolveFeatureStyle(style, feature, indexOf.get(feature) ?? 0)
      : (style || {}));

    const opts = {
      // Leaflet's default for a Point is L.marker with Icon.Default, which resolves its PNGs from
      // the URL of a `<script src=".../leaflet.js">` tag. This package bundles Leaflet, so that tag
      // never exists, Icon.Default falls back to a page-relative `images/marker-icon.png`, and each
      // point renders as a broken image. A circleMarker needs no asset and reads the neutral style
      // vocabulary an icon marker ignores, giving the same circle google draws above.
      pointToLayer: (feature, latlng) => {
        const s = neutralFor(feature);
        return L.circleMarker(latlng, { radius: DEFAULT_POINT_RADIUS, ...styleToLeaflet(s) });
      },
    };
    if (style) opts.style = (feature) => styleToLeaflet(neutralFor(feature));   // neutral vocab → L path opts
    const layer = L.geoJSON(geojson, opts);
    layer.addTo(map);
    return layer;
  },

  /** Tear a vector handle down. */
  removeVector(map, handle) {
    if (handle?.remove) handle.remove();            // L.Layer#remove() detaches from its map
    else if (handle) map.removeLayer(handle);
  },

  /** Fits the map to { north, south, east, west }. Leaflet takes [[south,west],[north,east]]. */
  fitBounds(map, bounds) {
    if (!bounds) return;
    map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]]);
  },

  // ---- static raster-image rendering: the same methods the google provider implements ----

  /** Positions a pre-rendered image over bounds through L.imageOverlay and returns the handle.
   * Non-interactive by default, since the engine dispatch hit-tests map events; opt in with
   * { interactive }. */
  addRasterImage(map, dataUrl, bounds, { opacity, interactive } = {}) {
    const L = _leaflet;
    if (!L) throw new Error("leaflet provider: addRasterImage called before a leaflet map was created");
    const overlay = L.imageOverlay(dataUrl,
      [[bounds.south, bounds.west], [bounds.north, bounds.east]], { opacity: opacity ?? 1, interactive: !!interactive });
    overlay.addTo(map);
    return overlay;
  },

  /** Tear a raster-image handle down. */
  removeRasterImage(map, handle) {
    if (handle?.remove) handle.remove();
    else if (handle) map.removeLayer(handle);
  },

  /** Change a raster-image handle's opacity (0..1). */
  setRasterImageOpacity(handle, opacity) {
    handle?.setOpacity?.(opacity);
  },

  // L.ImageOverlay#setUrl swaps the image in place, with no remove and recreate. It still returns
  // the handle, the same one, matching the google provider's signature so a call site never has to
  // know which provider it is on.
  /** Swap a raster-image handle's image (e.g. a palette repaint). Returns the handle to use next. */
  setRasterImageUrl(_map, handle, dataUrl, _bounds, { opacity } = {}) {
    handle?.setUrl?.(dataUrl);
    if (opacity != null) handle?.setOpacity?.(opacity);
    return handle;
  },

  // ---- map mouse-move for hover readouts: the same method the google provider implements ----

  /**
   * @returns {() => void} an unsubscribe function
   */
  onMapMouseMove(map, cb) {
    const handler = (e) => cb({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on("mousemove", handler);
    return () => map.off("mousemove", handler);
  },

  /**
   * Turns pan-by-drag on or off, as the google provider does and for the same reason: a freehand
   * stroke and a map pan are the same gesture, so one has to be suppressed.
   * @param {any} map @param {boolean} on
   */
  setDraggable(map, on) { if (on) map?.dragging?.enable?.(); else map?.dragging?.disable?.(); },

  /**
   * Ground meters per screen pixel with the map's pixel size, as the google provider returns, read
   * from Leaflet's own accessors.
   * @param {any} map @returns {{metresPerPixel: number, width: number, height: number}|null}
   */
  viewMetrics(map) {
    const zoom = map?.getZoom?.(), center = map?.getCenter?.();
    if (zoom == null || !center) return null;
    const size = map.getSize?.();
    return {
      metresPerPixel: metresPerPixelAt(center.lat, zoom),
      width: size?.x ?? 0,
      height: size?.y ?? 0,
    };
  },

  /** @returns {Promise<void>} resolves once the camera has settled. */
  whenIdle(map, { timeout = 400 } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        map.off("moveend", finish);
        map.off("zoomend", finish);
        resolve();
      };
      map.on("moveend", finish);
      map.on("zoomend", finish);
      // Neither event fires for a map that is already still, so the timer is what makes this always
      // safe to await. It also caps the wait when an animation is interrupted.
      const timer = setTimeout(finish, timeout);
    });
  },

  /**
   * Restacks overlays to match `handles`, ordered bottom to top, and returns the same handles.
   * Nothing is recreated here, unlike on Google.
   *
   * `bringToFront()` exists on both handle types, `L.ImageOverlay` and `L.GeoJSON` through
   * `L.FeatureGroup`, and calling it over the list in order leaves the last one on top. That beats
   * assigning z-indices, because Leaflet has no z-index for vector paths at all, only pane-relative
   * DOM order, so a `setZIndex`-shaped method would be misleading.
   */
  applyLayerOrder(map, handles = []) {
    for (const h of handles) h?.bringToFront?.();
    return handles;
  },

  // ---- normalized map events: the same method the google provider implements ----
  /**
   * @returns {() => void} an unsubscribe function
   */
  onMapEvent(map, type, cb) {
    const name = type === "hover" ? "mousemove" : type === "rightclick" ? "contextmenu" : type;
    const handler = (e) =>
      cb({ type, lat: e.latlng.lat, lng: e.latlng.lng, originalEvent: e.originalEvent || null });
    map.on(name, handler);
    return () => map.off(name, handler);
  },
});

// ---- the entry point ----------------------------------------------------------------------------

/**
 * Creates a map in `el` using the configured provider.
 *
 * @param {Element} el
 * @param {object}  options  { provider?, apiKey?, center?, zoom?, mapId?, mapOptions?, version?, libraries? }
 * @returns {Promise<any>} the provider's map object
 */
export async function createMap(el, options = {}) {
  const name = options.provider;
  if (!name) {
    throw fimError("config-invalid",
      "FimViz: a map provider is required — pass provider: 'leaflet' (no API key) or " +
      `provider: 'google' (with an apiKey). Registered: ${mapProviderNames().join(", ") || "(none)"}.`);
  }
  const provider = getMapProvider(name);
  if (!provider) {
    throw fimError("config-invalid",
      `FimViz: unknown map provider "${name}". Registered: ${mapProviderNames().join(", ") || "(none)"}. ` +
      "Add one with registerMapProvider(name, { create }).");
  }
  if (provider.requiresApiKey && !options.apiKey) {
    throw fimError("config-invalid",
      `FimViz: the "${name}" map provider requires an apiKey (pass options.apiKey to mount()).`);
  }
  if (!el) {
    throw fimError("config-invalid", "FimViz: no element to create the map in.");
  }
  return provider.create(el, options);
}

/** True when the named provider needs an apiKey. mount() checks config with it before booting. */
export function providerRequiresApiKey(name = DEFAULT_PROVIDER) {
  return !!getMapProvider(name)?.requiresApiKey;
}

/**
 * True when the named provider can render content in `crs`. The Layer render precondition asks
 * before drawing, so a non-WGS84 raster raises a clear "reproject first" error rather than showing
 * a blank overlay. A provider declaring no `acceptsCRS` accepts anything.
 * @param {string} name @param {string|null} crs @returns {boolean}
 */
export function providerAcceptsCRS(name = DEFAULT_PROVIDER, crs = null) {
  const provider = getMapProvider(name);
  return typeof provider?.acceptsCRS === "function" ? provider.acceptsCRS(crs) : true;
}
