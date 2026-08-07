# Headless UI module — usage reference

A **separate, opt-in** module the engine core never imports. Every piece touches the DOM only inside
functions (never at import time), and calls no `window.foo()` — the engine emits, these subscribe.
Mount whichever pieces you want; none of them are required for the engine to work.

Everything below imports from **`fimviz/ui`**, its only home — the engine barrel does not re-export
it. That entry carries just the small pure deps these need (~17 KB, no geotiff/Maps loader/GDAL), and
having exactly one entry means an app can never load two copies with two sets of state:

```js
import { createToast, connectToast, createToolsPanel } from 'fimviz/ui';
```

## Contents

[Toast](#toast) · [Tooltip (raster hover)](#tooltip-raster-hover) ·
[Info window (vector click)](#info-window-vector-click) · [Tools panel](#tools-panel) ·
[Legend/Stats renderers](#legendstats-renderers) · [Selection tools](#selection-tools-region-draw) ·
[Operations panel](#operations-panel) · [Layer panel](#layer-panel) ·
[Click-to-select](#click-to-select)

## Toast

```js
createToast(root?, { corner? })   // corner: 'br'|'bl'|'tr'|'tl', default 'br'
// → { show(msg, {level?, timeout?}), clear(), destroy(), el }
// level: 'info'|'success'|'warn'|'error' · timeout: ms, 0 = no auto-dismiss (default 4000)

connectToast(fim, toast?)   // wires the engine's 'notify' host event to a toast automatically
// → the toast (creates one via createToast() if not passed)
```

```js
const toast = createToast();
toast.show('Saved.', { level: 'success' });

connectToast(fim);   // now every fim.emit('notify', {message, level}) shows a toast automatically
```

## Tooltip (raster hover)

```js
createTooltip(fim?, { style? })
// → { show(evt, html), hide(), destroy(), el }

bindHoverValue(layer, { tooltip?, format? })
// layer: a RasterLayer · format: (v: number) => string, default v.toFixed(3)
// → { tooltip, off() }  — requires fim.enableMapEvents() to have been called
```

```js
fim.enableMapEvents();               // needed for hover dispatch at all
bindHoverValue(rasterLayer);          // shows the pixel value at the cursor, hides off-footprint
```

Reads `layer.settings.get('hover')` — set `layer.settings.set({hover: false})` to suppress without
unbinding.

## Info window (vector click)

```js
createInfoWindow(fim?, { style? })
// → { open(evt, html), close(), destroy(), el }

propsTable(props?)   // → an HTML <table> of a feature's properties (the default render)

bindFeatureInfo(layer, { infoWindow?, render? })
// layer: a VectorLayer · render: (feature) => string|Node, default propsTable(feature.properties)
// → { infoWindow, off() }  — requires fim.enableMapEvents()
```

```js
fim.enableMapEvents();
bindFeatureInfo(vectorLayer);   // opens on a feature click, closed on a miss
```

## Tools panel

A view over `layer.settings` — each control's change calls `layer.settings.set({[key]: value})`.

```js
rasterControls(layer)   // PURE, node-testable — the control spec for a RasterLayer:
                          // palette + continuous (only if layer.colorScale is attached), opacity, hover
vectorControls(layer)    // PURE — for a VectorLayer: opacity, plus EITHER a flat colour, OR (when the
                          // layer grades features via colorScale + colorBy) the same palette +
                          // continuous controls rasterControls emits — they write the same ColorScale

createToolsPanel(root, { layer, controls?, pretty? })
// controls: overrides the preset — an array, or (layer) => Control[]
// pretty: true injects a small scoped dark-theme stylesheet; false = bare unstyled structure
// → { el, update(), destroy() }
```

```js
createToolsPanel('#panel', { layer: rasterLayer, pretty: true });
// auto-picks rasterControls/vectorControls based on the layer shape (valueAt → raster, featureAt → vector)
```

`Control` shape: `{ type: 'select'|'checkbox'|'range'|'color'|'text', key, label?, value?, options?,
min?, max?, step? }` — `key` is the settings knob the control writes.

## Legend/Stats renderers

Thin wrappers over `Legend`/`Stats` (see [LEGEND.md](./LEGEND.md)) — data by default, HTML on
request:

```js
renderLegend(legend, { html? })   // html:false (default) → legend.toJSON(); html:true → legend.toHtml()
                                    // (or a built-in fallback swatch list if toHtml is absent)
renderStats(stats, { html? })      // html:false → stats.toJSON(); html:true → an HTML table of scalar fields
```

## Selection tools (region draw)

A **modal** interaction — while active, `fim.captureInteraction` routes ALL map events to the tool
(layer hover/click dispatch is suppressed).

Four modes, **one output**: rings of `{lat,lng}` wrapped in a `SpatialFilter`, which is exactly what
`dataset.mask()` and `layer.getStats({ filter })` already take. Nothing downstream branches on which
tool drew the shape.

```js
createRegionDraw(fim, {
  mode?,             // 'polygon' (default) | 'rectangle' | 'freehand' | 'brush'
  brushRadius?,      // brush: stamp radius in METRES (default 250)
  brushSides?,       // brush: vertices per stamp (default 16)
  minSampleMetres?,  // freehand/brush: drop samples closer than this (default 0 = keep all)
  keys?, keyTarget?, // Esc cancel · Enter finish · Backspace undo (default on, on `document`)
  freezeCamera?,     // drag modes suppress map panning while tracing (default true)
  onPoint?, onPreview?, onComplete?, onCancel?,
})
// onPoint(points, evt)        — per vertex / stroke sample added
// onPreview(rings)            — the live shape, incl. the rectangle rubber band on hover
// onComplete(filter, points, rings) — filter is a SpatialFilter or null if the shape has no area
// onCancel()
// → { start(), finish(), cancel(), undo(), setMode(m), mode, points, rings, active }
```

| Mode | Gesture | Ring(s) |
|---|---|---|
| `polygon` | one click per vertex, then Finish / <kbd>Enter</kbd> | one, from the vertices |
| `rectangle` | two clicks on opposite corners — **the second finishes it** | one, axis-aligned and corner-normalized |
| `freehand` | press · drag · release | one, from the traced samples |
| `brush` | press · drag · release | **many** — a circular stamp per sample, unioned |

`REGION_MODES` is exported as the list, in toolbar order.

```js
const draw = createRegionDraw(fim, {
  onComplete: (filter) => { if (filter) layer.getStats({ filter }).then(console.log); },
});
draw.setMode('brush');
draw.start();    // map events now go to the tool instead of hitting layers
```

Three things a host has to know:

- **Enable the events the drag modes need.** `fim.enableMapEvents(['click','hover','mousedown','mouseup'])`.
  Without `mousedown`/`mouseup`, freehand and brush fall back to click-to-start / click-to-stop rather
  than silently doing nothing — which is also how they behave on touch.
- **Wait for the camera.** `layer.fit(); await fim.whenIdle(); draw.start();` — a click resolved
  mid-animation is projected against the pre-animation view.
- **The drawn geometry is data.** This module names no map SDK, so rendering the in-progress shape is
  yours to do, via `onPreview`.

Drag modes take pan-by-drag away for the length of the stroke (`fim.setMapDraggable`), because tracing
and panning are the same gesture; it is restored on finish *and* on cancel. Polygon does not — moving
the map between vertices is legitimate. A press-drag-release also emits a trailing `click`, which the
tool eats so the end of a stroke does not also select whatever is under the cursor.

`setMode()` mid-draw discards the current shape and does **not** fire `onCancel` — the host asked for
the switch, and reporting it as a cancellation makes toolbars un-toggle themselves.

## Operations panel

Turns `Dataset` ops into a form that `deriveSources` onto a live layer (memoized ancestors are
reused — cheap).

```js
createOperationsPanel(root, { layer, region?, layers?, fim?, open?, pretty?, onApply?, onResult? })
// layer   : the layer the ops apply to
// region  : () => SpatialFilter|Array|null — feeds Mask and Zonal stats
// layers  : () => Layer[] — the operand pool for Combine and Group by (this layer is excluded)
// fim     : needed only by Rasterize, which adds a NEW layer rather than replacing this one
// open    : which groups start expanded (default ['Extent','Values'])
// onApply (layer, err?)  — after each attempt, err set on failure
// onResult(id, data)     — a TERMINAL's table (zonal stats, group by); these return data, not a layer
// → { el, ops, destroy() }   // `ops` = the op ids actually offered for this layer's kind
```

| Group | Ops |
|---|---|
| Extent | **Clip** (bbox, prefilled from the layer's footprint) · **Mask** (the drawn region, `invert`) |
| Values | **Reclassify** (`min`/`max`/`→ value`, `others: nodata|keep`) |
| Terrain | **Slope** (unit, z) · **Aspect** · **Hillshade** (azimuth, altitude, z) |
| Grid | **Resample** (w×h, method) · **Reproject** (CRS — GDAL, at render) |
| Multi-layer | **Combine** (another raster layer × difference/ratio/sum/mean/min/max) |
| Axis | **Reduce** (mean/sum/min/max over a selection axis) |
| Vector | **Rasterize** (w×h, field, burn value) |
| Analysis | **Zonal stats** (the region) · **Group by** (another layer's values, optional bins) |

Plus a **Reset** that points the layer back at the sources it was built from.

Three things worth knowing:

- **Ops are filtered by kind.** A vector layer is offered `rasterize` and nothing else — the raster
  ops would only ever throw on it. Read `ops` to see what a given layer actually got.
- **An op whose requirement is missing is disabled and says why**, rather than failing when pressed:
  no `region` wired up, no second raster layer, no selection axis on the dataset, no `fim`.
- **Reclassify covers both threshold and remap.** Leaving `→ value` blank is the engine's documented
  "keep the matched pixel's value" band, so a range with no value is exactly a threshold.

`rasterize` is the one op that does not derive in place: it changes the Dataset's *kind*, and a
`VectorLayer` cannot draw a raster (`Layer.rasterize()` throws saying so). With `fim` it adds the
result as its own layer; without it, it is disabled.

```js
const draw = createRegionDraw(fim, { onComplete: (f) => { lastRegion = f; } });
createOperationsPanel('#ops', {
  layer: rasterLayer, fim, pretty: true,
  region: () => lastRegion,
  layers: () => fim.layers,
  onResult: (id, rows) => console.table(rows),
});
```

## Layer panel

```js
createLayerPanel(root, { fim, pretty, selected, onSelect, onRemove })
// → { el, update(), select(layer), selected, destroy() }
```

A view of `fim.layers`, with per-row **show/hide**, **bring forward / send backward**, **fit** and
**remove**, and click-the-name to select.

Two things worth knowing:

- **Rows are top-first — the reverse of `fim.layers`, which is bottom-up.** That matches every layer
  list a user has met, but it means "up" in the panel is *toward the end* of the array.
- **Hidden layers stay listed**, struck through and dimmed. A layer you cannot see is exactly the one
  you need a list to find, so filtering them out would defeat the purpose.

Reordering moves the array *and* calls `fim.applyLayerOrder()`. Both halves matter: the array is what
`dispatchMapEventToLayers` walks for hit-testing, and `applyLayerOrder` is what makes the map draw in
the same order. Before that method existed the two could disagree — the layer receiving a click was
not necessarily the one on top.

The panel redraws itself on the map's `layers:changed` event (emitted on add and remove), and
`destroy()` unsubscribes.

```js
const panel = createLayerPanel('#layers', { fim, pretty: true, onSelect: (l) => showSettingsFor(l) });
```

`layerLabel(layer)` is exported separately for a host building its own list: filename → dataset name
→ type → id.

## Click-to-select

```js
createLayerSelect(fim, { fit, onSelect, onEmpty })
// → { off(), selected, stack, select(layer) }
```

Resolves a map click to the stack of visible layers under the pointer (topmost first, via each
layer's `hitTest`). **Clicking the same spot again advances through the stack**, which is the only way
to reach a layer buried under another. `fit` (default `true`) also fits the map to each as you cycle.

Coordinates are compared to 4 decimal places, so ordinary hand-jitter between clicks still counts as
"the same spot" — without that, cycling would reset on every click.

This rides the ordinary `map:click` bus rather than `fim.captureInteraction`, deliberately: capture is
**modal** and would suppress hover, tooltips and feature clicks for as long as selection was enabled.
Selection is passive, so everything else keeps working. It does require
`fim.enableMapEvents(['click'])`.

```js
const panel = createLayerPanel('#layers', { fim, pretty: true, onSelect: select });
createLayerSelect(fim, { fit: false, onSelect: (l) => panel.select(l) });
```
