// ui/regionOverlay.js — draw a selection tool's in-progress shape on the map.
//
// `createRegionDraw` is headless on purpose: it produces `{lat,lng}` and names no map SDK, which is
// what lets it work on Google, Leaflet and a test's fake map alike. The cost is that nothing was
// drawing the result, so a user clicking three points saw an empty map and reasonably concluded the
// tool was broken. This is the other half: feed it `onPreview`, it renders.
//
// It draws through `fim.addScratchVector`, so the shape is NOT a Layer — it is never hit-tested,
// reordered, listed in the layer panel, or saved. Scaffolding you are looking at, not data you
// loaded.

// The default look, in the engine's NEUTRAL style vocabulary (strokeColor/strokeWidth/fillColor/…),
// which both providers translate — not Leaflet's own key names. `dashArray` has no neutral spelling,
// so it rides the provider-native passthrough: Leaflet dashes, Google ignores it.
const RING_STYLE = { strokeColor: "#58a6ff", strokeWidth: 2, fillColor: "#58a6ff", fillOpacity: 0.15, dashArray: "5,4" };
const EDGE_STYLE = { strokeColor: "#58a6ff", strokeWidth: 2, fillOpacity: 0, dashArray: "5,4" };
const VERTEX_STYLE = { strokeColor: "#ffffff", strokeWidth: 2, fillColor: "#58a6ff", fillOpacity: 1, pointRadius: 4 };

const ll = (p) => [p.lng, p.lat];      // GeoJSON is x,y — the one place lat/lng order flips

/**
 * Build the FeatureCollection for a shape in progress.
 *
 * Three feature kinds, because a selection is visible long before it is a polygon: closed rings once
 * there are three points, an open line while there are only two, and a vertex marker from the very
 * first click. `role` is on every feature so a caller's own style function can tell them apart.
 * @param {Array<Array<{lat: number, lng: number}>>} rings
 * @param {Array<{lat: number, lng: number}>} points
 * @returns {{type: 'FeatureCollection', features: Array<Object>}}
 */
export function regionGeoJSON(rings = [], points = [], { vertices = true } = {}) {
  const features = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    features.push({
      type: "Feature", properties: { role: "ring" },
      geometry: { type: "Polygon", coordinates: [[...ring.map(ll), ll(ring[0])]] },
    });
  }
  // Only when there is no ring yet: once the polygon closes, its own outline is the edge.
  if (!features.length && points.length >= 2) {
    features.push({
      type: "Feature", properties: { role: "edge" },
      geometry: { type: "LineString", coordinates: points.map(ll) },
    });
  }
  if (vertices) {
    for (let i = 0; i < points.length; i++) {
      features.push({
        type: "Feature", properties: { role: "vertex", index: i },
        geometry: { type: "Point", coordinates: ll(points[i]) },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

/**
 * Render a selection tool's live geometry onto `fim`'s map.
 *
 * ```js
 * const overlay = createRegionOverlay(fim);
 * const draw = createRegionDraw(fim, {
 *   onPreview: (rings, points) => overlay.show(rings, points),
 *   onComplete: (filter, points, rings) => overlay.show(rings, points),
 *   onCancel: () => overlay.clear(),
 * });
 * ```
 *
 * Redraws are coalesced to one per animation frame. A freehand stroke fires `onPreview` on every
 * mousemove, and rebuilding a GeoJSON overlay per event makes the drag stutter — this way a fast
 * drag costs one rebuild per frame regardless of how many samples arrived in it.
 *
 * @param {import('../package/fimMap.js').FimMap} fim
 * @param {{ style?: Object|Function, vertices?: boolean }} [opts] - `style` overrides the whole
 *   look: the neutral style object `VectorLayer` takes, or a `({ feature, index }) => style` function
 *   (each feature carries `properties.role` — `'ring'`, `'edge'` or `'vertex'`).
 * @returns {{ show: (rings: Array, points?: Array) => void, clear: () => void,
 *             geojson: Object|null, destroy: () => void }}
 */
export function createRegionOverlay(fim, { style, vertices = true } = {}) {
  let handle = null;
  let current = null;
  let frame = null;
  let dead = false;

  // A per-feature callback, because ring / edge / vertex want three different looks and only the
  // callback form sees which one it is. Its argument shape is the engine's: `({ feature, index })`.
  const styleFor = style ?? (({ feature }) => {
    const role = feature?.properties?.role;
    return role === "vertex" ? VERTEX_STYLE : role === "edge" ? EDGE_STYLE : RING_STYLE;
  });

  function paint() {
    frame = null;
    if (dead) return;
    // Remove-then-add, not mutate: neither provider exposes an in-place geometry swap for a vector
    // overlay, and at one rebuild per frame the churn is not what costs anything here.
    if (handle) { fim.removeScratchVector?.(handle); handle = null; }
    if (!current?.features.length) return;
    handle = fim.addScratchVector?.(current, { style: styleFor }) ?? null;
  }

  function schedule() {
    if (frame != null || dead) return;
    frame = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(paint)
      : setTimeout(paint, 16);
  }

  return {
    /** @param {Array} rings @param {Array} [points] */
    show(rings = [], points = []) {
      current = regionGeoJSON(rings, points, { vertices });
      schedule();
    },
    clear() { current = null; schedule(); },
    /** The FeatureCollection last handed in — what a host would export or inspect. */
    get geojson() { return current; },
    destroy() {
      dead = true;
      if (frame != null) {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame); else clearTimeout(frame);
        frame = null;
      }
      if (handle) { fim.removeScratchVector?.(handle); handle = null; }
      current = null;
    },
  };
}
