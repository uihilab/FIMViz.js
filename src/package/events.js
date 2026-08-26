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

// ---- the host sink, engine to host, one direction ---------------------------------------
//
// One active sink lets deep engine modules such as gdal.js or io/fileUpload.js report to the
// mounted app's emitter without threading a context through each call. setActiveDom() uses the
// same ambient-pointer approach.
//
// This is the engine's only outbound channel to a host. The engine must not call an app function,
// by import or through `window.*`. A `window.pushNotification(...)` in library code couples as
// tightly as an import, no tool can see it, and it throws a TypeError in a host that never defined
// that global. The engine emits; the host subscribes and decides what to render.
//
// Nothing assumes a listener exists. An unhandled event does nothing, which is what lets the engine
// run headless.

let _sink = null;

/** Points the engine's outbound events at a host emitter. Pass null to detach. */
export function setHostSink(emitter) {
  _sink = emitter;
}

/** @deprecated Use setHostSink. The sink carries more than errors now. */
export const setErrorSink = setHostSink;

/** Emits an engine event to the host. Returns true when a sink is attached. */
export function emitHost(evt, payload) {
  if (!_sink) return false;
  _sink.emit(evt, payload);
  return true;
}

/** Emits 'error' with a coded Error. Codes are listed in docs/usage/USAGE.md. */
export function reportError(code, message) {
  emitHost("error", fimError(code, message));
}

/**
 * Emits 'notify' with a user-facing message. The host renders it as a toast, a console line or
 * nothing. Replaces the engine's direct `window.pushNotification(...)` calls.
 * @param {string} message
 * @param {{level?: 'info'|'warn'|'error', detail?: object}} [opts]
 */
export function notify(message, { level = "info", detail = null } = {}) {
  emitHost("notify", { message, level, detail });
}

/**
 * Emits 'storage:changed' after an upload, delete or rename, so a host list showing `store` knows
 * it is stale. `store` is the collection name the host uses, i.e. 'userFiles'. Replaces the four
 * `window.load*Options()` globals.
 */
export function notifyStorageChanged(store, detail = null) {
  emitHost("storage:changed", { store, detail });
}

/**
 * Emits 'upload:complete' so the host can dismiss whatever upload UI it showed. `target` names the
 * inlet that finished, i.e. 'comparison'. Replaces `window.hideUploadOverlay()` and
 * `hideComparisonUploadOverlay()`.
 */
export function notifyUploadComplete(target = "default", detail = null) {
  emitHost("upload:complete", { target, detail });
}

/**
 * Emits 'busy' when long-running work starts or finishes. The host decides whether that means a
 * spinner, a cursor or nothing, instead of the engine toggling a specific `#loading-indicator`.
 * `source` names the subsystem, i.e. 'depth', so a host can tell overlapping work apart. A host
 * with one indicator can ignore it.
 * @param {boolean} active @param {string} [source]
 */
export function notifyBusy(active, source = "default") {
  emitHost("busy", { active: !!active, source });
}
