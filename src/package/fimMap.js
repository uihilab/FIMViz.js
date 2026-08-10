// fimMap.js — one mounted widget instance.
//
// A FimMap owns the map + its registries (datasets/layers) and belongs to a FimViz (the
// ambient service container that holds config, the event bus, and — later — storage). It
// carries a concrete reference UP the chain (`app`) so operations never resolve "the current
// app" lazily (see docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
//
// The host runtime owns map boot. This class reaches it through INJECTED accessors (`getMap`/
// `teardown`, supplied by mount.js) rather than importing the runtime — otherwise the core instance
// object could not be constructed without pulling in the Maps loader and every layer subsystem
// transitively. Same rule as Dataset → GDAL: dependencies point INWARD to the model, never out to
// infrastructure.

import { parseSource } from "../io/parse.js";
import { proxiedUrl } from "./config.js";
import { createLayer, dispatchMapEventToLayers } from "./layer.js";
import { getMapProvider, DEFAULT_PROVIDER } from "./mapProvider.js";
import { ColorScale } from "./colorScale.js";

// `#foo` -> `[id="foo"]` for the exact-id case only. See $() below for why.
const ID_ONLY = /^#([A-Za-z_][\w-]*)$/;
const _scopedSel = (sel) => {
  const m = ID_ONLY.exec(String(sel).trim());
  return m ? `[id="${m[1]}"]` : sel;
};

// A Dataset already has a materialize hook; anything else shaped like a comparison {pixels,meta}
// source has neither and isn't parseable anyway, so it passes through untouched for the layer
// factory to consume as-is.
const _looksLikeDataset = (v) => typeof v === "object" && v != null
  && (typeof v.load === "function" || typeof v.grid === "function");
// The same source shapes addDataset()/parseFile() already accept (File extends Blob in a browser).
const _looksLikeRawSource = (v) => (typeof Blob !== "undefined" && v instanceof Blob)
  || v instanceof ArrayBuffer || typeof v === "string";
// A layer.toSpec() descriptor: a string `type` PLUS a sources array. No other accepted
// first-argument shape has both (a Dataset carries `kind`, a raw file is a Blob/ArrayBuffer/string).
const _looksLikeSpec = (v) => typeof v === "object" && v != null
  && typeof v.type === "string" && Array.isArray(v.sources);

// provider map object -> the FimMap that owns it. Populated by _adoptMap().
//
// This is how engine code that was handed a raw provider map (a google.maps.Map / L.Map — what the
// overlay subsystems receive) finds its owning instance. The alternative, reaching for
// `FimViz.current()?.maps?.[0]`, hardcodes the DEFAULT app's FIRST map: correct only while exactly
// one widget exists, and silently wrong (optional-chained to a no-op) the moment a second mounts.
// A WeakMap, so a destroyed map is collectable with no bookkeeping.
const _byProviderMap = new WeakMap();

/**
 * The FimMap that owns `providerMap`, or null if it is not one this library mounted.
 * @param {*} providerMap - a `google.maps.Map`, `L.Map`, or another provider's map object
 * @returns {FimMap|null}
 */
export function fimForMap(providerMap) {
  if (!providerMap || typeof providerMap !== "object") return null;
  return _byProviderMap.get(providerMap) || null;
}

/**
 * Parse `v` into a Dataset via addDataset() if it's a raw File/Blob/ArrayBuffer/URL; a Dataset (or any
 * other source shape, e.g. a comparison {pixels,meta}) passes through unchanged. Lets addLayer take
 * a raw file directly, the same as addDataset does, instead of requiring a separate `await
 * fim.addDataset(file)` step first.
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
   * The provider's map object. Advisory / read-mostly (see docs/usage/USAGE.md).
   *
   * Each instance OWNS its own reference — mount.js calls `_adoptMap()` once boot completes. This
   * must not resolve through a runtime-level accessor, or every FimMap on a page would answer with
   * whichever map booted last. `#getMap` is only a fallback for a runtime that never reports one.
   */
  /** @returns {*} the provider's map object — a `google.maps.Map`, an `L.Map`, or another provider's type */
  get map() { return this.#map ?? this.#getMap?.() ?? null; }

  /**
   * Record the google.maps.Map this instance booted. Called by mount.js after the runtime's
   * bootstrap() resolves. Internal — hosts use `fim.map`.
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
   * Datasets parsed on this app — SHARED with every other map on it, exactly like `storage`.
   *
   * A Dataset is a free value with no back-pointer to a map, so a file parsed here (by `addDataset`,
   * or implicitly by `addLayer(rawFile)`) is directly usable as a source for a Layer on another
   * map, of another provider, with no re-parse and no second decode. Rendering state — `layers` —
   * stays per-map.
   * @returns {import('./dataset.js').Dataset[]}
   */
  get datasets() { return this.#app.datasets; }

  /** Register a Dataset parsed elsewhere on this map's app. @param {*} ds @returns {*} */
  adoptDataset(ds) { return this.#app.adoptDataset(ds); }

  /**
   * Forget a Dataset — drops it from the app registry and releases its decode. Throws while any
   * layer on this app still renders it (pass `{ force: true }` to override).
   * @param {*} ds @param {{force?: boolean}} [opts] @returns {boolean}
   */
  removeDataset(ds, opts) { return this.#app.removeDataset(ds, opts); }

  /**
   * This instance's runtime config — always the app that owns THIS map, so two isolated apps on one
   * page never read each other's settings. This is THE way the engine reads config: there is no
   * ambient config pointer (the only module-level runtime value is gdalPath, which is process-global
   * because GDAL is a per-page singleton). See package/config.js.
   * @returns {Object}
   */
  get config() { return this.#app.config; }

  /**
   * This instance's Layer Panel — the per-instance UI object, lazily built against #root via the
   * factory mount.js injects (createLayerPanel). The model never imports ui/; the composition root
   * wires it in, same rule as getMap/teardown. Null when no factory was injected (headless boot).
   * Replaces the module-level `window.layerPanel` singleton, so two maps drive their own panels.
   * @returns {*}
   */
  get layerPanel() {
    if (!this.#panel && this.#createPanel) this.#panel = this.#createPanel(this.#root);
    return this.#panel;
  }

  /**
   * Scoped query helpers — resolve against this instance's root, not the whole document.
   * The linchpin for multi-instance: duplicate IDs across instances stop being ambiguous
   * Prefer these over `document.getElementById` so two widgets on one page cannot collide.
   *
   * A bare `#id` is rewritten to the equivalent `[id="..."]`. Per spec these are identical, but
   * some engines optimize `#id` by routing through document.getElementById — which returns only
   * the FIRST match in the document and then filters to the subtree, so a scoped lookup finds
   * NOTHING when ids repeat across instances. That is precisely our case: two widgets both carry
   * `#layer-panel`. jsdom/nwsapi does exactly this (browsers do not), so without the rewrite the
   * property cannot even be tested. The attribute form is engine-independent.
   *
   * Only an exact `#identifier` is rewritten — that is what the ~604 getElementById call sites
   * migrate to. Compound selectors are passed through untouched (rewriting inside them risks
   * mangling quoted attribute values), so they remain subject to the engine quirk above.
   * @param {string} sel
   * @returns {Element|null}
   */
  $(sel) { return (this.#root || document).querySelector(_scopedSel(sel)); }
  /** @param {string} sel @returns {Element[]} */
  $$(sel) { return [...(this.#root || document).querySelectorAll(_scopedSel(sel))]; }

  // Events are on the app's shared bus; a FimMap delegates to it (single-instance today,
  // shared across maps on a page).
  /** @param {string} evt @param {(payload: any) => void} fn @returns {FimMap} */
  on(evt, fn) { this.#app.on(evt, fn); return this; }
  /** @param {string} evt @param {(payload: any) => void} fn @returns {FimMap} */
  off(evt, fn) { this.#app.off(evt, fn); return this; }
  /** @param {string} evt @param {*} [payload] @returns {FimMap} */
  emit(evt, payload) { this.#app.emit(evt, payload); return this; }

  // NOTE: there is no getMap(). `fim.map` (the getter above) is the single accessor — a noun for
  // state, a verb only for work. The v0 `getMap()` alias returned exactly `this.map` and was removed
  // rather than deprecated, so there is one name for one concept.

  // ---- delegated actions -------------------------------------------------------------------
  //
  // Replaces the inline `onclick="fn('a')"` → `window.fn` bridge with ONE delegated listener per
  // instance, scoped to this map's root. Markup declares:
  //
  //     <button data-action="damageEstimate">                       (click is the default)
  //     <input  data-action="handleOptionsToggle" data-on="change" data-args='["fd"]'>
  //
  // The handler is invoked as `fn.call(el, ...args)` — `this` is the element, exactly as an inline
  // handler behaves — so existing functions migrate without changing their bodies. `data-on` is
  // REQUIRED for non-click events because a checkbox fires click AND change: dispatching on both
  // would fire every handler twice.
  //
  // Resolution order: this instance's registry, then `window[name]`. The window fallback is
  // TRANSITIONAL — it is what makes the migration incremental (convert the markup once, then move
  // subsystems off `window.*` one at a time). It is also why this is per-instance from day one:
  // the registry is the thing that eventually makes two widgets on a page independent.

  /**
   * Register a handler for `data-action="name"`.
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
   * Register many at once: registerActions({ foo, bar }).
   * @param {Object<string, (this: Element, ...args: any[]) => void>} [map]
   * @returns {FimMap}
   */
  registerActions(map = {}) {
    for (const [name, fn] of Object.entries(map)) this.registerAction(name, fn);
    return this;
  }

  /**
   * The handler for `name` — this instance's registry first, then the transitional window bridge.
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
    // Scope check: only elements inside THIS instance's root (a shared document may hold others).
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
    // `this` = the element, mirroring inline-handler semantics.
    return fn.call(el, ...args);
  }

  /**
   * Parse a source (File | Blob | ArrayBuffer | URL) into a Dataset and register it on this
   * instance. Returns the Dataset (not yet rendered — addLayer draws it).
   *
   * Format comes from the extension: geotiff, geojson, kml, kmz, shp, csv, xyz, and the
   * multi-dimensional scientific formats (.nc/.nc4/.cdf, .grib/.grib2/.grb2, .zarr), which return a
   * Dataset carrying a **time axis** to `select()` and `reduce()` over. `options` is passed through
   * to the parser — see `parseSource` for the per-format keys.
   * @param {File|Blob|ArrayBuffer|string} source
   * @param {Object} [options] - see `io/parse.js`'s `parseSource`
   * @returns {Promise<import('./dataset.js').Dataset>}
   */
  async addDataset(source, options = {}) {
    // Bind this instance's URL resolver (config.resolveUrl) into the parse options, so a fetched URL
    // goes through the host's CORS-proxy/mirror/auth rules. Instance-safe: the resolver closes over
    // THIS app's config, never a shared pointer. A caller-supplied options.resolveUrl still wins.
    const cfg = this.#app.config;
    const opts = cfg.resolveUrl ? { resolveUrl: (u) => proxiedUrl(u, cfg), ...options } : options;
    const ds = await parseSource(source, opts);
    return this.#app._registerDataset(ds);
  }

  /**
   * Create a rendered Layer of `type`. Dispatches to the subsystem factory registered via
   * registerLayerType. `type` can be a bare Dataset instead of a registry string — `fim.addLayer(ds)`
   * — or omitted, in either case inferred from the (single) source's `Dataset.kind` (see
   * createLayer). A raw File/Blob/ArrayBuffer/URL works too, in the `type` slot or in
   * `opts.source`/`opts.sources` — it is parsed into a Dataset via addDataset() first (and lands in
   * `this.datasets`, same as calling addDataset() yourself), so `fim.addLayer(file)` needs no separate
   * addDataset() step. Throws for types with no registered factory. Some factories (e.g. 'raster', whose
   * RasterLayer.render() is the async base implementation) return a Promise rather than a Layer, so
   * this must await before pushing — pushing an un-awaited Promise onto `this.layers` would silently
   * corrupt the registry for every consumer that iterates it.
   * @param {string|Object|File|Blob|ArrayBuffer} [type] - a registry name, a bare source to infer
   *   from, or a raw file/URL to parse first
   * @param {Object} [opts]
   * @returns {Promise<import('./layer.js').Layer>}
   */
  async addLayer(type, opts = {}) {
    // A SPEC from layer.toSpec() — rebuild an equivalent layer here, typically to put the same data
    // on a second map or a second provider. Distinguished by carrying both a string `type` and a
    // `sources` array, which none of the other accepted first-argument shapes do (a Dataset has
    // `kind`, not `type`). The ColorScale is REBUILT from its description, never shared, so the two
    // layers diverge instead of silently pointing at one mutable scale.
    if (_looksLikeSpec(type)) {
      const spec = type;
      for (const ds of spec.sources) this.adoptDataset(ds);   // discoverable on THIS app too
      const { colorScale, settings, visible, sources, type: t } = spec;
      const layer = await this.addLayer(t, { ...opts, sources });
      // Settings are applied through set() AFTER construction, not passed as factory options: a
      // factory takes construction args (`style`, `noData`), which are not the same vocabulary as
      // the settings knobs (`color`, `opacity`, `palette`). The scale goes first so that any
      // palette/continuous knob in `settings` lands on the scale this spec brought.
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
    return layer;
  }

  /** The Layer with this id (or null). @param {string} id @returns {import('./layer.js').Layer|null} */
  getLayer(id) { return this.layers.find((l) => l.id === id) || null; }

  /**
   * Register a Layer under a filename key — the user-file registry that floodExtent's
   * toggle_uploaded_file drives (one displayed user file → one Layer). Wires the up-chain `_map`
   * ref so layer.remove() can unregister itself, evicts any prior layer under the same name, and
   * adds the layer to `this.layers`.
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
    if (!this.layers.includes(layer)) { this.layers.push(layer); this.#layersChanged("added", layer); }
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
   * Announce that the layer SET changed — added, removed, or reordered.
   *
   * `layers` is a plain public array with no change signal of its own, so anything rendering a view
   * of it (ui/layerPanel.js) had no way to stay in sync short of polling. One event covers all three
   * mutations because a panel redraws the whole list either way; `reason` is there for a consumer
   * that wants to animate only insertions.
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

  // ---- Dataset lifecycle — owned by the APP, delegated from here ----
  //
  // One Dataset can back many Layers, on many maps, sharing one memoized decode. So eviction is
  // ref-counted at the APP: Layer.setSources acquires the new source and releases the old, and the
  // decode is dropped only when the last Layer ANYWHERE on the app lets go. Layers never call
  // ds.release() directly — that would strand a sibling still rendering the same Dataset.

  /** @internal @param {import('./dataset.js').Dataset} ds @returns {void} */
  _acquireDataset(ds) { this.#app._acquireDataset(ds); }

  /** @internal @param {import('./dataset.js').Dataset} ds @returns {void} */
  _releaseDataset(ds) { this.#app._releaseDataset(ds); }

  // ---- exclusive display claim — formalizes ui/activeDisplayLayer.js ----

  /**
   * Internal: `layer` (an exclusive display-claiming Layer) is taking the map. Tear down the prior
   * claimant first, so velocity/ensemble stay mutually exclusive. Called by Layer.render() when
   * `layer.exclusive`.
   * @internal @param {import('./layer.js').Layer} layer @returns {void}
   */
  _claimExclusive(layer) {
    if (this.#exclusiveClaimant && this.#exclusiveClaimant !== layer) this.#exclusiveClaimant.remove?.();
    this.#exclusiveClaimant = layer;
  }

  /** The Layer currently holding the exclusive display slot, or null. @returns {import('./layer.js').Layer|null} */
  get exclusiveClaimant() { return this.#exclusiveClaimant; }

  // ---- map event dispatch (the event-dispatch first slice — PACKAGE_ROADMAP §1) ---------------
  //
  // Subscribes to the provider's normalized map events and routes each to the layers TOP-DOWN in
  // z-order (last = top), hit-testing each layer and stopping when one absorbs it. It also emits an
  // UNFILTERED `map:${type}` on the app bus so a consumer (e.g. a value tooltip) can react to every
  // event, hit or miss — that is what lets a hover tooltip hide when the cursor leaves a raster.

  /**
   * Start routing provider map events (default: click + hover) to layers via hitTest + z-order
   * dispatch, and mirror each as `map:${type}` on the bus. Idempotent; needs a mounted map and a
   * provider that implements onMapEvent.
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
   * Dispatch mode. false (default) = precedence: top hit layer first, absorption stops propagation.
   * true = simultaneous: every hit-tested layer receives the event (no veto). PACKAGE_ROADMAP §1.
   * @param {boolean} v
   */
  set simultaneousLayerEvents(v) { this.#simultaneous = !!v; }
  /** @returns {boolean} */
  get simultaneousLayerEvents() { return this.#simultaneous; }

  /**
   * Register a MODAL interaction (e.g. a region-draw tool) that takes ALL map events until released.
   * While captured, the normal layer dispatch + `map:${type}` mirror are suppressed — every event
   * goes only to `handler({ type, lat, lng, originalEvent })`. Returns a release function; only one
   * capture at a time (a new one replaces the prior). PACKAGE_ROADMAP §1.
   * @param {(evt: {type: string, lat: number, lng: number}) => void} handler
   * @returns {() => void}
   */
  captureInteraction(handler) {
    this.#capture = typeof handler === "function" ? handler : null;
    return () => { if (this.#capture === handler) this.#capture = null; };
  }
  /**
   * Resolve once the map's camera has settled.
   *
   * The reason this exists rather than a `setTimeout`: `fitBounds`/`fit()` are ANIMATED on both
   * providers, and anything that reads the projection while one is in flight gets the pre-animation
   * one. A click captured mid-zoom therefore lands at the wrong coordinates — off by exactly 2× when
   * the fit changed zoom by one level. So the rule is `layer.fit(); await fim.whenIdle();` before
   * starting any tool that converts pointer position to coordinates.
   *
   * Safe to await unconditionally: it resolves on a timeout when the map is already still, and
   * resolves immediately when the provider declares no `whenIdle` at all.
   * @param {{ timeout?: number }} [opts]
   * @returns {Promise<void>}
   */
  /**
   * Turn pan-by-drag on or off.
   *
   * Exists for drag-based selection: a freehand or brush stroke is the SAME gesture as a map pan, so
   * one of the two has to give. The tool suppresses dragging for the length of the stroke and
   * restores it on finish/cancel — which is why restoring is in a `finally`, not on the happy path.
   *
   * A no-op when the provider declares no `setDraggable`, so a caller never has to feature-detect.
   * @param {boolean} on
   * @returns {FimMap}
   */
  setMapDraggable(on) {
    const provider = getMapProvider(this.config?.provider || DEFAULT_PROVIDER);
    if (this.map && typeof provider?.setDraggable === "function") provider.setDraggable(this.map, !!on);
    return this;
  }

  /**
   * Draw a GeoJSON overlay that is NOT a Layer — a tool's in-progress shape, a rubber band, a
   * highlight. It never enters `fim.layers`, so it is not hit-tested, not reordered, not listed in the
   * layer panel and not saved: it is scaffolding the user is looking at, not data they loaded.
   *
   * This exists because the selection tools are headless by design — they produce `{lat,lng}` and name
   * no map SDK — which left "show me what I am drawing" with nowhere to live. Putting it here rather
   * than in `fimviz/ui` keeps the provider registry (and Leaflet) out of the `dist/ui.js` bundle.
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
   * Ground metres per screen pixel, plus the map's pixel size — what lets a tool be sized in SCREEN
   * units (a brush that stays the same width as you zoom) without touching a map SDK.
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
   * Push this instance's layer order down to the map, so what is DRAWN on top matches what
   * `layers` says is on top.
   *
   * Worth being explicit about why this is needed at all: `dispatchMapEventToLayers` already walks
   * `layers` top-down and treats the last entry as the topmost for hit-testing, but visual stacking
   * has only ever been whatever order the provider happened to insert overlays in. The two could
   * therefore disagree — the layer that received a click was not necessarily the one drawn on top.
   * This makes the array authoritative for both.
   * @returns {FimMap}
   */
  applyLayerOrder() {
    const provider = getMapProvider(this.config?.provider || DEFAULT_PROVIDER);
    const map = this.map;
    if (!map || typeof provider?.applyLayerOrder !== "function") return this;
    // Bottom → top is the array's own order. Each layer exposes ONE provider handle; a layer with
    // none yet (never rendered, or hidden by teardown) simply has no place in the stack.
    const owners = this.layers.filter((l) => l._providerHandle);
    const reordered = provider.applyLayerOrder(map, owners.map((l) => l._providerHandle));
    // A provider may hand back REPLACED handles (Google recreates ground overlays), so adopt them or
    // the next removeLayer()/opacity change would act on a handle no longer on the map.
    owners.forEach((l, i) => { if (reordered[i] !== undefined) l._adoptProviderHandle(reordered[i]); });
    return this;
  }

  /** Release any modal interaction, restoring normal layer dispatch. @returns {FimMap} */
  releaseInteraction() { this.#capture = null; return this; }
  /** Is a modal interaction currently capturing events? @returns {boolean} */
  get capturing() { return !!this.#capture; }

  /**
   * Internal: mirror the event on the bus, then dispatch to layers top-down with absorption.
   * @internal @param {string} type @param {{lat:number,lng:number,originalEvent?:any}} base @returns {Object}
   */
  _dispatchMapEvent(type, base) {
    if (this.#capture) { this.#capture({ ...base, type }); return null; }   // modal: swallow layer dispatch
    this.emit(`map:${type}`, base);
    return dispatchMapEventToLayers(this.layers, type, base, { simultaneous: this.#simultaneous });
  }

  /**
   * Best-effort teardown for SPA unmount. Detaches the map, removes injected markup, and
   * releases this map from its app (which frees the ambient default's shared services when
   * the last map goes). Module-level singletons in host subsystems are NOT reset.
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
