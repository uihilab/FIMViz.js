// layer.js — abstract base for a rendered visualization of Dataset(s) on the map.
//
// A Layer is one rendering of a Dataset (or several — comparison/velocity take two). This base
// defines the shared contract and registry identity; subclasses implement the actual map render.
//
// A subclass registers a factory via registerLayerType(type, fn), so FimMap.addLayer dispatches by
// type without importing every subsystem. An unregistered type throws, naming the registered ones,
// rather than silently doing nothing.
//
// A Layer is an EVENT EMITTER (like Leaflet's L.Evented): it fires lifecycle events and UI
// subscribes. This inversion is what keeps the package embeddable — a Layer NEVER imports, names,
// or calls a UI panel or DOM element. Dependencies flow UI → Layer, never back. A layer that
// called a panel directly would weld one app's UI to the map layer and race its teardown.
//
// Lifecycle event contract (payload always carries { layer, ...extra }):
//   'rendered' — the overlay is on the map and its data is ready (extra = what a UI needs to draw
//                tools: pixel data, meta, image, type, filename, …). Fired by the subclass/overlay.
//   'removed'  — the layer has been torn down. Fired SYNCHRONOUSLY by remove(), so a UI reacting to
//                it does not depend on the map SDK's asynchronous removal timing.

import { createEmitter, emitHost } from "./events.js";
import { getMapProvider, providerAcceptsCRS, DEFAULT_PROVIDER } from "./mapProvider.js";
import { Legend } from "./legend.js";
import { Stats } from "./stats.js";
import { gridToDataURL, rangeOf } from "./rasterImage.js";
import { ColorScale } from "./colorScale.js";
import { LayerSettings, RasterSettings, VectorSettings } from "./layerSettings.js";

let _seq = 0;
const nextId = () => `layer_${Date.now().toString(36)}_${(++_seq).toString(36)}`;

/**
 * Guard for every `set({ colorScale })` path (raster and vector alike). Validated BEFORE anything is
 * mutated, so a bad argument — classically a palette-name string meant for `set({ palette })` —
 * throws cleanly instead of leaving `layer.colorScale` half-set.
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
    // A "display-claiming" layer owns the whole map exclusively (velocity/ensemble): activating one
    // deactivates the prior claimant, enforced by FimMap._claimExclusive. Formalizes ui/
    // activeDisplayLayer.js. Most layers coexist, so the default is false.
    this.exclusive = exclusive;
    this._name = null;             // filename key when registered in FimMap's named-layer index
    this._teardown = null;         // optional render-teardown hook (see remove())
    this._emitter = null;          // lazily created on first on()/emit() — costs nothing unused
    // Ref-count the initial sources so the map's Dataset lifecycle is balanced from birth (setSources
    // acquires/releases on every later swap). Best-effort + optional-chained: a fake map or a non-
    // Dataset source (comparison's {pixels,meta}) is a harmless no-op.
    for (const ds of this.sources) this._map?._acquireDataset?.(ds);
  }

  // ---- the layer-type registry, as statics on the type it serves ---------------------------
  //
  // `fim.addLayer(type, opts)` dispatches through this. It hangs off Layer because the owner was
  // never in question — a factory registered here builds a Layer — and one import (the class you
  // already have) beats two loose barrel functions.

  /**
   * Register the factory `fim.addLayer('<type>')` dispatches to.
   * @param {string} type
   * @param {(fim: import('./fimMap.js').FimMap, opts: Object) => Layer|Promise<Layer>} factory
   * @returns {void}
   */
  static registerType(type, factory) { return registerLayerType(type, factory); }

  /**
   * Every type `addLayer` can currently construct — built-ins plus anything a host registered.
   * REGISTRY KEYS, not `layer.type` values (see `getLayerTypes`).
   * @returns {string[]}
   */
  static types() { return getLayerTypes(); }

  /** The owning FimMap. @returns {import('./fimMap.js').FimMap|null} */
  get map() { return this._map; }
  /** Convenience = sources[0]. @returns {import('./dataset.js').Dataset|null} */
  get dataset() { return this.sources[0] || null; }

  // ---- events (Evented contract — layers fire, UI subscribes; a Layer never names a UI) ----
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
   * Fire `evt`. Listeners receive `{ ...payload, layer: this }`.
   *
   * The event goes to TWO places, so these two subscriptions see the same event:
   *
   *   layer.on('rendered')              — this ONE layer's lifecycle (per-object subscription)
   *   fim.on('userRaster:rendered')     — ANY layer of that type on this map (per-map subscription)
   *
   * The per-map form is derived from the per-layer one by forwarding under `${type}:${evt}`, so a new
   * layer type gets it with no extra wiring.
   *
   * Forwarding is skipped when the layer has no `type` (nothing to namespace with) or no owning map.
   * Subsystems that emit on the map bus directly (velocity/ensemble/depth emit their own
   * `*:activated` names) are unaffected — those are distinct event names, so nothing double-fires.
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

  // ---- lifecycle (subclasses override the render half) ----
  /** @returns {void} */
  show() { this.visible = true; }
  /** @returns {void} */
  hide() { this.visible = false; }
  /** Fit the map to this layer's bounds. @returns {void} */
  fit() {}

  // ---- the render/compute pipeline ----
  //
  // ONE public verb. Casual callers `await layer.render()` — it computes implicitly, checks the map
  // provider can render the source CRS, then draws. Power users call `compute()` for the result
  // without drawing. The "two families" are just a difference of degree in compute(): a single-source
  // layer materializes one Dataset; a derived layer (comparison/ensemble) aligns+reduces N. No
  // presentation/derived class split. `_draw()` is the ONLY provider-touching part; the base is a
  // no-op (headless subsystems render via an event-inversion binder off the emitted data instead).
  //
  // NOTE: VectorLayer overrides this with a SYNCHRONOUS render() — adding vector features to a
  // provider needs no decode step. Callers can `await` either uniformly.

  /**
   * Compute this layer's render-ready result. Default: force the primary source Dataset into its
   * decoded grid/features and memoize it on `this.result`. Subclasses override to align+reduce.
   * @param {Object} [opts]
   * @returns {Promise<*>}
   */
  async compute(opts = {}) {   // eslint-disable-line no-unused-vars
    const ds = this.sources[0];
    this.result = ds && typeof ds.load === "function" ? await ds.load() : null;
    return this.result;
  }

  /**
   * Render this layer: compute if needed, enforce the provider CRS precondition, then draw. `opts.render`
   * picks the update mechanism — `'in-place'` (swap the overlay's image, no flicker, keeps z-order/
   * identity), `'recreate'` (teardown + redraw), or `'auto'` (default: in-place when the provider + this
   * layer's render type support it, else recreate). Claims the exclusive
   * display slot on success when `this.exclusive`.
   * @param {Object} [opts] - { render?: 'auto'|'in-place'|'recreate' }
   * @returns {Promise<Layer>}
   */
  async render(opts = {}) {
    if (this.result == null) await this.compute(opts);
    this._checkProviderCRS();
    const mode = this._resolveRenderMode(opts.render || "auto");
    // this._draw resolves through the prototype chain, so this is only true when NO subclass
    // overrode it — a bare `Layer` (or one whose subclass forgot to). render() will otherwise
    // succeed silently and draw nothing, which looks indistinguishable from a real bug.
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
   * Replace this layer's source Datasets and, if the layer is already live, re-render. Immutable data
   * means "the data changed" == "point at a new Dataset" — never mutate. Drives the FimMap's Dataset
   * ref-count (acquire the new before releasing the old, so a Dataset shared with another layer is not
   * evicted mid-swap). `opts.render` chooses the update mechanism (see render()).
   *
   * ATOMIC: if the re-render throws (e.g. the new sources have an unrenderable CRS, or a materializer
   * fetch fails), the swap is rolled back — `sources`/`result` revert to their previous values, the
   * new sources' ref-count acquire is undone, and the error rethrows. What's actually on screen never
   * changed either way (a failed render draws nothing new), so this keeps the layer's own state
   * truthful to that: either the swap fully succeeded, or the layer is left exactly as it was before
   * the call — never pointing at broken new sources with the working old ones already let go.
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
   * "Hot-modify": derive new sources FROM the current ones and swap them in. Because the derived
   * Dataset shares memoized ancestors with the old, only the changed tail recomputes — a cheap live
   * tweak (e.g. re-classify with a new threshold) versus a cold source swap. Sugar over setSources.
   * @param {(current: import('./dataset.js').Dataset[]) => (import('./dataset.js').Dataset|import('./dataset.js').Dataset[])} fn
   * @param {Object} [opts]
   * @returns {Promise<Layer>}
   */
  async deriveSources(fn, opts = {}) {
    return this.setSources(fn(this.sources), opts);
  }

  // ---- chainable ops -----------------------------------------------------------------------
  //
  // The same Dataset ops, reachable from the layer you already have:
  //
  //     await layer.clip(bbox).mask(poly).reclassify(rules).render();
  //
  // THREE timings are at play here and only the first is what "immediate" refers to:
  //   1. sources are rewritten  → NOW, synchronously, at each call (this is the choice);
  //   2. the map redraws        → at the explicit render(), so a 4-op chain repaints once, not 4x;
  //   3. data is computed       → unchanged: at a terminal, inside compute(). Dataset stays lazy.
  //
  // Immediate application is what keeps `layer.dataset`/`getStats()`/`fit()` truthful mid-chain and
  // puts a bad argument's throw at the call that made it. Its cost is that a chain failing partway
  // leaves the earlier ops applied — nothing is corrupted (every op is a pure new node), and
  // `reset()` returns to the sources the layer was built from.
  //
  // Ops apply across ALL sources, so a comparison/ensemble layer clips every member. N-ary ops
  // (combine/difference) are deliberately absent: "which source is the left operand" has no
  // sensible answer on a layer — call them on the Datasets.

  /**
   * Apply one Dataset op across every source, immediately. Invalidates the memoized compute and
   * marks the layer dirty; draws nothing until `render()`.
   * @param {string} name - the op, for error messages
   * @param {(ds: import('./dataset.js').Dataset) => import('./dataset.js').Dataset} fn
   * @returns {Layer}
   */
  _op(name, fn) {
    if (!this.sources.length) throw new Error(`layer.${name}(): the layer has no source Dataset`);
    const prev = this.sources;
    // Build ALL the derived nodes before touching anything: a kind mismatch (e.g. clip on a vector)
    // throws here, at the call site, leaving the layer exactly as it was.
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
   * Point the layer back at the sources it held before its first op. Async and atomic, like any
   * source swap — a live layer re-renders. A no-op if nothing has been applied.
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
   * NOT chainable, on purpose. `rasterize` changes a Dataset's kind (vector → raster), and this
   * layer draws the kind it was built for — returning `this` would leave a VectorLayer pointing at a
   * raster it cannot draw. Do it on the Dataset and add the result as its own layer.
   * @returns {never}
   */
  rasterize() {
    throw new Error(
      "layer.rasterize() does not exist: rasterize changes a Dataset's kind (vector → raster), so it " +
      "cannot return this layer. Build the raster as its own layer instead:\n" +
      "    await fim.addLayer(layer.dataset.rasterize({ width, height }));");
  }

  /**
   * Resolve the render update mode. An explicit 'in-place'/'recreate' wins; 'auto' asks provider
   * CAPABILITY (does it expose setRasterImageUrl?) + layer TYPE (does this layer render a swappable
   * raster image?). Vector layers and providers without in-place swap fall back to recreate.
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
   * Strict CRS precondition: every source Dataset whose native CRS the active provider CANNOT render
   * blocks the render with an actionable error, AND emits a host event so the app can react (toast, or
   * auto-reproject as an app-tier policy). Mechanism here; policy in the host — the engine never
   * silently reprojects.
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
   * Tear down render, emit 'removed', then unregister from the owning FimMap. Subclasses
   * super.remove() last. If a `_teardown` hook was assigned (transitional: user-file Layers built
   * inline in floodExtent carry their google.maps teardown here instead of in a dedicated
   * subclass), it runs once before the event. 'removed' fires SYNCHRONOUSLY here — a subscriber
   * (the tools panel) reacts now, not on google.maps' later onRemove() frame, which is what makes
   * layer switches deterministic instead of racing.
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
    // Balance the acquire the constructor did for each source. Without this the count never returns
    // to zero, so a Dataset's memoized decode — the whole pixel array for a raster — stays pinned
    // for the life of the page even after every Layer using it is gone. Released LAST, so anything
    // reacting to 'removed' still sees a live decode.
    for (const ds of this.sources) this._map?._releaseDataset?.(ds);
    // `purgeSource` additionally FORGETS each source — unregistering it from the app so it no longer
    // shows up in `fim.datasets`. Skipped for any source another layer still holds: the app owns the
    // registry, and a layer must not evict data a sibling is rendering.
    if (purgeSource) {
      for (const ds of this.sources) {
        if (this._map?.app?._datasetRefCount?.(ds) === 0) this._map.removeDataset?.(ds);
      }
    }
  }

  /**
   * A plain, structured-cloneable DESCRIPTION of this layer — its type, its sources, and the
   * display state needed to rebuild an equivalent one, e.g. on a different map or provider:
   *
   *   map2.addLayer(layer1.toSpec());
   *
   * This is deliberately a COPY, not a handle. `addLayer(spec)` builds a NEW ColorScale from the
   * description, so the two layers diverge rather than silently sharing mutable colour state —
   * which is exactly the question a `clone()` API cannot answer for the caller. The layer's `id`
   * and its event subscribers are not carried either.
   *
   * `sources` are the live `Dataset` objects (free values, safe to share and already decoded). To
   * persist a spec instead of transferring it in-page, swap them for `ds.toRecord()`.
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

  // ---- data-first read-models — subclasses specialize ----
  /** @returns {import('./legend.js').Legend|null} */
  getLegend() { return null; }
  /** @returns {Promise<import('./stats.js').Stats|null>} */
  async getStats() { return null; }

  // ---- settings — the declarative change-model; subclasses specialize ----
  /**
   * This layer's settings knobs. Lazily built; subclasses override
   * _makeSettings() to supply Raster/Vector knobs. Mutating a knob (`layer.set({...})`)
   * emits the effect event (restyle/recomputed) and re-renders when live.
   * @returns {import('./layerSettings.js').LayerSettings}
   */
  get settings() { return (this._settings ??= this._makeSettings()); }
  /** @returns {import('./layerSettings.js').LayerSettings} */
  _makeSettings() { return new LayerSettings(this); }

  /**
   * THE way to change how this layer looks. Sync and chainable — returns the layer.
   *
   *   layer.set({ palette: 'viridis', continuous: true, opacity: 0.8 });
   *
   * Raster knobs: `palette`, `continuous`, `colorScale`, `noData`, `opacity`, `hover`.
   * Vector knobs: `color`, `opacity`, `useFileColors`, `hover`.
   *
   * This is the single path for changing a layer's appearance. `layer.colorScale` stays readable,
   * and `ColorScale` keeps its own `set()` for building a scale before you hand it over.
   *
   * A knob that needs a redraw (only `noData`) redraws; `await layer.settled()` if you need to know
   * it finished.
   * @param {Object} partial @returns {Layer}
   */
  set(partial) { return partial ? this.settings.set(partial) : this; }
  /** Read current settings. @returns {Object} */
  get() { return this.settings.get(); }
  /** Resolves once any redraw kicked off by `set()` has finished. @returns {Promise<Layer>} */
  settled() { return this.settings.settled(); }

  /**
   * Does the point fall on this layer? Base: no geometry → false. RasterLayer tests its footprint;
   * VectorLayer tests feature geometry. The map event dispatch uses this to route hover/click.
   * @param {number} lat @param {number} lng @returns {boolean}
   */
  hitTest(lat, lng) { return false; }   // eslint-disable-line no-unused-vars

  /** @returns {{id: string, type: string|null, visible: boolean, sources: Array<string|null>}} */
  toJSON() {
    return {
      id: this.id, type: this.type, visible: this.visible,
      sources: this.sources.map((d) => d?.id ?? null),
    };
  }
}

// Shared-mechanism siblings carry a `type`; divergent renderers get their own subclass.
// RasterLayer is ONE class for extent/userRaster/depth/ensemble — they differ only by `type`
// and which of these common palette-canvas fields they use. The subsystem owns the actual
// google.maps render; these hold the handles it manages so state lives on the Layer, not in
// module scope. (Kept google-free here — the model layer stays provider-neutral)
export class RasterLayer extends Layer {
  constructor(opts = {}) {
    super(opts);
    this.overlay = null;        // the OverlayView instance
    this.moveListener = null;   // enableHover()'s onMapMouseMove unsubscribe, when active
    this.loadSeq = 0;           // monotonic — drops stale async loads
    this.rasterData = null;     // pixel array (for hover lookups)
    this.meta = null;           // { bw, bs, be, bn, width, height, noData, unit }
    // The "no data" sentinel for colorize + hover/metrics (transparent, excluded from stats). Settable:
    // pass `{ noData }` here or assign `layer.noData` later. Overrides the grid's own noData when set;
    // null falls back to the decoded grid's noData. Some sources declare no nodata tag, so a host that
    // knows the convention (e.g. FIM's -99999) sets it explicitly.
    this.noData = opts.noData ?? null;
    this.opacity = opts.opacity ?? 1;   // overlay opacity (0..1) — a placement setting
    this.colorScale = null;     // the ColorScale that maps pixel value → colour
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
   * Hide the overlay on the map (opacity → 0 via the provider; the overlay itself is NOT torn down,
   * so show() is instant). The base Layer.hide() only flips `.visible` — that alone doesn't touch
   * anything the provider drew, so a raster overlay stayed visible on the map through it. Chainable.
   * @returns {RasterLayer}
   */
  hide() {
    if (this.overlay) {
      const provider = getMapProvider(this._map?.app?.config?.provider || DEFAULT_PROVIDER);
      provider?.setRasterImageOpacity?.(this.overlay, 0);
    }
    this.visible = false;
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
   * PIXEL-LEVEL hit-test (PACKAGE_ROADMAP §1): true only where a real (non-noData) pixel sits under the
   * point. A click over a transparent/noData part of the footprint therefore falls THROUGH to the
   * layers below, instead of the whole bounding rectangle absorbing it.
   * @param {number} lat @param {number} lng @returns {boolean}
   */
  hitTest(lat, lng) { return this.valueAt(lat, lng) != null; }

  /**
   * The pixel value at a lat/lng (nearest cell), or null when outside the footprint / no data / no
   * pixels loaded. The hover read-model a tooltip (or enableHover(), below) consumes.
   * @param {number} lat @param {number} lng
   * @param {{noDataTolerance?: number}} [opts] - widen the noData check to `|v - noData| <=
   *   tolerance` instead of exact equality — for a raster whose sentinel can drift slightly after
   *   resampling (e.g. a GDAL bilinear warp blending a real value with an adjacent nodata pixel near
   *   an edge). Default 0 = exact match, this method's original behavior; hitTest() always uses the
   *   default, so widening this does not change what a click resolves to unless you call valueAt()
   *   directly.
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
   * Wire a live hover readout: subscribes to the map provider's mouse-move, looks up valueAt() on
   * every move, and emits 'hover' with a ready-to-display `{lat, lng, value, text}`. Idempotent —
   * calling again replaces the previous subscription rather than stacking listeners. Opt-in, not
   * wired automatically on render — a layer nobody hovers shouldn't pay for a mousemove listener.
   * Torn down automatically on remove() (see _draw()'s _teardown).
   *
   * Standardizes what layers/depthMap.js's DepthLayer used to hand-roll inline — its own copy of the
   * bounds/row/col lookup this method now shares via valueAt(). The one thing this does NOT
   * generalize: treating an otherwise-valid VALUE as "nothing to report" (depth's `v === 0` domain
   * rule — zero depth reads as no flooding) is a caller concern, not the mechanism's — pass `isEmpty`
   * for that.
   * @param {Object} [opts]
   * @param {number} [opts.noDataTolerance=0] - forwarded to valueAt().
   * @param {(v: number) => boolean} [opts.isEmpty] - an in-range value to ALSO treat as absent
   *   (event.value becomes null, same as outside the footprint) — e.g. a domain "zero means nothing"
   *   rule that isn't really about noData.
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
   * Resolve the ColorScale to colorize with, in precedence order — (1) EXPLICIT: already attached
   * (a host called set({ colorScale }), or passed { colorScale } to the "raster" factory) — untouched;
   * (2) GDAL-EMBEDDED: a GDAL_METADATA legend in the file, auto-detected via ColorScale's registered
   * parser (layers/depthMap.js supplies it — see registerGdalLegendParser); (3) DEFAULT: a continuous
   * scale (ColorScale's own default palette) ranged to the grid's own min/max. Whichever is chosen is
   * attached to the layer, so getLegend()/getStats() reflect what's actually drawn in EVERY case
   * — never a silently-discarded fallback. This runs synchronously within the current render pass
   * (before the image is drawn), not reactively after — so there is no window where a generic default
   * draws first and a correct GDAL legend never gets applied because nothing repaints on its own.
   * @param {import('./materialize.js').RasterGrid} grid
   * @returns {Array|null} the raw parsed GDAL legend, if one was detected (for the 'rendered' event's
   *   `originalLegend`) — null in the explicit or default cases.
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
   * Draw this raster on the map: resolve a ColorScale (see _resolveColorScale) if none is attached
   * yet, colorize the materialized grid with it → a canvas data URL → position it over the grid's
   * bounds through the map provider. `mode === 'in-place'` swaps the existing overlay's image (no
   * flicker); otherwise it removes-and-re-adds. Provider-neutral — the SDK-specific work is all
   * behind addRasterImage/setRasterImageUrl. Populates `rasterData`/`meta` (hover read-model) from
   * the grid and installs a teardown that removes the overlay. Fires `rendered` with the grid + data
   * URL.
   * @param {Object} [opts] - { mode?: 'in-place'|'recreate' }
   * @returns {void}
   */
  _draw({ mode = "recreate" } = {}) {
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
    const dataURL = gridToDataURL(grid, { colorScale: this.colorScale, noData });
    const bounds = grid.bounds;
    if (mode === "in-place" && this.overlay && typeof provider.setRasterImageUrl === "function") {
      // Reassign to the RETURNED handle — Google recreates, Leaflet swaps in place (mapProvider.js).
      this.overlay = provider.setRasterImageUrl(fim.map, this.overlay, dataURL, bounds, { opacity: this.opacity }) ?? this.overlay;
    } else {
      if (this.overlay) provider.removeRasterImage(fim.map, this.overlay);
      this.overlay = provider.addRasterImage(fim.map, dataURL, bounds, { opacity: this.opacity });
    }
    // Hover read fields from the source grid. Still assignable (the transitional app path sets them
    // directly); they become getters off sources[0] once no caller assigns them.
    this.rasterData = grid.pixels;
    this.meta = { bw: bounds.west, bs: bounds.south, be: bounds.east, bn: bounds.north,
      width: grid.width, height: grid.height, noData, unit: grid.meta?.unit ?? null };
    this._teardown = () => {
      if (this.overlay) provider.removeRasterImage(fim.map, this.overlay);
      this.overlay = null;
      this.disableHover();
    };
    // 'rendered' carries what a tools binder (ui/rasterTools.js bindRasterLayerTools) needs to build the
    // Image Tools panel — per the Layer 'rendered' contract (pixel data, meta, image, type, filename).
    // `originalLegend` is the raw parsed GDAL legend when _resolveColorScale auto-detected one, else
    // null (explicit host-attached scale, or the plain default — neither has a "raw legend" to show);
    // `gmap` is the map for the hover listener.
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
   * Attach the ColorScale that colours this raster. Wiring its `onChange` to a `restyle` event is the
   * live-repaint seam (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 "Settings vs. Operations"): a UI/render subscribes to
   * `restyle` (or `${type}:restyle` on the map bus) and repaints when the user edits the palette —
   * the Layer still names no UI. Passing a new scale detaches the previous listener. `cs` must be a
   * real ColorScale instance (or `null` to detach) — validated BEFORE anything is mutated, so a bad
   * argument (e.g. a palette-name string, meant for `layer.set({ palette })`
   * instead) throws cleanly without leaving `this.colorScale` in a half-set, corrupted
   * state.
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
      // A scale edit (palette/continuous/band) emits 'restyle' AND repaints the memoized grid in
      // place when live — so `layer.set({ palette })` shows on
      // the map with no data re-force. Fire-and-forget: render() skips compute() since result is set.
      this._onScaleChange = () => {
        this.emit("restyle", { colorScale: cs });
        if (this.visible && this.result != null) this.render({ render: "in-place" });
      };
      cs.onChange(this._onScaleChange);
    }
    return this;
  }

  /**
   * The display read-model, derived from the ColorScale (null until one is attached).
   * @returns {import('./legend.js').Legend|null}
   */
  getLegend() {
    return this.colorScale ? Legend.fromColorScale(this.colorScale) : null;
  }

  /**
   * Statistics over this raster's pixels, classified by the attached ColorScale when present (so the
   * histogram buckets line up with the legend). Null until pixels are loaded.
   * @param {Object} [opts]
   * @returns {Promise<import('./stats.js').Stats|null>}
   */
  async getStats(opts = {}) {
    if (!this.rasterData || !this.meta) return null;
    return Stats.raster(this.rasterData, this.meta, { classify: this.colorScale, ...opts });
  }
}

// VectorLayer renders a vector Dataset (ds.data = a GeoJSON FeatureCollection) onto the map. It
// still names NO map SDK — it delegates to the active provider's addVector/removeVector/fitBounds
// (mapProvider.js), so the same layer works on any provider that implements the vector contract.
// The app tier ALSO constructs VectorLayer for its user-file overlays and drives rendering itself
// (setting .dataLayer + a _teardown), so render() here is additive and does not disturb that path.
export class VectorLayer extends Layer {
  /**
   * @param {Object} [opts] - the base Layer options, plus:
   * @param {import('./colorScale.js').ColorScale|null} [opts.colorScale] - value → colour for `colorBy`
   * @param {string|null} [opts.colorBy] - the feature property whose value the scale reads
   */
  constructor(opts = {}) {
    super(opts);
    // The SAME ColorScale a RasterLayer uses. Nothing about the class is pixel-specific: it maps a
    // value to a colour, and a feature property is as good a value as a pixel. What differs is only
    // where the value comes from — hence `colorBy`, the property name to read per feature.
    this.colorScale = null;
    this.colorBy = opts.colorBy ?? null;
    if (opts.colorScale) this._setColorScale(opts.colorScale);
  }

  /**
   * Attach the ColorScale that colours features by `colorBy`. Its `onChange` drives a live restyle,
   * the same seam RasterLayer uses for palette edits — the layer still names no UI.
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
        // A vector overlay has no in-place restyle in the provider contract, so a live layer is
        // re-added with the new resolution — the same remove-then-add setStyle() already does.
        if (this.visible && this._map?.map) this.setStyle({});
      };
      cs.onChange(this._onScaleChange);
    }
    return this;
  }

  /**
   * The style handed to the provider. With a ColorScale + `colorBy` attached this is a per-feature
   * FUNCTION — each feature's `properties[colorBy]` goes through the scale — merged over whatever
   * flat style `setStyle()`/`render({style})` set, so an explicit `strokeWidth` still applies. With
   * no scale (or no `colorBy`) it is just that flat style, exactly as before.
   *
   * A feature whose property is missing or non-numeric is coloured by the scale's `missingColor`
   * when one is set, and otherwise keeps the base style — never a value from the ramp, since
   * "no data for this feature" must not be able to look like a real reading.
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
   * The display read-model, derived from the ColorScale (null until one is attached) — so a vector
   * layer coloured by a property gets the same legend a raster does.
   * @returns {import('./legend.js').Legend|null}
   */
  getLegend() {
    return this.colorScale ? Legend.fromColorScale(this.colorScale) : null;
  }

  /**
   * Draw this layer's Dataset on the map via the owning FimMap's provider.
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
    // Base remove() runs this before emitting 'removed'.
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
   * Remove the vector overlay from the map (the provider contract has no vector "invisible" primitive
   * short of removing it). The base Layer.hide() only flips `.visible` — that alone doesn't touch
   * anything the provider drew, so the features stayed visible on the map through it. `show()` rebuilds
   * via `addVector` — the same remove-then-recreate shape `setStyle()` already uses. Chainable.
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
   * Feature statistics over this layer's GeoJSON — counts by geometry type, total area/length, bbox.
   *
   * Computed from the SOURCE (`dataset.data`), not from the provider's overlay handle, so it works
   * on every provider and before/without a render.
   *
   * @param {Object} [opts]
   * @param {import('./filter.js').Filter|Function|Array|null} [opts.filter] - scope to a region/predicate
   * @returns {Promise<import('./stats.js').Stats|null>}
   */
  async getStats(opts = {}) {
    const ds = this.dataset;
    if (!ds) return null;
    // Prefer the lazy terminal (it forces a URL-backed or op-chained Dataset); fall back to the
    // already-parsed inline GeoJSON that render() draws from.
    let features = ds.data ?? null;
    if (!features && typeof ds.features === "function") features = await ds.features();
    if (!features) return null;
    // Default the classification to whatever is actually colouring the features, so `byClass` and
    // the legend agree — the same guarantee RasterLayer.getStats() gives for pixels. Explicit opts
    // still win.
    return Stats.vector(features, {
      classify: this.colorScale, classifyBy: this.colorBy, ...opts,
    });
  }

  /**
   * Restyle: merge a neutral style patch and re-render (remove + re-add — the provider contract has
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

  /**
   * The first feature whose geometry contains the point (polygons with holes; points within a small
   * epsilon), or null. Drives a marker/feature info window.
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

// ---- geometry (vector hit-test) + map-event dispatch --------------------------------------------

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
 * Point-in-geometry for GeoJSON (x=lng, y=lat). Polygon/MultiPolygon exact; Point within ~0.0005°;
 * GeometryCollection recurses; lines/others → false. Exported for tests.
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
 * Dispatch a normalized map event to the layers TOP-DOWN in z-order (last = top), hit-testing each.
 * Default (precedence): stop when a handler absorbs it (`evt.stopPropagation()`). With
 * `{ simultaneous: true }`: precedence/absorption is bypassed — EVERY hit-tested layer receives it,
 * `stopPropagation` is inert. Only visible layers with a listener for `type` and a passing hitTest
 * receive it either way. Pure over a layers array — FimMap wraps it. (PACKAGE_ROADMAP §1)
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

// ---- type registry (subsystems populate this as they migrate) ----

/** @typedef {(fim: import('./fimMap.js').FimMap, opts: Object) => (Layer|Promise<Layer>)} LayerFactory */

const _factories = new Map();   // type -> (fim, opts) => Layer

/**
 * Register a Layer factory for a `type`. Called by each subsystem module as it migrates.
 * @param {string} type
 * @param {LayerFactory} factory
 * @returns {void}
 */
export function registerLayerType(type, factory) { _factories.set(type, factory); }

/**
 * True if a factory is registered for `type`.
 * @param {string} type
 * @returns {boolean}
 */
export function hasLayerType(type) { return _factories.has(type); }

/**
 * Every layer type `fim.addLayer(type, …)` can currently construct — the built-ins plus anything a
 * host registered. The public query, mirroring `mapProviderNames()`/`materializerFormats()`.
 *
 * NOTE these are REGISTRY KEYS, not `layer.type` values. The two overlap confusingly: 'depth' and
 * 'ensemble' appear here as constructible types AND as `RasterLayer.type` discriminators among
 * sibling rasters ('extent'|'userRaster'|'depth'|'ensemble'), where they mean "which kind of raster
 * is this", not "which factory built it". This function only ever answers the first question.
 * @returns {string[]}
 */
export function getLayerTypes() { return [..._factories.keys()]; }

/**
 * Construct a Layer of `type` for `fim`. `type` is normally a registry string ('vector', 'raster',
 * …), but a bare source works too: pass a Dataset (or anything else) in the `type` slot and it is
 * treated as `{ source: type }` — `fim.addLayer(ds)` needs no type argument at all. Either way, when
 * a type ends up unresolved it is inferred from `opts.source`/`opts.sources[0]`'s `Dataset.kind`
 * ('raster'|'vector') — only when there is EXACTLY one source, since a multi-source type
 * (comparison/ensemble) can't be guessed. Throws a clear error if a type can't be resolved, or if
 * the resolved type has no registered factory.
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

// The engine's built-in vector layer type. `fim.addLayer('vector', { source: ds, style })` parses
// nothing — it renders an already-parsed Dataset — so it resolves synchronously. Registered after
// the registry is defined (module-load order).
registerLayerType("vector", (fim, opts = {}) => {
  const layer = new VectorLayer({
    map: fim,
    type: opts.type || "vector",
    sources: opts.source ? [opts.source] : (opts.sources || []),
  });
  return layer.render({ style: opts.style });
});

// The engine's built-in raster layer type. `fim.addLayer('raster', { source: ds, colorScale?, noData?,
// opacity? })` forces the Dataset (base Layer.compute()) and draws it (RasterLayer._draw). Unlike
// VectorLayer, RasterLayer does not override the base render(), which is async — so, unlike 'vector'
// above, this factory returns a Promise<Layer> and callers (addLayer) must await it.
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
