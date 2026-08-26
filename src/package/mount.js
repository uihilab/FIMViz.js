// mount.js — the public boot API, create() and mount(), built on FimViz and FimMap.
//
// create() binds a FimMap to an app, injects the host's widget markup, and boots the map. mount()
// is an alias for it. Both return a Promise<FimMap> carrying on() and off(), so a host can attach
// listeners before it resolves.
//
// Several widgets share one page and are kept apart by DOM scoping (dom.js), not by iframes.
//
// This module handles config, markup, and setup and teardown only. Either a registered runtime's
// bootstrap() or mapProvider.js's createMap() boots the map itself, as described below.

import { fimError } from "./events.js";
// The headless core imports no widget markup. A host passes it to registerRuntime({ markup }),
// alongside the map boot and the panel factory.
import { FimMap } from "./fimMap.js";
import { getDefaultApp, createApp, FimViz as FimVizLifecycle } from "./fimViz.js";
import { parseSource } from "../io/parse.js";
import {
  createMap, providerRequiresApiKey, registerMapProvider, mapProviderNames, providerAcceptsCRS,
} from "./mapProvider.js";

// The map boot (bootstrap, getMountedMap, teardownMap), the Layer-panel factory and the widget
// markup belong to the host, not the headless core. A host passes them to registerRuntime() rather
// than this file importing them, so a host's UI can live outside the library.
//
// There is no default runtime, because the package ships no UI. Without one, create() below takes
// its own boot path through mapProvider.js's createMap(), so mount() from bare `fimviz` still
// yields a working map. It simply lacks the Layer Panel and flood layers a runtime would add.
// Shipping that chrome turnkey is not a library concern; a host wanting it registers its own
// runtime. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §5.1.
/**
 * @typedef {Object} Runtime
 * @property {((fim: any) => Promise<void>)|null} bootstrap - boots the map. create() calls it with
 *   the FimMap being mounted, instead of taking its own createMap() path.
 * @property {(() => any)|null} getMountedMap - read once bootstrap() resolves
 * @property {(() => void)|null} teardownMap - detaches listeners on destroy()
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

// Provider-specific error handling, i.e. Google's gm_authFailure global, lives in the provider that
// owns it, package/mapProvider.js. mount() is provider-neutral.

// Resolves a mount target, given as an Element, an id or a CSS selector, to an element.
function resolveMountEl(target) {
  if (!target) return null;
  if (typeof target !== "string") return target;
  return document.getElementById(target) || document.querySelector(target);
}

// The documented theming options, mapped to the widget's CSS custom properties.
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
 * Boots a FimMap on the default app.
 *
 * Applies the host config once, validates it, injects the widget markup unless the page already
 * has it, boots the map, then resolves to the FimMap. A mount failure releases the map so the
 * single-instance guard does not stay stuck.
 *
 * @param {Element|string} target - a container element, its id, or a CSS selector
 * @param {Object} [options] - see docs/usage/USAGE.md "Configuration"
 * @returns {Promise<import('./fimMap.js').FimMap> & {on: (evt: string, fn: Function) => any, off: (evt: string, fn: Function) => any}}
 */
export function create(target, options = {}) {
  // `isolated: true` gives this map its own app rather than the shared default, so a second mount()
  // on the same page, i.e. one using a different provider, does not trip the single-map guard.
  // Omit it in the normal case.
  const app = options.isolated ? createApp() : getDefaultApp();
  let fim = null;

  const ready = (async () => {
    // v0 supports one map on the default app per page.
    if (app.hasMaps) {
      throw fimError("already-mounted",
        "FimViz: an instance is already mounted (v0 supports one widget per page).");
    }
    app.configure(options);
    // The provider is required, with no default, because google and leaflet differ in credentials
    // and in which overlays they implement, so picking one would decide that for the host. Checked
    // before the container and markup work, so the message arrives even when a registered runtime
    // would otherwise boot the map itself.
    if (!app.config.provider) {
      throw fimError("config-invalid",
        "FimViz: mount() requires a map provider — pass provider: 'leaflet' (no API key needed) " +
        "or provider: 'google' with an apiKey.");
    }
    // Whether apiKey is required depends on the provider: google needs one, leaflet does not.
    if (providerRequiresApiKey(app.config.provider) && !app.config.apiKey) {
      throw fimError("config-invalid",
        `FimViz: the "${app.config.provider || "google"}" map provider requires an apiKey ` +
        "(pass options.apiKey or set GOOGLE_MAPS_API_KEY at build time).");
    }
    const container = resolveMountEl(target);
    if (!container) {
      throw fimError("config-invalid", "FimViz: target container not found: " + target);
    }

    // Inject widget markup unless the container already has it, since a host may include #map
    // inline. With no registered runtime there is no widget to inject, and the engine boots a bare
    // map into the container, so a plain `#map` div suffices.
    //
    // Scoped to the container rather than the document. `document.getElementById("map")` returns the
    // first #map on the page, so mounting a second widget found the first one's map div, decided the
    // markup was already present and injected nothing, leaving the second container empty and, with
    // a runtime, the widget missing. The DOM-scoping migration never reached this lookup, because it
    // runs before the FimMap that would scope it exists.
    const hasRuntime = typeof _runtime.bootstrap === "function";
    let injected = false;
    // A container that is itself the map div already provides one. Injecting another
    // `<div id="map">` inside it put two nodes with the same id in the document, so
    // `document.getElementById("map")` and `container.querySelector('#map')` disagreed about where
    // the map lived. That collides in practice, since `mount("map", ...)` is the obvious thing to
    // write. Bare-engine path only: with a runtime there is a real widget to inject and the host
    // names its own container.
    const containerIsMapDiv = !hasRuntime && container.id === "map";
    if (!containerIsMapDiv && !container.querySelector('[id="map"]')) {
      if (hasRuntime && !_runtime.markup) {
        throw fimError("config-invalid",
          "FimViz: a runtime is registered but supplied no `markup`, and the page has no #map. " +
          "Pass `markup` to registerRuntime, or provide the widget DOM (#map) in the page.");
      }
      container.innerHTML = _runtime.markup || '<div id="map" style="width:100%;height:100%"></div>';
      injected = true;
    }
    applyTheme(container, options.theme);

    // The engine does not set dom.js's ambient scope here. Nothing in the package reads it, since
    // the overlay layers emit rather than write host markup, so the host points it from
    // bootstrap(fim) using fim.root. Setting it here would repoint a global only host code depends
    // on, with nothing to show it happened.

    fim = new FimMap({
      app, root: container, injected,
      getMap: _runtime.getMountedMap, teardown: _runtime.teardownMap,
      createPanel: _runtime.createPanel,   // per-instance Layer Panel, scoped to this container
    });
    // Attach the delegated action dispatcher to the widget root. One listener serves each
    // `data-action` element, including markup added later, because it works by bubbling. Handlers
    // resolve through the instance registry first, then window.*.
    fim.bindActions();
    app._register(fim);   // routes deep-module errors to this app's bus and arms the guard
    app.lockConfig();     // config is written once, locked after the first boot

    try {
      // Two boot paths.
      //
      // By default the engine creates the map itself from config: apiKey, center, zoom, mapId and
      // mapOptions. A user who only wants a map should not have to import a Maps Loader and hand
      // the result back.
      //
      // A registered runtime boots instead when present. A host building a full widget around the
      // map needs control of that sequence, so registerRuntime() always wins.
      if (hasRuntime) {
        // bootstrap() receives the instance, so the runtime never has to ask which map it is
        // booting. `fim.map` is still null at this point, since _adoptMap() runs below once
        // bootstrap() has built it. A runtime may hold the reference but must not read .map yet.
        await _runtime.bootstrap(fim);
        // The instance takes ownership of the map, rather than reading a module-level singleton
        // inside the runtime on each access (see FimMap.map and _adoptMap).
        fim._adoptMap(_runtime.getMountedMap?.() ?? null);
      } else {
        fim._adoptMap(await createMap(fim.$("#map") || container, app.config));
      }
      app.emit("ready");
      return fim;
    } catch (e) {
      app._release(fim);  // roll back so a retry can run
      throw e;
    }
  })();

  // Mirror a mount or boot failure onto the 'error' event, carrying a machine-readable code.
  ready.then(undefined, (e) => {
    app.emit("error", (e && e.code) ? e : fimError("boot-failed", (e && e.message) || String(e)));
  });

  // Put on() and off() on the pending promise so on('ready') can be attached before it resolves.
  // The promise resolves to `fim`, which is not itself thenable, so there is no loop.
  ready.on = (evt, fn) => { app.on(evt, fn); return ready; };
  ready.off = (evt, fn) => { app.off(evt, fn); return ready; };

  // Forgot-to-await guard.
  //
  // Putting on() and off() on the promise makes it look partly like a FimMap, which is what makes
  // `const fim = mount(el); fim.addLayer(...)` a natural mistake: `mount(el).on('ready')` works, so
  // the rest looks like it should. Unguarded it failed with `undefined is not a function`, naming
  // neither cause nor fix. These accessors throw a message with both.
  //
  // They exist only on the promise. The resolved FimMap is a different object and is untouched.
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
 * The public entry point, and an alias for `create()`. With a registered runtime it boots the full
 * widget, and without one it boots a bare map (see the note above `_runtime`). Widgets share one
 * document and are kept apart by dom.js scoping; the iframe isolation path was removed.
 * @param {Element|string} target
 * @param {Object} [options]
 * @returns {ReturnType<typeof create>}
 */
export function mount(target, options = {}) {
  return create(target, options);
}

/**
 * Parses a source into a Dataset. Needs no instance and no map.
 * @param {File|Blob|ArrayBuffer|string} source
 * @param {Object} [options]
 * @returns {Promise<import('./dataset.js').Dataset>}
 */
export function parseFile(source, options = {}) {
  return parseSource(source, options);
}

// The namespace matching the documented API: FimViz.mount, FimViz.create, FimViz.parseFile.
//
// The map-backend registry and the runtime hooks hang off FimViz because FimViz boots the map. A
// provider is what `mount()` creates the map with, and a runtime is what it boots instead. Both
// were loose barrel functions whose owner was never in doubt.
/**
 * @type {typeof FimVizLifecycle & {create: typeof create, mount: typeof mount, parseFile: typeof parseFile}}
 */
export const FimViz = {
  ...FimVizLifecycle, create, mount, parseFile,
  registerRuntime,
  registerMapProvider,
  /** The registered map backends. @returns {string[]} */
  mapProviders: () => mapProviderNames(),
  /** True when the named provider can render content in `crs`. @param {string} name @param {string|null} crs @returns {boolean} */
  providerAcceptsCRS: (name, crs) => providerAcceptsCRS(name, crs),
};
