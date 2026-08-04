// events.js — a tiny event emitter and coded-error helper shared by the mount paths.

export function createEmitter() {
  const map = new Map(); // event name -> Set<handler>
  return {
    on(evt, fn) {
      if (typeof fn !== "function") return;
      if (!map.has(evt)) map.set(evt, new Set());
      map.get(evt).add(fn);
    },
    off(evt, fn) {
      const s = map.get(evt);
      if (s) s.delete(fn);
    },
    emit(evt, payload) {
      const s = map.get(evt);
      if (!s) return;
      for (const fn of [...s]) {
        try {
          fn(payload);
        } catch (e) {
          console.error("FimViz: event handler for '" + evt + "' threw", e);
        }
      }
    },
  };
}

// Build an Error carrying a machine-readable .code (see docs/usage/USAGE.md error codes).
export function fimError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

// ---- the host sink (engine → host, one direction) --------------------------------------
//
// A single active sink lets deep engine modules (gdal.js, io/fileUpload.js, Google Maps'
// gm_authFailure, …) report to the mounted app's emitter without threading a ctx through every
// call. Same ambient-active-pointer pattern as setActiveDom().
//
// THIS IS THE ENGINE'S ONLY OUTBOUND CHANNEL TO A HOST. The engine must never call an app
// function — not by import, and not through `window.*` either. A `window.pushNotification(...)`
// in library code is the same coupling as an import, minus the ability of any tool to see it, and
// it throws a TypeError in any host that doesn't happen to define that global. So: the engine
// EMITS, the host SUBSCRIBES and decides what (if anything) to render.
//
// Nothing here assumes a listener exists — an unhandled event is a silent no-op, which is what
// makes the engine embeddable headlessly.

let _sink = null;

/** Point the engine's outbound events at a host emitter (the app's bus). null to detach. */
export function setHostSink(emitter) {
  _sink = emitter;
}

/** @deprecated Use setHostSink — the sink carries more than errors now. */
export const setErrorSink = setHostSink;

/** Emit an arbitrary engine→host event. Returns true if a sink was attached. */
export function emitHost(evt, payload) {
  if (!_sink) return false;
  _sink.emit(evt, payload);
  return true;
}

/** Report a coded error (docs/usage/USAGE.md error codes) → 'error'. */
export function reportError(code, message) {
  emitHost("error", fimError(code, message));
}

/**
 * A user-facing message the host may surface however it likes (toast, console, nothing).
 * Replaces the engine's direct `window.pushNotification(...)` calls → 'notify'.
 * @param {string} message
 * @param {{level?: 'info'|'warn'|'error', detail?: object}} [opts]
 */
export function notify(message, { level = "info", detail = null } = {}) {
  emitHost("notify", { message, level, detail });
}

/**
 * Stored data for `store` changed (upload, delete, rename), so any host list showing it is stale.
 * Replaces `window.loadFileViewerOptions()` / `loadFloodExtentFileOptions()` /
 * `loadComparisonLoaderOptions()` / `loadEnsembleDisplayOptions()` → 'storage:changed'.
 * `store` is the logical collection name the host knows ('userFiles', 'floodExtent', …).
 */
export function notifyStorageChanged(store, detail = null) {
  emitHost("storage:changed", { store, detail });
}

/**
 * An upload finished successfully — the host may dismiss whatever upload affordance it showed.
 * Replaces `window.hideUploadOverlay()` / `hideComparisonUploadOverlay()` → 'upload:complete'.
 * `target` names which inlet finished ('default' | 'comparison' | …).
 */
export function notifyUploadComplete(target = "default", detail = null) {
  emitHost("upload:complete", { target, detail });
}

/**
 * Long-running work started (`active: true`) or finished (`active: false`). Replaces the engine
 * toggling a specific `#loading-indicator` — whether that means a spinner, a cursor or nothing is
 * the host's decision. `source` names the subsystem ('depth' | 'ensemble' | …) so a host can tell
 * overlapping work apart; a host with one indicator can ignore it.
 * @param {boolean} active @param {string} [source]
 */
export function notifyBusy(active, source = "default") {
  emitHost("busy", { active: !!active, source });
}
