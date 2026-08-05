# App startup & file upload — usage reference

Part 2 ([APP_STARTUP_ADVANCED.md](./APP_STARTUP_ADVANCED.md)): the map-provider seam, the
materialize/decode extension seam, and `FimMap`'s fuller instance API.

## Contents

[Mounting](#mounting) · [Options](#options) · [Two boot paths](#two-boot-paths) ·
[Multiple maps on one page](#multiple-maps-on-one-page) ·
[Listening before resolution](#listening-before-resolution) ·
[Namespace-level parse](#namespace-level-parse-no-map-needed) · [Teardown](#teardown) ·
[Uploading files](#uploading-files-drag-and-drop) · [Getting it on the map](#getting-it-on-the-map) ·
[The CRS check](#the-crs-check)

## Mounting

```js
import { FimViz, mount } from 'fimviz';   // or: FimViz.mount / FimViz.create

const fim = await mount(target, options);        // === FimViz.mount === FimViz.create (all aliases)
```

Everything on this page comes off the `fimviz` barrel; for the other published specifiers
(`fimviz/ui`, `fimviz/src`, `fimviz/src/*`) see [USAGE.md → Subpaths](./USAGE.md#subpaths).

`target`: an `Element`, its id string, or a CSS selector. Returns a `Promise<FimMap>` that ALSO has
`.on(evt, fn)`/`.off(evt, fn)` glued on *before* it resolves — so `mount(el, opts).on('ready', fn)`
works even though `mount()` hasn't finished yet.

**`await` it before calling instance methods.** Because `.on`/`.off` work on the un-awaited promise,
it looks partly like a `FimMap`, and treating it as one is an easy mistake:

```js
const fim = mount('#el', opts);          // ✗ fim is a Promise
await fim.addLayer(ds);                  // → throws, naming the fix

const fim = await mount('#el', opts);    // ✓
```

Accessing any `FimMap` member on an un-awaited promise **throws**, naming both the cause and the fix.
Only `.on()`/`.off()` are available before it resolves.

### Options

| Key | Default | Notes |
|---|---|---|
| `provider` | — (**required**) | `'leaflet'` \| `'google'` \| a registered name. **No default** — the backends differ in credentials *and* capability (`'leaflet'`: no key, map + vectors + static rasters; `'google'`: needs `apiKey`, adds velocity, damage markers and ArcGIS depth), so the engine never picks for you. Omitting it throws `config-invalid` naming both. |
| `apiKey` | `''` (build-time `GOOGLE_MAPS_API_KEY`) | Required when `provider` needs one (`google` does; `leaflet` doesn't) — throws `config-invalid` otherwise. |
| `center` | `null` (provider default) | `{lat, lng}`. |
| `zoom` | `null` (provider default) | number. |
| `mapId` | `null` | Google-only; required for `AdvancedMarkerElement`. |
| `mapOptions` | `{}` | Raw provider options, merged **last** — wins over every derived option above. |
| `dataSource` / `corsProxy` | `''` | Deployment topology the engine ships none of — see `resolveUrl`. |
| `resolveUrl` | `null` | `(url, cfg) => string` — override every fetched URL (CORS proxy/auth/mirrors). `null` = identity (no rewriting) unless a host runtime supplies its own. |
| `gdalPath` | version-pinned jsDelivr CDN | Where `gdal3.js` loads its wasm/data from (lazy — only fetched on first real reproject). |
| `storage` | `null` | `{name, version?, tables?}` — `fim.storage` throws until set; the engine names no database. |
| `theme` | — | `{bgColor, olColor, hlColor, bColor}` → the widget's CSS custom properties. |
| `isolated` | `false` | `true` gives this map its **own** `FimViz` instance instead of the shared default — see "Multiple maps" below. |

Config is **set-once**: `create()` locks it the moment a boot starts. A later `app.configure(...)` is
then ignored with a console warning rather than reconfiguring — and a second `mount()` on the same
app never gets that far, since the single-map guard throws `already-mounted` first (see
[Multiple maps](#multiple-maps-on-one-page)).

Three things `mount()` rejects before booting anything, all as `config-invalid`: a missing `provider`,
a provider that `requiresApiKey` with no `apiKey` given, and a `target` that resolves to no element.

### Two boot paths

- **No runtime registered** (bare `import {mount} from 'fimviz'`, nothing else): `create()` builds a
  real, working map itself via the map-provider seam straight into an injected `<div id="map">` — no
  FIMViz widget chrome (no Layer Panel, no flood layers), just a plain map.
- **A runtime is registered** (a host supplies one): the FULL widget boots instead.

```js
FimViz.registerRuntime({ bootstrap, getMountedMap, teardownMap, createPanel, markup });   // call BEFORE mount()
await mount('#el', { apiKey });
```

`registerRuntime` must run before `mount()` — `create()` reads the registered runtime once, at boot.
`bootstrap(fim)` receives the `FimMap` being mounted, so a runtime never has to look up which instance
it is booting. `fim.map` is still `null` at that point — the engine adopts the map once `bootstrap()`
resolves — so hold the reference, but read `fim.map` only afterwards.

### Markup injection

`mount()` injects markup into your container, unless **that container** already holds a `#map`. A
container you have already populated is left untouched, so you can supply the widget DOM inline. The
check is scoped to the container: a `#map` elsewhere on the page is unrelated and does not suppress
injection, which is what lets two widgets mount on one page.

What gets injected depends on the boot path: with no runtime it's a bare
`<div id="map" style="width:100%;height:100%">` for the engine to boot into; with a runtime it's that
runtime's `markup`. A runtime that registers **no** `markup` while the container has no `#map` is an
error, not a silent empty map — `mount()` throws `config-invalid` naming both fixes (pass `markup`,
or put `#map` in the page yourself).

### Multiple maps on one page

The default app allows **one** mounted map (`app.hasMaps` guards it — a second `mount()` on the
default app throws `"already mounted"`). To run a second, independent map (a different provider, a
different config), give it its own app:

```js
const fim1 = await mount('#lmap', { provider: 'leaflet' });
const fim2 = await mount('#gmap', { provider: 'google', apiKey: '...', isolated: true });   // own FimViz
```

### Listening before resolution

```js
mount('#el', opts)
  .on('ready', () => console.log('booted'))
  .on('error', (e) => console.error(e.code, e.message));
```

### Namespace-level parse (no map needed)

```js
const ds = await FimViz.parseFile(source, options);   // pure — no FimMap instance, no registration
```

### Teardown

```js
fim.destroy();   // detaches the map, clears injected markup, releases this map from its app
```

## Uploading files (drag-and-drop)

```js
let file = undefined;
let f1 = undefined;
const dropzone = document.getElementById('dropzone');
dropzone.addEventListener('dragover', (e) => e.preventDefault());   // required, or the browser rejects the drop
dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  file = e.dataTransfer.files[0];
  if (file) f1 =  await fim.addDataset(file);   // ⚠️ addDataset is ASYNC - needs await or then() 
});
```

`fim.addDataset(source, options?)` accepts `File | Blob | ArrayBuffer | string (URL)`. It parses (format
auto-detected from filename/extension unless `options.format` is given) into a `Dataset` and pushes
it onto `fim.datasets` — it does **not** render anything yet.

Recognised formats: `geotiff` (.tif/.tiff), `geojson` (.geojson/.json, incl. HAZUS damage), `kml`,
`kmz`, `shp` (a .zip carrying .shp/.dbf/.shx), `csv`, and `xyz`. The last two take their own
`options` — a `latField`/`lngField` column pair or a `geometryField` of WKT/GeoJSON for CSV,
`swapXY` for northing-first XYZ — and `csvHeaders(text)` reads a CSV's column names *before* parsing
so you can build a mapping picker; see
[LAYER_SUBTYPES.md → Building from CSV/XYZ](./LAYER_SUBTYPES.md#building-from-csvxyz-both-produce-a-vector-dataset--vectorlayer).

### Getting it on the map

```js
let l1 = await fim.addLayer(f1);   // infers 'raster'/'vector' from f1.kind (works with no type arg)
// or, if f1's raw file is what you have and haven't called addDataset yet:
let l1 = await fim.addLayer(file);   // addLayer parses it via addDataset() for you, same effect
```

### The CRS check

`addDataset`/`parseFile` **never reprojects** — a geotiff Dataset comes back in its own native CRS. If
that CRS isn't one the active map provider can render (`google`/`leaflet` accept the WGS84 family,
`EPSG:4326`/`4269`), `addLayer`/`render()` throws an actionable error naming the fix:

```js
let f1 = await fim.addDataset(file);
f1.crs;                                    // e.g. 'EPSG:26914' — check before rendering
let l1 = await fim.addLayer(f1.reproject('EPSG:4326'));   // reproject() is lazy; forcing (inside
                                                            // addLayer→render→compute) triggers the
                                                            // actual warp, auto-loaded, no setup call
```

See [DATASET_OPERATIONS.md](./DATASET_OPERATIONS.md) for every other Dataset op you can chain in
before rendering (`clip`/`mask`/`resampleTo`/...), and [LAYERS.md](./LAYERS.md) /
[LAYER_SUBTYPES.md](./LAYER_SUBTYPES.md) for what to do with `l1` once it's up.
