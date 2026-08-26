// layerSettings.js — the Layer change-model (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 "Settings vs. Operations").
//
// A setting is a declarative parameter applied while rendering the current source: palette, opacity,
// noData or hover. An operation replaces the data instead, so swap, reproject, select and reload are
// Layer and Dataset methods rather than knobs. Writing a setting classifies its effect and emits the
// matching event on the layer. Settings and operations share one event stream, so a UI reacts to
// both the same way:
//   'restyle'    recolor the memoized grid for palette, opacity or label. No re-force.
//   'recomputed' the derived grid changed, from noData. Re-colorize, and the hover meta changes.
//
// LayerSettings duplicates no state. RasterSettings routes style knobs to the layer's ColorScale,
// whose onChange already emits 'restyle' and repaints (see RasterLayer._setColorScale), so the
// ColorScale alone decides color. This bag stores only the opacity, hover and noData values a UI
// reads back.

/** The declarative knob bag for a Layer. Subclasses implement `_apply(key, value)`. */
export class LayerSettings {
  /**
   * @param {import('./layer.js').Layer} layer
   * @param {Object} [defaults] - initial knob values, and the reset() target unless overridden
   */
  constructor(layer, defaults = {}) {
    this._layer = layer;
    this._state = { opacity: 1, hover: false, ...defaults };
    this._defaults = { opacity: 1, hover: false };
  }

  /** Reads one knob, or a copy of the whole state object when given no key. */
  get(key) { return key == null ? { ...this._state } : this._state[key]; }

  /**
   * Writes a batch of knobs. Applies each known one, re-renders if any needs a redraw, then emits
   * each distinct effect event once plus a 'settings' summary. Synchronous and chainable: it returns
   * the Layer, not a Promise.
   *
   * Across Raster and Vector settings, only `noData` triggers a redraw. When it does, the render
   * runs and the effect events fire after it, so a subscriber never reads a half-updated grid. Await
   * it with `await layer.settled()`, or subscribe to 'recomputed' or 'rendered'. A render failure
   * arrives on the layer's 'error' event.
   *
   * Partial and best-effort: one key throwing, i.e. an invalid palette name failing ColorScale's
   * validation, does not abort the batch. The other keys still apply, commit to `_state` and fire
   * their effect events. Failures are collected and thrown together as one error at the end, after
   * the successful keys have taken effect, naming each failed key with its message and listing the
   * keys that succeeded. The user then sees exactly what went wrong and what did not, instead of
   * silent failure or one bad key blocking unrelated ones.
   * @param {Object} partial
   * @returns {import('./layer.js').Layer} the layer, for chaining
   */
  set(partial = {}) {
    const changed = {};
    const failed = {};
    let redraw = false;
    const emits = new Set();

    // Group pass. A subclass may fold related knobs into one underlying call. RasterSettings sends
    // the ColorScale-bound knobs through a single `colorScale.set(patch)`, so
    // `layer.set({palette, continuous})` produces one onChange and one 'restyle', matching what
    // `colorScale.set({palette, continuous})` already did. Applying them key by key fired one
    // restyle per key, so the same patch behaved differently depending on which object received it.
    //
    // If the grouped call throws, fall back to per-key application so only the genuinely bad key
    // fails, keeping the partial best-effort behavior described above.
    let claimed = null;
    try { claimed = this._applyGroup?.(partial) || null; }
    catch { claimed = null; }   // fall through to the per-key loop, which isolates the bad key

    for (const [k, v] of Object.entries(partial)) {
      if (claimed?.keys?.has(k)) { changed[k] = v; this._state[k] = v; continue; }
      let r;
      try {
        r = this._apply(k, v);
      } catch (e) {
        failed[k] = e?.message || String(e);
        continue;   // one bad knob does not block the rest of the batch
      }
      if (!r) continue;                 // unknown knob → ignore
      changed[k] = v; this._state[k] = v;
      if (r.redraw) redraw = true;
      if (r.emit) emits.add(r.emit);
    }
    if (Object.keys(changed).length) {
      const fire = () => {
        for (const e of emits) this._layer.emit(e, { changed });
        this._layer.emit("settings", { changed });
      };
      if (redraw && this._layer.visible && typeof this._layer.render === "function") {
        // Redraw before emitting, so a 'recomputed' subscriber cannot read a half-updated grid.
        // Held on _pending so layer.settled() can await it. Errors go to the layer's event bus
        // rather than becoming an unhandled rejection on a synchronous call.
        this._pending = Promise.resolve(this._layer.render({ render: "in-place" }))
          .then(fire)
          .catch((e) => { this._layer.emit("error", { error: e, phase: "settings", changed }); })
          .finally(() => { this._pending = null; });
      } else {
        fire();
      }
    }
    const failedKeys = Object.keys(failed);
    if (failedKeys.length) {
      const detail = failedKeys.map((k) => `"${k}": ${failed[k]}`).join("; ");
      const okNote = Object.keys(changed).length
        ? ` The other ${Object.keys(changed).length} knob(s) (${Object.keys(changed).join(", ")}) were applied successfully.`
        : "";
      throw new Error(`LayerSettings.set: ${failedKeys.length} of ${Object.keys(partial).length} knob(s) failed — ${detail}.${okNote}`);
    }
    return this._layer;
  }

  /**
   * Resolves once any redraw `set()` started has finished and its effect events have fired.
   * Resolves immediately when nothing is pending, so `await layer.settled()` is always safe.
   * @returns {Promise<import('./layer.js').Layer>}
   */
  async settled() { await this._pending; return this._layer; }

  /** Restores the reset defaults. @returns {import('./layer.js').Layer} */
  reset() { return this.set(this._defaults); }

  /**
   * Applies one knob and reports its effect. Returns `null` for an unknown knob, which set()
   * ignores. Otherwise `redraw:true` asks for an in-place re-render, and `emit` names the effect
   * event, or is null when something else already emits it, i.e. ColorScale.onChange for palette.
   * @param {string} key @param {*} value @returns {{redraw: boolean, emit: string|null}|null}
   */
  _apply(key, value) { return null; }   // eslint-disable-line no-unused-vars
}

/**
 * Raster knobs. `palette` and `continuous` go to the layer's ColorScale, whose onChange emits
 * 'restyle' and repaints. `noData` changes the data, so it emits 'recomputed' and forces a redraw.
 * `opacity` sets provider opacity with no redraw. `hover` affects interaction only.
 */
export class RasterSettings extends LayerSettings {
  constructor(layer) {
    super(layer, { opacity: layer.opacity ?? 1, hover: true, noData: layer.noData ?? null });
    this._defaults = { opacity: 1, hover: true };   // a raster shows hover values by default
  }
  /**
   * The knobs belonging to the attached ColorScale. One list, so the group pass and the per-key
   * fallback below cannot drift apart.
   */
  static SCALE_KEYS = ["palette", "continuous", "min", "max", "unit", "stops", "colorStops"];

  /**
   * Folds the ColorScale-bound knobs into one `colorScale.set(patch)`, giving one onChange, one
   * 'restyle' and one repaint however many of them the patch holds.
   * @param {Object} partial @returns {{keys: Set<string>, redraw: boolean, emit: string|null}|null}
   */
  _applyGroup(partial) {
    const present = RasterSettings.SCALE_KEYS.filter((k) => k in partial);
    if (!present.length) return null;
    const keys = new Set(present);
    const cs = this._layer.colorScale;
    // With no scale attached the knobs do nothing, but _state still records them, so a later attach
    // or a UI reading settings.get() sees what the user asked for.
    if (!cs) return { keys, redraw: false, emit: null };
    const patch = {};
    for (const k of present) patch[k] = k === "continuous" ? !!partial[k] : partial[k];
    cs.set(patch);   // throws on a bad value → set() falls back to the per-key loop below
    return { keys, redraw: false, emit: null };
  }

  _apply(key, v) {
    const L = this._layer;
    switch (key) {
      // The ColorScale-bound knobs. _applyGroup above normally handles them together; these per-key
      // cases isolate the bad key when that grouped call throws.
      case "palette":
      case "continuous":
      case "min":
      case "max":
      case "unit":
      case "stops":
      case "colorStops":
        if (L.colorScale) L.colorScale.set({ [key]: key === "continuous" ? !!v : v });
        return { redraw: false, emit: null };   // no scale attached, so nothing to repaint
      case "colorScale":
        // Swaps the whole scale, where `palette` and `continuous` edit the attached one. Handling
        // it here makes layer.set() the single recolor path, replacing layer.setColorScale,
        // layer.settings.set and layer.colorScale.setPalette. emit is null because the attached
        // ColorScale's own onChange emits 'restyle', and emitting here too would double-fire it.
        L._setColorScale?.(v); return { redraw: false, emit: null };
      case "noData":
        L.setNoData?.(v); return { redraw: true, emit: "recomputed" };
      case "opacity":
        L.setOpacity?.(v); return { redraw: false, emit: "restyle" };
      case "hover":
        return { redraw: false, emit: null };   // a tooltip reads settings.get('hover') itself
      default:
        return null;
    }
  }
}

/**
 * Vector knobs. `color` and `opacity` restyle the overlay: no provider implements setVectorStyle,
 * so VectorLayer.setStyle re-adds it with a merged neutral style. `hover` affects interaction only.
 */
export class VectorSettings extends LayerSettings {
  constructor(layer) {
    super(layer, {
      opacity: 1, hover: false, color: null, useFileColors: false,
      // Color by property, using the same ColorScale a raster uses but reading a feature property
      // rather than a pixel. Grading features needs both `colorBy` and a scale; with only one of
      // them set, `color` keeps applying flatly.
      colorScale: null, colorBy: null, missingColor: null,
    });
  }
  _apply(key, v) {
    const L = this._layer;
    switch (key) {
      case "color":
        L.setStyle?.({ fillColor: v, strokeColor: v }); return { redraw: false, emit: "restyle" };
      case "opacity":
        L.setStyle?.({ fillOpacity: v }); return { redraw: false, emit: "restyle" };
      case "useFileColors":
        return { redraw: false, emit: "restyle" };
      case "colorScale":
        // Validates before mutating, then re-adds the overlay using the new scale.
        L._setColorScale?.(v); L.setStyle?.({}); return { redraw: false, emit: "restyle" };
      case "colorBy":
        L.colorBy = v || null; L.setStyle?.({}); return { redraw: false, emit: "restyle" };
      // palette, continuous and missingColor go to the attached scale exactly as they do on a
      // raster, so one UI control writes the same knob on either kind of layer. missingColor paints
      // a feature whose `colorBy` value is unusable; leave it null to keep that feature's base style.
      case "palette":
      case "continuous":
      case "missingColor":
        if (!L.colorScale) return { redraw: false, emit: null };
        L.colorScale.set({ [key]: v }); return { redraw: false, emit: "restyle" };
      case "hover":
        return { redraw: false, emit: null };
      default:
        return null;
    }
  }
}
