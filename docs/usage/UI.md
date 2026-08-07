# Headless UI module — usage reference

A **separate, opt-in** module the engine core never imports. Every piece touches the DOM only inside
functions (never at import time), and calls no `window.foo()` — the engine emits, these subscribe.
Mount whichever pieces you want; none of them are required for the engine to work.

Everything below imports from **`fimviz/ui`**, its only home — the engine barrel does not re-export
it. That entry carries just the small pure deps these need (~46 KB, no geotiff/Maps loader/GDAL), and
having exactly one entry means an app can never load two copies with two sets of state:

```js
import { createToast, connectToast, createToolsPanel } from 'fimviz/ui';
```

## Contents

[Toast](#toast) · [Host bus (busy, metadata)](#the-rest-of-the-enginehost-bus) ·
[Tooltip (raster hover)](#tooltip-raster-hover) ·
[Info window (vector click)](#info-window-vector-click) · [Tools panel](#tools-panel) ·
[Legend/Stats renderers](#legendstats-renderers) · [Live panels](#live-panels--bindlegend--bindstats) ·
[Selection tools](#selection-tools-region-draw) · [Region overlay](#showing-the-shape--createregionoverlay) ·
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

`connectToast` also surfaces two engine **warnings** that otherwise reach only `console.warn`, where
nobody looking at the map would find them — `layer:raster-oversized` ("too large for one image —
drawn downsampled") and `layer:crs-unrenderable` ("…which leaflet cannot draw — reproject it to
EPSG:4326 first"). Both describe something visibly wrong with what was just drawn. Pass
`{ warnings: false }` for `notify` only. The returned toast carries an `off()` that releases every
subscription it made.

## The rest of the engine→host bus

```js
createBusyIndicator(fim, { root?, label?, pretty? })
// label: a string, or (sources: string[]) => string
// → { el, active, sources, off(), destroy() }

bindRasterMetadata(fim, { root?, render?, pretty? })
// → { el, shown, payload, off(), destroy() }

renderRasterMetadata(payload)   // PURE — the default rendering, for a host's own chrome
```

**`createBusyIndicator` ref-counts by `source`.** The `busy` event carries one precisely because work
overlaps; a single boolean would let the first job to finish hide an indicator two others still need.
A stray `active:false` from a source that never announced itself is ignored rather than clearing
everything.

`busy` is now emitted by the mainstream path too — `parseSource` (`source: 'parse'`) and the GDAL warp
inside a forced `reproject` (`source: 'reproject'`), which is the longest operation in the library
since the first one pulls ~38 MB of wasm. Both pair the emit in a `finally`, so a failure clears the
indicator rather than leaving it spinning on work that is not happening.

**`bindRasterMetadata`** renders the `raster:metadata` / `raster:metadata-hidden` pair. The engine
computes the rows and emits them (`geo/tifMeta.js`) precisely so it never has to name a panel — this
is the panel. Hiding does not clear `payload`, because the engine's event means "no longer current",
not "forget it". Today only the app-tier depth/ensemble/velocity layers emit it.

### Deliberately unbound

`storage:changed` and `upload:complete` get **no widget**. Both mean "a host list you own is now
stale" / "dismiss the affordance you showed", and neither the list nor the affordance is ours —
inventing one would be the same app-opinionated mistake the unified Layer Panel was kept out of the
package to avoid. They are ordinary events: `fim.on('storage:changed', …)`.

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
rasterControls(layer)   // PURE, node-testable — the control spec for a RasterLayer
vectorControls(layer)    // PURE — for a VectorLayer: opacity, plus EITHER a flat colour, OR (when the
                          // layer grades features via colorScale + colorBy) the same palette +
                          // continuous controls rasterControls emits — they write the same ColorScale

createToolsPanel(root, { layer, controls?, pretty?, reactive? })
// controls: overrides the preset — an array, or (layer) => Control[]
// pretty: true injects a small scoped dark-theme stylesheet; false = bare unstyled structure
// reactive: true re-reads the layer when it changes anywhere else (see the focus rule below)
// → { el, update(), destroy() }
```

```js
createToolsPanel('#panel', { layer: rasterLayer, pretty: true });
// auto-picks rasterControls/vectorControls based on the layer shape (valueAt → raster, featureAt → vector)
```

`Control` shape: `{ type: 'select'|'checkbox'|'range'|'color'|'text'|'number'|'bands'|'gradient', key,
label?, value?, options?, min?, max?, step?, note? }` — `key` is the settings knob the control writes.

### What `rasterControls` offers

With a `ColorScale` attached, **every knob `RasterSettings.SCALE_KEYS` accepts** — a knob the settings
layer honours but no preset offers is a knob nobody can reach:

| Control | Key | |
|---|---|---|
| Palette | `palette` | the named ramp |
| Continuous | `continuous` | interpolate rather than band |
| Min / Max | `min`, `max` | the domain |
| Unit | `unit` | legend/tooltip suffix |
| **Bands** | `stops` | discrete: one flat colour per range, with labels |
| **Gradient** | `colorStops` | control points, interpolated between the bracketing pair |

Plus `opacity` and the `hover` toggle, which exist with or without a scale. They all route through
`layer.settings.set()`, which coalesces the scale-bound keys into **one** `colorScale.set(patch)` — so
editing several is one repaint, not one per key.

**The three colouring modes are mutually exclusive**, and the panel inherits that from the engine
rather than policing it: `setPalette`/`setStops`/`setColorStops` each clear the others. So adding a
band leaves palette mode, adding gradient points clears the bands, and **picking a palette is how you
get back**. Neither editor has a "clear" button, because emptying `stops` does *not* restore palette
mode — `setStops([])` leaves the scale explicit with no bands, i.e. nothing painted at all.

Two behaviours worth knowing:

- **A gradient commits only at two or more control points.** `setColorStops` throws below that, so one
  point is treated as an edit in progress — rendered, not yet written — rather than throwing in the
  user's face halfway through a legitimate action.
- **Blanking a number field commits nothing.** Clearing `max` to retype it must not be read as zero.

The read side is `colorScale.toJSON()`, the documented structured-cloneable description — the only
thing that reports which mode is live. Note that the Continuous box reflects the `continuous` *flag*,
not the derived `kind`, which reports `'classed'` whenever stops exist.

### `reactive` — and why it is opt-in

`reactive: true` subscribes to the layer's `restyle`/`recomputed`/`settings` events, so a change made
by host code, or by a second panel on the same layer, shows up here.

**It is not the default because this panel is made of live inputs.** A restyle arrives on every
keystroke-driven commit, and rebuilding the panel destroys the field the user is typing in. So the
rule is: **if focus is inside the panel, defer** — remember that a redraw is owed and do it on
`focusout`. The user's own edits are exactly the ones that need no repaint, since the control they are
in already holds the value.

## Legend/Stats renderers

Thin wrappers over `Legend`/`Stats` (see [LEGEND.md](./LEGEND.md)) — data by default, HTML on
request:

```js
renderLegend(legend, { html? })   // html:false (default) → legend.toJSON(); html:true → legend.toHtml()
                                    // (or a built-in fallback swatch list if toHtml is absent)
renderStats(stats, { html? })      // html:false → stats.toJSON(); html:true → an HTML table of scalar fields
```

Both are **pure** — no DOM — so they are node-testable and usable anywhere.

### Live panels — `bindLegend` / `bindStats`

The same renderers, mounted and kept current, so a host never has to remember to re-read after a
repaint:

```js
bindLegend(layer, { root?, html?, render?, empty? })
bindStats (layer, { root?, html?, filter?, render?, empty? })
// → { el, update(), off(), destroy() }
```

They subscribe to three of the layer's own events, and only these three:

| | |
|---|---|
| `restyle` | the colour scale changed — palette, bands, min/max, opacity |
| `recomputed` | the pixels changed — noData, an applied op |
| `rendered` | a draw completed, which is when a legend derived *from* the grid (a GDAL legend detected mid-render) first exists at all |

`settings` is deliberately excluded: it fires for knobs that change neither, such as the hover toggle.

```js
const legend = bindLegend(layer, { root: $('#legend'), empty: 'no colour scale' });
const stats  = bindStats(layer,  { root: $('#stats'), filter: () => currentRegion });
layer.set({ palette: 'viridis' });    // both repaint themselves
```

Four things they handle that hand-rolled re-reading usually doesn't:

- **Coalescing.** One logical change can emit two of those events — a settings write that redraws
  emits `recomputed` *and* `rendered` — so updates batch to one read per microtask.
- **Ordering.** `getStats()` is async, and a fast sequence of edits can resolve out of order. A stale
  result is dropped rather than painted over a newer one: a lagging panel is recoverable, a wrong one
  is not.
- **`removed`.** The panel clears and releases its subscription, rather than showing a legend for a
  layer that is gone.
- **`filter` may be a getter**, because the usual filter is a drawn region that changes independently
  of the layer. The layer emits nothing when you draw one, so that is the one case needing `update()`
  — everything the *layer* can know about is already automatic.

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
// onPreview(rings, points)    — the live shape, incl. the rectangle rubber band on hover
// onComplete(filter, points, rings) — filter is a SpatialFilter or null if the shape has no area
// onCancel()
// → { start(), finish(), cancel(), undo(), setMode(m), mode, brushRadius, points, rings, active }
```

**Brush size can be a screen size.** `brushRadius` takes metres as a number — a fixed ground
footprint, what you want when the brush means "300 m either side of this line" — or a CSS-like string
resolved against the live view:

```js
createRegionDraw(fim, { mode: 'brush', brushRadius: '2vw' });   // 2% of the MAP's width
```

`vw`/`vh` are percentages of the **map container**, not the browser window, and `px` is literal
pixels. A screen size is re-resolved *per stamp*, so it holds its apparent width as you zoom — which
is what makes a brush feel like a brush. `brushRadius` is also settable on the handle
(`draw.brushRadius = '4vw'`), so a size slider takes effect on the next stamp rather than the next
tool. It falls back to a ground size when the map cannot report its scale.

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
- **`start()` is what arms the tool** — and, for the drag modes, what takes pan-by-drag away. A UI
  where picking "brush" does not call `start()` will pan the map under the user's stroke.

Drag modes take pan-by-drag away for the length of the stroke (`fim.setMapDraggable`), because tracing
and panning are the same gesture; it is restored on finish *and* on cancel. Polygon does not — moving
the map between vertices is legitimate. A press-drag-release also emits a trailing `click`, which the
tool eats so the end of a stroke does not also select whatever is under the cursor.

`setMode()` mid-draw discards the current shape and does **not** fire `onCancel` — the host asked for
the switch, and reporting it as a cancellation makes toolbars un-toggle themselves.

### Showing the shape — `createRegionOverlay`

The draw tool is headless: it produces `{lat,lng}` and names no map SDK, which is what lets it work on
Google, Leaflet and a test's fake map alike. This is the other half — without it the user draws blind.

```js
const overlay = createRegionOverlay(fim, { style?, vertices? });
// → { show(rings, points?), clear(), geojson, destroy() }

const draw = createRegionDraw(fim, {
  onPreview:  (rings, points) => overlay.show(rings, points),
  onComplete: (filter, points, rings) => overlay.show(rings, points),
  onCancel:   () => overlay.clear(),
});
```

It renders three feature kinds, because **a selection is visible long before it is a polygon**: a
`vertex` marker from the very first click, an open `edge` line at two points, and a closed `ring` from
three (a brush contributes one ring per stamp). Every feature carries `properties.role`, so a `style`
callback — `({ feature, index }) => neutralStyle` — can tell them apart. `regionGeoJSON(rings, points)`
is exported separately for a host that wants the FeatureCollection without the map plumbing.

Redraws coalesce to one per animation frame: a freehand stroke fires `onPreview` on every mousemove,
and rebuilding a vector overlay per event makes the drag stutter.

The shape is drawn with **`fim.addScratchVector`** — *not* a Layer. It never enters `fim.layers`, so
it is not hit-tested, reordered, listed in the layer panel or saved: it is scaffolding the user is
looking at, not data they loaded.

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
