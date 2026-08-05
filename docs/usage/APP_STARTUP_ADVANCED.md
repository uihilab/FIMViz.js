# App startup, part 2 — extension seams & the fuller `FimMap` API — usage reference

Continues [APP_STARTUP.md](./APP_STARTUP.md) (mounting + file upload). This covers the three
extension seams a host reaches for less often — registering a custom map backend, registering a
custom file-format decoder or reprojector, and the parts of `FimMap`'s own API beyond
`addDataset`/`addLayer`.

## Contents

[Map provider seam](#map-provider-seam) · [Built-in provider options](#built-in-provider-options) ·
[Neutral vector style vocabulary](#neutral-vector-style-vocabulary) ·
[Materialize / decode extension seam](#materialize--decode-extension-seam) ·
[FimMap — the fuller instance API](#fimmap--the-fuller-instance-api)

## Map provider seam

Two built-in backends cover the documented use — `'leaflet'` (no credentials) and `'google'`. Pick
one with the required `provider` option and read
[Built-in provider options](#built-in-provider-options) below; that is all most hosts ever need from
this seam. The registry hangs off `FimViz`, which is what boots a map:

```js
FimViz.mapProviders()                  // → string[] — the backends available
FimViz.providerAcceptsCRS(name, crs)   // → boolean — can it render content in this CRS?
createMap(el, options)                 // what mount() calls internally; you rarely call it directly
```

**Adding a third backend is possible but deliberately under-documented.**
`FimViz.registerMapProvider(name, impl)` takes an implementation of ~12 methods (`create`, `addVector`/
`removeVector`, `fitBounds`, the `addRasterImage` family, `onMapMouseMove`/`onMapEvent`, plus the
`requiresApiKey` and `acceptsCRS` properties) — `src/package/mapProvider.js` carries the full JSDoc
contract and two complete implementations to copy from, which is a better spec than a table here
could be. Four tiers stay provider-specific and outside the seam regardless: velocity's animated
canvas, the comparison draw-mask tool, HAZUS `AdvancedMarkerElement` markers, and `FloodDepthLayer`'s
ArcGIS MapServer tiles — so a third provider gets a map, vectors and static rasters, not those.

One contract detail that bites even when using the built-ins: **`setRasterImageUrl` returns the
handle to use next.** Google can't swap a `GroundOverlay`'s image in place, so it removes and
recreates; always reassign from the return value rather than reusing the handle you passed in.

`onMapEvent`'s `type` is one of `click`/`hover`/`dblclick`/`mousedown`/`mouseup`/`rightclick`
(`hover` maps to the provider's mousemove; `rightclick` and `contextmenu` are synonyms that both work
on either built-in). The callback gets `{ type, lat, lng, originalEvent }`, where `originalEvent` is
the DOM `MouseEvent` — for a UI that positions itself at the pointer.

## Built-in provider options

```js
// 'google' (requiresApiKey: true)
await mount('#el', {
  provider: 'google', apiKey, version?, libraries?, center?, zoom?, mapId?, mapOptions?,
});
// version default 'weekly'; center defaults to the continental US; zoom defaults 5;
// mapOptions is raw google.maps.MapOptions, merged LAST (wins over every default/derived option)

// 'leaflet' (requiresApiKey: false)
await mount('#el', { provider: 'leaflet', center?, zoom?, tileUrl?, tileOptions?, mapOptions? });
// tileUrl defaults to OpenStreetMap; pass tileUrl: null to opt out of the default tile layer
// (e.g. to add your own via L.tileLayer yourself); mapOptions is raw L.Map options
```

Both accept the WGS84 family only (`EPSG:4326`/`EPSG:4269`) for `acceptsCRS` — a non-WGS84 raster
must be reprojected first (see [DATASET_OPERATIONS.md](./DATASET_OPERATIONS.md)). Neither is loaded
until it is used: `create()` dynamic-imports the SDK, so a Leaflet-only page downloads no Maps loader
and vice versa. An unregistered `provider` name throws `config-invalid`, listing the registered ones.

**Leaflet needs `leaflet.css`.** The provider imports it itself (`leaflet/dist/leaflet.css`, alongside
the SDK), which the shipped `dist/fimviz.js` resolves — style-loader injects it on first `create()`,
no CDN request. Bundling from `fimviz/src` instead makes that import *your* bundler's problem: give it
a CSS rule, or drop the import and add a `<link>` of your own. Without the stylesheet, tiles and
markers lay out wrongly rather than failing loudly.

## Neutral vector style vocabulary

What makes `VectorLayer.render({style})`/`setStyle(patch)` provider-agnostic — describe a style ONCE,
each provider translates it to its own SDK names:

```js
{ fillColor?, fillOpacity?, strokeColor?, strokeWidth?, strokeOpacity? }
```

Any other key passes through untouched to the provider's native option (e.g. Google's `icon`,
Leaflet's `dashArray`) — portable only via the neutral names, but a single-provider caller can still
use provider-native options directly.

`style` may also be a **function** `({feature, index}) => style | colorString | null`, called once per
GeoJSON feature (same original feature + 0-based index on every provider) — a bare color string
shorthand expands to `{fillColor, strokeColor}`; `null` = that feature's provider-default styling.

The translation itself (`styleToGoogle`/`styleToLeaflet`) and the per-feature resolution
(`featuresOf`/`resolveFeatureStyle`) are **internal** to `mapProvider.js` — a `VectorLayer` applies
them for you. Read them there if you are implementing a provider.

## Materialize / decode extension seam

The registries behind `Dataset`'s lazy force — plug in a custom file format decoder, or swap the
reprojection implementation. They are **statics on `Dataset`**, the type they serve:

```js
Dataset.registerMaterializer(format, fn)  // fn: async (root, ds) => RasterGrid | VectorFeatures
                                          //   root: {kind:'inline', data} | {kind:'url', url}
Dataset.formats()                          // → string[] — every format decodable right now
                                          //   (built-ins + your own). Outside a custom decoder this
                                          //   is the one to reach for: build a file picker's
                                          //   `accept` list, or check an upload BEFORE parsing it.

Dataset.registerReprojector(fn)           // fn: async (grid, toCrs) => RasterGrid — the ONE warp slot
Dataset.registerDefaultReprojectorLoader(fn)
                                          // fn: async () => void — a JIT fallback invoked at most
                                          //   once, on the first force that finds nothing
                                          //   registered; it is expected to call
                                          //   Dataset.registerReprojector() before resolving. This
                                          //   is how the GDAL warp auto-loads with no setup call.
Dataset.registerResampler(fn)             // methods beyond nearest/bilinear/average (cubic/lanczos/…)

registerBuiltinMaterializers()            // a plain barrel function, not a Dataset static: it lives
                                          //   in io/materializers.js, which imports geotiff, and
                                          //   Dataset must never reach that. Idempotent, and it
                                          //   auto-runs at module scope there — which the barrel
                                          //   re-exports from, so importing anything from 'fimviz'
                                          //   has already registered the built-ins. Call it by hand
                                          //   only from a raw-browser page driving dist directly.
```

The registries' other readers (`getMaterializer`, `getReprojector`, `resolveReprojector`) are
**internal**: they hand back the implementation, and the seam already dispatches to it — a caller
who wants a decode calls `ds.load()`, and one who wants a warp calls `ds.reproject(crs)`.

```js
// Register a custom format decoder:
Dataset.registerMaterializer('my-format', async (root, ds) => {
  const bytes = root.kind === 'url' ? await (await fetch(root.url)).arrayBuffer() : root.data;
  // ... decode bytes ...
  return new RasterGrid({ pixels, width, height, bounds, crs, noData, meta });
});
```

The two value types a decoder must return:

```js
new RasterGrid({ pixels, width, height, bounds?, crs?, noData?, bands?, meta? })
new VectorFeatures({ features, bounds?, crs?, meta? })   // features: a GeoJSON FeatureCollection
```

## `FimMap` — the fuller instance API

Beyond `addDataset`/`addLayer`/`getLayer` (see [LAYERS.md](./LAYERS.md)):

```js
// Map-event dispatch (hover/click routed to layers by hitTest + z-order)
fim.enableMapEvents(types?, { simultaneous? })   // types default ['click','hover']
fim.disableMapEvents()
fim.simultaneousLayerEvents = true|false          // or read it back as a getter
fim.captureInteraction(handler)                    // MODAL: ALL map events go to handler until released;
                                                     // returns a release function (region-draw uses this)
fim.releaseInteraction()
fim.capturing                                       // getter — is a modal interaction active?

// data-action wiring (declarative markup: <button data-action="foo">)
fim.registerAction(name, fn)        // fn: function(this: Element, ...args)
fim.registerActions({ foo, bar })    // batch
fim.getAction(name)                  // this instance's registry, falling back to window[name]
fim.actionNames                       // string[] — registered on THIS instance only
fim.bindActions()                     // attach the one delegated listener (idempotent)

// scoped DOM query (resolves within this instance's root, not the whole document)
fim.$(sel)     // Element|null
fim.$$(sel)    // Element[]

fim.storage    // getter — throws unless `storage` was passed to mount()/create()
fim.layerPanel // getter — this instance's per-instance panel (null if no runtime registered one)
fim.config     // getter — this instance's app's config (the engine reads config only per-instance)

fim.destroy()   // detaches the map, clears injected markup, releases from its FimViz
```
