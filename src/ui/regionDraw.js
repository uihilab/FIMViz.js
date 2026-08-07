// ui/regionDraw.js — modal selection tools → a SpatialFilter (PACKAGE_ROADMAP.md §1/§5).
//
// A MODAL interaction: start() calls fim.captureInteraction, so while drawing, ALL map events go to
// the tool (layer hover/click dispatch is suppressed). Four modes — polygon, rectangle, freehand,
// brush — all produce the SAME thing: an array of rings of {lat,lng}, which is exactly what
// `SpatialFilter`, `dataset.mask()` and `layer.getStats({ filter })` already take. Nothing
// downstream has to know which tool drew the shape.
//
// The drawn geometry is DATA — the host renders it (the engine names no map SDK here).

import { SpatialFilter } from "../package/filter.js";

/** The selection tools, in the order a toolbar would show them. */
export const REGION_MODES = /** @type {const} */ (["polygon", "rectangle", "freehand", "brush"]);

/** Modes driven by press-drag-release rather than discrete clicks. */
const DRAG_MODES = new Set(["freehand", "brush"]);

const EARTH_R = 6378137;            // metres, WGS84 semi-major — the same constant geo/mercator.js uses
const DEG = Math.PI / 180;

/** Rough metres between two lat/lng, equirectangular. Good enough for a stroke-sampling threshold. */
function metresBetween(a, b) {
  const mLat = (b.lat - a.lat) * DEG * EARTH_R;
  const mLng = (b.lng - a.lng) * DEG * EARTH_R * Math.cos(((a.lat + b.lat) / 2) * DEG);
  return Math.hypot(mLat, mLng);
}

/**
 * A closed ring approximating a circle of `radius` metres around a point.
 *
 * Longitude degrees shrink with latitude, so the lng step is divided by cos(lat) — without that the
 * "circle" is an ellipse everywhere except the equator. The cosine is floored so a brush stamped
 * near a pole widens instead of dividing by ~0.
 */
function circleRing(lat, lng, radius, sides = 16) {
  const dLat = (radius / EARTH_R) / DEG;
  const dLng = dLat / Math.max(Math.cos(lat * DEG), 1e-6);
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const t = (i / sides) * 2 * Math.PI;
    ring.push({ lat: lat + dLat * Math.sin(t), lng: lng + dLng * Math.cos(t) });
  }
  return ring;
}

/** The axis-aligned box through two opposite corners, as a closed-by-convention 4-point ring. */
function boxRing(a, b) {
  const [s, n] = a.lat <= b.lat ? [a.lat, b.lat] : [b.lat, a.lat];
  const [w, e] = a.lng <= b.lng ? [a.lng, b.lng] : [b.lng, a.lng];
  return [{ lat: s, lng: w }, { lat: s, lng: e }, { lat: n, lng: e }, { lat: n, lng: w }];
}

/**
 * Mount a modal selection tool over `fim`.
 *
 * **Do not `start()` while the camera is moving.** `fit()`/`fitBounds` are animated on both
 * providers, and a click resolved mid-animation lands at the pre-animation projection — off by
 * exactly 2× when the fit changed zoom by one level. Await the map first:
 *
 * ```js
 * layer.fit();
 * await fim.whenIdle();     // resolves immediately-ish when the map is already still
 * regionDraw.start();
 * ```
 *
 * This module cannot enforce that itself: it is headless by design (it knows only `fim`'s own
 * methods, never a map SDK), so the wait belongs to the caller that moved the camera.
 *
 * **Event types the host must enable.** `polygon` and `rectangle` need only `click`; `rectangle`
 * additionally uses `hover` for its rubber band. `freehand` and `brush` prefer
 * `mousedown`/`mouseup`, so enable them:
 *
 * ```js
 * fim.enableMapEvents(["click", "hover", "mousedown", "mouseup"]);
 * ```
 *
 * Without those two, the drag modes fall back to click-to-start / click-to-stop rather than
 * silently doing nothing — which is also how they behave on a touch device that never reports a
 * button press.
 *
 * @param {import('../package/fimMap.js').FimMap} fim
 * @param {{ mode?: 'polygon'|'rectangle'|'freehand'|'brush',
 *           brushRadius?: number,
 *           brushSides?: number,
 *           minSampleMetres?: number,
 *           keys?: boolean,
 *           keyTarget?: any,
 *           freezeCamera?: boolean,
 *           onPoint?: (points: Array<{lat: number, lng: number}>, evt: any) => void,
 *           onPreview?: (rings: Array<Array<{lat: number, lng: number}>>) => void,
 *           onComplete?: (filter: SpatialFilter|null, points: Array<{lat: number, lng: number}>,
 *                         rings: Array<Array<{lat: number, lng: number}>>) => void,
 *           onCancel?: () => void }} [opts]
 * @returns {{ start: () => void, finish: () => (SpatialFilter|null), cancel: () => void,
 *             undo: () => void, setMode: (m: string) => void,
 *             mode: string, points: Array<{lat: number, lng: number}>,
 *             rings: Array<Array<{lat: number, lng: number}>>, active: boolean }}
 */
export function createRegionDraw(fim, {
  mode = "polygon",
  brushRadius = 250,
  brushSides = 16,
  minSampleMetres = 0,
  keys = true,
  keyTarget,
  freezeCamera = true,
  onPoint, onPreview, onComplete, onCancel,
} = {}) {
  if (!REGION_MODES.includes(mode)) {
    throw new Error(`createRegionDraw: unknown mode '${mode}' — expected one of ${REGION_MODES.join(", ")}`);
  }

  let points = [];          // the vertices the USER placed: polygon corners, rect corners, stroke samples
  let stamps = [];          // brush only: one ring per sample
  let release = null;
  let active = false;
  let tracing = false;      // drag modes: a stroke is in progress
  let tracedByPress = false;// …and it began with a real mousedown, so a mouseup ends it
  let swallowClick = false; // a press-drag-release also emits a trailing click; it must not restart
  let detachKeys = null;

  const target = () => keyTarget ?? (typeof document === "undefined" ? null : document);

  // ── geometry ──────────────────────────────────────────────────────────────────────────
  // One function every mode funnels through, so "what shape did I draw" has exactly one answer.
  function ringsOf() {
    if (mode === "brush") return stamps.filter((r) => r.length >= 3);
    if (mode === "rectangle") return points.length >= 2 ? [boxRing(points[0], points[points.length - 1])] : [];
    return points.length >= 3 ? [points.slice()] : [];
  }

  function preview(cursor) {
    if (!onPreview) return;
    if (mode === "rectangle" && points.length === 1 && cursor) onPreview([boxRing(points[0], cursor)]);
    else onPreview(ringsOf());
  }

  // ── event handling ────────────────────────────────────────────────────────────────────
  function addVertex(pt, e) {
    points.push(pt);
    onPoint?.(points.slice(), e);
  }

  /** Append a stroke sample, honouring `minSampleMetres` so a slow drag is not 4000 near-identical points. */
  function sample(pt, e) {
    const last = points[points.length - 1];
    if (last && minSampleMetres > 0 && metresBetween(last, pt) < minSampleMetres) return;
    if (mode === "brush") stamps.push(circleRing(pt.lat, pt.lng, brushRadius, brushSides));
    addVertex(pt, e);
  }

  function beginStroke(pt, e, byPress) {
    tracing = true; tracedByPress = byPress;
    points = []; stamps = [];
    sample(pt, e);
  }

  function endStroke() {
    tracing = false;
    swallowClick = tracedByPress;    // the click that follows mouseup is the same gesture, not a new one
    finish();
    swallowClick = false;
  }

  function onMapEvent(e) {
    const pt = { lat: e.lat, lng: e.lng };

    if (DRAG_MODES.has(mode)) {
      if (e.type === "mousedown") return beginStroke(pt, e, true);
      if (e.type === "mouseup") return tracing && tracedByPress ? endStroke() : undefined;
      if (e.type === "hover") { if (tracing) { sample(pt, e); preview(pt); } return; }
      if (e.type !== "click") return;
      // Click fallback, for a host that never enabled mousedown/mouseup (or a touch device).
      if (swallowClick) { swallowClick = false; return; }
      if (!tracing) return beginStroke(pt, e, false);
      // The terminating click is a place the user chose, so it counts — unlike a mouseup, which just
      // lands wherever the continuously-sampled path already was.
      if (!tracedByPress) { sample(pt, e); return endStroke(); }
      return;
    }

    if (e.type === "hover") return preview(pt);
    if (e.type !== "click") return;
    addVertex(pt, e);
    preview(pt);
    // Two clicks fully determine a rectangle, so making the user press Finish as well would be
    // a step that carries no information.
    if (mode === "rectangle" && points.length >= 2) finish();
  }

  function onKeyDown(e) {
    if (!active) return;
    if (e.key === "Escape") { e.preventDefault?.(); cancel(); }
    else if (e.key === "Enter") { e.preventDefault?.(); finish(); }
    else if (e.key === "Backspace") { e.preventDefault?.(); undo(); }
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────────────────
  function start() {
    if (active) return;
    active = true; points = []; stamps = [];
    tracing = false; tracedByPress = false; swallowClick = false;
    release = fim.captureInteraction(onMapEvent);

    if (keys) {
      const t = target();
      if (t?.addEventListener) {
        t.addEventListener("keydown", onKeyDown);
        detachKeys = () => t.removeEventListener("keydown", onKeyDown);
      }
    }
    // Only the drag modes conflict with panning; taking the map's pan away during a polygon draw
    // would stop the user repositioning between vertices, which is a legitimate thing to do.
    if (freezeCamera && DRAG_MODES.has(mode)) fim.setMapDraggable?.(false);
  }

  function stop() {
    active = false; tracing = false;
    try { release?.(); } finally { release = null; }
    try { detachKeys?.(); } finally { detachKeys = null; }
    if (freezeCamera && DRAG_MODES.has(mode)) fim.setMapDraggable?.(true);
    // A press-drag-release ends with mouseup AND a click, in that order. The capture is already gone
    // by now, so that trailing click would fall through to ordinary layer dispatch and select
    // whatever is under the cursor — the stroke would "click" its own end point. Hold a throwaway
    // capture just long enough to eat it. Installed BEFORE onComplete runs, so a host that starts
    // another tool from its callback replaces this one and still wins.
    if (swallowClick) swallowNextClick();
  }

  function swallowNextClick() {
    if (typeof fim.captureInteraction !== "function") return;
    let rel = null;
    const done = () => { const r = rel; rel = null; r?.(); };
    rel = fim.captureInteraction((e) => { if (e.type === "click") done(); });
    // No click ever arrives on touch, so this is what stops the map being stranded in capture.
    // `unref` where it exists (Node) so a pending timer cannot hold a test process open.
    setTimeout(done, 400)?.unref?.();
  }

  function finish() {
    if (!active) return null;
    stop();
    const rings = ringsOf();
    const filter = rings.length ? new SpatialFilter(rings) : null;
    onComplete?.(filter, points.slice(), rings);
    return filter;
  }

  function cancel() {
    if (!active) return;
    stop(); points = []; stamps = [];
    onPreview?.([]);
    onCancel?.();
  }

  /** Drop the last thing placed: a vertex, or a brush stamp with the sample that made it. */
  function undo() {
    if (!points.length) return;
    points.pop();
    if (mode === "brush") stamps.pop();
    onPoint?.(points.slice(), null);
    preview(null);
  }

  /**
   * Switch tools. Mid-draw this discards the current shape — a half-drawn polygon and a half-drawn
   * rectangle cannot be merged into one. It does NOT fire `onCancel`: the host is the one that asked
   * for the switch, and reporting it as a cancellation makes toolbars un-toggle themselves.
   */
  function setMode(next) {
    if (!REGION_MODES.includes(next)) {
      throw new Error(`setMode: unknown mode '${next}' — expected one of ${REGION_MODES.join(", ")}`);
    }
    if (next === mode) return;
    const wasActive = active;
    if (active) stop();
    points = []; stamps = [];
    mode = next;
    onPreview?.([]);
    if (wasActive) start();
  }

  return {
    start, finish, cancel, undo, setMode,
    get mode() { return mode; },
    get points() { return points.slice(); },
    get rings() { return ringsOf().map((r) => r.slice()); },
    get active() { return active; },
  };
}
