// mount.js — the public package boot API (create / mount), built on the FimViz/FimMap model.
//
// create() is the boot core: it binds a FimMap to an app, injects the host's widget markup, and
// boots the map. mount() is an alias for it. Both return a Promise<FimMap> that also carries
// on()/off(), so a host can attach listeners before it resolves.
//
// Composition is SINGLE-DOCUMENT — several widgets share one page and are kept apart by DOM
// scoping (dom.js), not by iframes.
//
// This module only orchestrates config / markup / lifecycle; the map itself is booted either by a
// registered runtime's bootstrap() or by mapProvider.js's createMap(). See the two boot paths below.

import { fimError } from "./events.js";
// The headless core does not import any widget markup — a host supplies it via registerRuntime
// ({ markup }), same as the map-boot + panel factory.
import { FimMap } from "./fimMap.js";
import { getDefaultApp, createApp, FimViz as FimVizLifecycle } from "./fimViz.js";
import { parseSource } from "../io/parse.js";
import {
  createMap, providerRequiresApiKey, registerMapProvider, mapProviderNames, providerAcceptsCRS,
} from "./mapProvider.js";

// Runtime seam (the boot inversion). The map-boot (bootstrap/getMountedMap/teardownMap), the
// Layer-panel factory, and the widget markup are a host concern, NOT the headless core's. They are
// supplied via registerRuntime() rather than imported here, so a host's UI can live outside the
// library.
//
// NOTE: there is no default runtime — the package ships no UI to supply one. Without a registered
// runtime, `create()` below takes its OWN default boot path (via mapProvider.js's createMap()), so
// `mount()` from bare `fimviz` still yields a real, working map; it just has none of the widget
// chrome (Layer Panel, flood layers, …) that a registered runtime supplies. Turnkey embedding of
// THAT chrome is not a library concern — a host wanting it registers its own runtime — see
// docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §5.1.
/**
 * @typedef {Object} Runtime
 * @property {((fim: any) => Promise<void>)|null} bootstrap - boot the map; called by create() instead of its default createMap() path, with the FimMap being mounted
 * @property {(() => any)|null} getMountedMap - reported once bootstrap() resolves
 * @property {(() => void)|null} teardownMap - detach listeners on destroy()
 * @property {((root: Element|null) => any)|null} createPanel - per-instance Layer Panel factory
 * @property {string|null} markup - widget HTML injected into the container
 */
/** @type {Runtime} */
const _runtime = { bootstrap: null, getMountedMap: null, teardownMap: null, createPanel: null, markup: null };
/**
 * @param {Partial<Runtime>} [rt]
 * @returns {Runtime}
 */
export function registerRuntime(rt = {}) { Object.assign(_runtime, rt); return _runtime; }

// Provider-specific error wiring (e.g. Google's gm_authFailure global) lives in the provider that
// owns it — package/mapProvider.js — not here. mount() is provider-neutral.

// Resolve a mount target (Element | id string | CSS selector) to an element.
function resolveMountEl(target) {
  if (!target) return null;
  if (typeof target !== "string") return target;
  return document.getElementById(target) || document.querySelector(target);
}

// Documented theming surface: map the theme option to the widget's CSS custom properties.
const THEME_VARS = {
  bgColor: "--bg-color",
  olColor: "--ol-color",
  hlColor: "--hl-color",
  bColor: "--b-color",
};
function applyTheme(el, theme) {
  if (!theme || !el) return;
  for (const key in THEME_VARS) {
    if (theme[key]) el.style.setProperty(THEME_VARS[key], theme[key]);
  }
}

/**
 * create(target, options) — boot a FimMap on the ambient default app.
 *
 * Applies host config (set-once), validates it, injects the widget markup unless the page
 * already provides it, boots the map, and resolves to the FimMap once it is ready. On mount
 * failure the map is released so the single-instance guard does not stay stuck.
 *
 * @param {Element|string} target - a container element, its id, or a CSS selector
 * @param {Object} [options] - see docs/usage/USAGE.md "Configuration"
 * @returns {Promise<import('./fimMap.js').FimMap> & {on: (evt: string, fn: Function) => any, off: (evt: string, fn: Function) => any}}
 */
export function create(target, options = {}) {
  // `isolated: true` gives this map its own app instead of the shared default, so a second mount()
  // on the same page (a different provider, say) does not trip the single-map guard. Omit it for
  // the normal turnkey case.
  const app = options.isolated ? createApp() : getDefaultApp();
  let fim = null;

  const ready = (async () => {
    // v0 (in-DOM) supports a single map on the default app per page.
    if (app.hasMaps) {
      throw fimError("already-mounted",
        "FimViz: an instance is already mounted (v0 supports one widget per page).");
    }
    app.configure(options);
    // The provider is REQUIRED, with no default. google and leaflet differ in credentials AND in
    // which overlay tiers they implement, so picking one for a host silently decides something it
    // should state. Checked here, before the container/markup work, so the message arrives even
    // when a runtime is registered and would otherwise boot the map itself.
    if (!app.config.provider) {
      throw fimError("config-invalid",
        "FimViz: mount() requires a map provider — pass provider: 'leaflet' (no API key needed) " +
        "or provider: 'google' with an apiKey.");
    }
    // apiKey is required BY PROVIDER, not always: Google needs one, another backend may not.
    if (providerRequiresApiKey(app.config.provider) && !app.config.apiKey) {
      throw fimError("config-invalid",
        `FimViz: the "${app.config.provider || "google"}" map provider requires an apiKey ` +
        "(pass options.apiKey or set GOOGLE_MAPS_API_KEY at build time).");
    }
    const container = resolveMountEl(target);
    if (!container) {
      throw fimError("config-invalid", "FimViz: target container not found: " + target);
    }

    // Inject widget markup into the container unless the container already provides it (a host may
    // include #map inline). With NO registered runtime there is no widget to inject — the engine
    // boots a bare map into the container itself, so a plain `#map` div is all that is needed.
    //
    // Scoped to the container, NOT document-wide. `document.getElementById("map")` returns the first
    // #map on the page, so mounting a second widget found the FIRST one's map div, concluded the
    // markup was already present, and injected nothing — leaving the second container empty (and,
    // with a runtime, the whole widget missing). This is the one lookup the DOM-scoping migration
    // never reached, because it runs before the FimMap that would scope it exists.
    const hasRuntime = typeof _runtime.bootstrap === "function";
    let injected = false;
    if (!container.querySelector('[id="map"]')) {
      if (hasRuntime && !_runtime.markup) {
        throw fimError("config-invalid",
          "FimViz: a runtime is registered but supplied no `markup`, and the page has no #map. " +
          "Pass `markup` to registerRuntime, or provide the widget DOM (#map) in the page.");
      }
      container.innerHTML = _runtime.markup || '<div id="map" style="width:100%;height:100%"></div>';
      injected = true;
    }
    applyTheme(container, options.theme);

    // NOTE: the engine does not set dom.js's ambient scope here. Nothing in the package reads it
    // — the overlay layers emit instead of writing host markup — so pointing it is the HOST's
    // business, done from bootstrap(fim) with fim.root. Setting it from here would silently repoint
    // a global that only host code depends on.

    fim = new FimMap({
      app, root: container, injected,
      getMap: _runtime.getMountedMap, teardown: _runtime.teardownMap,
      createPanel: _runtime.createPanel,   // per-instance Layer Panel, scoped to this container
    });
    // Arm the delegated action dispatcher on the widget root. One listener handles every
    // `data-action` element — including dynamically-generated markup, since it works by bubbling.
    // Handlers resolve through the instance registry, then fall back to window.*.
    fim.bindActions();
    app._register(fim);   // routes deep-module errors to this app's bus; arms the guard
    app.lockConfig();     // config is set-once, locked after the first boot

    try {
      // TWO BOOT PATHS.
      //
      // Default: the engine creates the map itself from config (apiKey/center/zoom/mapId/
      // mapOptions). This is the whole point of the seam — a consumer who just wants a map should
      // not have to import a Maps Loader and hand the result back.
      //
      // Override: a registered runtime boots instead. A host that wires a full widget around the
      // map needs control of that sequence, so registerRuntime() always wins when present.
      if (hasRuntime) {
        // The instance is handed to bootstrap() so the runtime never has to ask the engine which
        // map it is booting. `fim.map` is still null here — _adoptMap() happens below, once
        // bootstrap() has built it — so a runtime may hold the reference but must not read .map yet.
        await _runtime.bootstrap(fim);
        // The instance takes ownership of the map, rather than reading a module-level singleton in
        // the runtime on every access (see FimMap.map / _adoptMap).
        fim._adoptMap(_runtime.getMountedMap?.() ?? null);
      } else {
        fim._adoptMap(await createMap(fim.$("#map") || container, app.config));
      }
      app.emit("ready");
      return fim;
    } catch (e) {
      app._release(fim);  // roll back so a retry is possible
      throw e;
    }
  })();

  // Mirror any mount/boot failure to the 'error' event (with a machine-readable code).
  ready.then(undefined, (e) => {
    app.emit("error", (e && e.code) ? e : fimError("boot-failed", (e && e.message) || String(e)));
  });

  // Expose listener attachment on the pending promise so on('ready') can be registered
  // before it resolves. The promise resolves to `fim` (not itself thenable — no loop).
  ready.on = (evt, fn) => { app.on(evt, fn); return ready; };
  ready.off = (evt, fn) => { app.off(evt, fn); return ready; };

  // FORGOT-TO-AWAIT GUARD.
  //
  // Gluing on/off onto the promise makes it look PARTLY like a FimMap, which is precisely what makes
  // `const fim = mount(el); fim.addLayer(...)` a natural mistake to make — `mount(el).on('ready')`
  // works, so the rest looks like it should. Unguarded, the payoff was `undefined is not a function`,
  // which names neither the cause nor the fix. These accessors throw with both.
  //
  // They live only on the PROMISE; the resolved FimMap is a different object and is untouched.
  for (const k of ["addDataset", "addLayer", "getLayer", "getLayerByName", "removeLayer",
                   "registerNamedLayer", "namedLayers", "layers", "datasets", "map", "root", "app",
                   "storage", "layerPanel", "config", "$", "$$", "emit", "destroy", "settled",
                   "registerAction", "registerActions", "bindActions", "actionNames",
                   "enableMapEvents", "disableMapEvents", "captureInteraction", "releaseInteraction"]) {
    Object.defineProperty(ready, k, {
      configurable: true,
      get() {
        throw new Error(
          `mount() returns a Promise<FimMap>, and this one has not been awaited — so \`.${k}\` does ` +
          `not exist yet.\n    Write:  const fim = await mount(target, options);\n` +
          `    Only .on()/.off() work before it resolves (to subscribe to 'ready'/'error' early).`);
      },
    });
  }
  return ready;
}

/**
 * mount(target, options) — the public entry point; an alias for `create()`. With a registered
 * runtime it boots the full widget; otherwise it boots a bare map (see the note above `_runtime`).
 * Single-document composition (Path B via dom.js scoping); the abandoned iframe `isolate` path
 * (Path A) was removed.
 * @param {Element|string} target
 * @param {Object} [options]
 * @returns {ReturnType<typeof create>}
 */
export function mount(target, options = {}) {
  return create(target, options);
}

/**
 * parseFile(source, options) — pure parse (no instance, no map). Returns a Dataset.
 * @param {File|Blob|ArrayBuffer|string} source
 * @param {Object} [options]
 * @returns {Promise<import('./dataset.js').Dataset>}
 */
export function parseFile(source, options = {}) {
  return parseSource(source, options);
}

// Namespaced surface matching the documented API (FimViz.mount / .create / .parseFile / …).
//
// The map-backend registry and the runtime seam hang off FimViz because FimViz is what BOOTS a map:
// a provider is the thing `mount()` creates the map with, and a runtime is what it boots instead.
// Both were loose barrel functions whose owner was never ambiguous.
/**
 * @type {typeof FimVizLifecycle & {create: typeof create, mount: typeof mount, parseFile: typeof parseFile}}
 */
export const FimViz = {
  ...FimVizLifecycle, create, mount, parseFile,
  registerRuntime,
  registerMapProvider,
  /** Every registered map backend. @returns {string[]} */
  mapProviders: () => mapProviderNames(),
  /** Can the named provider render content in `crs`? @param {string} name @param {string|null} crs @returns {boolean} */
  providerAcceptsCRS: (name, crs) => providerAcceptsCRS(name, crs),
};
