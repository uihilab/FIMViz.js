// fimViz.js — the FimViz ambient service container + the lazily-created default instance.
//
// FimViz is NOT a class the user instantiates; it is a namespace (create/mount/parseFile)
// plus a lazily-created, reference-counted DEFAULT instance that owns the services shared
// across maps on a page: the event bus, config, the Maps-loader state, and the
// Storage handle. The default is born on the first FimMap and released when the last
// FimMap is destroyed. `FimViz.create()` makes a private (isolated) app instead.
//
// Pattern: ambient default instance, à la Firebase's [DEFAULT] app / matplotlib pyplot.
// See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 and §3.1.

import { newConfig, setGdalPath, resetGdalPath } from "./config.js";
import { createEmitter, setHostSink } from "./events.js";
import { Storage } from "../io/storage.js";

/**
 * A FimViz instance: the shared service container behind one or more FimMaps. The user
 * rarely holds one directly — they work in Maps/Layers and the default is implicit.
 */
export class FimVizInstance {
  #emitter = createEmitter();
  #maps = new Set();
  #config = newConfig();   // this app's own config object (defaults until configured)
  #configLocked = false;
  #isDefault = false;

  #storage = null;

  // DATA lives on the app; RENDERING lives on the map. A Dataset is a free value with no
  // back-pointer — one instance can back Layers on several maps, of several providers, at once — so
  // its registry and its ref-count belong at the level that is shared, alongside Storage. A per-map
  // count cannot be correct: map A dropping its last Layer would evict a decode map B is still
  // rendering, because A cannot see B's references.
  #datasets = [];
  #datasetRefs = new WeakMap();   // Dataset -> live Layer references, across every map on this app

  /** @param {{isDefault?: boolean}} [opts] */
  constructor({ isDefault = false } = {}) {
    this.#isDefault = isDefault;
  }

  /**
   * Client-side storage — shared across this app's maps. Lazily built from `config.storage`,
   * because Storage is GENERIC: the host owns the database name and schema, so the library has
   * nothing to construct one from until it is configured (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
   *
   *   mount('#el', { apiKey, storage: { name: 'my-store', version: 1, tables: ['userFiles'] } })
   *
   * Not configured is a clear throw rather than a silent null: reaching for storage you never set
   * up is a programming error.
   * @returns {Storage}
   */
  get storage() {
    if (!this.#storage) {
      const cfg = this.#config.storage;
      if (!cfg?.name) {
        throw new Error(
          "FimViz: storage is not configured. Pass storage: { name, version?, tables? } to " +
          "mount()/create() — the host owns the database schema (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1). " +
          "Or construct one directly: new Storage({ name }).");
      }
      this.#storage = new Storage(cfg);
    }
    return this.#storage;
  }

  // ---- Datasets (shared across every map on this app) --------------------------------------

  /**
   * Every Dataset parsed on this app, by any of its maps. A copy — register via `fim.addDataset()`
   * (or `fim.addLayer(rawFile)`, which parses implicitly), not by pushing here.
   * @returns {import('./dataset.js').Dataset[]}
   */
  get datasets() { return [...this.#datasets]; }

  /** @internal @param {import('./dataset.js').Dataset} ds @returns {import('./dataset.js').Dataset} */
  _registerDataset(ds) {
    if (ds && !this.#datasets.includes(ds)) this.#datasets.push(ds);
    return ds;
  }

  /**
   * Register a Dataset parsed elsewhere — typically one crossing over from another app, since a
   * Dataset is a free value that any map can render. Idempotent; returns the Dataset for chaining.
   *
   *   app2.adoptDataset(app1.datasets[0]);   // now discoverable on app2 too, no re-parse
   *
   * @param {import('./dataset.js').Dataset} ds
   * @returns {import('./dataset.js').Dataset}
   */
  adoptDataset(ds) { return this._registerDataset(ds); }

  /**
   * Forget a Dataset: drop it from this registry and release its decode.
   *
   * The verb lives HERE, not on `Layer`, because the app owns the registry — a Layer cannot know
   * whether a Layer on another map still wants it. That is also why this REFUSES while references
   * remain: unregistering data something is still rendering is never what the caller meant.
   *
   * @param {import('./dataset.js').Dataset} ds
   * @param {{force?: boolean}} [opts] - `force: true` drops it regardless (the renderers keep their
   *   own reference and re-force on next draw; only discoverability is lost)
   * @returns {boolean} false if it was not registered here
   */
  removeDataset(ds, { force = false } = {}) {
    const i = this.#datasets.indexOf(ds);
    if (i < 0) return false;
    const refs = this._datasetRefCount(ds);
    if (refs > 0 && !force) {
      throw new Error(
        `FimViz.removeDataset("${ds?.name ?? "?"}"): still rendered by ${refs} layer(s) on this app. ` +
        "Remove those layers first, or pass { force: true } to unregister anyway.");
    }
    this.#datasets.splice(i, 1);
    this.#datasetRefs.delete(ds);
    ds.release?.();
    return true;
  }

  /**
   * A Layer took a reference to `ds`. Counted per APP, so a Dataset shared by Layers on two
   * different maps is only evicted once every one of them has let go.
   * @internal @param {import('./dataset.js').Dataset} ds @returns {void}
   */
  _acquireDataset(ds) {
    if (!ds) return;
    this.#datasetRefs.set(ds, (this.#datasetRefs.get(ds) || 0) + 1);
  }

  /**
   * A Layer dropped its reference to `ds`; evict the memoized decode at zero. The Dataset itself
   * STAYS in `datasets` — the registry records what was parsed, the count records what is rendered,
   * and a re-render simply re-forces.
   * @internal @param {import('./dataset.js').Dataset} ds @returns {void}
   */
  _releaseDataset(ds) {
    if (!ds) return;
    const n = (this.#datasetRefs.get(ds) || 0) - 1;
    if (n > 0) { this.#datasetRefs.set(ds, n); return; }
    this.#datasetRefs.delete(ds);
    ds.release?.();
  }

  /** Live Layer references to `ds` across this app's maps. @internal @param {*} ds @returns {number} */
  _datasetRefCount(ds) { return this.#datasetRefs.get(ds) || 0; }

  /** Is this the shared ambient default app (vs. one created via `{ isolated: true }`)? @returns {boolean} */
  get isDefault() { return this.#isDefault; }
  /** Every `FimMap` currently mounted on this app. @returns {import('./fimMap.js').FimMap[]} */
  get maps() { return [...this.#maps]; }
  /** The underlying event emitter backing `on`/`off`/`emit`. @returns {*} */
  get emitter() { return this.#emitter; }

  // --- config (set-once, locked after the first map boots) ------------------------------
  /**
   * Merge host options into config. No-op (with a warning) once locked.
   * @param {Object} [options]
   * @returns {void}
   */
  configure(options = {}) {
    if (this.#configLocked) {
      if (options && Object.keys(options).length) {
        console.warn("FimViz: config is locked after boot; ignoring late reconfigure. " +
          "Pass config to the first create()/mount() call.");
      }
      return;
    }
    Object.assign(this.#config, options);
  }
  /** Lock config against further changes — called once the first map on this app has booted. @returns {void} */
  lockConfig() { this.#configLocked = true; }
  /** This app's own config object (defaults merged with whatever was passed to `mount()`/`create()`). @returns {Object} */
  get config() { return this.#config; }

  // --- event bus ------------------------------------------------------------------------
  /** Subscribe to an app-level event (`error`, `notify`, `storage:changed`, …). @param {string} evt @param {(payload: any) => void} fn @returns {FimVizInstance} */
  on(evt, fn) { this.#emitter.on(evt, fn); return this; }
  /** Unsubscribe a listener previously added with `on`. @param {string} evt @param {(payload: any) => void} fn @returns {FimVizInstance} */
  off(evt, fn) { this.#emitter.off(evt, fn); return this; }
  /** Emit an app-level event to every subscriber. @param {string} evt @param {*} [payload] @returns {FimVizInstance} */
  emit(evt, payload) { this.#emitter.emit(evt, payload); return this; }

  // --- map registry + reference-counted lifecycle ---------------------------------------
  /** Does this app have at least one mounted `FimMap`? Used as the single-instance mount guard. @returns {boolean} */
  get hasMaps() { return this.#maps.size > 0; }

  /**
   * Register a newly-booted `FimMap` on this app: arms the reference count and points the ambient
   * event sink at this app. Called by `mount()`/`create()` — not part of the public API.
   * @internal
   * @param {import('./fimMap.js').FimMap} map @returns {void}
   */
  _register(map) {
    this.#maps.add(map);
    // gdalPath is the one process-global setting (GDAL is a per-page singleton); adopt this app's.
    // Everything else in config is read per-instance via `fim.config`, never ambiently.
    setGdalPath(this.#config.gdalPath);
    // Route deep-module engine events (coded errors, notify, storage:changed, upload:complete)
    // to this app's event bus — the engine's only outbound channel to the host.
    setHostSink(this.#emitter);
  }

  /**
   * Unregister a `FimMap` from this app on `destroy()`; when the last map goes, releases shared
   * services (storage connection, gdalPath, event sink). Not part of the public API.
   * @internal
   * @param {import('./fimMap.js').FimMap} map @returns {void}
   */
  _release(map) {
    this.#maps.delete(map);
    if (this.#maps.size === 0) {
      // Last map gone: release shared services. IndexedDB data persists; we just drop the
      // in-memory handles and reset the gdalPath/sink. The default app is re-created
      // on the next map.
      this.#storage?.close();   // fire-and-forget: closes the connection, data persists
      this.#storage = null;
      resetGdalPath();
      setHostSink(null);
      if (this.#isDefault && _defaultApp === this) _defaultApp = null;
    }
  }

  /** Force-teardown of every map on this app (rare; the ref-counted path is the norm). @returns {void} */
  destroy() {
    for (const map of [...this.#maps]) map.destroy();
  }
}

// The lazily-created shared default instance.
let _defaultApp = null;

/** The ambient default FimViz, created on first use. @returns {FimVizInstance} */
export function getDefaultApp() {
  if (!_defaultApp) _defaultApp = new FimVizInstance({ isDefault: true });
  return _defaultApp;
}

/**
 * An ISOLATED app — its own config, event bus, storage and single-map guard, NOT the shared
 * default. This is what lets two independent widgets (e.g. a Google map and a Leaflet map) coexist
 * on one page: each `mount({ isolated: true })` gets a fresh app, so the per-app "already-mounted"
 * guard does not collide. (The ambient DOM/config pointers are still last-writer-wins — fine for
 * bare maps; the layer subsystems are not yet fully isolated.)
 * @returns {FimVizInstance}
 */
export function createApp() {
  return new FimVizInstance();
}

// The public namespace (create/mount are attached in mount.js to avoid a cycle; here we
// expose the ambient-lifecycle helpers).
export const FimViz = {
  /** The active default instance, or null if no map is mounted. @returns {FimVizInstance|null} */
  current() { return _defaultApp; },
  /** Force-release the default instance (tears down its maps). Rarely needed. @returns {void} */
  reset() { if (_defaultApp) _defaultApp.destroy(); },
};
