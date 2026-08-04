// mapProvider.js — creating the underlying map. The one place the engine constructs one.
//
// WHY THIS EXISTS: booting a map ("load the SDK, make a Map centred here at this zoom") is generic
// engine work — the genuinely app-specific part is the WIDGET (panels, layer controllers, custom
// styling), not the map. Delegating boot wholesale to the host would force every consumer, even one
// that only wants a plain map, to import the Maps Loader and hand the result back.
//
// So: `mount()` boots a map by itself, and `registerRuntime()` is an override for a host that needs
// to control boot (because it wires a whole widget around the map).
//
// PROVIDER SEAM: `provider` is a registry, not a hardcoded branch, so a second backend can be added
// without changing the mount contract or any caller's option shape. `requiresApiKey` is a property
// of the PROVIDER — Google needs one, Leaflet does not — so mount() demands an apiKey only when the
// selected provider declares it.
//
// ⚠️ SCOPE: a provider covers the MAP, the VECTOR tier (addVector/removeVector/fitBounds — both
// google and leaflet implement them, so `fim.addLayer('vector', …)` works on either), the STATIC
// RASTER-IMAGE tier (addRasterImage/removeRasterImage/setRasterImageOpacity/setRasterImageUrl — one
// pre-rendered image positioned over geographic bounds, swappable for live repaint), and map
// mouse-move (onMapMouseMove, normalized to `{lat,lng}` — hover-value readouts). What a non-Google
// provider still does NOT get: velocity's continuously-animated canvas (its own viewport-driven
// repaint loop, not a static image), a host's raster Layer-Settings draw/measurement tool
// (polyline/polygon drawing + area/distance math, built directly on
// `google.maps.event`/`getProjection()` — a bespoke tool, same class of work as the next item), the
// comparison draw-mask tool, `AdvancedMarkerElement` HAZUS damage markers, and `FloodDepthLayer`'s
// ArcGIS MapServer tile integration (a whole vendored Google-only library). Each of those needs its
// own per-provider work — see docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §2.1.

import { fimError, reportError } from "./events.js";

// @googlemaps/js-api-loader is a dual-package hazard — webpack resolves it as ESM (named `Loader`),
// node resolves the CJS build (no named export). A STATIC import forces one shape and breaks the
// other. Loading it lazily inside the google provider's create() sidesteps that entirely: the
// dynamic-import namespace works in both resolvers, and node tests that import this module never
// try to resolve the loader at all (they register a fake provider instead).
async function loadGoogleLoader() {
  const ns = await import("@googlemaps/js-api-loader");
  return ns.Loader ?? ns.default?.Loader ?? ns.default;
}

const _providers = new Map();

/**
 * The contract a map backend must implement to register via `registerMapProvider(name, impl)`. Every
 * method except `create` has the IDENTICAL parameter shape on every built-in provider — that
 * uniformity is the whole point of the seam: `VectorLayer`/`RasterLayer`/the engine's event dispatch
 * call these without knowing which provider is underneath. `create()`'s `options` is the one
 * PROVIDER-SPECIFIC piece — see `GoogleCreateOptions`/`LeafletCreateOptions`.
 * @typedef {Object} MapProviderImpl
 * @property {boolean} [requiresApiKey] - does `create()` need `options.apiKey`? (google: true, leaflet: false)
 * @property {(crs: string|null) => boolean} [acceptsCRS] - can this provider render content in `crs`?
 *   Asked by `Layer`'s render precondition before drawing. Omitted = permissive (accepts anything).
 * @property {(el: Element, options: (GoogleCreateOptions|LeafletCreateOptions)) => Promise<any>} create -
 *   build the map in `el`; returns the provider's native map object (exposed as `fim.map`).
 * @property {(map: any, geojson: Object, opts?: { style?: (NeutralStyle|string|((ctx: {feature: Object, index: number}) => (NeutralStyle|string|null))) }) => any} addVector -
 *   render a GeoJSON FeatureCollection/Feature onto `map`; returns an opaque vector handle.
 * @property {(map: any, handle: any) => void} removeVector - tear a vector handle down.
 * @property {(map: any, bounds: {north: number, south: number, east: number, west: number}) => void} fitBounds -
 *   fit the map's viewport to `bounds`.
 * @property {(map: any, dataUrl: string, bounds: {north: number, south: number, east: number, west: number}, opts?: { opacity?: number, interactive?: boolean }) => any} addRasterImage -
 *   position a pre-rendered image (data URL or any image URL) over `bounds`; returns an opaque
 *   raster-image handle. Non-interactive (`clickable:false`) by default so map events pass through to
 *   the engine's own hit-testing; pass `{ interactive: true }` to opt this overlay into direct SDK
 *   interaction.
 * @property {(map: any, handle: any) => void} removeRasterImage - tear a raster-image handle down.
 * @property {(handle: any, opacity: number) => void} setRasterImageOpacity -
 *   change a raster-image handle's opacity (0..1).
 * @property {(map: any, handle: any, dataUrl: string, bounds: {north: number, south: number, east: number, west: number}, opts?: { opacity?: number, interactive?: boolean }) => any} setRasterImageUrl -
 *   swap a raster-image handle's image (e.g. a palette repaint). The caller MUST use the RETURNED
 *   handle going forward — some providers (google) cannot swap the image in place and recreate the
 *   overlay instead.
 * @property {(map: any, cb: (pt: {lat: number, lng: number}) => void) => (() => void)} onMapMouseMove -
 *   subscribe to mouse-move on the map, normalized to `{lat, lng}`; returns an unsubscribe function.
 * @property {(map: any, type: ('click'|'hover'|'dblclick'|'mousedown'|'mouseup'|'rightclick'), cb: (evt: {type: string, lat: number, lng: number, originalEvent: (MouseEvent|null)}) => void) => (() => void)} onMapEvent -
 *   subscribe to a normalized map event; returns an unsubscribe function. `hover` maps to the
 *   provider's mousemove equivalent.
 */

/**
 * Register a map backend.
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
// THIS is what makes VectorLayer provider-agnostic. A consumer describes a vector's look ONCE, in a
// neutral vocabulary, and each provider translates it to its own SDK — Google wants `strokeWeight`,
// Leaflet wants `weight`; Google `strokeColor`, Leaflet `color`. Without this, a page targeting both
// backends would have to pass two different style objects and know which map is which.
//
// Neutral keys (all optional):
//   fillColor, fillOpacity, strokeColor, strokeWidth, strokeOpacity
//
// Any OTHER key is passed through untouched, so a single-provider power user can still hand a
// provider-native option (e.g. Google's `icon`, Leaflet's `dashArray`) straight through — it simply
// won't be portable. Portability is opt-in via the neutral names, not enforced.
//
// PER-FEATURE STYLING: `style` may also be a FUNCTION `({ feature, index }) => result`, evaluated
// once per GeoJSON feature so colouring can branch on `feature.properties`, coordinates, or the
// feature's `index`. Its `result` is either a neutral style OBJECT (same vocabulary as above) or a
// bare colour STRING — the "graded colour" shorthand, expanded to `{ fillColor, strokeColor }`. The
// callback sees the ORIGINAL GeoJSON feature and the same 0-based index on EVERY provider; each
// adapter maps its own SDK feature back to that (see addVector below). See resolveFeatureStyle.
/**
 * @typedef {Object} NeutralStyle
 * @property {string} [fillColor]
 * @property {number} [fillOpacity]
 * @property {string} [strokeColor]
 * @property {number} [strokeWidth]
 * @property {number} [strokeOpacity]
 */
/**
 * @param {NeutralStyle} [s]
 * @returns {Object} a `google.maps.Data` style object
 */
export function styleToGoogle(s = {}) {
  const { strokeColor, strokeWidth, strokeOpacity, fillColor, fillOpacity, ...rest } = s;
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
  const { strokeColor, strokeWidth, strokeOpacity, fillColor, fillOpacity, ...rest } = s;
  return {
    ...rest,                                                       // provider-native extras (dashArray, …)
    ...(fillColor != null ? { fillColor, fill: true } : {}),
    ...(fillOpacity != null ? { fillOpacity } : {}),
    ...(strokeColor != null ? { color: strokeColor } : {}),       // stroke color → Leaflet's `color`
    ...(strokeWidth != null ? { weight: strokeWidth } : {}),      // px width → Leaflet's `weight`
    ...(strokeOpacity != null ? { opacity: strokeOpacity } : {}),
  };
}

// The features of any accepted GeoJSON, in document order — a FeatureCollection's array, a lone
// Feature wrapped as a one-element list, or [] for a bare geometry. The addVector adapters use this
// to give a per-feature `style` callback the ORIGINAL feature + its index.
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

// Resolve `style` for ONE feature into a neutral style object, ready for styleToGoogle/styleToLeaflet.
//   • object   → used as-is for every feature (the non-callback path).
//   • function → called `({ feature, index })`; may return a neutral style OBJECT, or a colour
//                STRING (the graded-colour shorthand → { fillColor, strokeColor }).
//   • nullish result → {} (provider default styling for that feature).
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

// Defaults chosen so a bare `mount(el, { apiKey })` yields a usable map. Each is overridable via
// `mapOptions`, which is merged last and wins.
const GOOGLE_DEFAULTS = {
  center: { lat: 39.8097343, lng: -98.5556199 },   // continental US
  zoom: 5,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
};

// Google invokes this global when the key is invalid/unauthorized. Owned by THIS provider (it is a
// Google concept), routed to the active app's error bus as a typed 'invalid-api-key'. Installed
// lazily on first create() so registering the provider has no global side effect.
function installGmAuthFailure() {
  if (typeof window === "undefined" || window.gm_authFailure) return;
  window.gm_authFailure = () =>
    reportError("invalid-api-key", "Google Maps rejected the API key (gm_authFailure).");
}

// CRS the Google JS API can place an overlay in: it works in WGS84 lat/lng. NAD83 (EPSG:4269) differs
// from WGS84 by ~1-2 m — below render resolution — so it is accepted as-is (matches geo/reproject.js's
// NAD83→WGS84 no-op). Anything else must be reprojected before a Layer can render it (the render
// precondition asks acceptsCRS; see Layer.#checkProviderCRS).
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

  // A null/unknown CRS is treated as acceptable (best-effort) — the engine can't prove it wrong, and
  // many sources arrive already in 4326 without declaring geokeys. Only a KNOWN non-WGS84 CRS blocks.
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

  // ---- vector rendering (the first slice of the overlay contract) ----
  // The engine's VectorLayer calls these; provider-specific SDK code (google.maps.Data) lives
  // HERE, in the google adapter, so the Layer model itself stays provider-neutral.

  /** Render a GeoJSON FeatureCollection → an opaque handle the engine holds. */
  addVector(map, geojson, { style } = {}) {
    // eslint-disable-next-line no-undef
    const data = new google.maps.Data();
    const added = data.addGeoJson(geojson);   // Data.Feature[] in document order
    if (typeof style === "function") {
      // google.maps.Data.setStyle accepts a per-feature function, but hands it a Data.Feature — not
      // the GeoJSON feature. Map it back by add order so the callback sees feature.properties/geometry.
      const feats = featuresOf(geojson);
      const indexOf = new Map(added.map((df, i) => [df, i]));
      data.setStyle((df) => {
        const i = indexOf.get(df) ?? 0;
        return styleToGoogle(resolveFeatureStyle(style, feats[i], i));
      });
    } else if (style) {
      data.setStyle(styleToGoogle(style));   // neutral vocab → google.maps.Data style
    }
    data.setMap(map);
    return data;
  },

  /** Tear a vector handle down. */
  removeVector(_map, handle) {
    handle?.setMap(null);
  },

  /** Fit the map to { north, south, east, west }. */
  fitBounds(map, bounds) {
    if (bounds) map.fitBounds(bounds);   // LatLngBoundsLiteral
  },

  // ---- static raster-image rendering ----
  // The engine's raster overlays (flood extent, depth, ensemble, …) already do 100% of the
  // provider-neutral work themselves — decode the GeoTIFF, colour it, build a canvas, get a data
  // URL — so all a provider needs is "put this image over these geographic bounds." GroundOverlay
  // does that as a first-class Maps object (no custom OverlayView subclass, no manual draw()
  // repositioning on pan/zoom — it handles that internally), which is what makes this a genuine
  // simplification of the google path too, not just a Leaflet compatibility shim.

  /**
   * Position a pre-rendered image (data URL or any image URL) over bounds → an opaque handle.
   * Raster overlays default NON-INTERACTIVE (`clickable:false`) so the overlay does not swallow map
   * mouse events over its rectangle — the engine's event dispatch attaches to the MAP and hit-tests
   * layers itself (PACKAGE_ROADMAP §1), so it must still fire over the raster. Pass `{ interactive:
   * true }` to opt a specific overlay INTO direct SDK interaction.
   */
  addRasterImage(map, dataUrl, bounds, { opacity, interactive } = {}) {
    // eslint-disable-next-line no-undef
    const overlay = new google.maps.GroundOverlay(dataUrl, bounds, { opacity: opacity ?? 1, clickable: !!interactive });
    overlay.setMap(map);
    return overlay;
  },

  /** Tear a raster-image handle down. */
  removeRasterImage(_map, handle) {
    handle?.setMap(null);
  },

  /** Change a raster-image handle's opacity (0..1). */
  setRasterImageOpacity(handle, opacity) {
    handle?.setOpacity?.(opacity);
  },

  // GroundOverlay has no documented way to swap its image after construction (unlike Leaflet's
  // ImageOverlay#setUrl) — so a live repaint (e.g. switching palettes in the Layer Settings panel)
  // means remove-and-recreate here. Callers must use the RETURNED handle going forward, not the one
  // they passed in — this is exactly why the contract returns a handle instead of mutating in place.
  /** Swap a raster-image handle's image (e.g. a palette repaint). Returns the handle to use next. */
  setRasterImageUrl(map, handle, dataUrl, bounds, { opacity, interactive } = {}) {
    handle?.setMap(null);
    // Keep the same interactivity across the repaint — see addRasterImage (default non-interactive).
    // eslint-disable-next-line no-undef
    const next = new google.maps.GroundOverlay(dataUrl, bounds, { opacity: opacity ?? 1, clickable: !!interactive });
    next.setMap(map);
    return next;
  },

  // ---- map mouse-move (hover-value readouts) ----

  /**
   * Subscribe to mouse-move on the map, normalized to `{lat, lng}`.
   * @returns {() => void} an unsubscribe function
   */
  onMapMouseMove(map, cb) {
    // eslint-disable-next-line no-undef
    const listener = google.maps.event.addListener(map, "mousemove", (e) =>
      cb({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
    // eslint-disable-next-line no-undef
    return () => google.maps.event.removeListener(listener);
  },

  // ---- generalized map events (the event-dispatch first slice — PACKAGE_ROADMAP §1) ----
  /**
   * Subscribe to a normalized map event. `type` ∈ click/hover/dblclick/mousedown/mouseup/rightclick;
   * the callback gets `{ type, lat, lng, originalEvent }` (originalEvent = the DOM MouseEvent, for a
   * UI that positions at the pointer). `hover` maps to Google's `mousemove`.
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

// Leaflet is a real dependency but lazy-loaded (dynamic import inside create()), so a google-only
// consumer never downloads it — webpack code-splits it into its own async chunk. Node tests that
// import this module do not trigger it either.
//
// requiresApiKey is false — this is the whole reason apiKey is a per-provider property.
//
// Implements the same MAP + VECTOR + static RASTER-IMAGE contract as the google provider (see the
// scope note at the top of this file for what's still Google-only: animated velocity, the
// comparison draw tool, damage markers, ArcGIS depth tiles).
//
// CSS: Leaflet needs leaflet.css for correct tile/marker layout. In a bundler, add
// `import "leaflet/dist/leaflet.css"`; in a raw-browser page, add a <link> to it. The provider does
// not inject a stylesheet, to avoid baking a CDN URL into the library.
const LEAFLET_DEFAULTS = {
  center: { lat: 39.8097343, lng: -98.5556199 },
  zoom: 5,
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileOptions: { attribution: "© OpenStreetMap contributors" },
};

// Leaflet is a singleton library — `import("leaflet")` returns the same module every time. create()
// stashes it here so the (synchronous) vector-contract methods below don't each have to await the
// import. A map must be created before any addVector, so this is always set by the time they run.
let _leaflet = null;

/**
 * `create()` options for the built-in `"leaflet"` provider.
 * @typedef {Object} LeafletCreateOptions
 * @property {{lat: number, lng: number}} [center] - initial map center; defaults to the continental US.
 * @property {number} [zoom] - initial zoom level; defaults to `5`.
 * @property {string|null} [tileUrl] - basemap tile URL template; pass `null` to opt out of the default
 *   OpenStreetMap tile layer (e.g. to add your own via `L.tileLayer`).
 * @property {Object} [tileOptions] - options passed to `L.tileLayer` (e.g. `attribution`).
 * @property {Object} [mapOptions] - raw Leaflet `L.Map` options, passed straight to `L.map(el, mapOptions)`.
 */

registerMapProvider("leaflet", {
  requiresApiKey: false,

  // L.imageOverlay/L.geoJSON position content by lat/lng, so Leaflet renders the same WGS84 family as
  // google (a documented small subset — reprojected basemaps in other CRS are a separate concern).
  acceptsCRS: (crs) => crs == null || WGS84_FAMILY.has(String(crs).toUpperCase()),

  /**
   * @param {Element} el
   * @param {LeafletCreateOptions} [options]
   * @returns {Promise<any>} an `L.Map` instance
   */
  async create(el, options = {}) {
    // Leaflet needs its own CSS (unlike google.maps, which the script Loader pulls in for you) — a
    // host would otherwise have to remember a manual <link> tag. Dynamic-imported alongside the JS, same
    // laziness rationale (a google-only consumer downloads neither); webpack's style-loader
    // (configured in this package's build) injects it as a real bundled <style>
    // tag on first evaluation — no CDN request, no separate asset, and ES module caching means a
    // second create() call is a no-op re-import, not a duplicate injection.
    await import("leaflet/dist/leaflet.css");
    const ns = await import("leaflet");
    const L = (_leaflet = ns.default ?? ns);

    const center = options.center ?? LEAFLET_DEFAULTS.center;
    const zoom = options.zoom ?? LEAFLET_DEFAULTS.zoom;

    const map = L.map(el, options.mapOptions || {}).setView([center.lat, center.lng], zoom);

    // A basemap tile layer, unless the host opts out with `tileUrl: null` (e.g. to add its own).
    const tileUrl = options.tileUrl !== undefined ? options.tileUrl : LEAFLET_DEFAULTS.tileUrl;
    if (tileUrl) {
      L.tileLayer(tileUrl, options.tileOptions || LEAFLET_DEFAULTS.tileOptions).addTo(map);
    }
    return map;
  },

  // ---- vector rendering: the SAME contract the google provider implements ----
  // VectorLayer calls these without knowing which provider it is on; the neutral style is
  // translated to Leaflet path options here. This is the whole point of the seam — one Layer, one
  // style vocabulary, any provider that implements addVector/removeVector/fitBounds.

  /** Render a GeoJSON FeatureCollection via L.geoJSON → the layer handle the engine holds. */
  addVector(map, geojson, { style } = {}) {
    const L = _leaflet;
    if (!L) throw new Error("leaflet provider: addVector called before a leaflet map was created");
    let opts = {};
    if (typeof style === "function") {
      // L.geoJSON's style callback gets the GeoJSON feature but no index; recover it from a
      // reference map (L.geoJSON keeps the original feature object as layer.feature).
      const indexOf = new Map(featuresOf(geojson).map((f, i) => [f, i]));
      opts = { style: (feature) => styleToLeaflet(resolveFeatureStyle(style, feature, indexOf.get(feature) ?? 0)) };
    } else if (style) {
      opts = { style: () => styleToLeaflet(style) };   // neutral vocab → L path opts
    }
    const layer = L.geoJSON(geojson, opts);
    layer.addTo(map);
    return layer;
  },

  /** Tear a vector handle down. */
  removeVector(map, handle) {
    if (handle?.remove) handle.remove();            // L.Layer#remove() detaches from its map
    else if (handle) map.removeLayer(handle);
  },

  /** Fit the map to { north, south, east, west }. Leaflet wants [[south,west],[north,east]]. */
  fitBounds(map, bounds) {
    if (!bounds) return;
    map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]]);
  },

  // ---- static raster-image rendering: the SAME contract the google provider implements ----

  /** Position a pre-rendered image over bounds via L.imageOverlay → the handle the engine holds.
   * Non-interactive by default (the engine dispatch hit-tests on map events); opt in with { interactive }. */
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

  // L.ImageOverlay#setUrl swaps the image in place — cheap, no remove/recreate needed. Still
  // returns the handle (same one), matching the google provider's contract shape so callers never
  // need to know which provider they're on.
  /** Swap a raster-image handle's image (e.g. a palette repaint). Returns the handle to use next. */
  setRasterImageUrl(_map, handle, dataUrl, _bounds, { opacity } = {}) {
    handle?.setUrl?.(dataUrl);
    if (opacity != null) handle?.setOpacity?.(opacity);
    return handle;
  },

  // ---- map mouse-move (hover-value readouts): the SAME contract the google provider implements ----

  /**
   * @returns {() => void} an unsubscribe function
   */
  onMapMouseMove(map, cb) {
    const handler = (e) => cb({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on("mousemove", handler);
    return () => map.off("mousemove", handler);
  },

  // ---- generalized map events: the SAME contract the google provider implements ----
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
 * Create a map in `el` using the configured provider.
 *
 * @param {Element} el
 * @param {object}  options  { provider?, apiKey?, center?, zoom?, mapId?, mapOptions?, version?, libraries? }
 * @returns {Promise<any>} the provider's map object
 */
export async function createMap(el, options = {}) {
  const name = options.provider || "google";
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

/** Does the named provider need an apiKey? Used by mount() to validate config before booting. */
export function providerRequiresApiKey(name = "google") {
  return !!getMapProvider(name)?.requiresApiKey;
}

/**
 * Can the named provider render content in `crs`? The Layer render precondition asks this before
 * drawing so a non-WGS84 raster surfaces a clear "reproject first" error instead of a blank overlay.
 * A provider that declares no `acceptsCRS` is treated as accepting anything (permissive default).
 * @param {string} name @param {string|null} crs @returns {boolean}
 */
export function providerAcceptsCRS(name = "google", crs = null) {
  const provider = getMapProvider(name);
  return typeof provider?.acceptsCRS === "function" ? provider.acceptsCRS(crs) : true;
}
