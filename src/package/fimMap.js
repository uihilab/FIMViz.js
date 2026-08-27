// fimMap.js — one mounted widget instance.
//
// A FimMap owns the map and its dataset and layer registries, and belongs to a FimViz, the service
// container holding config, the event bus and storage. It keeps a direct `app` reference up the
// chain, so nothing resolves "the current app" lazily (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md
// §1.1).
//
// The host runtime boots the map. This class reaches it through the `getMap` and `teardown`
// accessors mount.js injects, rather than importing the runtime. Importing it would make the core
// instance object unconstructable without pulling in the Maps loader and every layer subsystem
// behind it. Dataset treats GDAL the same way: dependencies point inward to the model.

import { parseSource } from "../io/parse.js";
import { proxiedUrl } from "./config.js";
import { createLayer, dispatchMapEventToLayers } from "./layer.js";
import { getMapProvider, DEFAULT_PROVIDER } from "./mapProvider.js";
import { ColorScale } from "./colorScale.js";

// Rewrites `#foo` to `[id="foo"]`, for an exact id only. $() below explains why.
const ID_ONLY = /^#([A-Za-z_][\w-]*)$/;
const _scopedSel = (sel) => {
  const m = ID_ONLY.exec(String(sel).trim());
  return m ? `[id="${m[1]}"]` : sel;
};

// A Dataset carries its own materialize hook. Anything shaped like a comparison {pixels,meta}
// source has none and is not parseable, so it passes through untouched for the layer factory.
const _looksLikeDataset = (v) => typeof v === "object" && v != null
  && (typeof v.load === "function" || typeof v.grid === "function");
// The source shapes addDataset() and parseFile() already accept. A browser's File extends Blob.
const _looksLikeRawSource = (v) => (typeof Blob !== "undefined" && v instanceof Blob)
  || v instanceof ArrayBuffer || typeof v === "string";
// A layer.toSpec() descriptor carries both a string `type` and a sources array. No other accepted
// first argument has both: a Dataset carries `kind`, and a raw file is a Blob, ArrayBuffer or string.
const _looksLikeSpec = (v) => typeof v === "object" && v != null
  && typeof v.type === "string" && Array.isArray(v.sources);

// Maps a provider map object to the FimMap that owns it. _adoptMap() fills it.
//
// Engine code handed a raw google.maps.Map or L.Map, which is what the overlay subsystems receive,
// finds its owning instance here. Reaching for `FimViz.current()?.maps?.[0]` instead would hardcode
// the default app's first map: right while one widget exists, and wrong once a second mounts,
// with no error, since the optional chain turns it into a no-op. A WeakMap, so a destroyed map is
// collectable with no bookkeeping.
const _byProviderMap = new WeakMap();

/**
 * The FimMap that owns `providerMap`, or null when this library did not mount it.
 * @param {*} providerMap - a `google.maps.Map`, `L.Map`, or another provider's map object
 * @returns {FimMap|null}
 */
export function fimForMap(providerMap) {
  if (!providerMap || typeof providerMap !== "object") return null;
  return _byProviderMap.get(providerMap) || null;
}

/**
 * Parses `v` into a Dataset through addDataset() when it is a raw File, Blob, ArrayBuffer or URL.
 * A Dataset passes through unchanged, as does any other source shape such as a comparison
 * {pixels,meta}. This is what lets addLayer take a raw file directly, with no separate
 * `await fim.addDataset(file)` step.
 * @param {import('./fimMap.js').FimMap} fim @param {*} v @returns {Promise<*>}
 */
async function _resolveLayerSource(fim, v) {
  if (v == null || _looksLikeDataset(v) || !_looksLikeRawSource(v)) return v;
  return fim.addDataset(v);
}

export class FimMap {
  #app;
  #root;          // the mount container — the query scope for $ / $$
  #injected;      // did we inject widget markup into #root (so destroy clears it)?
  #destroyed = false;

  /** @type {import('./layer.js').Layer[]} */
  layers = [];
  #layersByName = new Map();   // filename -> Layer (the displayed-user-file registry)
  #exclusiveClaimant = null;   // the current exclusive display-claiming Layer (velocity/ensemble)
  #actions = new Map();        // data-action name -> handler
  #onEvent = null;             // the single delegated listener, bound to #root
  #mapEventUnsubs = null;      // provider map-event unsubscribes (hover/click dispatch)
  #simultaneous = false;       // dispatch mode: false = precedence/absorption, true = every hit layer
  #capture = null;             // a modal interaction (region draw) that takes ALL map events
  #map = null;                 // THIS instance's google.maps.Map (adopted after boot)
  #getMap;                     // fallback accessor for a runtime that does not report its map
  #teardown;                   // injected by mount.js (script.js's teardownMap)
  #createPanel;                // injected by mount.js (ui/layerPanel.js createLayerPanel)
  #panel = null;               // this instance's LayerPanel, lazily built against #root

  /**
   * @param {Object} opts
   * @param {import('./fimViz.js').FimVizInstance} opts.app - the owning FimViz
   * @param {Element|null} [opts.root] - the mount container (query scope)
   * @param {boolean} [opts.injected] - did FimViz inject widget markup into `root`
   * @param {(() => any)|null} [opts.getMap] - fallback map accessor for a runtime that doesn't report its map
   * @param {(() => void)|null} [opts.teardown] - runtime-supplied teardown, run by destroy()
   * @param {((root: Element|null) => any)|null} [opts.createPanel] - per-instance Layer Panel factory
   */
  constructor({ app, root, injected = false, getMap = null, teardown = null, createPanel = null }) {
    this.#app = app;
    this.#root = root || null;
    this.#injected = injected;
    this.#getMap = getMap;
    this.#teardown = teardown;
    this.#createPanel = createPanel;
  }

  /** The owning FimViz (default or private) — the up-chain reference. @returns {import('./fimViz.js').FimVizInstance} */
  get app() { return this.#app; }

  /** The mount container element (query scope). @returns {Element|null} */
  get root() { return this.#root; }

  /**
   * The provider's map object. Read it rather than write it (see docs/usage/USAGE.md).
   *
   * Each instance holds its own reference, which mount.js sets through `_adoptMap()` once boot
   * completes. Resolving through a runtime-level accessor instead would make every FimMap on a page
   * answer with whichever map booted last. `#getMap` is only a fallback for a runtime that never
   * reports one.
   */
  /** @returns {*} the provider's map object — a `google.maps.Map`, an `L.Map`, or another provider's type */
  get map() { return this.#map ?? this.#getMap?.() ?? null; }

  /**
   * Records the map this instance booted. mount.js calls it after the runtime's bootstrap()
   * resolves. Internal; a host reads `fim.map`.
   * @internal @param {*} map
   * @returns {FimMap}
   */
  _adoptMap(map) {
    this.#map = map ?? null;
    if (this.#map) _byProviderMap.set(this.#map, this);   // so fimForMap() can resolve back
    return this;
  }

  /** Shared client-side storage (owned by the app). @returns {import('../io/storage.js').Storage} */
  get storage() { return this.#app.storage; }

  /**
   * Datasets parsed on this app, shared with its other maps the way `storage` is.
   *
   * A Dataset holds no back-pointer to a map, so a file parsed here by `addDataset`, or implicitly
   * by `addLayer(rawFile)`, works as a source for a Layer on another map and another provider, with
   * no re-parse and no second decode. Rendering state stays per map, in `layers`.
   * @returns {import('./dataset.js').Dataset[]}
   */
  get datasets() { return this.#app.datasets; }

  /** Register a Dataset parsed elsewhere on this map's app. @param {*} ds @returns {*} */
  adoptDataset(ds) { return this.#app.adoptDataset(ds); }

  /**
   * Drops a Dataset from the app registry and releases its decode. Throws while a layer on this app
   * still renders it, unless given `{ force: true }`.
   * @param {*} ds @param {{force?: boolean}} [opts] @returns {boolean}
   */
  removeDataset(ds, opts) { return this.#app.removeDataset(ds, opts); }

  /**
   * This instance's runtime config, always from the app owning this map, so two isolated apps on one
   * page never read each other's settings. The engine reads config only this way; there is no
   * ambient config pointer. The one module-level runtime value is gdalPath, which is process-global
   * because GDAL is a per-page singleton. See package/config.js.
   * @returns {Object}
   */
  get config() { return this.#app.config; }

  /**
   * This instance's Layer Panel, built lazily against #root by the createLayerPanel factory mount.js
   * injects. The model never imports ui/; mount.js supplies it, as it does getMap and teardown.
   * Null when no factory was injected, which is the headless boot. Replaces the module-level
   * `window.layerPanel` singleton, so two maps drive their own panels.
   * @returns {*}
   */
  get layerPanel() {
    if (!this.#panel && this.#createPanel) this.#panel = this.#createPanel(this.#root);
    return this.#panel;
  }

  /**
   * Query helpers resolving against this instance's root rather than the whole document. Use these
   * instead of `document.getElementById`, so duplicate ids across two widgets stay unambiguous.
   *
   * A bare `#id` is rewritten to `[id="..."]`. The spec calls them identical, but some engines
   * optimize `#id` through document.getElementById, which returns the first match in the document
   * and then filters to the subtree, so a scoped lookup finds nothing when ids repeat. That is this
   * case exactly: two widgets both carry `#layer-panel`. jsdom and nwsapi do this where browsers do
   * not, so without the rewrite the behavior cannot even be tested. The attribute form behaves the
   * same everywhere.
   *
   * Only an exact `#identifier` is rewritten, which is what the migrated getElementById call sites
   * use. A compound selector passes through untouched, because rewriting inside one risks mangling
   * a quoted attribute value, so it stays subject to the engine quirk above.
   * @param {string} sel
   * @returns {Element|null}
   */
  $(sel) { return (this.#root || document).querySelector(_scopedSel(sel)); }
  /** @param {string} sel @returns {Element[]} */
  $$(sel) { return [...(this.#root || document).querySelectorAll(_scopedSel(sel))]; }

  // Events live on the app's shared bus, and a FimMap forwards to it. One instance today, shared
  // across the maps on a page.
  /** @param {string} evt @param {(payload: any) => void} fn @returns {FimMap} */
  on(evt, fn) { this.#app.on(evt, fn); return this; }
  /** @param {string} evt @param {(payload: any) => void} fn @returns {FimMap} */
  off(evt, fn) { this.#app.off(evt, fn); return this; }
  /** @param {string} evt @param {*} [payload] @returns {FimMap} */
  emit(evt, payload) { this.#app.emit(evt, payload); return this; }

  // There is no getMap(). The `fim.map` getter above is the only accessor: a noun names state and a
  // verb does work. The v0 `getMap()` returned exactly `this.map`, so it was removed rather than
  // deprecated, leaving one name for one thing.

  // ---- delegated actions -------------------------------------------------------------------
  //
  // Replaces the inline `onclick="fn('a')"` to `window.fn` bridge with one delegated listener per
  // instance, scoped to this map's root. Markup declares:
  //
  //     <button data-action="damageEstimate">                       (click is the default)
  //     <input  data-action="handleOptionsToggle" data-on="change" data-args='["fd"]'>
  //
  // The handler runs as `fn.call(el, ...args)`, so `this` is the element just as an inline handler
  // sees it, and an existing function migrates without changing its body. A non-click event needs
  // `data-on`, because a checkbox fires both click and change and dispatching on both would run
  // every handler twice.
  //
  // Names resolve through this instance's registry first, then `window[name]`. The window fallback
  // is temporary, and it is what makes the migration incremental: convert the markup once, then move
  // subsystems off `window.*` one at a time. It is also why this is per-instance already, since the
  // registry is what eventually makes two widgets on a page independent.

  /**
   * Registers a handler for `data-action="name"`.
   * @param {string} name
   * @param {(this: Element, ...args: any[]) => void} fn
   * @returns {FimMap}
   */
  registerAction(name, fn) {
    if (typeof fn !== "function") throw new Error(`registerAction("${name}"): fn must be a function`);
    this.#actions.set(name, fn);
    return this;
  }

  /**
   * Registers several at once: registerActions({ foo, bar }).
   * @param {Object<string, (this: Element, ...args: any[]) => void>} [map]
   * @returns {FimMap}
   */
  registerActions(map = {}) {
    for (const [name, fn] of Object.entries(map)) this.registerAction(name, fn);
    return this;
  }

  /**
   * The handler for `name`, from this instance's registry first, then the window bridge.
   * @param {string} name
   * @returns {Function|null}
   */
  getAction(name) {
    return this.#actions.get(name) || (typeof window !== "undefined" ? window[name] : null) || null;
  }

  /** All action names registered on THIS instance (excludes the window fallback). @returns {string[]} */
  get actionNames() { return [...this.#actions.keys()]; }

  /** Attach the delegated listener to this instance's root. Idempotent. @returns {FimMap} */
  bindActions() {
    if (this.#onEvent || !this.#root) return this;
    this.#onEvent = (e) => this._dispatchAction(e);
    for (const type of ["click", "change", "input"]) {
      this.#root.addEventListener(type, this.#onEvent);
    }
    return this;
  }

  /** Internal: resolve an event to a declared action and invoke it. @internal @param {Event} e @returns {*} */
  _dispatchAction(e) {
    const el = e.target?.closest?.("[data-action]");
    // Only elements inside this instance's root, since a shared document may hold others.
    if (!el || !this.#root?.contains(el)) return;
    if ((el.dataset.on || "click") !== e.type) return;

    const name = el.dataset.action;
    const fn = this.getAction(name);
    if (!fn) {
      console.warn(`FimMap: no action "${name}" registered (and no window.${name} fallback).`, el);
      return;
    }

    let args = [];
    if (el.dataset.args) {
      try {
        args = JSON.parse(el.dataset.args);
        if (!Array.isArray(args)) args = [args];
      } catch {
        console.warn(`FimMap: data-args on action "${name}" is not valid JSON: ${el.dataset.args}`);
        return;
      }
    }
    // `this` is the element, matching how an inline handler behaves.
    return fn.call(el, ...args);
  }

  /**
   * Parses a File, Blob, ArrayBuffer or URL into a Dataset and registers it on this instance. The
   * Dataset comes back unrendered; addLayer draws it.
   *
   * The extension decides the format. Alongside geotiff, geojson, kml, kmz, shp, csv and xyz, the
   * multi-dimensional scientific formats (.nc, .nc4, .cdf, .grib, .grib2, .grb2, .zarr) return a
   * Dataset carrying a time axis for `select()` and `reduce()`. `options` passes through to the
   * parser; `parseSource` lists the per-format keys.
   * @param {File|Blob|ArrayBuffer|string} source
   * @param {Object} [options] - see `io/parse.js`'s `parseSource`
   * @returns {Promise<import('./dataset.js').Dataset>}
   */
  async addDataset(source, options = {}) {
    // Bind this instance's config.resolveUrl into the parse options, so a fetched URL goes through
    // the host's CORS proxy, mirror or auth rules. The resolver closes over this app's config, never
    // a shared pointer. An options.resolveUrl passed by the user still wins.
    const cfg = this.#app.config;
    const opts = cfg.resolveUrl ? { resolveUrl: (u) => proxiedUrl(u, cfg), ...options } : options;
    const ds = await parseSource(source, opts);
    return this.#app._registerDataset(ds);
  }

  /**
   * Creates and renders a Layer of `type`, dispatching to the factory registerLayerType recorded.
   *
   * `type` may be a bare Dataset, as in `fim.addLayer(ds)`, or omitted; either way
   * createLayer infers it from the single source's `Dataset.kind`. A raw File, Blob, ArrayBuffer or
   * URL works too, in the `type` slot or in `opts.source` or `opts.sources`: addDataset() parses it
   * first and it joins `this.datasets`, so `fim.addLayer(file)` needs no separate addDataset() call.
   *
   * Throws for a type with no registered factory. Some factories return a Promise rather than a
   * Layer, i.e. 'raster', whose RasterLayer.render() is async, so this awaits before pushing.
   * Pushing an un-awaited Promise onto `this.layers` would corrupt the registry for anything that
   * iterates it.
   * @param {string|Object|File|Blob|ArrayBuffer} [type] - a registry name, a bare source to infer
   *   from, or a raw file/URL to parse first
   * @param {Object} [opts]
   * @returns {Promise<import('./layer.js').Layer>}
   */
  async addLayer(type, opts = {}) {
    // A spec from layer.toSpec(), rebuilt here as an equivalent layer, usually to put the same data
    // on a second map or provider. It is recognizable by carrying both a string `type` and a
    // `sources` array, which no other accepted first argument does: a Dataset has `kind`, not
    // `type`. The ColorScale is rebuilt from its description rather than shared, so the two layers
    // diverge instead of pointing at one mutable scale.
    if (_looksLikeSpec(type)) {
      const spec = type;
      for (const ds of spec.sources) this.adoptDataset(ds);   // discoverable on THIS app too
      const { colorScale, settings, visible, sources, type: t } = spec;
      const layer = await this.addLayer(t, { ...opts, sources });
      // Settings go through set() after construction rather than as factory options, because a
      // factory takes construction arguments such as `style` and `noData`, which are a different
      // vocabulary from the settings knobs `color`, `opacity` and `palette`. The scale is applied
      // first, so a palette or continuous knob in `settings` writes to the scale this spec brought.
      if (colorScale) layer.set?.({ colorScale: ColorScale.fromJSON(colorScale) });
      if (settings && Object.keys(settings).length) layer.set?.(settings);
      if (visible === false) layer.hide?.();
      return layer;
    }
    if (type != null && typeof type !== "string") type = await _resolveLayerSource(this, type);
    if (opts.source != null || opts.sources != null) {
      opts = {
        ...opts,
        source: opts.source != null ? await _resolveLayerSource(this, opts.source) : opts.source,
        sources: Array.isArray(opts.sources)
          ? await Promise.all(opts.sources.map((s) => _resolveLayerSource(this, s)))
          : opts.sources,
      };
    }
    const layer = await createLayer(this, type, opts);
    this.layers.push(layer);
    this.#layersChanged("added", layer);
    // Restack immediately, so "the array's order is the z-order" holds from the first add rather
    // than from the first panel move. Without this the provider draws in insertion order while
    // hit-testing follows the array, and the two disagree the moment they differ — a layer whose
    // handle attaches late, or any add after a remove.
    this.applyLayerOrder();
    return layer;
  }

  /** The Layer with this id (or null). @param {string} id @returns {import('./layer.js').Layer|null} */
  getLayer(id) { return this.layers.find((l) => l.id === id) || null; }

  /**
   * Registers a Layer under a filename key, the user-file registry floodExtent's
   * toggle_uploaded_file drives, where one displayed user file means one Layer. Sets the layer's
   * `_map` reference so layer.remove() can unregister itself, evicts any prior layer under the same
   * name, and adds this one to `this.layers`.
   * @param {string} name
   * @param {import('./layer.js').Layer} layer
   * @returns {import('./layer.js').Layer}
   */
  registerNamedLayer(name, layer) {
    const prev = this.#layersByName.get(name);
    if (prev && prev !== layer) prev.remove();
    layer._map = this;
    layer._name = name;
    this.#layersByName.set(name, layer);
    if (!this.layers.includes(layer)) {
      this.layers.push(layer);
      this.#layersChanged("added", layer);
      this.applyLayerOrder();
    }
    return layer;
  }

  /** The named user-file Layer for `name` (or null). @param {string} name @returns {import('./layer.js').Layer|null} */
  getLayerByName(name) { return this.#layersByName.get(name) || null; }

  /** All currently-registered named user-file Layers. @returns {import('./layer.js').Layer[]} */
  get namedLayers() { return [...this.#layersByName.values()]; }

  /** Remove a Layer by id or instance — tears down its render and unregisters it. @param {string|import('./layer.js').Layer} idOrLayer @returns {void} */
  removeLayer(idOrLayer) {
    const layer = typeof idOrLayer === "string" ? this.getLayer(idOrLayer) : idOrLayer;
    if (layer) layer.remove();   // remove() calls back into _unregisterLayer
  }

  /**
   * Announces that the layer set changed, by an add, a remove or a reorder.
   *
   * `layers` is a plain public array with no change signal, so ui/layerPanel.js had no way to stay
   * in sync short of polling. One event covers all three, since a panel redraws the whole list
   * either way. `reason` is there for a view that wants to animate insertions alone.
   * @param {'added'|'removed'|'reordered'} reason
   * @param {import('./layer.js').Layer|null} [layer]
   */
  #layersChanged(reason, layer = null) {
    this.emit("layers:changed", { reason, layer, layers: this.layers.slice() });
  }

  /** Internal: drop a Layer from the registry (called by Layer.remove()). @internal @param {import('./layer.js').Layer} layer @returns {void} */
  _unregisterLayer(layer) {
    const i = this.layers.indexOf(layer);
    if (i >= 0) { this.layers.splice(i, 1); this.#layersChanged("removed", layer); }
    if (layer?._name && this.#layersByName.get(layer._name) === layer) {
      this.#layersByName.delete(layer._name);
    }
    if (this.#exclusiveClaimant === layer) this.#exclusiveClaimant = null;
  }

  // ---- Datasets: the app owns them, this class forwards ----
  //
  // One Dataset can back many Layers across many maps, sharing one memoized decode, so the app
  // reference-counts eviction. Layer.setSources acquires the new source and releases the old, and
  // the decode drops only once the last Layer anywhere on the app lets go. A Layer never calls
  // ds.release() itself, which would strand a sibling still rendering the same Dataset.

  /** @internal @param {import('./dataset.js').Dataset} ds @returns {void} */
  _acquireDataset(ds) { this.#app._acquireDataset(ds); }

  /** @internal @param {import('./dataset.js').Dataset} ds @returns {void} */
  _releaseDataset(ds) { this.#app._releaseDataset(ds); }

  // ---- exclusive display claim, replacing ui/activeDisplayLayer.js ----

  /**
   * Hands the map to `layer`, tearing down the previous exclusive layer first so velocity and
   * ensemble stay mutually exclusive. Layer.render() calls it when `layer.exclusive`. Internal.
   * @internal @param {import('./layer.js').Layer} layer @returns {void}
   */
  _claimExclusive(layer) {
    if (this.#exclusiveClaimant && this.#exclusiveClaimant !== layer) this.#exclusiveClaimant.remove?.();
    this.#exclusiveClaimant = layer;
  }

  /** The Layer currently holding the exclusive display slot, or null. @returns {import('./layer.js').Layer|null} */
  get exclusiveClaimant() { return this.#exclusiveClaimant; }

  // ---- map event dispatch (PACKAGE_ROADMAP §1) ------------------------------------------------
  //
  // Subscribes to the provider's normalized map events and routes each to the layers top down in
  // z-order, where the last entry is topmost, hit-testing each and stopping once one absorbs it. It
  // also emits `map:${type}` on the app bus unfiltered, so a view such as a value tooltip sees every
  // event whether it hit a layer or not. That is what lets a hover tooltip hide when the cursor
  // leaves a raster.

  /**
   * Starts routing provider map events, click and hover by default, to layers by hit test and
   * z-order, and mirrors each as `map:${type}` on the bus. Idempotent. Needs a mounted map and a
   * provider implementing onMapEvent.
   * @param {string[]} [types]
   * @param {{ simultaneous?: boolean }} [opts] - simultaneous:true → every hit layer gets the event
   * @returns {FimMap}
   */
  enableMapEvents(types = ["click", "hover"], { simultaneous } = {}) {
    if (simultaneous !== undefined) this.#simultaneous = !!simultaneous;
    if (this.#mapEventUnsubs) return this;   // already on
    const provider = getMapProvider(this.config?.provider || "google");
    const map = this.map;
    if (!map || typeof provider?.onMapEvent !== "function") {
      console.warn("FimMap.enableMapEvents: the provider has no onMapEvent — layer hover/click is unavailable.");
      this.#mapEventUnsubs = [];
      return this;
    }
    this.#mapEventUnsubs = types.map((type) =>
      provider.onMapEvent(map, type, (e) => this._dispatchMapEvent(type, e)));
    return this;
  }

  /** Stop routing provider map events. @returns {FimMap} */
  disableMapEvents() {
    this.#mapEventUnsubs?.forEach((u) => { try { u?.(); } catch { /* ignore */ } });
    this.#mapEventUnsubs = null;
    return this;
  }

  /**
   * Dispatch mode. false, the default, gives precedence: the top hit layer goes first and
   * absorption stops propagation. true delivers the event to each hit layer, with no veto.
   * PACKAGE_ROADMAP §1.
   * @param {boolean} v
   */
  set simultaneousLayerEvents(v) { this.#simultaneous = !!v; }
  /** @returns {boolean} */
  get simultaneousLayerEvents() { return this.#simultaneous; }

  /**
   * Registers a modal interaction, i.e. a region-draw tool, that takes all map events until it is
   * released. While captured, layer dispatch and the `map:${type}` mirror are suppressed and each
   * event goes only to `handler({ type, lat, lng, originalEvent })`. Returns a release function. One
   * capture at a time; a new one replaces the previous. PACKAGE_ROADMAP §1.
   * @param {(evt: {type: string, lat: number, lng: number}) => void} handler
   * @returns {() => void}
   */
  captureInteraction(handler) {
    this.#capture = typeof handler === "function" ? handler : null;
    return () => { if (this.#capture === handler) this.#capture = null; };
  }
  /**
   * Resolves once the map's camera has settled.
   *
   * This exists rather than a `setTimeout` because `fitBounds` and `fit()` animate on both
   * providers, and reading the projection mid-flight returns the pre-animation one. A click captured
   * mid-zoom then resolves to the wrong coordinates, off by exactly 2x when the fit changed zoom by
   * one level. So write `layer.fit(); await fim.whenIdle();` before starting any tool that converts
   * a pointer position into coordinates.
   *
   * Always safe to await: it resolves on a timeout when the map is already still, and immediately
   * when the provider declares no `whenIdle`.
   * @param {{ timeout?: number }} [opts]
   * @returns {Promise<void>}
   */
  /**
   * Turns pan-by-drag on or off.
   *
   * Drag-based selection needs it: a freehand or brush stroke is the same gesture as a map pan, so
   * one has to yield. The tool suppresses dragging for the length of the stroke and restores it on
   * finish or cancel, which is why the restore sits in a `finally` rather than the success path.
   *
   * Does nothing when the provider declares no `setDraggable`, so no feature detection is needed.
   * @param {boolean} on
   * @returns {FimMap}
   */
  setMapDraggable(on) {
    const provider = getMapProvider(this.config?.provider || DEFAULT_PROVIDER);
    if (this.map && typeof provider?.setDraggable === "function") provider.setDraggable(this.map, !!on);
    return this;
  }

  /**
   * Draws a GeoJSON overlay that is not a Layer: a tool's in-progress shape, a rubber band, a
   * highlight. It never enters `fim.layers`, so nothing hit-tests it, reorders it, lists it in the
   * layer panel or saves it. It is scaffolding the user is looking at, not data they loaded.
   *
   * The selection tools are headless by design, producing `{lat,lng}` and naming no map SDK, which
   * left "show me what I am drawing" with nowhere to live. Keeping it here rather than in
   * `fimviz/ui` keeps the provider registry, and Leaflet with it, out of the `dist/ui.js` bundle.
   *
   * @param {Object} geojson - a Feature or FeatureCollection
   * @param {{ style?: Object|Function }} [opts] - the neutral style vocabulary `VectorLayer` uses
   * @returns {*} an opaque handle to pass to {@link removeScratchVector}, or null if there is no map
   */
  addScratchVector(geojson, { style } = {}) {
    const provider = getMapProvider(this.config?.provider || DEFAULT_PROVIDER);
    if (!this.map || typeof provider?.addVector !== "function" || !geojson) return null;
    return provider.addVector(this.map, geojson, { style });
  }

  /** Tear down a handle from {@link addScratchVector}. Safe on null. @param {*} handle @returns {FimMap} */
  removeScratchVector(handle) {
    const provider = getMapProvider(this.config?.provider || DEFAULT_PROVIDER);
    if (handle && this.map && typeof provider?.removeVector === "function") {
      try { provider.removeVector(this.map, handle); } catch { /* already gone */ }
    }
    return this;
  }

  /**
   * Ground meters per screen pixel, with the map's pixel size. A tool uses these to size itself in
   * screen units, i.e. a brush that keeps its width as the user zooms, without touching a map SDK.
   * @returns {{metresPerPixel: number, width: number, height: number}|null} null when unavailable
   */
  viewMetrics() {
    const provider = getMapProvider(this.config?.provider || DEFAULT_PROVIDER);
    if (!this.map || typeof provider?.viewMetrics !== "function") return null;
    return provider.viewMetrics(this.map);
  }

  async whenIdle(opts = {}) {
    const provider = getMapProvider(this.config?.provider || DEFAULT_PROVIDER);
    const map = this.map;
    if (!map || typeof provider?.whenIdle !== "function") return;
    await provider.whenIdle(map, opts);
  }

  /**
   * Pushes this instance's layer order down to the map, so what is drawn on top matches what
   * `layers` says is on top.
   *
   * `dispatchMapEventToLayers` already walks `layers` top down and treats the last entry as topmost
   * for hit-testing, but visual stacking was whatever order the provider inserted overlays in. The
   * two could disagree, so the layer receiving a click was not necessarily the one drawn on top.
   * This makes the array decide both.
   *
   * Called automatically after every add (addLayer, registerNamedLayer) and by the layer panel after
   * a move, so a host only calls it directly when it reorders `layers` itself.
   * @returns {FimMap}
   */
  applyLayerOrder() {
    const provider = getMapProvider(this.config?.provider || DEFAULT_PROVIDER);
    const map = this.map;
    if (!map || typeof provider?.applyLayerOrder !== "function") return this;
    // The array's own order runs bottom to top. Each layer exposes one provider handle, and a layer
    // with none yet, never rendered or hidden by teardown, has no place in the stack.
    const owners = this.layers.filter((l) => l._providerHandle);
    const reordered = provider.applyLayerOrder(map, owners.map((l) => l._providerHandle));
    // A provider may return replaced handles, since Google recreates ground overlays, so adopt them.
    // Otherwise the next removeLayer() or opacity change would act on a handle no longer on the map.
    owners.forEach((l, i) => { if (reordered[i] !== undefined) l._adoptProviderHandle(reordered[i]); });
    return this;
  }

  /** Release any modal interaction, restoring normal layer dispatch. @returns {FimMap} */
  releaseInteraction() { this.#capture = null; return this; }
  /** Is a modal interaction currently capturing events? @returns {boolean} */
  get capturing() { return !!this.#capture; }

  /**
   * Mirrors the event on the bus, then dispatches to layers top down with absorption. Internal.
   * @internal @param {string} type @param {{lat:number,lng:number,originalEvent?:any}} base @returns {Object}
   */
  _dispatchMapEvent(type, base) {
    if (this.#capture) { this.#capture({ ...base, type }); return null; }   // modal: swallow layer dispatch
    this.emit(`map:${type}`, base);
    return dispatchMapEventToLayers(this.layers, type, base, { simultaneous: this.#simultaneous });
  }

  /**
   * Best-effort teardown for an SPA unmount. Detaches the map, removes injected markup, and
   * releases this map from its app, which frees the default app's shared services once the last map
   * goes. Module-level singletons inside host subsystems are left alone.
   * @returns {void}
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    if (this.#onEvent && this.#root) {
      for (const type of ["click", "change", "input"]) {
        this.#root.removeEventListener(type, this.#onEvent);
      }
      this.#onEvent = null;
    }
    this.disableMapEvents();
    this.#actions.clear();
    this.#panel?.deactivate?.();
    this.#panel = null;
    this.#map = null;
    this.#teardown?.();
    if (this.#injected && this.#root) this.#root.innerHTML = "";
    this.#app._release(this);
  }
}
