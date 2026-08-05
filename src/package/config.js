// Runtime configuration. Each FimViz owns its own config object (see fimViz.js) — the instance-safe
// place to read runtime settings is `fim.config` / `fim.app.config`. The engine threads what it needs
// from that object explicitly (e.g. addDataset binds `resolveUrl` into the parse options; the URL a
// lazy `fromURL` Dataset fetches is resolved from a resolver the Dataset carries) rather than reaching
// for a shared ambient pointer — so two isolated apps on one page never read each other's config.
//
// The ONE genuinely process-global setting is `gdalPath`: gdal3.js compiles a single Emscripten module
// per page (GDAL is a singleton), so its load path cannot be per-instance. That single value has a
// narrow module-level holder below (setGdalPath/getGdalPath), set from the first mounted app's config.

const DEFAULT_GDAL_PATH = "https://cdn.jsdelivr.net/npm/gdal3.js@2.8.1/dist/package";

const DEFAULTS = {
  // process.env.GOOGLE_MAPS_API_KEY is replaced at build time by webpack's DefinePlugin — the library
  // build defines it empty, so no key ever ships. The normal path is to pass it to mount({ apiKey }).
  // eslint-disable-next-line no-undef -- replaced at build time by webpack's DefinePlugin
  apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  // NO DEFAULT DEPLOYMENT. These describe where a HOST's data lives; baking one lab's URLs into the
  // library is how it stops being embeddable. A host supplies them via mount(config), and its own
  // `resolveUrl` hook (below) can read them.
  dataSource: "",
  corsProxy: "",
  // Directory (URL) that gdal3.js loads its wasm/data from. Defaults to a version-pinned CDN so nothing
  // large ships in the package; a host can override to self-host. Process-global (see the header note).
  gdalPath: DEFAULT_GDAL_PATH,
  // Host hook (url, cfg) => string to rewrite every fetched URL (CORS proxy, auth, mirrors). null → the
  // identity default (defaultResolveUrl below). The engine APPLIES this at every URL it fetches — the
  // parse path (io/parse.js) and lazy url-root materialize (Dataset.#materializeRoot) — threaded from
  // the owning instance's config, never from an ambient pointer. A generalizable SDK must not bake one
  // deployment's topology into library logic; this is the seam that lets a host supply its own. See
  // docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 "the app policy leaking into library code" pattern.
  resolveUrl: null,
  // ---- map boot (read by package/mapProvider.js when no runtime is registered) ----
  // Which backend creates the map. REQUIRED — there is deliberately no default. The providers differ
  // in ways a guess cannot paper over: google needs an apiKey and carries the full overlay tier
  // (velocity, damage markers, ArcGIS depth); leaflet needs no credentials and carries the map +
  // vector + static-raster tiers only. Defaulting either way silently decides that for a host, so
  // mount() throws `config-invalid` naming both options instead.
  provider: null,
  center: null,        // { lat, lng } — provider default when null
  zoom: null,          // number      — provider default when null
  mapId: null,         // google: required for AdvancedMarkerElement
  mapOptions: {},      // merged LAST into the provider's map options; host overrides win
  // Client-side storage schema: { name, version?, tables? }. NO DEFAULT ON PURPOSE — Storage is generic
  // and the host owns the database name/schema, so the library has nothing to name it with. `app.storage`
  // throws until this is set.
  storage: null,
};

// A fresh per-app config object (defaults merged with host overrides).
export function newConfig(overrides = {}) {
  return { ...DEFAULTS, ...overrides };
}

// ---- gdalPath: the one process-global setting (GDAL is a per-page singleton) --------------------
// This is the sole module-level runtime value the engine keeps. It is honest, not a shortcut: gdal3.js
// can only load one wasm build per page, so a per-instance gdalPath is meaningless. Set from the first
// mounted app's config (fimViz._register), reset to the default when the last map is released.
let _gdalPath = DEFAULT_GDAL_PATH;
/** Set the GDAL wasm/data load path. GDAL is process-global, so the first mounted app's value wins. @param {string} [path] @returns {void} */
export function setGdalPath(path) { if (path) _gdalPath = path; }
/** The GDAL wasm/data load path. @returns {string} */
export function getGdalPath() { return _gdalPath; }
/** Reset the GDAL load path to the built-in default (on last-map release). @returns {void} */
export function resetGdalPath() { _gdalPath = DEFAULT_GDAL_PATH; }

// ---- URL resolution seam ------------------------------------------------------------------------
/**
 * Apply a config's `resolveUrl` hook (or the identity default) to a URL. PURE — takes the config
 * explicitly, so it is instance-safe. A host binds this to its instance config once (`fim.addDataset`
 * does exactly that) and threads the resulting `(url) => string` resolver into the parse/materialize
 * paths; the engine never reads a shared config pointer to resolve a URL.
 * @param {string} targetUrl
 * @param {Object} [cfg] - a config object (e.g. `fim.config`); its `resolveUrl(url, cfg)` runs if present
 * @returns {string}
 */
export function proxiedUrl(targetUrl, cfg = {}) {
  const resolve = typeof cfg.resolveUrl === "function" ? cfg.resolveUrl : defaultResolveUrl;
  return resolve(targetUrl, cfg);
}

/**
 * Is `hostname` a loopback address — i.e. are we running a dev server? A pure utility a host's own
 * `resolveUrl` may use to decide whether to proxy. Not read by the engine itself.
 *
 * Must recognise EVERY form a dev server is reached by, not just the "localhost" hostname. A substring
 * test is the trap: `http://[::1]:3001` — what a browser navigates to when the dev host resolves to IPv6
 * first — contains no "localhost", so such a check reports production, URLs are fetched unproxied, and the
 * symptom is a CORS failure on first data load, far from the cause.
 *
 * Loopback is a property of the ADDRESS, so test the address: the whole 127.0.0.0/8 block, the IPv6 `::1`
 * (with or without the brackets a URL hostname carries), and the `.localhost` TLD reserved by RFC 2606.
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
 * The library's fallback when a host supplies no `resolveUrl`: return the URL unchanged.
 *
 * The library ships NO deployment topology — no hostname list, no proxy rule. A host's own rules live in
 * its own config and reach the engine through the `resolveUrl` hook.
 *
 * Identity is the honest neutral default: the library cannot know your CORS story, and guessing produced a
 * real bug (a dev server on http://[::1] was misread as production and fetched same-origin URLs cross-origin).
 * @param {string} targetUrl
 * @returns {string}
 */
export function defaultResolveUrl(targetUrl) {
  return targetUrl;
}
