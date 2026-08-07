// ui/regionDraw.js — a modal region-draw tool → a SpatialFilter (PACKAGE_ROADMAP.md §1/§5).
//
// A MODAL interaction: start() calls fim.captureInteraction, so while drawing, ALL map events go to
// the tool (layer hover/click dispatch is suppressed). Each click adds a polygon vertex; finish()
// builds a `SpatialFilter` from the vertices and releases the capture. The drawn geometry is DATA
// (lat/lng points) — the host renders it (the engine names no map SDK here). Scope a layer's stats
// to the region with `layer.getStats({ filter })`. Headless: no DOM.

import { SpatialFilter } from "../package/filter.js";

/**
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
 * This module cannot enforce that itself: it is headless by design (it knows only
 * `fim.captureInteraction`, never a map SDK), so the wait belongs to the caller that moved the camera.
 *
 * @param {import('../package/fimMap.js').FimMap} fim
 * @param {{ onPoint?: (points: Array<{lat,lng}>, evt: any) => void,
 *           onComplete?: (filter: SpatialFilter|null, points: Array<{lat,lng}>) => void,
 *           onCancel?: () => void }} [opts]
 * @returns {{ start: () => void, finish: () => (SpatialFilter|null), cancel: () => void,
 *             points: Array<{lat,lng}>, active: boolean }}
 */
export function createRegionDraw(fim, { onPoint, onComplete, onCancel } = {}) {
  let points = [];
  let release = null;
  let active = false;

  function start() {
    if (active) return;
    active = true; points = [];
    release = fim.captureInteraction((e) => {
      if (e.type !== "click") return;               // clicks add vertices; hover is ignored (no rubber-band here)
      points.push({ lat: e.lat, lng: e.lng });
      onPoint?.(points.slice(), e);
    });
  }

  function stop() { active = false; release?.(); release = null; }

  function finish() {
    if (!active) return null;
    stop();
    const filter = points.length >= 3 ? new SpatialFilter(points.slice()) : null;
    onComplete?.(filter, points.slice());
    return filter;
  }

  function cancel() {
    if (!active) return;
    stop(); points = [];
    onCancel?.();
  }

  return {
    start, finish, cancel,
    get points() { return points.slice(); },
    get active() { return active; },
  };
}
