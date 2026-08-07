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
[Legend/Stats renderers](#legendstats-renderers) · [Region draw](#region-draw) ·
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

## Region draw

A **modal** interaction — while active, `fim.captureInteraction` routes ALL map events to the tool
(layer hover/click dispatch is suppressed).

```js
createRegionDraw(fim, { onPoint?, onComplete?, onCancel? })
// onPoint(points, evt) — called per vertex added (a click)
// onComplete(filter, points) — called by finish(); filter is a SpatialFilter (>=3 points) or null
// onCancel() — called by cancel()
// → { start(), finish(), cancel(), points (getter), active (getter) }
```

```js
const draw = createRegionDraw(fim, {
  onComplete: (filter) => { if (filter) layer.getStats({ filter }).then(console.log); },
});
draw.start();    // clicks now add vertices instead of hitting layers
// ... user clicks a few points ...
draw.finish();   // builds the SpatialFilter, releases the modal capture, fires onComplete
```

The drawn geometry is **data** (`{lat,lng}` points) — this module names no map SDK; you render the
in-progress polygon yourself if you want a visual (e.g. via `onPoint`).

## Operations panel

Turns `Dataset` ops into buttons that `deriveSources` onto a live layer (memoized ancestors are
reused — cheap).

```js
createOperationsPanel(root, { layer, region?, pretty?, onApply? })
// layer: a RasterLayer · region: () => SpatialFilter|Array|null (feeds "Mask to region")
// onApply(layer, err?) — called after each op attempt, err set on failure
// → { el, destroy() }
```

Ships two ops out of the box — **Threshold** (`ds.reclassify([{min,max}], {unmatched:'nodata'})`,
keeps values in `[min,max)`) and **Mask to region** (`ds.mask(region())`) — plus a **Reset** button
that calls `layer.setSources([layer.dataset])` to restore the original, pristine source.

```js
const draw = createRegionDraw(fim, { onComplete: (f) => { lastRegion = f; } });
createOperationsPanel('#ops', { layer: rasterLayer, region: () => lastRegion, pretty: true });
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
