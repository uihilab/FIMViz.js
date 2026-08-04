# Layer subtypes — usage reference

Shared base mechanics (`render`/`compute`/`setSources`/`settings`/events/...): see
[LAYERS.md](./LAYERS.md). This doc covers every subtype's **own** methods/properties — not just its
"ops" in the Dataset sense, but everything you can call on it.

## Contents

[RasterLayer](#rasterlayer) · [VectorLayer](#vectorlayer) · [ComparisonLayer](#comparisonlayer) ·
[EnsembleAggregationLayer](#ensembleaggregationlayer) ·
[App-tier renderFile subclasses](#app-tier-renderfile-pattern-subclasses)

## `RasterLayer`

One class for extent/userRaster/depth/ensemble/... — subtypes differ only by `.type` string, not by
subclass. Registered as `"raster"`.

```js
new RasterLayer({ map?, type?, sources=[], id?, exclusive?, noData?, opacity=1 })
```

### Properties

| Property | Type | Notes |
|---|---|---|
| `.overlay` | `*` | The provider's positioned-image handle (`GroundOverlay`/`ImageOverlay`). |
| `.rasterData` | `TypedArray\|null` | Pixel array, for hover lookups (`valueAt`). |
| `.meta` | `{bw,bs,be,bn,width,height,noData,unit}\|null` | Populated by `_draw()`. |
| `.noData` | `number\|null` | Overrides the decoded grid's own noData when set. |
| `.opacity` | `number` (0–1) | Placement setting, applied live via the provider. |
| `.colorScale` | `ColorScale\|null` | See [COLOR_SCALE.md](./COLOR_SCALE.md) for everything about this. |

### Methods

```js
layer.setNoData(v)                // chainable
layer.setOpacity(v)                // chainable — live via provider, no redraw needed
layer.hide()                       // chainable — overlay opacity -> 0 via the provider (overlay is
                                    // NOT torn down, so show() is instant); OVERRIDES the base's
                                    // flip-.visible-only no-op
layer.show()                       // chainable — restores the overlay to its configured .opacity
layer.set({ colorScale: cs })      // cs: ColorScale|null — VALIDATED before mutating (throws on a
                                    // non-ColorScale value cleanly, doesn't corrupt .colorScale)
layer.getLegend()                  // Legend derived from .colorScale, or null until one is attached
await layer.getStats(opts?)        // Stats classified by .colorScale; null until pixels are loaded
                                   // (VectorLayer: feature counts by type + area/length/bbox,
                                   //  computed from dataset.data — no map or render required)
layer.fit()                        // fit the map to this raster's bounds
layer.hitTest(lat, lng)            // PIXEL-LEVEL — true only over a real (non-noData) pixel, so a
                                    // click over a transparent part falls through to layers below
layer.valueAt(lat, lng, opts?)     // the pixel value at a point (nearest cell), or null.
                                    // opts.noDataTolerance (default 0 = exact match) widens the
                                    // noData check to |v-noData|<=tolerance — for a raster whose
                                    // sentinel can drift after resampling. hitTest() always uses the
                                    // default; widening only affects a direct valueAt() call.
layer.enableHover(opts?)           // wires a live hover readout: onMapMouseMove + valueAt() on every
                                    // move, emits 'hover' {lat,lng,value,text}. Idempotent (replaces,
                                    // doesn't stack); torn down automatically on remove(). Opts:
                                    // noDataTolerance (→ valueAt), isEmpty(v)=>bool (an in-range value
                                    // to ALSO treat as absent — e.g. "zero means nothing" for a depth
                                    // layer), formatValue(v)=>string (defaults to String(v)).
layer.disableHover()               // stop a hover readout wired by enableHover() — a no-op if none active
```

### ColorScale resolution on render

When `_draw()` runs and no `ColorScale` is attached yet, one is resolved automatically, in order:
(1) already explicit → untouched, (2) a GDAL-embedded legend auto-detected from the file → built via
`ColorScale.fromGdalLegend`, (3) a default continuous scale (`ColorScale`'s own default palette,
`"blues"`) ranged to the grid's own min/max. Whichever is chosen is **attached**, so `.colorScale`/
`getLegend()`/`getStats()` always reflect what's actually drawn. Full detail:
[COLOR_SCALE.md](./COLOR_SCALE.md).

### Settings knobs (`layer.settings.set({...})`)

| Key | Effect |
|---|---|
| `palette` | routes to the attached `colorScale` — no-op if none attached yet. |
| `continuous` | routes to the attached `colorScale`. |
| `noData` | `setNoData(v)` → `'recomputed'` (redraw). |
| `opacity` | `setOpacity(v)` → `'restyle'`. |
| `hover` | Interaction-only; a tooltip reads `settings.get('hover')`. |

### Registered-type construction

```js
await fim.addLayer('raster', { source: ds, sources?, noData?, opacity?, colorScale?, render? })
```

## `VectorLayer`

Renders a vector Dataset's GeoJSON via the provider's `addVector`/`removeVector`. Registered as
`"vector"`. **Note:** `render()` here is **synchronous** (returns `VectorLayer`, not a Promise) —
unlike the base/RasterLayer async pipeline, since parsing nothing is needed to draw already-parsed
GeoJSON.

```js
new VectorLayer({ map?, type?, sources=[], id?, exclusive? })
```

### Properties

| Property | Notes |
|---|---|
| `.dataLayer` | The provider's vector handle. |
| `._style` | The current neutral style patch (`fillColor`/`strokeColor`/`fillOpacity`/...). |

### Methods

```js
layer.render({ style? })          // SYNC. style: provider-native style object; throws if unmounted
                                    // or the Dataset has no GeoJSON, or the provider lacks addVector
layer.setStyle(patch)              // merge + re-add (no in-place setVectorStyle in the provider
                                    // contract — this removes + re-adds)
layer.hide()                       // chainable — removes the dataLayer via the provider (no vector
                                    // "invisible" primitive short of removing it); OVERRIDES the
                                    // base's flip-.visible-only no-op
layer.show()                       // chainable — re-adds via addVector, at the last style, if hidden
layer.fit()                        // fit the map to the Dataset's bounds
layer.hitTest(lat, lng)             // true if the point falls inside any feature's geometry
layer.featureAt(lat, lng)          // the first matching GeoJSON Feature, or null (drives an info window)
```

### Building from CSV/XYZ (both produce a vector Dataset → `VectorLayer`)

`fim.addDataset(source, options)`'s `options` for these two formats:

```js
// CSV — a row becomes a Point (lat/lng column pair) or whatever geometry a WKT/GeoJSON column
// carries. Common column names auto-detect when no mapping is given (lat/latitude/y,
// lng/lon/long/longitude/x, geometry/geom/wkt/the_geom); every other column → feature properties.
await fim.addDataset(csvFile, { latField?, lngField?, geometryField?, delimiter? })

// Read the header row FIRST (before parsing) to build a column-mapping picker:
import { csvHeaders } from 'fimviz';
const headers = csvHeaders(await csvFile.text(), { delimiter? });

// A failed auto-detect throws with `.columns` attached (the detected headers), for a reactive picker:
try { await fim.addDataset(csvFile); }
catch (e) { console.log(e.columns); }   // present only on this specific failure

// WKT parsing standalone (what geometryField uses internally), if you need it directly:
import { wktToGeometry } from 'fimviz';
wktToGeometry('POINT(-90.07 29.95)');   // → GeoJSON geometry; POINT/MULTIPOINT/LINESTRING/
                                          // MULTILINESTRING/POLYGON/MULTIPOLYGON (2-D only)

// XYZ — headerless x,y,z point files (LiDAR/survey dumps). Extra columns beyond x,y,z → z2, z3, ...
await fim.addDataset(xyzFile, { swapXY? })   // swapXY:true if a file orders northing/easting first
```

### Settings knobs

| Key | Effect |
|---|---|
| `color` | `setStyle({fillColor: v, strokeColor: v})` → `'restyle'`. |
| `opacity` | `setStyle({fillOpacity: v})` → `'restyle'`. |
| `useFileColors` | → `'restyle'` (the UI reads this back; no direct style call here). |
| `hover` | Interaction-only. |

### Registered-type construction

```js
await fim.addLayer('vector', { source: ds, sources?, style? })   // resolves synchronously (still awaitable)
```

## `ComparisonLayer`

Aligns N (2–8) extent rasters onto one grid, classifies **which subset** is wet (2ⁿ−1 colours), and
— for exactly 2 sources — scores agreement (confusion-matrix metrics). Registered as `"comparison"`.
Headless: names no map SDK; emits `'computed'` for a UI binder.

```js
new ComparisonLayer({ map?, sources=[] })   // sources: {pixels,meta}[] | RasterLayer[]
```

### Methods

```js
layer.compute({ policy?, method?, colors?, dryValue?, mask? })
// policy: 'low'|'high'|'average' (default 'high' — a warning is recorded, not thrown, if omitted)
// method: a resample method name (default 'nearest'; unknown → warning + falls back)
// colors: 2^n-1 colour override array · dryValue: the "dry" sentinel (default -99999)
// mask: draw polygon scoping the 2-ary metrics
// → returns { grid, rgba, counts, nLayers, metrics, policy, method, warnings, aligned, dryValue }
//   and emits 'computed' (→ map bus 'comparison:computed') with the same payload

await layer.prepare()          // materializes any Dataset sources into RasterGrids first — needed
                                // because compute() itself is SYNC and can't force a Dataset (async)
layer.getAligned()              // the last compute()'s aligned per-layer pixel arrays, or null
layer.metricsForMask(mask)      // recompute ONLY the 2-ary metrics under a new mask, reusing the
                                // already-aligned pixels — null if nLayers !== 2
```

### Registered-type construction

```js
await fim.addLayer('comparison', { sources: [{pixels,meta}, ...], policy?, method?, colors?, compute? })
// compute defaults true (computes at construction); pass { compute: false } to build without computing
```

## `EnsembleAggregationLayer`

The ensemble twin of `ComparisonLayer` — same align-N-onto-one-grid shape, different reduction: asks
**how many** members are wet (a per-pixel agreement count 0..N over an N-colour ramp), not which
subset. Registered as `"ensembleAgreement"`. Distinct from `layers/ensemble.js`'s single-file
pre-baked-GeoTIFF `RasterLayer` (type `'ensemble'`) — this one aggregates multiple member rasters.

```js
new EnsembleAggregationLayer({ map?, sources=[] })   // sources: {pixels,meta}[] | RasterLayer[]
```

### Methods

```js
layer.compute({ policy?, method?, colors?, dryValue? })
// same policy/method/dryValue as ComparisonLayer; colors: N-colour agreement ramp (omitted → a
// viridis ramp + a warning, from the reducer)
// → returns { grid, rgba, perPixel, histogram, nLayers, policy, method, warnings }
//   and emits 'computed' (→ map bus 'ensembleAgreement:computed')

await layer.prepare()    // same as ComparisonLayer — materialize Dataset sources first
layer.getAligned()        // the last compute()'s aligned per-member pixel arrays, or null
```

### Registered-type construction

```js
await fim.addLayer('ensembleAgreement', { sources: [{pixels,meta}, ...], policy?, method?, colors?, compute? })
```

## App-tier `renderFile`-pattern subclasses

Three real `Layer` subclasses drive the "one uploaded user file → one persistent rendering
singleton" pattern (`EnsembleLayer`/`DepthLayer` in the engine's `layers/`, `DamageLayer` in the
app): a thin subclass whose constructor just sets `type`, and one method:

```js
await layer.renderFile(fileData, map)   // delegates to the subsystem singleton, takes ownership of
                                          // teardown, sets .visible=true, emits 'rendered'
```

`layer._name` (the filename) must be set first — `fim.registerNamedLayer(name, layer)` does that.
These exist so every user-file type is a proper `Layer` (participates in `fim.layers`/`removeLayer`/
`'removed'`), even though the actual pixel-level rendering lives in a module-level subsystem
singleton, not on the instance.
