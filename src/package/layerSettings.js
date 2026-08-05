// layerSettings.js — the Layer change-model (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 "Settings vs. Operations").
//
// A SETTING is a declarative parameter applied while rendering the CURRENT source (palette, opacity,
// noData, hover). It is NOT an OPERATION (swap/reproject/select/reload — those replace the data and
// are Layer/Dataset methods, not knobs). Mutating a setting classifies its EFFECT and emits the
// matching event on the layer; both settings AND operations feed ONE effect-event stream so any UI
// reacts uniformly:
//   'restyle'    — recolor the memoized grid (palette/opacity/label). No data re-force.
//   'recomputed' — the derived grid changed (noData). Re-colorize + hover meta changes.
//
// LayerSettings holds NO duplicate state: RasterSettings routes STYLE knobs to the layer's existing
// ColorScale (whose onChange already emits 'restyle' and repaints — see RasterLayer._setColorScale),
// so the ColorScale stays the single source of truth for colour. The bag stores only the opacity/hover/noData
// mirrors a UI reads back.

/**
 * The declarative knob bag for a Layer. Subclasses implement `_apply(key, value)`.
 */
export class LayerSettings {
  /**
   * @param {import('./layer.js').Layer} layer
   * @param {Object} [defaults] - initial knob values (also the reset() target unless overridden)
   */
  constructor(layer, defaults = {}) {
    this._layer = layer;
    this._state = { opacity: 1, hover: false, ...defaults };
    this._defaults = { opacity: 1, hover: false };
  }

  /** Read one knob, or the whole state object (a copy) when called with no key. */
  get(key) { return key == null ? { ...this._state } : this._state[key]; }

  /**
   * Batch write. Applies each known knob, re-renders if any change needs a redraw, then emits the
   * distinct effect events (restyle/recomputed) once each plus a 'settings' summary.
   *
   * SYNC AND CHAINABLE — returns the Layer, not a Promise.
   *
   * Of every knob across Raster and Vector settings, exactly ONE (`noData`) triggers a redraw. When
   * it does, the render runs and the effect events fire AFTER it, so a subscriber never reads a
   * half-updated grid. To await that, use `await layer.settled()`, or subscribe to the
   * 'recomputed'/'rendered' event. A render failure is reported via the layer's 'error' event.
   *
   * PARTIAL, BEST-EFFORT: one key throwing (e.g. an invalid palette name failing `ColorScale`'s
   * validation) does not abort the rest of the batch — every OTHER key still
   * gets applied, committed to `_state`, and its effect event still fires. Failures are collected and,
   * if any occurred, thrown together as ONE aggregate error at the end — after the successful keys
   * have already taken effect — naming every failed key with its own message, plus which keys DID
   * succeed. This is deliberate: a caller sees exactly what went wrong and what didn't, rather than
   * either silently swallowing errors or having one bad key block unrelated ones in the same call.
   * @param {Object} partial
   * @returns {import('./layer.js').Layer} the layer, for chaining
   */
  set(partial = {}) {
    const changed = {};
    const failed = {};
    let redraw = false;
    const emits = new Set();

    // GROUP PASS. A subclass may coalesce a set of related knobs into ONE underlying call —
    // RasterSettings routes every ColorScale-bound knob (palette/continuous/min/max/unit/…) through a
    // single `colorScale.set(patch)`, so one `layer.set({palette, continuous})` produces ONE onChange
    // and ONE 'restyle', matching what `colorScale.set({palette, continuous})` already did. Applying
    // them key-by-key fired one restyle PER key, so the same patch behaved differently depending on
    // which object you handed it to — exactly the inconsistency this model exists to remove.
    //
    // If the grouped call throws (e.g. one invalid palette name), fall back to per-key application so
    // the PARTIAL, BEST-EFFORT contract below still holds: only the genuinely bad key fails.
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
        continue;   // one bad knob doesn't block the rest of the batch
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
        // Redraw first, THEN emit — a 'recomputed' subscriber must not read a half-updated grid.
        // Tracked on _pending so layer.settled() can await it; errors go to the layer's event bus
        // rather than surfacing as an unhandled rejection on a now-synchronous call.
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
   * Resolves once any redraw a `set()` kicked off has finished (and its effect events have fired).
   * Resolves immediately when nothing is pending — so `await layer.settled()` is always safe.
   * @returns {Promise<import('./layer.js').Layer>}
   */
  async settled() { await this._pending; return this._layer; }

  /** Restore the reset defaults. @returns {import('./layer.js').Layer} */
  reset() { return this.set(this._defaults); }

  /**
   * Apply one knob and report its effect. Return `null` for an unknown knob (ignored), else
   * `{ redraw, emit }` — `redraw:true` to re-render in place, `emit` the effect event name (or null
   * when another mechanism already emits it, e.g. ColorScale.onChange for palette).
   * @param {string} key @param {*} value @returns {{redraw: boolean, emit: string|null}|null}
   */
  _apply(key, value) { return null; }   // eslint-disable-line no-unused-vars
}

/**
 * Raster knobs: palette/continuous route to the layer's ColorScale (style axis → 'restyle', which the
 * ColorScale's own onChange emits + repaints); noData is the data axis (→ 'recomputed' + a redraw);
 * opacity is placement (provider opacity, no redraw); hover is interaction-only (no map change).
 */
export class RasterSettings extends LayerSettings {
  constructor(layer) {
    super(layer, { opacity: layer.opacity ?? 1, hover: true, noData: layer.noData ?? null });
    this._defaults = { opacity: 1, hover: true };   // a raster shows hover values by default
  }
  /**
   * Every knob that belongs to the attached ColorScale. Kept in one place so the group pass and the
   * per-key fallback below can't drift apart.
   */
  static SCALE_KEYS = ["palette", "continuous", "min", "max", "unit", "stops", "colorStops"];

  /**
   * Coalesce all ColorScale-bound knobs into ONE `colorScale.set(patch)` — one onChange, one
   * 'restyle', one repaint, no matter how many of them are in the patch.
   * @param {Object} partial @returns {{keys: Set<string>, redraw: boolean, emit: string|null}|null}
   */
  _applyGroup(partial) {
    const present = RasterSettings.SCALE_KEYS.filter((k) => k in partial);
    if (!present.length) return null;
    const keys = new Set(present);
    const cs = this._layer.colorScale;
    // No scale attached yet → the knobs are inert, but still recorded in _state so a later attach or
    // a UI reading settings.get() sees what the caller asked for.
    if (!cs) return { keys, redraw: false, emit: null };
    const patch = {};
    for (const k of present) patch[k] = k === "continuous" ? !!partial[k] : partial[k];
    cs.set(patch);   // throws on a bad value → set() falls back to the per-key loop below
    return { keys, redraw: false, emit: null };
  }

  _apply(key, v) {
    const L = this._layer;
    switch (key) {
      // The ColorScale-bound knobs. Normally handled as a GROUP by _applyGroup above; these
      // per-key cases are the isolate-the-bad-key fallback when the grouped call throws.
      case "palette":
      case "continuous":
      case "min":
      case "max":
      case "unit":
      case "stops":
      case "colorStops":
        if (L.colorScale) L.colorScale.set({ [key]: key === "continuous" ? !!v : v });
        return { redraw: false, emit: null };   // no scale attached → nothing to repaint
      case "colorScale":
        // Swapping the whole scale, vs. `palette`/`continuous` which edit the attached one. Folding
        // it in here is what makes layer.set() the SINGLE recolour path: the three that existed
        // (layer.setColorScale / layer.settings.set / layer.colorScale.setPalette) are now one.
        // emit:null for the same reason as palette/continuous above — the attached ColorScale's own
        // onChange owns the 'restyle' emit, so emitting here too would double-fire it.
        L._setColorScale?.(v); return { redraw: false, emit: null };
      case "noData":
        L.setNoData?.(v); return { redraw: true, emit: "recomputed" };
      case "opacity":
        L.setOpacity?.(v); return { redraw: false, emit: "restyle" };
      case "hover":
        return { redraw: false, emit: null };   // a tooltip reads settings.get('hover')
      default:
        return null;
    }
  }
}

/**
 * Vector knobs: colour/opacity re-style the overlay (VectorLayer.setStyle re-adds with a merged
 * neutral style — no provider setVectorStyle in the contract); hover is interaction-only.
 */
export class VectorSettings extends LayerSettings {
  constructor(layer) {
    super(layer, {
      opacity: 1, hover: false, color: null, useFileColors: false,
      // Colour-by-property: the same ColorScale a raster uses, reading a feature property instead of
      // a pixel. `colorBy` alone (or a scale alone) does nothing — both are needed to grade features,
      // and until then `color` keeps applying flatly.
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
        // Validates before mutating, then re-adds the overlay through the new resolution.
        L._setColorScale?.(v); L.setStyle?.({}); return { redraw: false, emit: "restyle" };
      case "colorBy":
        L.colorBy = v || null; L.setStyle?.({}); return { redraw: false, emit: "restyle" };
      // palette/continuous/missingColor route to the attached scale, exactly as they do on a raster
      // — so one UI control writes the same knob whichever kind of layer it is bound to.
      // missingColor is what a feature with no usable `colorBy` value is painted; leave it null to
      // keep such features at their base style instead.
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
