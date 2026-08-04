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

```js
registerMapProvider(name, impl)   // impl: MapProviderImpl (below)
createMap(el, options)             // what mount() calls internally — options.provider picks the impl
mapProviderNames()                  // → string[] — every registered name
providerAcceptsCRS(name, crs)        // → boolean — can this provider render content in this CRS?
providerRequiresApiKey(name)         // → boolean
```

### The `MapProviderImpl` contract

Every method except `create` has an **identical** shape across providers — that's the point: `Layer`
and the event dispatch call these without knowing which provider is underneath. Only `create()`'s
`options` shape is provider-specific.

| Method | Signature | Notes |
|---|---|---|
| `create` | `(el, options) => Promise<map>` | Builds the map; returns the provider's native map object (`fim.map`). |
| `requiresApiKey` | `boolean` | Property, not a method. `google`: `true`; `leaflet`: `false`. |
| `acceptsCRS` | `(crs: string\|null) => boolean` | Asked by `Layer`'s render precondition. Omitted = permissive (accepts anything). |
| `addVector` | `(map, geojson, {style?}) => handle` | `style`: a neutral style object/string, **or** a `({feature, index}) => style\|string\|null` function for per-feature styling. |
| `removeVector` | `(map, handle) => void` | |
| `fitBounds` | `(map, {north,south,east,west}) => void` | |
| `addRasterImage` | `(map, dataUrl, bounds, {opacity?, interactive?}) => handle` | Non-interactive (`clickable:false`) by default — map events pass through to the engine's own hit-testing. |
| `removeRasterImage` | `(map, handle) => void` | |
| `setRasterImageOpacity` | `(handle, opacity) => void` | |
| `setRasterImageUrl` | `(map, handle, dataUrl, bounds, {opacity?, interactive?}) => handle` | Swap the image (a repaint). **Use the RETURNED handle going forward** — some providers (google) can't swap in place and recreate the overlay. |
| `onMapMouseMove` | `(map, cb: ({lat,lng}) => void) => unsubscribe` | |
| `onMapEvent` | `(map, type, cb: ({type,lat,lng,originalEvent}) => void) => unsubscribe` | `type ∈ click\|hover\|dblclick\|mousedown\|mouseup\|rightclick`. `hover` maps to the provider's mousemove. |

```js
registerMapProvider('mine', {
  requiresApiKey: false,
  acceptsCRS: (crs) => crs == null || crs === 'EPSG:4326',
  async create(el, options) { /* return your map object */ },
  addVector(map, geojson, { style }) { /* ... */ },
  removeVector(map, handle) { /* ... */ },
  fitBounds(map, bounds) { /* ... */ },
  addRasterImage(map, dataUrl, bounds, opts) { /* ... */ },
  removeRasterImage(map, handle) { /* ... */ },
  setRasterImageOpacity(handle, opacity) { /* ... */ },
  setRasterImageUrl(map, handle, dataUrl, bounds, opts) { /* ... */ },
  onMapMouseMove(map, cb) { /* return an unsubscribe fn */ },
  onMapEvent(map, type, cb) { /* return an unsubscribe fn */ },
});

await mount('#el', { provider: 'mine' });
```

**Still provider-specific by design, not covered by this seam** (each needs its own per-provider
work): velocity's continuously-animated canvas, the comparison draw-mask tool, HAZUS
`AdvancedMarkerElement` damage markers, `FloodDepthLayer`'s ArcGIS MapServer tiles.

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
must be reprojected first (see [DATASET_OPERATIONS.md](./DATASET_OPERATIONS.md)).

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

```js
styleToGoogle(neutralStyle)     // → a google.maps.Data style object
styleToLeaflet(neutralStyle)    // → Leaflet path options
featuresOf(geojson)              // → Feature[] in document order (FeatureCollection/Feature/[])
resolveFeatureStyle(style, feature, index)   // resolves one feature's style per the rules above
```

## Materialize / decode extension seam

The registries behind `Dataset`'s lazy force (`package/materialize.js`) — plug in a custom file
format decoder, or swap the reprojection implementation:

```js
registerMaterializer(format, fn)   // fn: async (root, ds) => RasterGrid | VectorFeatures
                                    // root: {kind:'inline', data} | {kind:'url', url}
getMaterializer(format)              // → the registered decoder, or null
materializerFormats()                 // → string[] — every registered format name
registerBuiltinMaterializers()        // wires geotiff + geojson/kml/kmz/shp/hazus/csv/xyz at once
                                       // (auto-runs on import of io/materializers.js — usually no
                                       // manual call needed)

registerReprojector(fn)              // fn: async (grid, targetCrs) => RasterGrid — the ONE warp slot
getReprojector()                      // → the registered warp, or null
registerDefaultReprojectorLoader(fn)  // fn: async () => void — a JIT fallback, invoked at most once,
                                       // the first force that finds nothing registered; expected to
                                       // call registerReprojector() itself before resolving. This is
                                       // how the GDAL warp auto-loads with no setup call — see
                                       // DATASET_OPERATIONS.md's reproject note.
resolveReprojector()                   // → Promise<Reprojector|null> — what Dataset's force actually
                                       // calls (tries the default loader before giving up)
```

```js
// Register a custom format decoder:
registerMaterializer('my-format', async (root, ds) => {
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
