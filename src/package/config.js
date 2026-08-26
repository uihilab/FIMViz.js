// Runtime configuration. Each FimViz owns its config object (see fimViz.js), so read settings from
// `fim.config` or `fim.app.config`. The engine passes what it needs from that object explicitly:
// addDataset binds `resolveUrl` into the parse options, and a lazy `fromURL` Dataset carries its own
// resolver. Nothing reads a shared ambient pointer, so two apps on one page cannot read each other's
// config.
//
// `gdalPath` is the exception. gdal3.js compiles one Emscripten module per page, so its load path
// cannot be per-instance. setGdalPath/getGdalPath below hold that single value, taken from the first
// mounted app's config.

const DEFAULT_GDAL_PATH = "https://cdn.jsdelivr.net/npm/gdal3.js@2.8.1/dist/package";

const DEFAULTS = {
  // webpack's DefinePlugin replaces process.env.GOOGLE_MAPS_API_KEY at build time. The library build
  // defines it empty, so no key ships. The host normally passes one to mount({ apiKey }).
  // eslint-disable-next-line no-undef -- replaced at build time by webpack's DefinePlugin
  apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  // No default. These say where a host's data lives, and baking one lab's URLs into the library
  // would stop it being embeddable. A host supplies them through mount(config), and its own
  // `resolveUrl` hook below can read them.
  dataSource: "",
  corsProxy: "",
  // URL directory gdal3.js loads its wasm and data from. Defaults to a version-pinned CDN so nothing
  // large ships in the package; a host can point it at its own copy. Process-global, see the header.
  gdalPath: DEFAULT_GDAL_PATH,
  // Host hook (url, cfg) => string that rewrites a fetched URL for a CORS proxy, auth or a mirror.
  // null uses defaultResolveUrl below, which returns the URL unchanged. Both fetch paths apply it,
  // io/parse.js and Dataset.#materializeRoot, taking it from the owning instance's config rather
  // than an ambient pointer. It exists so a host's deployment topology stays out of library logic,
  // per docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 "the app policy leaking into library code".
  resolveUrl: null,
  // ---- map boot (read by package/mapProvider.js when no runtime is registered) ----
  // Which backend creates the map. Required, with no default, because the two differ in ways a
  // guess cannot cover: google needs an apiKey and draws the full overlay set (velocity, damage
  // markers, ArcGIS depth), while leaflet needs no credentials and draws only maps, vectors and
  // static rasters. Defaulting would decide that for the host, so mount() throws
  // `config-invalid` and names both options.
  provider: null,
  center: null,        // { lat, lng } — provider default when null
  zoom: null,          // number      — provider default when null
  mapId: null,         // google: required for AdvancedMarkerElement
  mapOptions: {},      // merged last into the provider's map options, so host overrides win
  // Client-side storage schema: { name, version?, tables? }. No default, because Storage is generic
  // and the host owns the database name and schema. `app.storage` throws until this is set.
  storage: null,
};

// A fresh per-app config: the defaults with host overrides merged over them.
export function newConfig(overrides = {}) {
  return { ...DEFAULTS, ...overrides };
}

// ---- gdalPath: the one process-global setting -------------------------------------------------
// The only module-level runtime value the engine keeps, and not a shortcut: gdal3.js loads one wasm
// build per page, so a per-instance gdalPath would mean nothing. fimViz._register sets it from the
// first mounted app's config, and releasing the last map resets it.
let _gdalPath = DEFAULT_GDAL_PATH;
/** Sets the GDAL wasm and data load path. The first mounted app's value wins. @param {string} [path] @returns {void} */
export function setGdalPath(path) { if (path) _gdalPath = path; }
/** @returns {string} */
export function getGdalPath() { return _gdalPath; }
/** Resets the load path to the built-in default, on last-map release. @returns {void} */
export function resetGdalPath() { _gdalPath = DEFAULT_GDAL_PATH; }

// ---- URL resolution -----------------------------------------------------------------------------
/**
 * Applies a config's `resolveUrl` hook to a URL, or defaultResolveUrl when it has none. Pure, since
 * the config arrives as an argument. `fim.addDataset` binds it to one instance config and passes the
 * resulting `(url) => string` into the parse and materialize paths, so nothing reads a shared
 * config pointer to resolve a URL.
 * @param {string} targetUrl
 * @param {Object} [cfg] - i.e. `fim.config`; its `resolveUrl(url, cfg)` runs when present
 * @returns {string}
 */
export function proxiedUrl(targetUrl, cfg = {}) {
  const resolve = typeof cfg.resolveUrl === "function" ? cfg.resolveUrl : defaultResolveUrl;
  return resolve(targetUrl, cfg);
}

/**
 * True when `hostname` is a loopback address, meaning a dev server. A host's `resolveUrl` can use
 * this to decide whether to proxy. The engine does not read it.
 *
 * Tests the address rather than the name, covering the 127.0.0.0/8 block, IPv6 `::1` with or without
 * the brackets a URL hostname carries, and the `.localhost` TLD from RFC 2606. A substring test for
 * "localhost" misses `http://[::1]:3001`, which is what a browser navigates to when the dev host
 * resolves to IPv6 first. That reports production, fetches unproxied, and fails with a CORS error
 * on first data load, far from its cause.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isLoopbackHost(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return false;
  return h === "localhost" || h.endsWith(".localhost") ||
         h === "::1" || h === "0.0.0.0" ||
         /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

/**
 * Returns the URL unchanged. Used when a host supplies no `resolveUrl`.
 *
 * The library ships no hostname list and no proxy rule. A host keeps its own rules in its own config
 * and passes them in through the `resolveUrl` hook. The library cannot know a host's CORS setup, and
 * guessing once caused a real bug: a dev server on http://[::1] read as production and fetched
 * same-origin URLs cross-origin.
 * @param {string} targetUrl
 * @returns {string}
 */
export function defaultResolveUrl(targetUrl) {
  return targetUrl;
}
