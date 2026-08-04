# FIMViz — usage reference

The package is a **headless flood-visualization engine**. Two ways to use it:

- **Composable primitives** — parse files, compute statistics, build colour scales, store datasets. Pure/
  headless, no map, no runtime registration. **Works today straight from the package.**
- **The full widget** — map + Layer Panel + flood layers. Needs a **UI runtime**, which the library no
  longer contains (see [Booting the widget](#booting-the-widget)).

> **Full per-parameter API reference:** [docs/api/](../api/) — generated from the library's own
> JSDoc. This page is the narrative quickstart, not an exhaustive parameter listing.
>
> **Dense, task-oriented usage guides** (short text, parameter tables, worked examples):
> [APP_STARTUP.md](./APP_STARTUP.md) (every way to mount + the file-upload flow) +
> [part 2](./APP_STARTUP_ADVANCED.md) (map-provider seam, materialize/decode extension seam,
> `FimMap`'s fuller API), [DATASET_OPERATIONS.md](./DATASET_OPERATIONS.md) (every unary/binary
> Dataset op, plus the standalone grid functions), [LAYERS.md](./LAYERS.md) (the base Layer class),
> [LAYER_SUBTYPES.md](./LAYER_SUBTYPES.md) (RasterLayer/VectorLayer/ComparisonLayer/
> EnsembleAggregationLayer), [COLOR_SCALE.md](./COLOR_SCALE.md) (all three ColorScale modes),
> [LEGEND.md](./LEGEND.md), [STORAGE.md](./STORAGE.md) (the generic IndexedDB key-value store), and
> [UI.md](./UI.md) (the opt-in headless UI module — toast/tooltip/info-window/tools-panel/
> region-draw/operations-panel).

**Try it:** serve the repo root (`npx serve .`) and open [`examples/test.html`](../../examples/test.html) for a
smoke test, [`examples/api-test.esm.html`](../../examples/api-test.esm.html) for the full bench, or
[`examples/method-playground.html`](../../examples/method-playground.html) for every public method with sample
parameters.

## Contents

[Install](#install--import) · [Booting the widget](#booting-the-widget) · [`FimViz`](#fimviz-namespace) ·
[`FimMap`](#fimmap-instance) · [Configuration](#configuration) · [Events](#events) · [`Dataset`](#dataset) ·
[`warp`](#warp) · [`Storage`](#storage) · [`ColorScale`](#colorscale) · [Palettes](#palettes) ·
[`Legend`](#legend) · [`Stats`](#stats) · [Filters](#filters) · [`Layer`](#layer) ·
[From file to rendered layer](#from-file-to-rendered-layer) ·
[Vendored primitives](#vendored-primitives) · [GDAL](#gdal) · [Hosting](#hosting-notes) ·
[Security](#security) · [Limitations](#limitations)

---

## Install & import

**ESM-only, single-entry.** Everything is one `import { … } from 'fimviz'` — there is no
subpath-per-concern split (`fimviz/data`, `fimviz/storage`, etc. do **not** exist). `fimviz` resolves
to `dist/fimviz.js`:

```js
import {
  mount, FimViz, registerRuntime,             // boot
  createMap, registerMapProvider, mapProviderNames,  // map-provider seam (google/leaflet)
  Dataset, warp, Storage,                      // composable core
  ColorScale, PALETTES, registerPalette, hasPalette, paletteNames, Legend, Stats,
  Filter, SpatialFilter, PredicateFilter,      // read-models
  Layer, RasterLayer, VectorLayer, registerLayerType, ComparisonLayer, EnsembleAggregationLayer,
  fromArrayBuffer, kml, shp, Loader,           // vendored primitives (below)
} from 'fimviz';
```

You get the whole engine or nothing — a page that only parses files still pulls in the Layer model and
the vendored Maps loader. There are no tree-shakeable subpaths.

This works unchanged in a bundler (Vite/webpack/Rollup/esbuild). In Node, the **same** bare `fimviz`
resolves to the **built** `dist/fimviz.js` (the `exports` map has no `browser`/`node` split), so
module-scope `self`/`window` references can throw under Node even though the import succeeds in a
browser. In a raw browser, an
import map supplies resolution:

```html
<script type="importmap">{ "imports": { "fimviz": "/node_modules/fimviz/dist/fimviz.js" } }</script>
<script type="module">import { FimViz } from "fimviz";</script>
```

**Vendored primitives are an escape hatch.** `fromArrayBuffer`/`kml`/`shp`/`Loader` re-export geotiff /
@tmcw/togeojson / shpjs / the Maps loader so you reach raw primitives without adding those packages yourself
(risking a version split with ours). Prefer `parseFile()` for anything it covers.

**No UMD** — a second build meant a second artifact to sync, and its global was a wart (`window.FimViz` held
the module *namespace*, which exported something called `FimViz` → `window.FimViz.FimViz`). ESM has no such
ambiguity. Async chunks (GDAL glue, arcgislink) are emitted next to `fimviz.js` and resolved with
`publicPath: "auto"` — they load relative to wherever you serve the bundle.

---

## Booting the widget

**`mount()` has two boot paths; only one needs a runtime.**

**No runtime → a bare map.** `create()` builds the map itself through the map-provider seam:

```js
import { mount } from 'fimviz';
const fim  = await mount('#fim',  { apiKey: 'YOUR_GOOGLE_MAPS_KEY' });   // real google.maps.Map
const fim2 = await mount('#fim2', { provider: 'leaflet' });              // real Leaflet map, no key
```

Only the **provider** requires an `apiKey` (`google` does, `leaflet` does not). You get a working empty map
+ every composable primitive; you do **not** get the FIMViz widget chrome (Layer Panel, flood layers,
comparison tools).

**Runtime → the full widget.** The UI tier (map boot, panels, widget markup) is a host concern. A host
supplies it via `registerRuntime()` **before** `mount()`; the registered `bootstrap()` then takes over boot:

```js
import { mount, registerRuntime } from 'fimviz';
registerRuntime({
  bootstrap,     // async (fim) => void — boot the map; called instead of createMap()
  getMountedMap, // () => the provider's map object — reported once bootstrap resolves
  teardownMap,   // () => void — detach listeners on destroy()
  createPanel,   // (root) => LayerPanel — per-instance panel factory
  markup,        // string — widget HTML injected into the container
});
const fim = await mount('#fim', { apiKey: '…' });
```

`bootstrap(fim)` receives the `FimMap` being mounted, so a runtime never has to look up which
instance it is booting. `fim.map` is still `null` at that point — the engine adopts the map once
`bootstrap()` resolves — so hold the reference, but read `fim.map` only afterwards.

A host's own composition root wires this up. There is no plan to package the UI tier as a separate
library — a turnkey full widget means registering your own runtime as shown above.
**The composable primitives below need neither path.**

---

## `FimViz` namespace

```js
FimViz.mount(target, options)   // → Promise<FimMap>  (= create; see above)
FimViz.create(target, options)  // → Promise<FimMap>  (boot core)
FimViz.parseFile(source)        // → Promise<Dataset> (pure; no map, no instance)
FimViz.current()                // → FimVizInstance | null  (the ambient default app)
FimViz.reset()                  // force-release the default app (tears down its maps)
```

`target` is an element, id, or CSS selector. The returned promise carries `.on(evt, fn)`/`.off()` so you can
subscribe **before** it resolves: `mount('#fim', opts).on('error', e => …)`.

### `parseFile(source, options?) → Promise<Dataset>`

`source`: `File`|`Blob`|`ArrayBuffer`|URL string. `options`: `{ format?, name? }` (auto-detected from the
name/extension). Supported: `geotiff` (.tif/.tiff), `geojson` (.geojson/.json, incl. HAZUS damage), `kml`,
`kmz`, `shp` (a .zip with .shp/.dbf/.shx), `csv` (a `latField`/`lngField` column pair, or a
`geometryField` of WKT/GeoJSON per row — auto-detected from common column names when omitted; use
`csvHeaders(text)` to read the header row and build a mapping picker **before** calling `parseFile`),
`xyz` (headerless `x y z` point files; `{ swapXY: true }` for northing-first exports). **Parsing never
reprojects** — the Dataset comes back in its **native** `crs`; warp deliberately with
[`warp`](#warp).

### `FimVizInstance` (via `FimViz.current()` or `fim.app`)

| Member | Notes |
|---|---|
| `config` | this app's config (see [Configuration](#configuration)) |
| `storage` | shared `Storage`; **throws** unless `config.storage` was set |
| `maps` | `FimMap[]` |
| `datasets` | `Dataset[]` — every Dataset parsed on this app, shared by all its maps |
| `isDefault` / `hasMaps` | booleans |
| `on/off/emit(evt, payload)` | the shared event bus |
| `configure(options)` | merge options; no-op with a warning once locked after boot |
| `destroy()` | tear down every map on this app |

---

## `FimMap` instance (from `mount()`/`create()`)

| Member | Notes |
|---|---|
| `root` | the mount container element |
| `app` | the owning `FimVizInstance` |
| `map` | the underlying map — a `google.maps.Map`, or `L.Map` with `provider: 'leaflet'`; advisory, read-mostly |
| `config` | this instance's config — the engine reads config **only** per-instance (no ambient pointer) |
| `storage` | the app's `Storage` |
| `layerPanel` | this instance's panel, lazily built from the registered `createPanel` |
| `datasets` | delegates to `app.datasets` — **shared with every map on the app** |
| `layers` / `namedLayers` | per-map registries; `namedLayers` = displayed user-file layers |
| `$(sel)` / `$$(sel)` | querySelector[All] **scoped to this root** |
| `on/off/emit(evt, payload)` | delegates to the app bus |
| `addDataset(source, options?)` | parse → `Dataset`, registered in `datasets` |
| `addLayer(type, opts?)` | construct a registered layer type → `Layer` |
| `getLayer(id)` / `getLayerByName(name)` | → `Layer \| null` |
| `registerNamedLayer(name, layer)` | index a layer under a filename |
| `removeLayer(idOrLayer)` | tear down + unregister |
| `registerAction(name, fn)` / `registerActions(map)` / `bindActions()` / `actionNames` | `data-action` handlers |
| `destroy()` | best-effort teardown; releases the map from its app |

### Delegated actions

Markup declares actions; one listener per instance dispatches them:

```html
<button data-action="doThing">Go</button>
<input data-action="setThing" data-on="change" data-args='["fd", 2]'>
```

Handlers run as `fn.call(element, ...args)` — `this` is the element (mirrors inline handlers). `data-on` is
**required** for non-click events (a checkbox fires both `click` and `change`, which would double-fire).

---

## Configuration

Passed to `mount()`/`create()`. **Set-once — locked after the first boot.**

| Option | Default | Notes |
|---|---|---|
| `provider` | `'google'` | Map backend for `createMap()`. Built in: `'google'`, `'leaflet'`. `registerMapProvider(name, {...})` adds another. |
| `apiKey` | `''` (build env) | Google Maps JS API key. **Required only if `provider` requires one** (`providerRequiresApiKey(name)`). |
| `dataSource` | `''` | Base URL for your data. The engine ships **no** deployment topology; only meaningful to a registered runtime (the bare-map path ignores it). |
| `corsProxy` | `''` | CORS proxy base. |
| `resolveUrl` | `null` | `(url, cfg) => string` — rewrite every fetched URL. `null` → identity. |
| `gdalPath` | jsDelivr CDN | Where gdal3.js loads its wasm/data. |
| `storage` | `null` | `{ name, version?, tables? }`. **No default** — the host owns the schema; `app.storage` throws until set. |
| `theme` | — | `{ bgColor, olColor, hlColor, bColor }` → CSS custom properties. |

`center`/`zoom` are read by the app runtime, not the engine.

**URL resolution** — `resolveUrl` keeps one deployment's topology out of the library (without it, URLs are
returned unchanged):

```js
mount('#fim', { apiKey, dataSource: 'https://data.example/', corsProxy: 'https://proxy.example/',
  resolveUrl: (url, cfg) => url.startsWith('https://third-party.example') ? cfg.corsProxy + url : url });
```

`isLoopbackHost(hostname)` is exported from `fimviz/src/package/config.js` for dev-vs-production detection
(handles `localhost`, `127.0.0.0/8`, `::1`/`[::1]`, the `.localhost` TLD).

---

## Events

Subscribe on a `FimMap` (`fim.on`) or the app (`FimViz.current().on`).

| Event | Payload | Fired by |
|---|---|---|
| `ready` | — | boot completed |
| `error` | `Error` with `.code` | boot failures, invalid API key, GDAL init |
| `busy` | `{ active, source }` | long work started / finished |
| `raster:metadata` | `{ title, name, rows, specRows, showSupp }` | a raster's metadata is ready |
| `raster:metadata-hidden` | `{}` | that metadata is no longer current |
| `velocity:activated`/`velocity:removed` | field data | the velocity layer |
| `ensemble:activated`/`ensemble:removed` | ensemble data | the ensemble layer |
| `` `${type}:rendered` `` / `` `${type}:removed` `` | `{ layer, … }` | **any** `Layer` (below) |

A `Layer` also fires `hover` on its own emitter while the cursor is over it, carrying the reading under
the pointer (`{ lat, lng, value, text, unit }`) — build whatever readout you like from it.

Error codes: `already-mounted`, `config-invalid`, `boot-failed`, `invalid-api-key`, `gdal-init-failed`.

**One event, two subscriptions.** A `Layer` fires on its own emitter **and** forwards to the owning map's
bus namespaced by type, so these are the same event:

```js
layer.on('rendered', fn);            // this ONE layer
fim.on('userRaster:rendered', fn);   // ANY layer of that type on this map
```

A host also emits to its own UI through the same sink — `notify`, `storage:changed`, `upload:complete` are
conventions the reference app uses.

**The engine names no element of yours.** It never looks up an id, sets a `style`, or writes text into
your page — it reports *what happened* and you decide what that looks like. `busy` is the clearest case:
the engine says it is working, and whether that means a spinner, a cursor or nothing is entirely yours.
`examples/depth-events.html` is a host with none of the reference app's markup, driving its own spinner,
hover readout and legend from these events alone.

---

## `Dataset`

A parsed source in its **native CRS**. Not on the map until a `Layer` renders it; one Dataset backs many
Layers. The unit of storage/reuse; imports no infrastructure (constructible/testable without GDAL).

> **Note:** the shipped model is a **lazy, immutable op-chain** — `reproject`/`select`/`mask`/`clip`/
> `reclassify`/`combine` are methods returning **new** lazy Datasets, and nothing decodes until a terminal
> (`load`/`grid`/`features`/`zonalStats`) forces it. Full reference:
> [DATASET_OPERATIONS.md](./DATASET_OPERATIONS.md).

```js
const ds = new Dataset({ id, name, kind, format, crs, bounds, meta, data });
```

| Field | Notes |
|---|---|
| `id` / `name` | stable string id (auto) / filename or label |
| `kind` | `'raster'` \| `'vector'` |
| `format` | `'geotiff'` \| `'geojson'` \| `'kml'` \| `'kmz'` \| `'shp'` \| `'hazus'` |
| `crs` | e.g. `'EPSG:26915'` — **native**, `null` when unknown |
| `bounds` | `{ north, south, east, west }` in `crs` |
| `meta` | pixel dims, no-data, bands, GDAL legend/unit, feature counts… |
| `data` | `ArrayBuffer` (raster) \| object (parsed GeoJSON) |

```js
ds.download();                  // save the original bytes/content to disk
ds.toRecord();                  // structured-cloneable record (source + op recipe; { storeMaterialized } embeds the decode)
Dataset.fromRecord(record);     // rehydrate — required: structured clone drops prototypes
ds.toJSON();                    // metadata view, without the heavy `data` payload
```

`toRecord()`/`fromRecord()` are what you hand to [`Storage`](#storage) — serialization lives on the type
that knows the format.

---

## `warp`

```js
const wgs84 = await warp(ds, 'EPSG:4326');   // → a NEW Dataset; the input is untouched
```

**Two names, because there are two behaviours.** `warp(ds, crs)` is the **eager** free function — it
warps immediately. `ds.reproject(crs)` is the **lazy** `Dataset` op — it returns an unforced node and
nothing warps until a terminal (`grid()`/`load()`) forces it. Both dispatch to the same GDAL warp.

Explicit by design: an implicit warp makes parse cost non-deterministic (the first lazily pulls ~38 MB of
GDAL wasm from a CDN) and destroys GDAL metadata tags. **Browser-only** — gdal3.js can't run under Node.

---

## `Storage`

A **generic** key-value store over IndexedDB — knows nothing about Datasets or FIMViz; you supply the
database name, table names, and keys. **Full usage guide (version-management primitives, `map()`
data-migration, `clearAll`, connection lifecycle): [docs/usage/STORAGE.md](./STORAGE.md).**

```js
const db = new Storage({ name: 'my-store', version: 1, tables: ['userFiles'] });
const userFiles = db.table('userFiles');             // row ops scoped to one table
await userFiles.put('x.tif', ds.toRecord());         // value stored VERBATIM
Dataset.fromRecord(await userFiles.get('x.tif'));
```

| Method | Returns |
|---|---|
| `name` | database name |
| `tables()` | `string[]` |
| `createTable(t)` / `dropTable(t)` | `boolean` (false if no-op); bumps the DB version |
| `put(table, key, value)` | the key |
| `get(table, key)` | value \| `undefined` |
| `has(table, key)` | `boolean` (distinguishes a stored `undefined` from missing) |
| `delete(table, key)` / `clear(table)` | `true` |
| `list(table, { keys?, range? })` | `[{key, value}]`, or `key[]` with `{ keys: true }` |
| `map(table, fn)` | in-key-order transform (`fn(key,value)` → value \| `Storage.DELETE` \| `undefined`); the DATA-migration primitive |
| `clearAll()` | wipe every store, keep the schema |
| `close()` / `destroy()` | drop the connection (data persists) / delete the database |

**Values are stored verbatim** — anything structured-cloneable (ArrayBuffer, TypedArray, Blob, File, Map,
Set, Date, objects). `JSON.stringify(arrayBuffer)` is `"{}"` (silent total loss). Keys are **out-of-line**,
which is what makes verbatim storage possible. A resolved write has really **committed** (awaits transaction
completion); a broken read **rejects** rather than resolving `undefined`. Scope edge: not a database library
— no query DSL, index management, or migrations. `resetTablesOnUpgrade` (constructor) drops-and-recreates
the declared tables on a version bump (a host's "a schema change accepts data loss" policy).

---

## `ColorScale`

The mutable value→(colour, label) engine. **Full usage guide with worked examples for every mode:
[docs/usage/COLOR_SCALE.md](./COLOR_SCALE.md).** Three mutually-exclusive modes: **palette**
(`{ palette, min, max, continuous }`, colour computed per value), **explicit stops** (`[{ value|range,
color, label }]`, colour looked up, no interpolation), and **continuous color stops** (`setColorStops`
— arbitrary breakpoint values, each with its own colour, interpolated between the nearest pair).

```js
const cs   = new ColorScale({ palette: 'viridis', min: 0, max: 10, continuous: false, unit: 'm' });
const gdal = ColorScale.fromGdalLegend(stops, 'm');
```

| Read | | Write (chainable, fires `onChange`) | |
|---|---|---|---|
| `getStops()` | `[{ min?, max?, value?, color, label }]` | `set({ palette })` | back to palette mode |
| `getValues()` | breakpoint values | `setStops(stops)` | explicit/classed mode |
| `getRange(i)` | `{ min, max }` for band `i` | `setColorStops(values, colors)` | continuous control-point mode |
| `getColor(v)` | css string \| `null` | `set({ continuous })` / `set({ min, max })` | |
| `getRgb(v)` | `[r,g,b]` (hot path) \| `null` | `setRange(i,{min,max})` / `setColor(i,c)` / `setLabel(i,s)` | per-band; materializes to explicit stops |
| `kind`/`isExplicit`/`discrete`/`source` | `'continuous'`\|`'classed'`; provenance | `colorFor = v => hex\|css\|null` | escape hatch; overrides when non-null |
| | | `onChange(fn)` / `offChange(fn)` | repaint hook |

An unknown palette **throws**, listing the available names.

### Palettes

```js
PALETTES              // built-ins: blues, grayscale, rainbow, heat, viridis, terrain, reds, plasma
registerPalette(name, colors)   // colors: >= 2 hex strings
hasPalette(name) → boolean      paletteNames() → string[]   // built-in + registered
```

---

## `Legend`

A read-model derived from a `ColorScale`. **Full usage guide:** [docs/usage/LEGEND.md](./LEGEND.md).

```js
const legend = Legend.fromColorScale(cs);
new Legend({ unit, kind, source, stops });
legend.toJSON();   // { unit, kind, source, stops[] } — data-complete
legend.toHtml();   // convenience renderer;  legend.formatLabel / formatValue = host hooks
```

---

## `Stats`

Pure computation, extracted out of the DOM path.

```js
Stats.raster(pixelData, meta, { filter?, classify?, skipZero?, bins? })   // meta: { bw,bs,be,bn, width,height, noData?, unit? }
Stats.vector(source, { filter? })     // source: GeoJSON (FeatureCollection|Feature|Feature[]|VectorFeatures)
                                      //         OR a google.maps.Data layer. classify: a ColorScale to bucket byClass
```

| Method | | Fields |
|---|---|---|
| `percentile(p)` | | raster: `min, max, mean, count, histogram, area, byClass?` |
| `diff(other)` | compare two Stats | vector: `featureCount, byType, area, length, bbox, propertySummary?` |
| `describe()` | human summary | |
| `toJSON()` / `toCSV()` / `download(name)` | | |

> `filter` accepts a `Filter`, a function, or an **array of Filters** (AND). To scope by a **polygon**, wrap
> it in a `SpatialFilter` — a raw array is read as a filter list, not a ring.

---

## Filters

Scope a `Stats` computation — or any per-unit test — to a region or predicate.

```js
new SpatialFilter([{lat, lng}, …])          // one ring
new SpatialFilter([[ring], [ring]])         // multi-polygon (union)
new PredicateFilter((v, x, y, at) => v > 5)  // raster; or (feature) => … for vectors
Filter.from(fnOrFilterOrPolygon)   // → a Filter        Filter.all([f1, f2])   // → conjunction (AND)
```

| Member | Notes |
|---|---|
| `test(unit)` | `unit` = `{ value, x, y, lat, lng, at }` (raster) or `{ feature, lat, lng }` (vector) |
| `isEmpty()` | a degenerate region (< 3 points) |
| `SpatialFilter.contains(lat, lng)` | point-in-polygon (any ring) |
| `SpatialFilter.pixelBbox(meta)` | fast-reject window in pixel space |

The base `Filter.test()` is permissive, so an absent filter never excludes anything.

---

## `Layer`

A rendered visualization of one or more Datasets. `RasterLayer`/`VectorLayer` differ by `type`; divergent
renderers get their own subclass. Full reference: [LAYERS.md](./LAYERS.md) and
[LAYER_SUBTYPES.md](./LAYER_SUBTYPES.md).

```js
const layer = await fim.addLayer('vector', { source: ds });   // 'vector' is the engine's own built-in type
registerLayerType('my-type', (fim, opts) => new RasterLayer({ ...opts, type: 'my-type' }));
```

`'vector'` is the only type the **library** registers itself (raster overlays extend
`google.maps.OverlayView`, so a generic raster type isn't provider-safe to ship). `'depth'`/`'ensemble'`/
`'velocity'`/`'comparison'`/`'ensembleAgreement'` are also engine-registered but expect FIM-shaped data;
`'extent'`/`'damage'`/`'userRaster'` are registered only by a host. `addLayer` with an unregistered
type throws with the current list.

| Member | Notes |
|---|---|
| `id` / `type` / `sources` / `visible` / `map` / `dataset` | `dataset` = `sources[0]` |
| `render(opts)` / `compute(opts)` | `render` = compute → CRS precondition → draw; `render: 'auto'\|'in-place'\|'recreate'` |
| `setSources(ds[], opts)` / `deriveSources(fn, opts)` | swap sources (cold) / hot-modify (reuse memoized ancestors) |
| `settings` / `set(partial)` / `get()` | the `LayerSettings` change-model (palette/opacity/hover/noData…) |
| `on/off/once/emit(evt, payload)` | Evented (`L.Evented` style) |
| `show()` / `hide()` / `fit()` | |
| `remove()` | runs teardown, emits `'removed'` **synchronously**, unregisters |
| `getLegend()` / `getStats()` / `hitTest(lat,lng)` | subclasses specialize; `RasterLayer` adds `valueAt(lat,lng)`, `enableHover()`/`disableHover()` (see [LAYER_SUBTYPES.md](./LAYER_SUBTYPES.md)) |
| `toJSON()` | |

Lifecycle events: `'rendered'`/`'removed'`, payload `{ layer, …extra }`. **A Layer never names a UI panel or
DOM id** — it emits, UI subscribes.

---

## From file to rendered layer

There is no single `uploadFile()` call. Getting a user's file onto the map is always the same shape —
**parse → (maybe reproject) → construct/render a Layer** — composed explicitly, so a headless consumer
can stop after step 1 (just wanting the Dataset — stats, a colour scale, `ds.download()`) without
paying for a map at all.

### 1. Parse → `Dataset`

```js
const ds = await fim.addDataset(file);       // File | Blob | ArrayBuffer | URL string — also registers on fim.datasets
const ds2 = await FimViz.parseFile(file); // same parse, no instance, no side effect
```

Format is auto-detected; see [`parseFile`](#fimviz-namespace) for the supported list. **`ds.crs` is
the file's native CRS** (`null` when unknown) — parsing never reprojects.

Merely importing anything from `'fimviz'` is enough to make `ds.load()`/`ds.grid()`/`layer.render()`
work for every built-in format out of the box — the barrel re-exports from `io/materializers.js`,
and that module self-registers its geotiff/vector decoders as one of its own import side effects.
Nothing to call explicitly.

### 2. Reproject, if needed

The built-in map providers only render the WGS84 family (`EPSG:4326`/`4269`); `geojson`/`kml`/`kmz`/
`shp`/`csv`/`xyz` are already WGS84 by spec, so this is a **raster-only** concern:

```js
if (ds.kind === 'raster' && ds.crs && !providerAcceptsCRS(fim.config.provider, ds.crs)) {
  ds = await warp(ds, 'EPSG:4326');   // → a NEW Dataset (GDAL WASM; browser-only, first call is slow)
}
```

Skip this and `layer.render()` throws a clear `"…cannot render CRS "…". Reproject first: …"` instead of
drawing a blank overlay (`Layer`'s CRS precondition) — the engine never reprojects silently. *(The lazy
`ds.reproject(crs)` op is the lazy alternative to the eager `warp()` function above — both dispatch through
the same GDAL warp seam, and neither needs an explicit `registerGdalReprojector()` call: `lib.js` wires it
as a JIT default loader, so the first reproject anyone forces triggers exactly one dynamic `import()` of
the GDAL path. `registerGdalReprojector()` exists for a host that wants to pre-warm GDAL ahead of
first use.)*

### 3. Construct and render a `Layer`

**Vector** — `'vector'` is the one generic type the engine registers itself, so `addLayer` both
constructs and renders:

```js
const layer = await fim.addLayer('vector', {
  source: ds,
  style: { fillColor: '#58a6ff', fillOpacity: 0.3, strokeColor: '#1f6feb', strokeWidth: 2 },
});
```

**Raster** — there is no generic registered raster type (raster overlays extend
`google.maps.OverlayView`, which isn't provider-safe to ship as a one-size-fits-all factory), so
construct a `RasterLayer` directly and render it:

```js
const layer = new RasterLayer({ map: fim, sources: [ds], noData: -99999 });
await layer.render();   // compute() [ds.grid()] → CRS precondition → colorize → provider.addRasterImage → 'rendered'
layer.set({ colorScale: new ColorScale({ palette: 'viridis', min: 0, max: 46, continuous: true, unit: 'm' }) });
```

`render()` calls `compute()` for you when `layer.result` is still empty, so `await layer.render()` alone
is enough; calling them separately only matters when you want to inspect `layer.result` before drawing.

### Tracking + tearing down

Neither `addLayer` nor `new RasterLayer`/`new VectorLayer` registers a layer under a filename by
themselves — do that explicitly for a file-list UI:

```js
fim.registerNamedLayer(file.name, layer);   // evicts any prior layer already registered under that name
// …
fim.getLayerByName(file.name)?.remove();    // teardown, 'removed', drops from both fim.layers and this index
```

`layer.remove()` alone also works (teardown + synchronous `'removed'` + drops from `fim.layers`) — the
named registry is only needed for filename-keyed lookup.

`'comparison'`/`'ensembleAgreement'` are also engine-registered (see their sections above) but expect
**aligned raster sets**, not a single uploaded file; `'depth'`/`'ensemble'`/`'velocity'` are
engine-registered too but read FIM-specific service config, not a user file. `addLayer` with an
unregistered type throws with the current registered-types list.

---

## Vendored primitives

Re-exported so consumers never name the underlying packages directly (the engine is the single owner):

```js
fromArrayBuffer(buf)   // geotiff — raster pixel access
kml(xmlDocument)       // @tmcw/togeojson — KML → GeoJSON
shp(arrayBuffer)       // shpjs — zipped shapefile → GeoJSON
Loader                 // @googlemaps/js-api-loader — the Maps script loader
```

> Importing bare `fimviz` pulls `Loader` (CommonJS) and breaks under `node --test`. For the parse primitives
> alone use `fimviz/src/io/parsePrimitives.js`.

---

## GDAL

`gdal3.js` is bundled but its ~38 MB `.wasm`/`.data` are **not** — they load from a version-pinned CDN, and
**only on the first reprojection that needs them** (a widget that never reprojects downloads nothing).
Self-host with `mount('#fim', { apiKey, gdalPath: '/my/static/gdal' })`. GDAL is **process-global** (one
Emscripten module per page, so the first `gdalPath` wins; a later different path warns). Runs with
`useWorker: false`, so basic reprojection does **not** require `SharedArrayBuffer`/COOP-COEP.

## Hosting notes

- **Container height is required** — Google Maps renders blank in a zero-height box.
- **COOP/COEP** only needed for `SharedArrayBuffer`-backed GDAL threading (`Cross-Origin-Opener-Policy:
  same-origin` + `Cross-Origin-Embedder-Policy: require-corp`).
- **IndexedDB** and `fetch` don't work from `file://` — serve over HTTP.

## Security

The Google Maps API key passed to `mount({ apiKey })` ends up in the client bundle (unavoidable for a
browser Maps key). **Restrict it** (HTTP-referrer + API restrictions in the Google Cloud console) rather
than relying on secrecy.

## Limitations

- **The full FIMViz widget needs a registered runtime** — the library ships no UI tier for it. A bare
  `mount()` gives a plain map, not that chrome.
- **The raster overlay tier is Google-only.** The map-provider seam (`createMap`, `VectorLayer`) covers a
  plain map + vector layers on `'google'` or `'leaflet'`; raster overlays (`RasterLayer`, flood extent/depth/
  velocity) extend `google.maps.OverlayView` — inheritance, not a provider call — so they render on Google
  only, regardless of `provider`. *(The static-raster-image tier — `addRasterImage` — works on both.)*
- **One live widget per default `FimViz`** — a second `mount()` throws `already-mounted`; pass `{ isolated:
  true }` for a second widget (its own `FimViz`, storage, event bus; in-page, not an iframe).
- **`destroy()` is best-effort** — re-mounting after destroy is not fully supported.
- **Reprojection is browser-only** — `warp()` and `ds.reproject()` both need gdal3.js, which has no Node build.
- **Multi-instance config is instance-safe** — the engine reads config only via `fim.config` (no shared
  ambient pointer), so two isolated apps never read each other's settings. The one process-global setting is
  `gdalPath` (GDAL is a per-page singleton, so its load path can't be per-instance).
- English-only UI; theming limited to the documented CSS variables.
