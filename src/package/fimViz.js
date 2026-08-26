// fimViz.js — the ambient service container and its lazily-created default instance.
//
// FimViz is a namespace holding create, mount and parseFile, not a class the user instantiates. It
// also owns a reference-counted default instance holding the services maps on a page share: the
// event bus, config, the Maps-loader state and the Storage handle. The first FimMap creates that
// default and destroying the last FimMap releases it. `FimViz.create()` makes an isolated app.
//
// Firebase's [DEFAULT] app and matplotlib's pyplot use the same ambient-default pattern. See
// docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 and §3.1.

import { newConfig, setGdalPath, resetGdalPath } from "./config.js";
import { createEmitter, setHostSink } from "./events.js";
import { Storage } from "../io/storage.js";

/**
 * The shared service container behind one or more FimMaps. The user rarely holds one, since they
 * work in Maps and Layers while the default stays implicit.
 */
export class FimVizInstance {
  #emitter = createEmitter();
  #maps = new Set();
  #config = newConfig();   // this app's own config, holding defaults until configure() runs
  #configLocked = false;
  #isDefault = false;

  #storage = null;

  // Data belongs to the app and rendering belongs to the map. A Dataset holds no back-pointer, so
  // one can back Layers on several maps and several providers at once. Its registry and reference
  // count therefore sit here beside Storage. A per-map count would be wrong: map A dropping its
  // last Layer would evict a decode map B is still rendering, because A cannot see B's references.
  #datasets = [];
  #datasetRefs = new WeakMap();   // Dataset -> live Layer references, across every map on this app

  /** @param {{isDefault?: boolean}} [opts] */
  constructor({ isDefault = false } = {}) {
    this.#isDefault = isDefault;
  }

  /**
   * Client-side storage, shared across this app's maps. Built lazily from `config.storage`, because
   * Storage is generic: the host owns the database name and schema, so the library cannot construct
   * one until it is configured (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
   *
   *   mount('#el', { apiKey, storage: { name: 'my-store', version: 1, tables: ['userFiles'] } })
   *
   * Throws when unconfigured rather than returning null, since reaching for storage that was never
   * set up is a programming error.
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
   * A copy of every Dataset parsed on this app, by any of its maps. Add one with `fim.addDataset()`
   * or `fim.addLayer(rawFile)`, which parses implicitly. Pushing onto this array does nothing.
   * @returns {import('./dataset.js').Dataset[]}
   */
  get datasets() { return [...this.#datasets]; }

  /** @internal @param {import('./dataset.js').Dataset} ds @returns {import('./dataset.js').Dataset} */
  _registerDataset(ds) {
    if (ds && !this.#datasets.includes(ds)) this.#datasets.push(ds);
    return ds;
  }

  /**
   * Registers a Dataset parsed elsewhere, usually one coming from another app, since any map can
   * render one. Idempotent, and returns the Dataset for chaining.
   *
   *   app2.adoptDataset(app1.datasets[0]);   // now discoverable on app2 too, no re-parse
   *
   * @param {import('./dataset.js').Dataset} ds
   * @returns {import('./dataset.js').Dataset}
   */
  adoptDataset(ds) { return this._registerDataset(ds); }

  /**
   * Drops a Dataset from this registry and releases its decode.
   *
   * It lives on the app rather than on `Layer` because the app owns the registry, and a Layer cannot
   * know whether a Layer on another map still wants the data. For the same reason it throws while
   * references remain: unregistering data something is still rendering is never intended.
   *
   * @param {import('./dataset.js').Dataset} ds
   * @param {{force?: boolean}} [opts] - `force: true` drops it anyway. The renderers keep their own
   *   reference and re-force on the next draw, so only discoverability is lost.
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
   * Records that a Layer took a reference to `ds`. Counted per app, so a Dataset shared by Layers
   * on two maps is evicted only once both have let go.
   * @internal @param {import('./dataset.js').Dataset} ds @returns {void}
   */
  _acquireDataset(ds) {
    if (!ds) return;
    this.#datasetRefs.set(ds, (this.#datasetRefs.get(ds) || 0) + 1);
  }

  /**
   * Records that a Layer dropped its reference to `ds`, and evicts the memoized decode at zero. The
   * Dataset stays in `datasets`: the registry records what was parsed, the count records what is
   * rendered, and a re-render forces it again.
   * @internal @param {import('./dataset.js').Dataset} ds @returns {void}
   */
  _releaseDataset(ds) {
    if (!ds) return;
    const n = (this.#datasetRefs.get(ds) || 0) - 1;
    if (n > 0) { this.#datasetRefs.set(ds, n); return; }
    this.#datasetRefs.delete(ds);
    ds.release?.();
  }

  /** How many live Layers reference `ds` across this app's maps. @internal @param {*} ds @returns {number} */
  _datasetRefCount(ds) { return this.#datasetRefs.get(ds) || 0; }

  /** True for the shared default app, false for one from `{ isolated: true }`. @returns {boolean} */
  get isDefault() { return this.#isDefault; }
  /** The `FimMap`s currently mounted on this app. @returns {import('./fimMap.js').FimMap[]} */
  get maps() { return [...this.#maps]; }
  /** The underlying event emitter backing `on`/`off`/`emit`. @returns {*} */
  get emitter() { return this.#emitter; }

  // --- config: written once, then locked when the first map boots -----------------------
  /**
   * Merges host options into config. Once locked it warns and does nothing.
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
  /** Locks config against further changes, once the first map on this app has booted. @returns {void} */
  lockConfig() { this.#configLocked = true; }
  /** This app's config: the defaults with whatever `mount()` or `create()` was given merged over. @returns {Object} */
  get config() { return this.#config; }

  // --- event bus ------------------------------------------------------------------------
  /** Subscribes to an app-level event, i.e. `storage:changed`. @param {string} evt @param {(payload: any) => void} fn @returns {FimVizInstance} */
  on(evt, fn) { this.#emitter.on(evt, fn); return this; }
  /** Removes a listener added with `on`. @param {string} evt @param {(payload: any) => void} fn @returns {FimVizInstance} */
  off(evt, fn) { this.#emitter.off(evt, fn); return this; }
  /** Emits an app-level event to its subscribers. @param {string} evt @param {*} [payload] @returns {FimVizInstance} */
  emit(evt, payload) { this.#emitter.emit(evt, payload); return this; }

  // --- map registry, reference-counted from first boot to last destroy ------------------
  /** True when at least one `FimMap` is mounted. mount() reads it as the single-instance guard. @returns {boolean} */
  get hasMaps() { return this.#maps.size > 0; }

  /**
   * Registers a newly-booted `FimMap`, arming the reference count and pointing the ambient event
   * sink at this app. `mount()` and `create()` call it. Not public.
   * @internal
   * @param {import('./fimMap.js').FimMap} map @returns {void}
   */
  _register(map) {
    this.#maps.add(map);
    // gdalPath is the one process-global setting, since GDAL is a per-page singleton, so adopt this
    // app's. Everything else in config is read per instance through `fim.config`.
    setGdalPath(this.#config.gdalPath);
    // Route engine events from the deep modules to this app's event bus, which is the engine's only
    // outbound channel to the host.
    setHostSink(this.#emitter);
  }

  /**
   * Unregisters a `FimMap` on `destroy()`. When the last map goes it releases the shared services:
   * the storage connection, gdalPath and the event sink. Not public.
   * @internal
   * @param {import('./fimMap.js').FimMap} map @returns {void}
   */
  _release(map) {
    this.#maps.delete(map);
    if (this.#maps.size === 0) {
      // The last map is gone, so release the shared services. IndexedDB data persists; this drops
      // only the in-memory handles and resets gdalPath and the sink. The next map re-creates the
      // default app.
      this.#storage?.close();   // not awaited: closes the connection, data persists
      this.#storage = null;
      resetGdalPath();
      setHostSink(null);
      if (this.#isDefault && _defaultApp === this) _defaultApp = null;
    }
  }

  /** Tears down each map on this app. Rare, since the reference-counted path is the norm. @returns {void} */
  destroy() {
    for (const map of [...this.#maps]) map.destroy();
  }
}

// The lazily-created shared default instance.
let _defaultApp = null;

/** The default FimViz, created on first use. @returns {FimVizInstance} */
export function getDefaultApp() {
  if (!_defaultApp) _defaultApp = new FimVizInstance({ isDefault: true });
  return _defaultApp;
}

/**
 * An isolated app with its own config, event bus, storage and single-map guard, separate from the
 * default. This is what lets two widgets coexist on one page, i.e. a Google map beside a Leaflet
 * one: each `mount({ isolated: true })` gets a fresh app, so the per-app already-mounted guard does
 * not collide. The ambient DOM and config pointers remain last-writer-wins, which is fine for bare
 * maps, but the layer subsystems are not fully isolated yet.
 * @returns {FimVizInstance}
 */
export function createApp() {
  return new FimVizInstance();
}

// The public namespace. mount.js attaches create and mount to avoid an import cycle, so only the
// default-instance helpers appear here.
export const FimViz = {
  /** The active default instance, or null when no map is mounted. @returns {FimVizInstance|null} */
  current() { return _defaultApp; },
  /** Releases the default instance, tearing down its maps. Rarely needed. @returns {void} */
  reset() { if (_defaultApp) _defaultApp.destroy(); },
};
