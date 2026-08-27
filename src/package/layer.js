// layer.js — abstract base for a rendered visualization of Dataset(s) on the map.
//
// A Layer is one rendering of a Dataset, or of several, since comparison and velocity take two.
// This base class defines what they share and their registry identity; a subclass does the actual
// map render.
//
// A subclass registers a factory with registerLayerType(type, fn), so FimMap.addLayer dispatches by
// type without importing every subsystem. An unregistered type throws and names the registered ones
// rather than doing nothing.
//
// A Layer emits events, the way Leaflet's L.Evented does, and a UI subscribes. That inversion is
// what keeps the package embeddable: a Layer never imports, names or calls a UI panel or a DOM
// element. Dependencies flow from UI to Layer and never back. A layer calling a panel directly would
// weld one app's UI onto the map layer and race its teardown.
//
// The two events, whose payload always carries { layer, ...extra }:
//   'rendered'  the overlay is on the map and its data is ready. `extra` holds what a UI needs to
//               draw tools: pixel data, meta, image, type and filename. The subclass fires it.
//   'removed'   the layer has been torn down. remove() fires it synchronously, so a UI reacting to
//               it does not wait on the map SDK's own asynchronous removal.

import { createEmitter, emitHost } from "./events.js";
import { getMapProvider, providerAcceptsCRS, DEFAULT_PROVIDER } from "./mapProvider.js";
import { Legend } from "./legend.js";
import { Stats } from "./stats.js";
import { gridToDataURL, rangeOf } from "./rasterImage.js";
import { rasterRenderPlan, toMercatorRows } from "../geo/mercator.js";
import { ColorScale } from "./colorScale.js";
import { LayerSettings, RasterSettings, VectorSettings } from "./layerSettings.js";

let _seq = 0;
const nextId = () => `layer_${Date.now().toString(36)}_${(++_seq).toString(36)}`;

/**
 * Guards the `set({ colorScale })` paths on raster and vector alike. Validates before mutating, so
 * a bad argument, usually a palette-name string meant for `set({ palette })`, throws cleanly rather
 * than leaving `layer.colorScale` half set.
 * @param {*} cs
 * @returns {void}
 */
function assertColorScale(cs) {
  if (cs != null && typeof cs.onChange !== "function") {
    throw new Error(
      `layer.set({ colorScale }): expected a ColorScale instance (or null), got ${typeof cs === "string" ? `the string "${cs}"` : typeof cs}. ` +
      "Construct one first — new ColorScale({ palette: '...', min, max }) — or, to just change the " +
      "palette on the already-attached scale, call layer.set({ palette: '...' }) instead.");
  }
}

export class Layer {
  /**
   * @param {Object} [opts]
   * @param {import('./fimMap.js').FimMap|null} [opts.map] - the owning FimMap
   * @param {string|null} [opts.type] - discriminator among siblings of one class (e.g. 'vector')
   * @param {import('./dataset.js').Dataset[]} [opts.sources] - 1 for most layers; 2 for comparison/velocity
   * @param {string} [opts.id] - stable id; auto-generated when omitted
   */
  constructor({ map = null, type = null, sources = [], id, exclusive = false } = {}) {
    this.id = id || nextId();
    this.type = type;              // discriminator among siblings of one class
    this.sources = sources;        // Dataset[] — 1 for most; 2 for comparison/velocity
    this._map = map;               // the owning FimMap (up-chain ref)
    this.visible = false;
    // A display-claiming layer owns the whole map, i.e. velocity, so activating one deactivates the
    // previous claimant. FimMap._claimExclusive enforces it, replacing ui/activeDisplayLayer.js.
    // Most layers coexist, so this defaults to false.
    this.exclusive = exclusive;
    this._name = null;             // filename key when registered in FimMap's named-layer index
    this._teardown = null;         // optional render-teardown hook (see remove())
    this._emitter = null;          // lazily created on first on()/emit() — costs nothing unused
    // Reference-count the initial sources so the app's count is balanced from the start; setSources
    // acquires and releases on each later swap. Optional-chained, so a fake map or a non-Dataset
    // source such as comparison's {pixels,meta} does nothing.
    for (const ds of this.sources) this._map?._acquireDataset?.(ds);
  }

  // ---- the layer-type registry, as statics on the type it serves ---------------------------
  //
  // `fim.addLayer(type, opts)` dispatches through this. It lives on Layer because a factory
  // registered here builds a Layer, and one import of the class beats two loose exports.

  /**
   * Registers the factory `fim.addLayer('<type>')` dispatches to.
   * @param {string} type
   * @param {(fim: import('./fimMap.js').FimMap, opts: Object) => Layer|Promise<Layer>} factory
   * @returns {void}
   */
  static registerType(type, factory) { return registerLayerType(type, factory); }

  /**
   * The types `addLayer` can construct, built-in and host-registered. These are registry keys, not
   * `layer.type` values; see `getLayerTypes`.
   * @returns {string[]}
   */
  static types() { return getLayerTypes(); }

  /** The owning FimMap. @returns {import('./fimMap.js').FimMap|null} */
  get map() { return this._map; }
  /** Convenience = sources[0]. @returns {import('./dataset.js').Dataset|null} */
  get dataset() { return this.sources[0] || null; }

  // ---- events: a Layer fires, a UI subscribes, and a Layer never names a UI ----
  /** @param {string} evt @param {(payload: Object) => void} fn @returns {Layer} */
  on(evt, fn) {
    (this._emitter ??= createEmitter()).on(evt, fn);
    (this._counts ??= new Map()).set(evt, (this._counts.get(evt) || 0) + 1);
    return this;
  }
  /** @param {string} evt @param {(payload: Object) => void} fn @returns {void} */
  off(evt, fn) {
    this._emitter?.off(evt, fn);
    if (this._counts?.has(evt)) this._counts.set(evt, Math.max(0, (this._counts.get(evt) || 0) - 1));
    return this;
  }
  /** Does this layer have at least one listener for `evt`? Lets the map dispatch skip uninterested layers. @param {string} evt @returns {boolean} */
  _hasListeners(evt) { return (this._counts?.get(evt) || 0) > 0; }
  /** @param {string} evt @param {(payload: Object) => void} fn @returns {Layer} */
  once(evt, fn) {
    const wrap = (p) => { this.off(evt, wrap); fn(p); };
    return this.on(evt, wrap);
  }
  /**
   * Fires `evt`. A listener receives `{ ...payload, layer: this }`.
   *
   * The event reaches two places, so both of these see it:
   *
   *   layer.on('rendered')              this one layer
   *   fim.on('userRaster:rendered')     any layer of that type on this map
   *
   * The second comes from the first, forwarded under `${type}:${evt}`, so a new layer type gets it
   * with no extra work.
   *
   * Forwarding is skipped when the layer has no `type` to namespace with, or no owning map.
   * Subsystems emitting on the map bus themselves, i.e. velocity's `*:activated` names, are
   * unaffected, since those are different event names and nothing double-fires.
   * @param {string} evt
   * @param {Object} [payload]
   * @returns {Layer}
   */
  emit(evt, payload = {}) {
    const full = { ...payload, layer: this };
    this._emitter?.emit(evt, full);
    if (this.type && this._map?.emit) this._map.emit(`${this.type}:${evt}`, full);
    return this;
  }

  // ---- setup and teardown; a subclass overrides the render half ----
  /** @returns {void} */
  show() { this.visible = true; }
  /** @returns {void} */
  hide() { this.visible = false; }
  /** Fit the map to this layer's bounds. @returns {void} */
  fit() {}

  // ---- the render/compute pipeline ----
  //
  // One public verb. `await layer.render()` computes if needed, checks the map provider can render
  // the source CRS, then draws. `compute()` returns the result without drawing.
  //
  // A single-source layer materializes one Dataset and a derived layer such as comparison aligns and
  // reduces several, but that is a difference inside compute() rather than two class hierarchies.
  // `_draw()` is the only part touching a provider, and the base version does nothing, since the
  // headless subsystems render from the emitted data through a binder instead.
  //
  // VectorLayer overrides render() with a synchronous one, because adding vector features to a
  // provider needs no decode. Awaiting either works.

  /**
   * Computes this layer's render-ready result. By default it forces the primary source Dataset into
   * its decoded grid or features and memoizes that on `this.result`. A derived subclass overrides
   * this to align and reduce several sources.
   * @param {Object} [opts]
   * @returns {Promise<*>}
   */
  async compute(opts = {}) {   // eslint-disable-line no-unused-vars
    const ds = this.sources[0];
    this.result = ds && typeof ds.load === "function" ? await ds.load() : null;
    return this.result;
  }

  /**
   * Renders this layer: computes if needed, checks the provider CRS precondition, then draws.
   *
   * `opts.render` picks the update mechanism. `'in-place'` swaps the overlay's image, avoiding a
   * flicker and keeping z-order and identity. `'recreate'` tears down and redraws. `'auto'`, the
   * default, goes in-place when the provider and this layer's render type allow it and recreates
   * otherwise. On success it claims the exclusive display slot when `this.exclusive`.
   * @param {Object} [opts] - { render?: 'auto'|'in-place'|'recreate' }
   * @returns {Promise<Layer>}
   */
  async render(opts = {}) {
    if (this.result == null) await this.compute(opts);
    this._checkProviderCRS();
    const mode = this._resolveRenderMode(opts.render || "auto");
    // this._draw resolves through the prototype chain, so this is true only when no subclass
    // overrode it: a bare `Layer`, or one whose subclass forgot. Otherwise render() succeeds and
    // draws nothing, which looks exactly like a bug.
    if (this._draw === Layer.prototype._draw) {
      console.warn(
        `Layer.render(): "${this.type || this.id}" has no _draw() override, so this will draw ` +
        "nothing. Use a concrete subclass (RasterLayer/VectorLayer/...), or override _draw() " +
        "yourself if this is meant to be a headless layer that renders via an emitted event instead.");
    }
    await this._draw({ ...opts, mode });
    this.visible = true;
    this._dirty = false;   // what is drawn now matches the sources (see the chainable ops)
    if (this.exclusive) this._map?._claimExclusive?.(this);
    return this;
  }

  /**
   * Replaces this layer's source Datasets, re-rendering when the layer is live. Data is immutable,
   * so changing it means pointing at a new Dataset rather than mutating one. It acquires the new
   * sources before releasing the old, so a Dataset another layer shares is not evicted mid-swap.
   * `opts.render` chooses the update mechanism (see render()).
   *
   * Atomic. If the re-render throws, because the new sources have an unrenderable CRS or a
   * materializer fetch failed, the swap rolls back: `sources` and `result` return to their previous
   * values, the new sources' acquire is undone, and the error rethrows. The screen never changed
   * either way, since a failed render draws nothing, so the layer's state matches it. The swap fully
   * succeeded, or the layer is exactly as it was, never pointing at broken sources with the working
   * ones already released.
   * @param {import('./dataset.js').Dataset|import('./dataset.js').Dataset[]} sources
   * @param {Object} [opts] - { render?: 'auto'|'in-place'|'recreate' }
   * @returns {Promise<Layer>}
   */
  async setSources(sources, opts = {}) {
    const next = Array.isArray(sources) ? sources : [sources];
    const wasLive = this.visible && this.result != null;
    const prev = this.sources;
    const prevResult = this.result;
    for (const ds of next) this._map?._acquireDataset?.(ds);   // acquire new BEFORE touching anything else
    this.sources = next;
    this.result = null;                                        // invalidate the memoized compute
    if (wasLive) {
      try {
        await this.render(opts);
      } catch (e) {
        for (const ds of next) this._map?._releaseDataset?.(ds);   // undo the new acquire
        this.sources = prev;                                       // prev was never released — no re-acquire needed
        this.result = prevResult;
        throw e;
      }
    }
    for (const ds of prev) this._map?._releaseDataset?.(ds);   // only release the OLD sources once the swap succeeded
    return this;
  }

  /**
   * Derives new sources from the current ones and swaps them in. The derived Dataset shares memoized
   * ancestors with the old one, so only the changed tail recomputes, which makes a live tweak such as
   * reclassifying with a new threshold much cheaper than a cold swap. Shorthand for setSources.
   * @param {(current: import('./dataset.js').Dataset[]) => (import('./dataset.js').Dataset|import('./dataset.js').Dataset[])} fn
   * @param {Object} [opts]
   * @returns {Promise<Layer>}
   */
  async deriveSources(fn, opts = {}) {
    return this.setSources(fn(this.sources), opts);
  }

  // ---- chainable ops -----------------------------------------------------------------------
  //
  // The Dataset ops, reachable from a layer:
  //
  //     await layer.clip(bbox).mask(poly).reclassify(rules).render();
  //
  // Three timings matter, and only the first is immediate. The sources are rewritten now,
  // synchronously, at each call. The map redraws at the explicit render(), so a four-op chain
  // repaints once rather than four times. The data is computed at a terminal inside compute(), so
  // Dataset stays lazy.
  //
  // Rewriting the sources immediately keeps `layer.dataset`, `getStats()` and `fit()` truthful
  // mid-chain, and puts a bad argument's throw at the call that made it. The cost is that a chain
  // failing partway leaves the earlier ops applied. Nothing is corrupted, since each op is a pure
  // new node, and `reset()` returns to the sources the layer was built from.
  //
  // An op applies across all sources, so a comparison layer clips each member. The N-ary ops such as
  // combine are absent on purpose: which source is the left operand has no sensible answer on a
  // layer, so call them on the Datasets.

  /**
   * Applies one Dataset op across the sources immediately. Invalidates the memoized compute and
   * marks the layer dirty, drawing nothing until `render()`.
   * @param {string} name - the op, for error messages
   * @param {(ds: import('./dataset.js').Dataset) => import('./dataset.js').Dataset} fn
   * @returns {Layer}
   */
  _op(name, fn) {
    if (!this.sources.length) throw new Error(`layer.${name}(): the layer has no source Dataset`);
    const prev = this.sources;
    // Build the derived nodes before touching anything, so a kind mismatch such as clip on a vector
    // throws here, at the call site, leaving the layer as it was.
    const next = prev.map((ds) => {
      if (typeof ds?.[name] !== "function") {
        throw new Error(`layer.${name}(): source "${ds?.name ?? "?"}" is not a Dataset with a ${name}() op`);
      }
      return ds[name] ? fn(ds) : ds;
    });
    if (this._origin == null) this._origin = prev;   // first op — remember what to reset() to
    for (const ds of next) this._map?._acquireDataset?.(ds);
    this.sources = next;
    this.result = null;
    this._dirty = true;
    for (const ds of prev) this._map?._releaseDataset?.(ds);
    return this;
  }

  /** Has an op been applied that the last render() has not drawn yet? @returns {boolean} */
  get dirty() { return !!this._dirty; }

  /**
   * Points the layer back at the sources it held before its first op. Async and atomic like any
   * source swap, so a live layer re-renders. Does nothing when no op has been applied.
   * @param {Object} [opts] - { render?: 'auto'|'in-place'|'recreate' }
   * @returns {Promise<Layer>}
   */
  async reset(opts = {}) {
    if (this._origin == null) return this;
    const origin = this._origin;
    this._origin = null;
    this._dirty = false;
    return this.setSources(origin, opts);
  }

  /** Crop to a bbox. @param {{north:number,south:number,east:number,west:number}} bbox @returns {Layer} */
  clip(bbox) { return this._op("clip", (ds) => ds.clip(bbox)); }
  /** Pixels outside `polygon` (or inside, with `{invert:true}`) become noData. @param {*} polygon @param {Object} [opts] @returns {Layer} */
  mask(polygon, opts) { return this._op("mask", (ds) => ds.mask(polygon, opts)); }
  /** Remap pixel values by rules or a callback. @param {Array|Function} rules @param {Object} [opts] @returns {Layer} */
  reclassify(rules, opts) { return this._op("reclassify", (ds) => ds.reclassify(rules, opts)); }
  /** Resample onto an explicit target grid (does not reproject). @param {Object} target @param {Object} [opts] @returns {Layer} */
  resampleTo(target, opts) { return this._op("resampleTo", (ds) => ds.resampleTo(target, opts)); }
  /** Warp to `toCrs` — forced at render, GDAL loaded then. @param {string} toCrs @returns {Layer} */
  reproject(toCrs) { return this._op("reproject", (ds) => ds.reproject(toCrs)); }
  /** Slope (Horn's method). @param {Object} [opts] @returns {Layer} */
  slope(opts) { return this._op("slope", (ds) => ds.slope(opts)); }
  /** Downslope compass bearing. @returns {Layer} */
  aspect() { return this._op("aspect", (ds) => ds.aspect()); }
  /** Shaded relief. @param {Object} [opts] @returns {Layer} */
  hillshade(opts) { return this._op("hillshade", (ds) => ds.hillshade(opts)); }
  /** Resolve one selection-axis entry (the scenario-slider op). @param {number|string} coord @param {Object} [opts] @returns {Layer} */
  select(coord, opts) { return this._op("select", (ds) => ds.select(coord, opts)); }
  /** Collapse a selection axis to one grid. @param {string} [op] @param {Object} [opts] @returns {Layer} */
  reduce(op, opts) { return this._op("reduce", (ds) => ds.reduce(op, opts)); }

  /**
   * Not chainable, deliberately. `rasterize` turns a vector Dataset into a raster one, and this
   * layer draws the kind it was built for, so returning `this` would leave a VectorLayer pointing at
   * a raster it cannot draw. Call it on the Dataset and add the result as its own layer.
   * @returns {never}
   */
  rasterize() {
    throw new Error(
      "layer.rasterize() does not exist: rasterize changes a Dataset's kind (vector → raster), so it " +
      "cannot return this layer. Build the raster as its own layer instead:\n" +
      "    await fim.addLayer(layer.dataset.rasterize({ width, height }));");
  }

  /**
   * Resolves the render update mode. An explicit 'in-place' or 'recreate' wins. 'auto' checks
   * whether the provider exposes setRasterImageUrl and whether this layer draws a swappable raster
   * image. A vector layer, or a provider without in-place swap, falls back to recreate.
   * @param {string} requested
   * @returns {'in-place'|'recreate'}
   */
  _resolveRenderMode(requested) {
    if (requested === "in-place" || requested === "recreate") return requested;
    const providerName = this._map?.app?.config?.provider || DEFAULT_PROVIDER;
    const provider = getMapProvider(providerName);
    const canSwap = typeof provider?.setRasterImageUrl === "function" && this._usesRasterImage();
    return canSwap ? "in-place" : "recreate";
  }

  /** Does this layer render a swappable raster image (the in-place-capable case)? RasterLayer overrides. @returns {boolean} */
  _usesRasterImage() { return false; }

  /** The provider-specific draw step. Base is a no-op (headless layers render via a binder). @param {Object} [opts] - carries the resolved `mode`. @returns {void|Promise<void>} */
  _draw(opts) {}   // eslint-disable-line no-unused-vars

  /**
   * Blocks the render when a source Dataset's native CRS is one the active provider cannot draw,
   * throwing an actionable error and emitting a host event so the app can react with a toast or an
   * auto-reproject. The mechanism lives here and the policy lives in the host: the engine never
   * reprojects on its own.
   * @returns {void}
   */
  _checkProviderCRS() {
    const providerName = this._map?.app?.config?.provider || DEFAULT_PROVIDER;
    for (const ds of this.sources) {
      const crs = ds?.crs;
      if (crs && !providerAcceptsCRS(providerName, crs)) {
        emitHost("layer:crs-unrenderable", { layer: this, crs, provider: providerName, datasetName: ds.name });
        throw new Error(
          `Layer.render: the "${providerName}" provider cannot render CRS "${crs}" ` +
          `("${ds.name}"). Reproject first: ds.reproject('EPSG:4326').`);
      }
    }
  }

  /**
   * Tears down the render, emits 'removed', then unregisters from the owning FimMap. A subclass
   * calls super.remove() last. Any assigned `_teardown` hook runs once before the event; user-file
   * Layers built inline in floodExtent carry their google.maps teardown there rather than in a
   * subclass. 'removed' fires synchronously, so the tools panel reacts now rather than on
   * google.maps' later onRemove() frame, which makes layer switches deterministic.
   * @returns {void}
   */
  remove({ purgeSource = false } = {}) {
    if (this._removed) return;    // idempotent — a second call must not double-release the sources
    this._removed = true;
    this.hide();
    const teardown = this._teardown;
    this._teardown = null;
    if (typeof teardown === "function") teardown();
    this.emit("removed");
    this._map?._unregisterLayer?.(this);
    // Balance the acquire the constructor did per source. Without it the count never reaches zero,
    // so a Dataset's memoized decode, the whole pixel array for a raster, stays pinned for the life
    // of the page after the last Layer using it is gone. Released last, so anything reacting to
    // 'removed' still sees a live decode.
    for (const ds of this.sources) this._map?._releaseDataset?.(ds);
    // `purgeSource` also forgets each source, unregistering it from the app so it leaves
    // `fim.datasets`. Skipped for a source another layer still holds: the app owns the registry, and
    // a layer must not evict data a sibling is rendering.
    if (purgeSource) {
      for (const ds of this.sources) {
        if (this._map?.app?._datasetRefCount?.(ds) === 0) this._map.removeDataset?.(ds);
      }
    }
  }

  /**
   * A structured-cloneable description of this layer: its type, its sources and the display state
   * needed to rebuild an equivalent one, i.e. on a different map or provider:
   *
   *   map2.addLayer(layer1.toSpec());
   *
   * The result is a copy, not a handle. `addLayer(spec)` builds a new ColorScale from the
   * description, so the two layers diverge rather than sharing mutable color state. The layer's `id`
   * and its event subscribers are not carried either.
   *
   * `sources` are the live `Dataset` objects, which are safe to share and already decoded. To
   * persist a spec rather than move it within a page, replace them with `ds.toRecord()`.
   * @returns {{type: string|null, visible: boolean, settings: Object, colorScale: Object|null, sources: Array}}
   */
  toSpec() {
    return {
      type: this.type,
      visible: this.visible,
      settings: this.settings?.get?.() ?? {},
      colorScale: this.colorScale?.toJSON?.() ?? null,
      sources: [...this.sources],
    };
  }

  // ---- read models; a subclass specializes them ----
  /** @returns {import('./legend.js').Legend|null} */
  getLegend() { return null; }
  /** @returns {Promise<import('./stats.js').Stats|null>} */
  async getStats() { return null; }

  // ---- settings: the declarative change model; a subclass specializes it ----
  /**
   * This layer's settings knobs, built lazily. A subclass overrides _makeSettings() to supply raster
   * or vector knobs. Writing one with `layer.set({...})` emits 'restyle' or 'recomputed' and
   * re-renders when the layer is live.
   * @returns {import('./layerSettings.js').LayerSettings}
   */
  get settings() { return (this._settings ??= this._makeSettings()); }
  /** @returns {import('./layerSettings.js').LayerSettings} */
  _makeSettings() { return new LayerSettings(this); }

  /**
   * Changes how this layer looks. Synchronous and chainable, returning the layer.
   *
   *   layer.set({ palette: 'viridis', continuous: true, opacity: 0.8 });
   *
   * Raster knobs: `palette`, `continuous`, `colorScale`, `noData`, `opacity`, `hover`.
   * Vector knobs: `color`, `opacity`, `useFileColors`, `hover`.
   *
   * This is the one path for changing a layer's appearance. `layer.colorScale` stays readable, and
   * `ColorScale` keeps its own `set()` for building a scale before attaching it.
   *
   * Only `noData` forces a redraw. Await `layer.settled()` to know when that finished.
   * @param {Object} partial @returns {Layer}
   */
  set(partial) { return partial ? this.settings.set(partial) : this; }
  /** Read current settings. @returns {Object} */
  get() { return this.settings.get(); }
  /** Resolves once any redraw kicked off by `set()` has finished. @returns {Promise<Layer>} */
  settled() { return this.settings.settled(); }

  /**
   * True when the point falls on this layer. The base class has no geometry and returns false.
   * RasterLayer tests its footprint and VectorLayer tests feature geometry. The map event dispatch
   * uses this to route hover and click.
   * @param {number} lat @param {number} lng @returns {boolean}
   */
  hitTest(lat, lng) { return false; }   // eslint-disable-line no-unused-vars

  /**
   * The one opaque provider handle this layer owns, or null when it is not on the map.
   *
   * A subclass stores its handle under a name that suits it, `overlay` for a raster and `dataLayer`
   * for a vector. This pair is the type-agnostic view, so `FimMap.applyLayerOrder` can restack a
   * mixed stack without knowing what each layer is.
   * @returns {*|null}
   */
  get _providerHandle() { return null; }

  /** Adopts a handle the provider replaced, since Google recreates ground overlays to restack. */
  _adoptProviderHandle(handle) { void handle; }

  /** @returns {{id: string, type: string|null, visible: boolean, sources: Array<string|null>}} */
  toJSON() {
    return {
      id: this.id, type: this.type, visible: this.visible,
      sources: this.sources.map((d) => d?.id ?? null),
    };
  }
}

// Siblings sharing a mechanism carry a `type`; a renderer that diverges gets its own subclass.
// RasterLayer is one class covering extent, userRaster, depth and ensemble, which differ only in
// `type` and in which of the common palette-canvas fields they use. The subsystem does the actual
// render, and these fields hold the handles it manages, so the state lives on the Layer rather than
// in module scope. Nothing here names google, so the model stays provider-neutral.

/**
 * The `raster:metadata` payload for a core raster layer, built from its decoded grid.
 *
 * Format-independent by construction: everything here comes off the RasterGrid and the layer, so a
 * GeoTIFF, a NetCDF timestep and a synthesised grid all describe themselves in the same rows. Extra
 * rows a specific format knows about — GeoTIFF tags, a GDAL legend — are the overlay tier's to add.
 *
 * `num: true` marks a value the default renderer right-aligns in a monospace column.
 * @param {RasterLayer} layer
 * @param {{width: number, height: number, crs?: string|null, bands?: number, meta?: Object}} grid
 * @param {{north: number, south: number, east: number, west: number}} bounds
 * @param {number|null} noData
 * @returns {{title: string, name: string, specRows: Array<{k: string, v: *, num?: boolean}>}}
 */
function rasterMetadataPayload(layer, grid, bounds, noData) {
  const name = layer.dataset?.name || layer._name || layer.type || layer.id;
  const dp = (n) => (typeof n === "number" ? +n.toFixed(4) : n);
  const specRows = [
    { k: "Size", v: `${grid.width} \u00d7 ${grid.height}` },
    { k: "CRS", v: grid.crs || layer.dataset?.crs || "unknown" },
    { k: "Bands", v: grid.bands ?? 1, num: true },
    { k: "North", v: dp(bounds.north), num: true },
    { k: "South", v: dp(bounds.south), num: true },
    { k: "East", v: dp(bounds.east), num: true },
    { k: "West", v: dp(bounds.west), num: true },
    { k: "No-data", v: noData == null ? "none declared" : noData, num: noData != null },
  ];
  const unit = grid.meta?.unit ?? layer.colorScale?.unit ?? null;
  if (unit) specRows.push({ k: "Unit", v: unit });
  return { title: "Raster", name, specRows };
}

export class RasterLayer extends Layer {
  constructor(opts = {}) {
    super(opts);
    this.overlay = null;        // the OverlayView instance
    this.moveListener = null;   // enableHover()'s onMapMouseMove unsubscribe, when active
    this.loadSeq = 0;           // monotonic — drops stale async loads
    this.rasterData = null;     // pixel array (for hover lookups)
    this.meta = null;           // { bw, bs, be, bn, width, height, noData, unit }
    // The no-data sentinel for colorizing, hover and metrics: drawn transparent and excluded from
    // stats. Pass `{ noData }` here or assign `layer.noData` later. It overrides the grid's own
    // noData when set, and null falls back to the decoded grid's. Some sources declare no nodata tag,
    // so a host knowing the convention, i.e. FIM's -99999, sets it explicitly.
    this.noData = opts.noData ?? null;
    this.opacity = opts.opacity ?? 1;   // overlay opacity (0..1) — a placement setting
    // How this raster becomes something the map can draw: the Mercator row remap and the budget
    // deciding image against tiles. The defaults are in geo/mercator.js's RASTER_LIMITS, anything
    // set here overrides them for this layer, and `render({ raster })` overrides again for one draw.
    // { strategy, mercator, maxPixels, maxDimension, tileSize, resample }
    this.raster = opts.raster ?? {};
    this.colorScale = null;     // the ColorScale that maps a pixel value to a color
    this._onScaleChange = null; // bound onChange listener (so _setColorScale can detach the old one)
  }

  /** Set the no-data sentinel (transparent + excluded from stats). Chainable. @param {number|null} v @returns {RasterLayer} */
  setNoData(v) { this.noData = v; return this; }

  /** Set overlay opacity (0..1), applied live via the provider (no redraw). Chainable. @param {number} v @returns {RasterLayer} */
  setOpacity(v) {
    this.opacity = v;
    const provider = getMapProvider(this._map?.app?.config?.provider || DEFAULT_PROVIDER);
    provider?.setRasterImageOpacity?.(this.overlay, v);
    return this;
  }

  /**
   * Hides the overlay by setting its provider opacity to 0. The overlay stays on the map, so show()
   * is instant. The base Layer.hide() only flips `.visible`, which touches nothing the provider
   * drew, so a raster overlay stayed visible through it. Chainable.
   * @returns {RasterLayer}
   */
  hide() {
    if (this.overlay) {
      const provider = getMapProvider(this._map?.app?.config?.provider || DEFAULT_PROVIDER);
      provider?.setRasterImageOpacity?.(this.overlay, 0);
    }
    this.visible = false;
    // The panel describes what is on the map, so a hidden raster's metadata is no longer current.
    // remove() calls hide() first, which covers removal too.
    emitHost("raster:metadata-hidden", { id: this.id });
    return this;
  }

  /** Re-show the overlay at its configured opacity. Chainable. @returns {RasterLayer} */
  show() {
    if (this.overlay) {
      const provider = getMapProvider(this._map?.app?.config?.provider || DEFAULT_PROVIDER);
      provider?.setRasterImageOpacity?.(this.overlay, this.opacity);
    }
    this.visible = true;
    return this;
  }

  /** @returns {import('./layerSettings.js').RasterSettings} */
  _makeSettings() { return new RasterSettings(this); }

  /** The geographic footprint { north, south, east, west } (from meta, else the grid). @returns {Object|null} */
  _bounds() {
    if (this.meta) return { north: this.meta.bn, south: this.meta.bs, east: this.meta.be, west: this.meta.bw };
    return this.result?.bounds || null;
  }

  /**
   * A pixel-level hit test (PACKAGE_ROADMAP §1), true only where a real pixel sits under the point.
   * A click over a transparent or noData part of the footprint falls through to the layers below,
   * rather than the whole bounding rectangle absorbing it.
   * @param {number} lat @param {number} lng @returns {boolean}
   */
  hitTest(lat, lng) { return this.valueAt(lat, lng) != null; }

  /** @returns {*|null} the raster-image overlay handle. */
  get _providerHandle() { return this.overlay ?? null; }
  _adoptProviderHandle(handle) { this.overlay = handle ?? null; }

  /**
   * The pixel value at a lat/lng, from the nearest cell. Null outside the footprint, at a no-data
   * pixel, or before pixels load. A tooltip, or enableHover() below, reads it.
   * @param {number} lat @param {number} lng
   * @param {{noDataTolerance?: number}} [opts] - widen the noData check to `|v - noData| <=
   *   tolerance` rather than exact equality, for a raster whose sentinel drifts after resampling,
   *   i.e. a GDAL bilinear warp blending a real value with an adjacent nodata pixel near an edge.
   *   Defaults to 0, an exact match. hitTest() always uses the default, so widening this changes
   *   nothing about what a click resolves to unless valueAt() is called directly.
   * @returns {number|null}
   */
  valueAt(lat, lng, { noDataTolerance = 0 } = {}) {
    const b = this._bounds(), px = this.rasterData, m = this.meta;
    if (!b || !px || !m) return null;
    if (lat > b.north || lat < b.south || lng < b.west || lng > b.east) return null;
    const ew = b.east - b.west, ns = b.north - b.south;
    if (ew <= 0 || ns <= 0) return null;
    const c = Math.min(m.width - 1, Math.max(0, Math.floor(((lng - b.west) / ew) * m.width)));
    const r = Math.min(m.height - 1, Math.max(0, Math.floor(((b.north - lat) / ns) * m.height)));
    const v = px[r * m.width + c];
    if (v == null || Number.isNaN(v)) return null;
    const nd = this.noData ?? m.noData ?? null;
    if (nd != null && Math.abs(v - nd) <= noDataTolerance) return null;
    return v;
  }

  /**
   * Starts a live hover readout: it subscribes to the map provider's mouse-move, calls valueAt() on
   * each move, and emits 'hover' with a displayable `{lat, lng, value, text}`. Idempotent, so
   * calling it again replaces the previous subscription rather than stacking listeners. Opt-in
   * rather than automatic on render, since a layer nobody hovers should not pay for a mousemove
   * listener. remove() tears it down (see _draw()'s _teardown).
   *
   * This replaces the bounds and row/column lookup DepthLayer hand-rolled in layers/depthMap.js,
   * which valueAt() now shares. It does not generalize one thing: treating an otherwise valid value
   * as nothing to report, i.e. depth's rule that zero means no flooding, is domain knowledge, so
   * pass `isEmpty` for that.
   * @param {Object} [opts]
   * @param {number} [opts.noDataTolerance=0] - forwarded to valueAt().
   * @param {(v: number) => boolean} [opts.isEmpty] - an in-range value to ALSO treat as absent
   *   so event.value becomes null, as it does outside the footprint. Use it for a domain rule such
   *   as zero meaning nothing, which is not really about noData.
   * @param {(v: number) => string} [opts.formatValue] - value → display text. Defaults to `String(v)`.
   * @returns {RasterLayer}
   */
  enableHover({ noDataTolerance = 0, isEmpty = null, formatValue = (v) => String(v) } = {}) {
    this.disableHover();
    const map = this._map?.map;
    if (!map) return this;
    const provider = getMapProvider(this._map?.app?.config?.provider || DEFAULT_PROVIDER);
    this.moveListener = provider.onMapMouseMove(map, ({ lat, lng }) => {
      let value = this.valueAt(lat, lng, { noDataTolerance });
      if (value != null && isEmpty?.(value)) value = null;
      const text = value == null ? "—" : formatValue(value);
      this.emit("hover", { lat, lng, value, text });
    });
    return this;
  }

  /** Stop the hover readout wired by enableHover() — a no-op if none is active. @returns {RasterLayer} */
  disableHover() {
    this.moveListener?.();
    this.moveListener = null;
    return this;
  }

  /** A RasterLayer renders a single positioned image, so the provider CAN swap it in place. @returns {boolean} */
  _usesRasterImage() { return true; }

  /**
   * Resolves which ColorScale colors this raster, trying three sources in order.
   *
   * An already-attached scale wins and is left alone; a host attaches one with set({ colorScale }) or
   * by passing { colorScale } to the "raster" factory. Failing that, a GDAL_METADATA legend embedded
   * in the file is detected through ColorScale's registered parser, which layers/depthMap.js supplies
   * (see registerGdalLegendParser). Failing that, a continuous scale on ColorScale's default palette,
   * ranged to the grid's own min and max.
   *
   * Whichever is chosen is attached to the layer, so getLegend() and getStats() always describe what
   * is drawn rather than a discarded fallback. This runs synchronously inside the current render
   * pass, before the image is drawn, so there is no window where a generic default draws first and a
   * correct GDAL legend never arrives because nothing repaints on its own.
   * @param {import('./materialize.js').RasterGrid} grid
   * @returns {Array|null} the raw parsed GDAL legend, if one was detected (for the 'rendered' event's
   *   `originalLegend`. Null when an explicit or default scale was used instead.
   */
  _resolveColorScale(grid) {
    if (this.colorScale) return null;   // case 1: explicit — already attached, leave it alone
    const parser = ColorScale.getGdalLegendParser();
    const parsed = parser && grid.meta?.gdalMetadata ? parser(grid.meta.gdalMetadata) : null;
    if (parsed?.legend?.length) {   // case 2: GDAL-embedded legend
      this._setColorScale(ColorScale.fromGdalLegend(parsed.legend, parsed.unit));
      return parsed.legend;
    }
    this._setColorScale(new ColorScale({ continuous: true, ...rangeOf(grid) }));   // case 3: default
    return null;
  }

  /**
   * Draws this raster on the map. It resolves a ColorScale when none is attached (see
   * _resolveColorScale), colorizes the materialized grid into a canvas data URL, then positions that
   * over the grid's bounds through the map provider. `mode === 'in-place'` swaps the existing
   * overlay's image without a flicker; otherwise it removes and re-adds. Provider-neutral, since the
   * SDK-specific work sits behind addRasterImage and setRasterImageUrl.
   *
   * It also fills `rasterData` and `meta` from the grid for hover, installs a teardown that removes
   * the overlay, and fires `rendered` with the grid and the data URL.
   * @param {Object} [opts] - { mode?: 'in-place'|'recreate', raster?: Object } — `raster` overrides
   *   this layer's projection/budget options for one draw (see `RasterLayer#raster`)
   * @returns {void}
   */
  _draw({ mode = "recreate", raster: rasterOverride } = {}) {
    const grid = this.result;
    if (!grid || grid.kind !== "raster") return;   // compute() sets result = the decoded RasterGrid
    const originalLegend = this._resolveColorScale(grid);
    const fim = this._map;
    const providerName = fim?.app?.config?.provider || DEFAULT_PROVIDER;
    const provider = getMapProvider(providerName);
    if (typeof provider?.addRasterImage !== "function") {
      throw new Error(`RasterLayer: the "${providerName}" provider has no addRasterImage`);
    }
    const noData = this.noData ?? grid.noData ?? null;
    // The provider stretches the image linearly in Web Mercator, but a grid's rows are evenly spaced
    // in latitude, so the rows are resampled before colorizing. Only the image is reprojected:
    // `grid`, and so rasterData, meta, Stats, filters and hover, stays the real data at real
    // coordinates. See geo/mercator.js.
    const rasterOpts = { ...this.raster, ...(rasterOverride || {}) };
    const plan = rasterRenderPlan(grid, rasterOpts);
    const display = toMercatorRows(grid, plan, { method: rasterOpts.resample ?? "nearest", noData });
    const dataURL = gridToDataURL({ ...grid, ...display }, { colorScale: this.colorScale, noData });
    const bounds = display.bounds;
    // When this fires, one baked image can no longer carry the raster's detail. It is still drawn,
    // correctly placed but downsampled, and the host is told rather than left wondering why a
    // zoomed-in field looks soft. Tiles are the real answer; see geo/mercator.js.
    if (plan.mode === "tiles") {
      console.warn(`RasterLayer: ${plan.reason}. Drawn downsampled — a tile backend is not yet ` +
        "implemented (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md).");
      emitHost("layer:raster-oversized", { layer: this, plan, datasetName: this._name });
    }
    if (mode === "in-place" && this.overlay && typeof provider.setRasterImageUrl === "function") {
      // Reassign to the returned handle: Google recreates and Leaflet swaps in place (mapProvider.js).
      this.overlay = provider.setRasterImageUrl(fim.map, this.overlay, dataURL, bounds, { opacity: this.opacity }) ?? this.overlay;
    } else {
      if (this.overlay) provider.removeRasterImage(fim.map, this.overlay);
      this.overlay = provider.addRasterImage(fim.map, dataURL, bounds, { opacity: this.opacity });
    }
    // Hover fields, written from the source grid. They stay plain writable properties rather than
    // getters off sources[0], because two callers set them on a layer that has no sources:
    // layers/depthMap.js:39 builds `new RasterLayer({ type: "depth" })` with none, decodes and draws
    // the GeoTIFF itself, then assigns both at :177 so valueAt() and getStats() work; the hit-test
    // and valueAt tests do the same to avoid constructing a Dataset. Converting to getters means
    // routing depthMap through a Dataset first.
    this.rasterData = grid.pixels;
    this.meta = { bw: bounds.west, bs: bounds.south, be: bounds.east, bn: bounds.north,
      width: grid.width, height: grid.height, noData, unit: grid.meta?.unit ?? null };
    // 'raster:metadata' from the CORE raster path (PACKAGE_ROADMAP.md §9.1). Before this, the event
    // had one producer, showTifMetadata() in geo/tifMeta.js, reachable only from the opt-in overlay
    // barrel and only for a decoded GeoTIFF — so a host that mounted bindRasterMetadata against a
    // plain `raster` layer subscribed to an event nothing emitted. The payload here is built from
    // the RasterGrid, so it carries no format assumption: a GeoTIFF, a NetCDF slice and a
    // Dataset.fromGrid surface all describe themselves the same way. The overlay tier still emits
    // its own richer payload, with the GeoTIFF tag rows this one cannot know about.
    emitHost("raster:metadata", rasterMetadataPayload(this, grid, bounds, noData));
    this._teardown = () => {
      if (this.overlay) provider.removeRasterImage(fim.map, this.overlay);
      this.overlay = null;
      this.disableHover();
    };
    // 'rendered' carries what bindRasterLayerTools in ui/rasterTools.js needs to build the Image
    // Tools panel: pixel data, meta, image, type and filename, as the event's payload promises.
    // `originalLegend` is the raw parsed GDAL legend when _resolveColorScale detected one, and null
    // otherwise, since neither an attached scale nor the default has a raw legend to show. `gmap` is
    // the map, for the hover listener.
    this.emit("rendered", {
      grid, dataURL, bounds, type: this.type,
      pixelData: grid.pixels, meta: this.meta, overlayHandle: this.overlay,
      originalLegend, gmap: fim.map, filename: this._name,
    });
  }

  /** Fit the map to this raster's bounds (after render). @returns {RasterLayer} */
  fit() {
    const fim = this._map;
    const provider = getMapProvider(fim?.app?.config?.provider || DEFAULT_PROVIDER);
    provider?.fitBounds?.(fim?.map, this.result?.bounds);
    return this;
  }

  /**
   * Attaches the ColorScale that colors this raster, and connects its `onChange` to a `restyle`
   * event. A UI subscribes to `restyle`, or to `${type}:restyle` on the map bus, and repaints when
   * the user edits the palette, so the Layer still names no UI
   * (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 "Settings vs. Operations").
   *
   * Passing a new scale detaches the previous listener. `cs` must be a real ColorScale, or `null` to
   * detach, and is validated before anything is mutated, so a bad argument such as a palette-name
   * string meant for `layer.set({ palette })` throws without leaving `this.colorScale` half set.
   * @internal Use `layer.set({ colorScale })` — the one public mutation path. This stays as the
   * implementation that `RasterSettings._apply` routes to, and for engine-internal attach points
   * (`_ensureColorScale`, the "raster" factory, depthMap/ensemble).
   * @param {import('./colorScale.js').ColorScale|null} cs
   * @returns {RasterLayer}
   */
  _setColorScale(cs) {
    assertColorScale(cs);
    if (this.colorScale && this._onScaleChange) this.colorScale.offChange?.(this._onScaleChange);
    this.colorScale = cs || null;
    this._onScaleChange = null;
    if (cs) {
      // A scale edit emits 'restyle' and repaints the memoized grid in place when the layer is
      // live, so `layer.set({ palette })` shows on the map with no re-force. Not awaited: render()
      // skips compute() because result is already set.
      this._onScaleChange = () => {
        this.emit("restyle", { colorScale: cs });
        if (this.visible && this.result != null) this.render({ render: "in-place" });
      };
      cs.onChange(this._onScaleChange);
    }
    return this;
  }

  /**
   * The legend, derived from the ColorScale. Null until one is attached.
   * @returns {import('./legend.js').Legend|null}
   */
  getLegend() {
    return this.colorScale ? Legend.fromColorScale(this.colorScale) : null;
  }

  /**
   * Statistics over this raster's pixels, classified by the attached ColorScale when there is one,
   * so the histogram buckets match the legend. Null until pixels load.
   * @param {Object} [opts]
   * @returns {Promise<import('./stats.js').Stats|null>}
   */
  async getStats(opts = {}) {
    if (!this.rasterData || !this.meta) return null;
    return Stats.raster(this.rasterData, this.meta, { classify: this.colorScale, ...opts });
  }
}

// VectorLayer draws a vector Dataset, whose `ds.data` is a GeoJSON FeatureCollection, onto the map.
// It names no map SDK, calling the active provider's addVector, removeVector and fitBounds
// (mapProvider.js), so the same layer works on any provider implementing those three. The app also
// constructs VectorLayer for its user-file overlays and renders them itself, setting .dataLayer and
// a _teardown, so render() here adds to that path rather than disturbing it.
export class VectorLayer extends Layer {
  /**
   * @param {Object} [opts] - the base Layer options, plus:
   * @param {import('./colorScale.js').ColorScale|null} [opts.colorScale] - maps a `colorBy` value to a color
   * @param {string|null} [opts.colorBy] - the feature property whose value the scale reads
   */
  constructor(opts = {}) {
    super(opts);
    // The same ColorScale a RasterLayer uses. Nothing in that class is pixel-specific: it maps a
    // value to a color, and a feature property is as good a value as a pixel. Only the source of the
    // value differs, which is what `colorBy` names.
    this.colorScale = null;
    this.colorBy = opts.colorBy ?? null;
    if (opts.colorScale) this._setColorScale(opts.colorScale);
  }

  /**
   * Attaches the ColorScale that colors features by `colorBy`. Its `onChange` drives a live restyle,
   * as it does for a RasterLayer's palette edits, and the layer still names no UI.
   * @internal Use `layer.set({ colorScale })`.
   * @param {import('./colorScale.js').ColorScale|null} cs
   * @returns {VectorLayer}
   */
  _setColorScale(cs) {
    assertColorScale(cs);
    if (this.colorScale && this._onScaleChange) this.colorScale.offChange?.(this._onScaleChange);
    this.colorScale = cs || null;
    this._onScaleChange = null;
    if (cs) {
      this._onScaleChange = () => {
        this.emit("restyle", { colorScale: cs });
        // No provider implements an in-place vector restyle, so a live layer is re-added with the
        // new scale, the same remove-then-add setStyle() already does.
        if (this.visible && this._map?.map) this.setStyle({});
      };
      cs.onChange(this._onScaleChange);
    }
    return this;
  }

  /**
   * The style passed to the provider. With a ColorScale and `colorBy` attached it is a per-feature
   * function, sending each feature's `properties[colorBy]` through the scale, merged over whatever
   * flat style `setStyle()` or `render({style})` set, so an explicit `strokeWidth` still applies.
   * Without a scale or without `colorBy` it is that flat style alone.
   *
   * A feature whose property is missing or non-numeric takes the scale's `missingColor` when one is
   * set, and otherwise keeps the base style. It never takes a value from the ramp, so no data for a
   * feature cannot look like a real reading.
   * @returns {Object|Function|null}
   */
  _resolveStyle() {
    const cs = this.colorScale;
    const key = this.colorBy;
    const base = (this._style && typeof this._style === "object") ? this._style : null;
    if (!cs || !key) return this._style ?? null;
    return ({ feature }) => {
      const raw = feature?.properties?.[key];
      const v = (raw == null || raw === "") ? NaN : Number(raw);
      const color = Number.isFinite(v) ? cs.getColor(v) : (cs.missingColor || null);
      return color ? { ...base, fillColor: color, strokeColor: color } : (base || {});
    };
  }

  /**
   * The legend, derived from the ColorScale and null until one is attached, so a vector layer
   * colored by a property gets the same legend a raster does.
   * @returns {import('./legend.js').Legend|null}
   */
  getLegend() {
    return this.colorScale ? Legend.fromColorScale(this.colorScale) : null;
  }

  /**
   * Draws this layer's Dataset on the map through the owning FimMap's provider.
   * @param {{ style?: object }} [opts]  provider-native style (e.g. google.maps.Data style)
   * @returns {VectorLayer}
   */
  render(opts = {}) {
    const fim = this._map;
    if (!fim?.map) throw new Error("VectorLayer.render: the layer has no mounted map");

    const providerName = fim.app?.config?.provider || DEFAULT_PROVIDER;
    const provider = getMapProvider(providerName);
    if (typeof provider?.addVector !== "function") {
      throw new Error(
        `VectorLayer: the "${providerName}" map provider does not support vector layers ` +
        "(it has no addVector). Built-in 'google' and 'leaflet' do; a custom provider must " +
        "implement addVector/removeVector/fitBounds.");
    }

    const geojson = this.dataset?.data;
    if (!geojson) throw new Error("VectorLayer.render: the source Dataset has no GeoJSON data");

    this._style = opts.style ?? this._style ?? null;
    this.dataLayer = provider.addVector(fim.map, geojson, { ...opts, style: this._resolveStyle() });
    this.visible = true;
    this._dirty = false;   // VectorLayer.render() is synchronous — it does not go through the base
    // The base remove() runs this before emitting 'removed'.
    this._teardown = () => provider.removeVector(fim.map, this.dataLayer);
    this.emit("rendered", { dataset: this.dataset });
    return this;
  }

  /** Fit the map to this layer's Dataset bounds, via the provider. @returns {VectorLayer} */
  fit() {
    const fim = this._map;
    const provider = getMapProvider(fim?.app?.config?.provider || DEFAULT_PROVIDER);
    provider?.fitBounds?.(fim.map, this.dataset?.bounds);
    return this;
  }

  /**
   * Removes the vector overlay from the map, since no provider offers a way to make a vector
   * invisible short of removing it. The base Layer.hide() only flips `.visible`, which touches
   * nothing the provider drew, so the features stayed visible through it. `show()` rebuilds through
   * `addVector`, the same remove-then-recreate `setStyle()` uses. Chainable.
   * @returns {VectorLayer}
   */
  hide() {
    const fim = this._map;
    if (this.dataLayer && fim?.map) {
      const provider = getMapProvider(fim.app?.config?.provider || DEFAULT_PROVIDER);
      provider?.removeVector?.(fim.map, this.dataLayer);
      this.dataLayer = null;
    }
    this.visible = false;
    return this;
  }

  /** Re-add the vector overlay to the map at its last style. Chainable. @returns {VectorLayer} */
  show() {
    const fim = this._map;
    if (!this.dataLayer && fim?.map) {
      const provider = getMapProvider(fim.app?.config?.provider || DEFAULT_PROVIDER);
      const geojson = this.dataset?.data;
      if (geojson) this.dataLayer = provider.addVector(fim.map, geojson, { style: this._resolveStyle() });
    }
    this.visible = true;
    return this;
  }

  /** @returns {import('./layerSettings.js').VectorSettings} */
  _makeSettings() { return new VectorSettings(this); }

  /**
   * Feature statistics over this layer's GeoJSON: counts by geometry type, total area and length,
   * and the bbox.
   *
   * Computed from the source in `dataset.data` rather than from the provider's overlay handle, so it
   * works on either provider and before any render.
   *
   * @param {Object} [opts]
   * @param {import('./filter.js').Filter|Function|Array|null} [opts.filter] - scope to a region/predicate
   * @returns {Promise<import('./stats.js').Stats|null>}
   */
  async getStats(opts = {}) {
    const ds = this.dataset;
    if (!ds) return null;
    // Prefer the lazy terminal, which forces a URL-backed or op-chained Dataset, and fall back to
    // the already-parsed inline GeoJSON render() draws from.
    let features = ds.data ?? null;
    if (!features && typeof ds.features === "function") features = await ds.features();
    if (!features) return null;
    // Default the classification to whatever is coloring the features, so `byClass` and the legend
    // agree, as RasterLayer.getStats() does for pixels. An explicit option still wins.
    return Stats.vector(features, {
      classify: this.colorScale, classifyBy: this.colorBy, ...opts,
    });
  }

  /**
   * Merges a neutral style patch and re-renders by removing and re-adding, since no provider has
   * no in-place setVectorStyle). @param {Object} patch @returns {VectorLayer}
   */
  setStyle(patch = {}) {
    const base = (this._style && typeof this._style === "object") ? this._style : {};
    this._style = { ...base, ...patch };
    if (this.visible && this._map?.map) {
      const provider = getMapProvider(this._map.app?.config?.provider || DEFAULT_PROVIDER);
      if (this.dataLayer) provider.removeVector(this._map.map, this.dataLayer);
      this.dataLayer = provider.addVector(this._map.map, this.dataset?.data, { style: this._resolveStyle() });
    }
    return this;
  }

  /** True if the point falls inside any feature geometry. @param {number} lat @param {number} lng @returns {boolean} */
  hitTest(lat, lng) { return !!this.featureAt(lat, lng); }

  /** @returns {*|null} the vector handle. */
  get _providerHandle() { return this.dataLayer ?? null; }
  _adoptProviderHandle(handle) { this.dataLayer = handle ?? null; }

  /**
   * The first feature whose geometry contains the point, honoring polygon holes and matching a point
   * within a small epsilon. Null when none does. Drives a feature info window.
   * @param {number} lat @param {number} lng @returns {Object|null}
   */
  featureAt(lat, lng) {
    const fc = this.dataset?.data;
    const feats = !fc ? [] : fc.type === "FeatureCollection" ? (fc.features || [])
      : fc.type === "Feature" ? [fc] : [];
    for (const f of feats) if (geomContains(f?.geometry, lng, lat)) return f;
    return null;
  }
}

// ---- vector hit-test geometry and map-event dispatch --------------------------------------------

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function polyContains(rings, x, y) {
  if (!rings?.length || !pointInRing(x, y, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (pointInRing(x, y, rings[i])) return false; // in a hole
  return true;
}
/**
 * Point-in-geometry for GeoJSON, where x is lng and y is lat. Polygon and MultiPolygon are exact, a
 * Point matches within ~0.0005 degrees, a GeometryCollection recurses, and anything else is false.
 * Exported for tests.
 * @param {Object} geom @param {number} x @param {number} y @returns {boolean}
 */
export function geomContains(geom, x, y) {
  if (!geom) return false;
  switch (geom.type) {
    case "Polygon": return polyContains(geom.coordinates, x, y);
    case "MultiPolygon": return (geom.coordinates || []).some((p) => polyContains(p, x, y));
    case "Point": { const [px, py] = geom.coordinates || []; return Math.abs(px - x) < 5e-4 && Math.abs(py - y) < 5e-4; }
    case "GeometryCollection": return (geom.geometries || []).some((g) => geomContains(g, x, y));
    default: return false;
  }
}

/**
 * Dispatches a normalized map event to the layers top down in z-order, where the last entry is
 * topmost, hit-testing each. By default it stops once a handler absorbs the event with
 * `evt.stopPropagation()`. With `{ simultaneous: true }` each hit layer receives it and
 * `stopPropagation` does nothing. Either way, only a visible layer with a listener for `type` and a
 * passing hitTest receives it. Pure over a layers array, and FimMap wraps it. (PACKAGE_ROADMAP §1)
 * @param {import('./layer.js').Layer[]} layers @param {string} type @param {{lat:number,lng:number}} base
 * @param {{ simultaneous?: boolean }} [opts]
 * @returns {Object} the event object (carries `stopPropagation`)
 */
export function dispatchMapEventToLayers(layers, type, base, { simultaneous = false } = {}) {
  let stopped = false;
  const evt = { ...base, type, stopPropagation() { stopped = true; } };
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer?.visible || !layer._hasListeners?.(type)) continue;
    if (typeof layer.hitTest === "function" && !layer.hitTest(base.lat, base.lng)) continue;
    layer.emit(type, evt);
    if (!simultaneous && stopped) break;
  }
  return evt;
}

// ---- type registry, filled in by each subsystem as it migrates ----

/** @typedef {(fim: import('./fimMap.js').FimMap, opts: Object) => (Layer|Promise<Layer>)} LayerFactory */

const _factories = new Map();   // type -> (fim, opts) => Layer

/**
 * Registers a Layer factory for a `type`. Each subsystem module calls it as it migrates.
 * @param {string} type
 * @param {LayerFactory} factory
 * @returns {void}
 */
export function registerLayerType(type, factory) { _factories.set(type, factory); }

/**
 * True when a factory is registered for `type`.
 * @param {string} type
 * @returns {boolean}
 */
export function hasLayerType(type) { return _factories.has(type); }

/**
 * The layer types `fim.addLayer(type, ...)` can construct, built-in and host-registered. The public
 * query, matching `mapProviderNames()` and `materializerFormats()`.
 *
 * These are registry keys, not `layer.type` values, and the two overlap. 'depth' and 'ensemble'
 * appear here as constructible types and also as `RasterLayer.type` values among sibling rasters,
 * alongside 'extent' and 'userRaster', where they say which kind of raster this is rather than which
 * factory built it. This function answers only the first question.
 * @returns {string[]}
 */
export function getLayerTypes() { return [..._factories.keys()]; }

/**
 * Constructs a Layer of `type` for `fim`. `type` is normally a registry string such as 'vector', but
 * a bare source works too: a Dataset in the `type` slot is read as `{ source: type }`, so
 * `fim.addLayer(ds)` needs no type at all. When the type is still unresolved it comes from
 * `opts.source` or `opts.sources[0]`'s `Dataset.kind`, raster or vector, and only when there is
 * exactly one source, since a multi-source type such as comparison cannot be guessed. Throws when
 * the type cannot be resolved, or when the resolved type has no registered factory.
 * @param {import('./fimMap.js').FimMap} fim
 * @param {string|Object} [type] - a registry name, OR a bare source (Dataset) to infer from
 * @param {Object} [opts]
 * @returns {Layer|Promise<Layer>}
 */
export function createLayer(fim, type, opts = {}) {
  if (type != null && typeof type !== "string") {
    opts = { ...opts, source: type };
    type = undefined;
  }
  if (!type) {
    const sources = opts.source ? [opts.source] : (opts.sources || []);
    const known = [..._factories.keys()].join(", ") || "(none yet)";
    if (sources.length !== 1) {
      throw new Error(
        `addLayer: no type given, and it can only be inferred from exactly one source (got ${sources.length}). ` +
        `Pass an explicit type: ${known}.`);
    }
    const kind = sources[0]?.kind;
    if (kind !== "raster" && kind !== "vector") {
      throw new Error(
        `addLayer: no type given, and it could not be inferred from the source (Dataset.kind is "${kind}"). ` +
        `Pass an explicit type: ${known}.`);
    }
    type = kind;
  }
  const factory = _factories.get(type);
  if (!factory) {
    const known = [..._factories.keys()].join(", ") || "(none yet)";
    throw new Error(`Layer type "${type}" has no registered factory. Registered types: ${known}`);
  }
  return factory(fim, opts);
}

// The built-in vector layer type. `fim.addLayer('vector', { source: ds, style })` parses nothing,
// rendering an already-parsed Dataset, so it resolves synchronously. Registered after the registry
// is defined, which module-load order requires.
registerLayerType("vector", (fim, opts = {}) => {
  const layer = new VectorLayer({
    map: fim,
    type: opts.type || "vector",
    sources: opts.source ? [opts.source] : (opts.sources || []),
  });
  return layer.render({ style: opts.style });
});

// The built-in raster layer type. `fim.addLayer('raster', { source: ds, colorScale?, noData?,
// opacity? })` forces the Dataset through the base Layer.compute() and draws it in
// RasterLayer._draw. RasterLayer does not override the base render(), which is async, so unlike
// 'vector' above this factory returns a Promise<Layer> that addLayer must await.
registerLayerType("raster", (fim, opts = {}) => {
  const layer = new RasterLayer({
    map: fim,
    type: opts.type || "raster",
    sources: opts.source ? [opts.source] : (opts.sources || []),
    noData: opts.noData,
    opacity: opts.opacity,
  });
  if (opts.colorScale) layer._setColorScale(opts.colorScale);
  return layer.render({ render: opts.render });
});
