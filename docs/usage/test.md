# Console snippets — usage reference

A companion to the docs in this folder ([USAGE.md](./USAGE.md), [APP_STARTUP.md](./APP_STARTUP.md),
[APP_STARTUP_ADVANCED.md](./APP_STARTUP_ADVANCED.md), [LAYERS.md](./LAYERS.md),
[LAYER_SUBTYPES.md](./LAYER_SUBTYPES.md), [STORAGE.md](./STORAGE.md),
[COLOR_SCALE.md](./COLOR_SCALE.md), [LEGEND.md](./LEGEND.md), [UI.md](./UI.md),
[DATASET_OPERATIONS.md](./DATASET_OPERATIONS.md)) — one runnable snippet per documented method, in the
same order as the doc that names it, so you can walk a doc top-to-bottom and paste the matching block
into the console to check it still behaves as written. Not a test suite (no assertions) — read the
printed value yourself, same spirit as `examples/method-playground.html`.

## Contents

[Setup](#setup) · [1. USAGE.md](#1-usagemd) · [2. APP_STARTUP.md](#2-app_startupmd) ·
[3. APP_STARTUP_ADVANCED.md](#3-app_startup_advancedmd) · [4. LAYERS.md](#4-layersmd) ·
[5. LAYER_SUBTYPES.md](#5-layer_subtypesmd) · [6. STORAGE.md](#6-storagemd) ·
[7. COLOR_SCALE.md](#7-color_scalemd) · [8. LEGEND.md](#8-legendmd) · [9. UI.md](#9-uimd) ·
[10. DATASET_OPERATIONS.md](#10-dataset_operationsmd)

---

## Setup

These snippets assume a page that has booted a `FimMap` and exposed the package on `window` — a real,
booted `FimMap` as `window.fim` plus every export these snippets use callable directly. Any host page
that does `import * as FIM from 'fimviz'; import * as UI from 'fimviz/ui';
Object.assign(window, FIM, UI)` and mounts a map will do — the UI module is a separate entry, so both
imports are needed. `examples/console-test.html` and `examples/method-playground.html` are two such
pages you can open in a browser.

Registries are reached through the type that owns them (`Layer.registerType`,
`ColorScale.registerPalette`, `Dataset.registerMaterializer`, `FimViz.registerMapProvider`, …), so
those calls appear qualified below rather than as bare globals.

Wait for `window.fim` to exist (`mount()` resolves asynchronously — the app's own `.then` sets it):

```js
fim              // FimMap — should already be your booted map
FimViz           // the namespace
Dataset, Storage, Layer, RasterLayer, VectorLayer, ColorScale, Legend, Stats, Filter, SpatialFilter
```

A small fetch helper + a bounds→Stats-shaped-meta helper, used throughout below:

```js
async function urlToFile(url, name, type = 'application/octet-stream') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return new File([await res.blob()], name, { type });
}
// RasterGrid.bounds is {north,south,east,west}; several functions (Stats.raster, resampleGrid,
// alignRasters, resolveTargetGrid) instead want the flat {bw,bs,be,bn,width,height} shape.
function gridMeta(grid, extra = {}) {
  const b = grid.bounds || {};
  return { bw: b.west, bs: b.south, be: b.east, bn: b.north, width: grid.width, height: grid.height,
    noData: grid.noData, ...extra };
}
```

Sample files this doc reuses (served by the dev app under `/assets/SampleFiles/`):

```js
const RASTER_URL  = '/assets/SampleFiles/4326.tif';                  // WGS84 already, per filename
const DEPTH_URL   = '/assets/SampleFiles/Brazos_RP100_depth.tif';    // a second, differently-shaped raster
const CMP_A_URL   = '/assets/SampleFiles/Compare_0-0-DEP-12840.tif'; // two aligned extent rasters —
const CMP_B_URL   = '/assets/SampleFiles/Compare_0-0-DEP-17780.tif'; //   good for Comparison/Ensemble tests
const GEOJSON_URL = '/assets/SampleFiles/Iowa_city.json';
const KMZ_URL     = '/assets/SampleFiles/ames.kmz';
```

One raster + one vector Dataset, reused across sections (re-run this any time you reload the page):

```js
const rasterFile = await urlToFile(RASTER_URL, '4326.tif', 'image/tiff');
let ds = await fim.addDataset(rasterFile);           // → Dataset, kind:'raster'
console.log(ds.kind, ds.format, ds.crs, ds.bounds);

const vectorFile = await urlToFile(GEOJSON_URL, 'Iowa_city.json', 'application/geo+json');
const dsVector = await fim.addDataset(vectorFile);   // → Dataset, kind:'vector'
console.log(dsVector.kind, dsVector.format, dsVector.crs, dsVector.bounds);

const grid = await ds.grid();                     // decode once, reuse below
console.log(grid.width, grid.height, grid.bounds, grid.noData);
```

---

## 1. USAGE.md

### `FimViz` namespace

```js
FimViz.current();                 // → this page's FimVizInstance (or null before boot)
FimViz.current().config;          // this app's locked config
FimViz.current().maps;            // → [fim] (the one mounted map)
FimViz.current().isDefault;       // true (the dev site never passes {isolated:true})
FimViz.current().hasMaps;         // true

const dsHead = await FimViz.parseFile(rasterFile);   // pure — no instance, no side effect
dsHead.toJSON();
```

### `FimMap` instance

```js
fim.root; fim.app; fim.map; fim.map === fim.map;
fim.config;
fim.storage;             // ⚠️ THROWS on the dev site — SITE_CONFIG passes no `storage` option
fim.layerPanel;          // the app's real Layer Panel (this map has a registered runtime)
fim.datasets;            // Dataset[] — includes ds/dsVector from Setup
fim.layers;              // Layer[]
fim.namedLayers;         // Layer[] — the subset registered under a filename
fim.$('#layer-panel');   // scoped querySelector (root-relative, not document-relative)
fim.$$('.layer-toggle-window');
```

Delegated actions (`data-action` markup) — see [4. LAYERS.md](#4-layersmd) below for
`registerAction`/`registerActions`/`bindActions`/`actionNames`; the widget's own `widget.html` already
uses this mechanism, so `fim.actionNames.length > 0` should already be true on the dev site.

### Configuration

```js
fim.config.provider;      // 'google' on the dev site
fim.config.apiKey;        // present, truthy
fim.config.dataSource;    // SITE_CONFIG.dataSource
fim.config.corsProxy;
fim.config.resolveUrl;    // siteResolveUrl — a function
fim.config.gdalPath;
fim.config.theme;

fim.app.configure({ apiKey: 'ignored' });   // no-op + console warning — locked after boot
```

`isLoopbackHost` is an internal import (`fimviz/src/package/config.js`), not on the public
barrel, so it isn't reachable from this console hook — see it exercised directly in
`test/*.test.mjs` instead.

### Events

```js
fim.on('ready', () => console.log('(already fired before you could attach this, but wiring works)'));
fim.on('error', (e) => console.log('error event:', e.code, e.message));

// One event, two subscriptions — build any RasterLayer, then:
const evtLayer = await fim.addLayer('raster', { source: ds });
evtLayer.on('rendered', (p) => console.log('layer-local rendered', p));
fim.on(`${evtLayer.type}:rendered`, (p) => console.log('map-bus rendered', p.layer === evtLayer));
await evtLayer.render({ render: 'recreate' });   // fires both listeners above
evtLayer.remove();
```

### `Dataset` (core, not the full ops catalogue — see [§10](#10-dataset_operationsmd))

```js
ds.id; ds.name; ds.kind; ds.format; ds.crs; ds.bounds; ds.meta;
const rec = ds.toRecord();               // small — source + recipe, no decoded payload
const rehydrated = Dataset.fromRecord(rec);
rehydrated.toJSON();                      // {id,name,kind,format,crs,bounds,meta,axes}

Dataset.formats();                        // every format decodable right now

// fromGrid: the way back INTO the op chain from an already-decoded grid
const wrapped = Dataset.fromGrid(grid, { name: 'from-grid' });
wrapped.isMaterialized;                   // true — nothing to decode
(await wrapped.clip(ds.bounds).grid()).width;

// features() is iterable — no .features.features
const vf = await dsVector.features();
vf.count; vf.toArray().length; [...vf][0]?.type;
```

`ds.download()` triggers a real file save — run it manually if you want to see the browser's save
dialog; skipped here since it can't be observed from a returned value.

### `reproject` (the standalone function)

```js
// reproject() returns the SAME Dataset (no copy) when the request is a same-CRS no-op, and a NEW
// one only when a warp actually ran:
const warped = await warp(ds, 'EPSG:4326');
console.log(warped.crs, warped === ds);
```

### `Storage` (headless — see the full guide at [§6](#6-storagemd) for everything else)

```js
const db = new Storage({ name: 'test-md-store', version: 1, tables: ['userFiles'] });
const userFiles = db.table('userFiles');
await userFiles.put('x.tif', ds.toRecord());
Dataset.fromRecord(await userFiles.get('x.tif')).toJSON();
await db.destroy();   // clean up — don't leave a stray IndexedDB database behind
```

### `ColorScale` / Palettes (see the full guide at [§7](#7-color_scalemd))

```js
const cs = new ColorScale({ palette: 'viridis', min: 0, max: 10, continuous: false, unit: 'm' });
cs.getStops();
ColorScale.palettes();                              // built-in + registered
ColorScale.palettes().includes('viridis');          // true
ColorScale.palettes().includes('not-a-palette');    // false
ColorScale.registerPalette('test-md-ramp', ['#000000', '#ffffff']);
ColorScale.palettes().includes('test-md-ramp');     // true

cs.set({ missingColor: '#cccccc' });   // what an absent value (null/NaN/'') is painted
cs.missingColor;                        // survives a mode switch — it is orthogonal to the 3 modes
cs.set({ missingColor: null });         // back to "the consumer decides"
```

### `Legend` / `Stats` / Filters (full guides at [§8](#8-legendmd) and here)

```js
const legend = Legend.fromColorScale(cs);
legend.toJSON();

const stats = Stats.raster(grid.pixels, gridMeta(grid));
stats.describe();
stats.toJSON();

new SpatialFilter([{ lat: grid.bounds.south, lng: grid.bounds.west },
                   { lat: grid.bounds.north, lng: grid.bounds.west },
                   { lat: grid.bounds.north, lng: grid.bounds.east }]).isEmpty();   // false (3 points)
new PredicateFilter((v) => v > 0).test({ value: 5 });                               // true
Filter.from((v) => v > 0).test({ value: -1 });                                       // false
Filter.all([new PredicateFilter((v) => v > 0), new PredicateFilter((v) => v < 100)]).test({ value: 5 });
```

### `Layer` (base — see [§4](#4-layersmd) for the full pipeline)

```js
const vlayer = await fim.addLayer('vector', { source: dsVector,
  style: { fillColor: '#58a6ff', fillOpacity: 0.3, strokeColor: '#1f6feb', strokeWidth: 2 } });
vlayer.id; vlayer.type; vlayer.visible;
vlayer.fit();
vlayer.remove();

// Chainable ops — the Dataset ops applied to the layer's sources IMMEDIATELY, drawn once at render()
const rlayer = await fim.addLayer('raster', { source: ds });
rlayer.clip({ north: 90, south: -90, east: 180, west: -180 });
rlayer.dirty;                    // true — applied but not yet drawn
await rlayer.render();
rlayer.dirty;                    // false
await rlayer.reset();            // back to the pristine source
rlayer.remove();

### From file to rendered layer

```js
// registerNamedLayer / getLayerByName / namedLayers (the file-viewer registry) —
const l = await fim.addLayer(ds);                 // type inferred from ds.kind ('raster')
fim.registerNamedLayer('4326.tif', l);
fim.getLayerByName('4326.tif') === l;              // true
fim.namedLayers.includes(l);                       // true
fim.getLayerByName('4326.tif')?.remove();          // teardown + drops from both registries
```

### Vendored primitives

```js
const tiff = await fromArrayBuffer(await rasterFile.arrayBuffer());
(await tiff.getImage()).getWidth();

// parseFile's own kmz support (unzip + kml() internally) — a real sample file round-trip:
const kmzFile = await urlToFile(KMZ_URL, 'ames.kmz', 'application/vnd.google-earth.kmz');
const dsKmz = await fim.addDataset(kmzFile);
dsKmz.kind, dsKmz.format;   // 'vector', 'kmz'

// kml() itself takes an XML Document, not raw .kmz bytes — exercise the standalone primitive
// directly on a real .kml doc instead:
const kmlDoc = new DOMParser().parseFromString(
  '<kml><Document><Placemark><name>p</name><Point><coordinates>-90.07,29.95</coordinates></Point></Placemark></Document></kml>',
  'text/xml');
kml(kmlDoc);   // → GeoJSON FeatureCollection

const shpBuf = await (await fetch('/assets/SampleFiles/FIMS_Sample_Map_Layers.zip')).arrayBuffer();
await shp(shpBuf).catch((e) => console.log('shp() needs a real shapefile zip inside:', e.message));

typeof Loader;   // 'function' — the @googlemaps/js-api-loader class, re-exported
```

### GDAL (see `callGdal` fully covered in [§10](#10-dataset_operationsmd))

```js
fim.config.gdalPath;   // where gdal3.js loads its wasm/data from — the version-pinned CDN by default
```

---

## 2. APP_STARTUP.md

### Mounting + options

The dev site already mounted `fim` once (the default app allows exactly one). Exercise a **second,
independent** map instead of touching `fim`:

```js
const div = document.createElement('div');
div.id = 'test-md-leaflet'; div.style.cssText = 'position:fixed;bottom:8px;right:8px;width:300px;height:200px;z-index:9999;border:2px solid #58a6ff';
document.body.appendChild(div);

const fim2 = await mount(div, { provider: 'leaflet', isolated: true, center: { lat: 30, lng: -90 }, zoom: 6 });
fim2.map;                      // a real L.Map
fim2.config.provider;          // 'leaflet'
```

### Two boot paths

`fim2` above took the **no-runtime bare-map** path (nothing registered a runtime for a second,
isolated app) — confirm it has no widget chrome:

```js
fim2.layerPanel;               // null — no createPanel factory for this isolated app
fim2.root.querySelector('#layer-panel');   // null — no widget markup was injected either
```

### Multiple maps on one page

```js
fim.app.hasMaps;               // true (the default app)
fim.app === fim2.app;          // false — fim2 is isolated, its own FimVizInstance
```

### Listening before resolution

```js
const target = document.createElement('div');
target.style.cssText = 'position:fixed;bottom:8px;left:8px;width:300px;height:200px;z-index:9999;border:2px solid #3fb950';
document.body.appendChild(target);
let sawReady = false;
mount(target, { provider: 'leaflet', isolated: true })
  .on('ready', () => { sawReady = true; console.log('ready fired'); })
  .on('error', (e) => console.log('error', e.code));
```

### Namespace-level parse (no map needed)

```js
const dsHeadless = await FimViz.parseFile(rasterFile);   // no FimMap, no fim.datasets registration
fim.datasets.includes(dsHeadless);                        // false — confirms no side effect
```

### Teardown

```js
fim2.destroy();
div.remove();
```

### Uploading files (drag-and-drop)

The doc's snippet is literally the app's own `io/fileUploadSetup.js` wiring — already live on the
page. Simulate the same `addDataset` call the drop handler makes, without a real drag gesture:

```js
const dropSimFile = await urlToFile(DEPTH_URL, 'Brazos_RP100_depth.tif', 'image/tiff');
const f1 = await fim.addDataset(dropSimFile);    // async — same call fileUploadSetup.js awaits on 'drop'
f1.kind, f1.crs;
```

### Getting it on the map

```js
const l1 = await fim.addLayer(f1);            // infers 'raster' from f1.kind — no type arg needed
l1.type;                                       // 'raster'
l1.remove();
```

### The CRS check

```js
f1.crs;                                        // whatever Brazos_RP100_depth.tif declares
if (f1.crs && !FimViz.providerAcceptsCRS(fim.config.provider, f1.crs)) {
  const l2 = await fim.addLayer(f1.reproject('EPSG:4326'));   // lazy op; warp forced inside render()
  l2.remove();
} else {
  console.log('already renderable as-is:', f1.crs);
}
```

---

## 3. APP_STARTUP_ADVANCED.md

### Map provider seam

```js
FimViz.mapProviders();                       // → ['google', 'leaflet'] on a stock build
FimViz.providerAcceptsCRS('google', 'EPSG:4326'); // true
FimViz.providerAcceptsCRS('google', 'EPSG:26915');// false — needs reprojecting first
FimViz.providerAcceptsCRS('leaflet', null);       // true — unknown CRS treated permissively
```

`providerRequiresApiKey(name)` is documented in this doc's seam table but is **not** re-exported from
the barrel (only `mount.js` uses it internally) — see
[Doc/reality gaps](#docreality-gaps-found-while-writing-this) below. Exercise the same behavior
black-box instead, via the error it produces:

```js
try { await mount(document.createElement('div'), { provider: 'google', isolated: true, apiKey: '' }); }
catch (e) { console.log(e.code); }   // 'config-invalid' — proves google requires a key
await mount(document.createElement('div'), { provider: 'leaflet', isolated: true });   // no apiKey, succeeds
```

Register a trivial third provider to exercise the whole `MapProviderImpl` contract yourself:

```js
FimViz.registerMapProvider('test-md-noop', {
  requiresApiKey: false,
  acceptsCRS: (crs) => crs == null || crs === 'EPSG:4326',
  async create(el) { const d = document.createElement('div'); d.textContent = 'fake map'; el.appendChild(d); return d; },
  addVector(map, geojson, { style } = {}) { return { geojson, style }; },
  removeVector() {},
  fitBounds() {},
  addRasterImage(map, dataUrl, bounds, opts) { return { dataUrl, bounds, opts }; },
  removeRasterImage() {},
  setRasterImageOpacity() {},
  setRasterImageUrl(map, handle, dataUrl, bounds, opts) { return { dataUrl, bounds, opts }; },
  onMapMouseMove() { return () => {}; },
  onMapEvent() { return () => {}; },
});
FimViz.mapProviders().includes('test-md-noop');   // true
const fim3 = await mount(document.createElement('div'), { provider: 'test-md-noop', isolated: true });
fim3.map;   // the fake <div>"fake map"</div>
fim3.destroy();
```

### Built-in provider options

```js
const fimLeaf = await mount(document.createElement('div'),
  { provider: 'leaflet', isolated: true, center: { lat: 41.66, lng: -91.53 }, zoom: 10, tileUrl: null });
fimLeaf.map;   // an L.Map with NO default OSM tile layer (tileUrl: null)
fimLeaf.destroy();
```

### Neutral vector style vocabulary

```js
// styleToGoogle/styleToLeaflet/featuresOf/resolveFeatureStyle are internal to mapProvider.js — a
// VectorLayer applies them for you. Exercise the vocabulary through the layer instead:
const vl = await fim.addLayer('vector', { source: dsVector, style: '#ff8800' });   // bare color string shorthand
vl._style;
vl.setStyle({ strokeWidth: 4 });

// Colour features BY A PROPERTY through the same ColorScale a raster uses:
vl.set({ colorScale: new ColorScale({ palette: 'viridis', min: 0, max: 10, continuous: true }),
         colorBy: 'SOME_NUMERIC_PROPERTY' });
vl.getLegend();                       // a Legend, exactly as on a raster
(await vl.getStats()).byClass;        // bucketed by that same scale
vl.set({ missingColor: '#cccccc' });  // features with no usable value, painted explicitly
vl.remove();

const vlFn = await fim.addLayer('vector', { source: dsVector,
  style: ({ feature, index }) => (index % 2 === 0 ? '#58a6ff' : null) });   // per-feature function style
vlFn.remove();
```

### Materialize / decode extension seam

```js
Dataset.registerMaterializer('test-md-format', async (root, dsForRoot) => {
  // root: {kind:'inline', data} | {kind:'url', url} — return a RasterGrid or VectorFeatures
  return new RasterGrid({ pixels: new Float32Array([1, 2, 3, 4]), width: 2, height: 2,
    bounds: { north: 1, south: 0, east: 1, west: 0 }, crs: 'EPSG:4326' });
});
const dsCustom = new Dataset({ kind: 'raster', format: 'test-md-format', data: {} });
const customGrid = await dsCustom.grid();
customGrid.width, customGrid.pixels;

Dataset.registerReprojector(async (grid, targetCrs) => { console.log('custom reprojector called for', targetCrs); return grid; });
// Careful: this REPLACES the GDAL reprojector for the whole page — only run this in a throwaway tab.
```

### `FimMap` — the fuller instance API

```js
fim.enableMapEvents();                 // default ['click','hover']
fim.simultaneousLayerEvents = true;
fim.simultaneousLayerEvents;            // true
fim.disableMapEvents();

const release = fim.captureInteraction((evt) => console.log('captured', evt.type));
fim.capturing;                          // true
release();
fim.capturing;                          // false

fim.registerAction('testMdAction', function (...args) { console.log('action fired on', this, args); });
fim.actionNames.includes('testMdAction');   // true
fim.getAction('testMdAction');
fim.registerActions({ testMdAction2: () => console.log('two') });
fim.bindActions();                       // idempotent — safe to call again
```

---

## 4. LAYERS.md

### Construction / properties

```js
const rawLayer = new Layer({ map: fim, type: 'test-md-raw', sources: [ds] });
rawLayer.id; rawLayer.type; rawLayer.sources; rawLayer.map === fim; rawLayer.dataset === ds;
rawLayer.visible; rawLayer.exclusive; rawLayer.result;   // result is null until compute()
```

### Events

```js
rawLayer.on('rendered', (p) => console.log('rendered', p));
fim.on('test-md-raw:rendered', (p) => console.log('forwarded', p.layer === rawLayer));
await rawLayer.render();   // base _draw() is a no-op → console.warn, but still fires 'rendered'
rawLayer.once('removed', () => console.log('removed once'));
```

### Lifecycle

```js
rawLayer.show(); rawLayer.visible;    // true — base show()/hide() only flip the flag
rawLayer.hide(); rawLayer.visible;    // false
rawLayer.fit();                        // base no-op
rawLayer.remove();                     // teardown + synchronous 'removed' + unregister
```

### Render pipeline (`compute`/`render`, the CRS precondition, `_draw` warning)

```js
const rl = new RasterLayer({ map: fim, sources: [ds] });
await rl.compute();          // forces ds.grid(), memoizes onto rl.result
rl.result != null;            // true
await rl.render();            // compute is skipped this time (result already set) → CRS check → _draw
rl.overlay != null;           // true — RasterLayer DOES override _draw, unlike the bare Layer above

// CRS precondition — force a Dataset with an unrenderable fake CRS:
const dsBadCrs = new Dataset({ kind: 'raster', format: 'test-md-format', data: {}, crs: 'EPSG:9999' });
try { await new RasterLayer({ map: fim, sources: [dsBadCrs] }).render(); }
catch (e) { console.log(e.message); }   // "...cannot render CRS 'EPSG:9999'... Reproject first..."
```

### Swapping sources

```js
await rl.setSources([ds]);          // cold swap — same Dataset here, just exercises the call
await rl.deriveSources((cur) => cur[0].clip(ds.bounds));   // hot-modify — reuses memoized ancestors
```

### Settings

```js
rl.settings.get();                  // whole state object (copy)
rl.settings.get('opacity');
await rl.set({ opacity: 0.5 });     // sugar for rl.settings.set({opacity:0.5})
rl.get();                            // sugar for rl.settings.get()
await rl.settings.reset();
```

### Read-models / hit-testing

```js
rl.getLegend();                      // Legend, once a ColorScale has been resolved (after render())
await rl.getStats();
rl.hitTest(grid.bounds.north - 0.001, grid.bounds.west + 0.001);   // near a corner — pixel-level test
```

### The type registry

```js
Layer.registerType('test-md-type', (fimArg, opts) => new RasterLayer({ ...opts, map: fimArg, type: 'test-md-type' }));
const tLayer = await fim.addLayer('test-md-type', { source: ds });
tLayer.type;   // 'test-md-type'
tLayer.remove();

Layer.types();   // every type addLayer can construct, incl. the one just registered

// hasLayerType/createLayer/dispatchMapEventToLayers are internal — Layer.types() is the public read.
// An unresolvable type demonstrates the registry indirectly too (it lists what IS registered):
try { await fim.addLayer('not-a-real-type', {}); } catch (e) { console.log(e.message); }
```

### `FimMap`-side layer registry

```js
const named = await fim.addLayer('raster', { source: ds });
fim.registerNamedLayer('test-md-named.tif', named);
fim.getLayer(named.id) === named;                // true
fim.getLayerByName('test-md-named.tif') === named; // true
fim.namedLayers.includes(named);                  // true
fim.removeLayer(named.id);                         // → named.remove()
```

### Map-event dispatch

`dispatchMapEventToLayers` is an internal pure function (`fimMap.js` calls it, not barrel-exported) —
exercise it through the real map instead:

```js
fim.enableMapEvents(['click', 'hover'], { simultaneous: false });
// now click/hover the actual map in the browser and watch layers with hitTest()==true react.
fim.disableMapEvents();
```

---

## 5. LAYER_SUBTYPES.md

### `RasterLayer`

```js
const rl2 = new RasterLayer({ map: fim, sources: [ds], noData: -99999, opacity: 1 });
await rl2.render();
rl2.overlay; rl2.rasterData; rl2.meta; rl2.noData; rl2.opacity; rl2.colorScale;

rl2.setNoData(-9999);
rl2.setOpacity(0.6);
rl2.hide();   // overlay opacity -> 0 via the provider, NOT torn down
rl2.show();   // restored to .opacity
rl2.set({ colorScale: new ColorScale({ palette: 'plasma', min: 0, max: 10, continuous: true }) });
rl2.getLegend();
await rl2.getStats();
rl2.fit();
rl2.hitTest(grid.bounds.north - 0.001, grid.bounds.west + 0.001);
rl2.valueAt(grid.bounds.north - 0.001, grid.bounds.west + 0.001);

await rl2.settings.set({ palette: 'viridis', continuous: false, noData: -9999, opacity: 0.8, hover: true });
rl2.remove();
```

### `VectorLayer`

```js
const vl2 = new VectorLayer({ map: fim, sources: [dsVector] });
vl2.render({ style: { fillColor: '#ff0000' } });   // SYNCHRONOUS — no await needed, but still awaitable
vl2.dataLayer; vl2._style;
vl2.setStyle({ strokeWidth: 3 });
vl2.hide();   // removes dataLayer via the provider (no vector "invisible" primitive)
vl2.show();   // re-adds at the last style
vl2.fit();
vl2.hitTest(dsVector.bounds.north - 0.001, dsVector.bounds.west + 0.001);
vl2.featureAt(dsVector.bounds.north - 0.001, dsVector.bounds.west + 0.001);
vl2.remove();
```

CSV / XYZ → `VectorLayer`:

```js
const csvText = 'name,lat,lng\nA,29.95,-90.07\nB,29.96,-90.08\n';
const csvFile = new File([csvText], 'points.csv', { type: 'text/csv' });
csvHeaders(csvText);                          // → ['name','lat','lng'] — read BEFORE parseFile
const dsCsv = await fim.addDataset(csvFile);      // auto-detects lat/lng by common column names
dsCsv.kind;                                     // 'vector'

const xyzText = '-90.07 29.95 1.2\n-90.08 29.96 1.4\n';
const xyzFile = new File([xyzText], 'points.xyz', { type: 'text/plain' });
const dsXyz = await fim.addDataset(xyzFile, { swapXY: false });
dsXyz.kind;

wktToGeometry('POINT(-90.07 29.95)');           // standalone — what the csv geometryField path uses
```

### `ComparisonLayer`

```js
const cmpFileA = await urlToFile(CMP_A_URL, 'a.tif', 'image/tiff');
const cmpFileB = await urlToFile(CMP_B_URL, 'b.tif', 'image/tiff');
const dsA = await fim.addDataset(cmpFileA);
const dsB = await fim.addDataset(cmpFileB);
const gridA = await dsA.grid(), gridB = await dsB.grid();

const cmp = new ComparisonLayer({ map: fim,
  sources: [{ pixels: gridA.pixels, meta: gridMeta(gridA) }, { pixels: gridB.pixels, meta: gridMeta(gridB) }] });
const cmpResult = cmp.compute({ policy: 'high', method: 'nearest' });
cmpResult.grid, cmpResult.rgba, cmpResult.counts, cmpResult.nLayers, cmpResult.metrics, cmpResult.warnings;
cmp.getAligned();
cmp.metricsForMask(null);   // whole-extent metrics again (no mask)

// registered-type construction:
const cmpLayer = await fim.addLayer('comparison',
  { sources: [{ pixels: gridA.pixels, meta: gridMeta(gridA) }, { pixels: gridB.pixels, meta: gridMeta(gridB) }] });
cmpLayer.remove();
```

`await layer.prepare()` only matters when `sources` are `RasterLayer[]`/`Dataset`-backed rather than
already-decoded `{pixels,meta}` pairs — since the snippet above already hands `compute()` decoded
pixels directly, `prepare()` is a no-op here; it's the step that forces Dataset sources first when
you construct from `RasterLayer[]` instead.

### `EnsembleAggregationLayer`

Reusing the same two aligned rasters purely to exercise the **shape** (this method wants N member
rasters, not specifically an ensemble product):

```js
const ens = new EnsembleAggregationLayer({ map: fim,
  sources: [{ pixels: gridA.pixels, meta: gridMeta(gridA) }, { pixels: gridB.pixels, meta: gridMeta(gridB) }] });
const ensResult = ens.compute({ policy: 'high', method: 'nearest' });
ensResult.grid, ensResult.rgba, ensResult.perPixel, ensResult.histogram, ensResult.nLayers, ensResult.warnings;
ens.getAligned();
```

### App-tier `renderFile` subclasses

`EnsembleLayer`/`DepthLayer`/`DamageLayer` aren't barrel-exported (they're app-registered layer
TYPES, not classes on the engine barrel) — exercise them through their registered type strings
instead, which is how the app itself uses them:

```js
fim.addLayer;   // 'ensemble' / 'depth' / 'damage' types are registered by a host, not the engine —
                 // see layers/ensemble.js, layers/depthMap.js for their own FIM-specific option
                 // shapes; not documented in the generic usage docs.
```

---

## 6. STORAGE.md

### Getting an instance

```js
const sdb = new Storage({ name: 'test-md-storage', version: 1, tables: ['userFiles', 'scratch'] });
sdb.name;   // 'test-md-storage'
```

### Rows (via `table(name)`)

```js
const uf = sdb.table('userFiles');
uf.name;                                   // 'userFiles'
await uf.put('a.tif', { hello: 'world' }); // → 'a.tif'
await uf.get('a.tif');                     // → {hello:'world'}
await uf.get('missing-key');               // → undefined
await uf.has('a.tif');                     // true
await uf.has('missing-key');               // false
await uf.list();                            // [{key:'a.tif', value:{...}}]
await uf.list({ keys: true });              // ['a.tif']
await uf.delete('a.tif');                   // true
await uf.clear();                           // true (no-op-safe on an empty table)

// interchangeable with the db-level calls:
await sdb.put('userFiles', 'b.tif', 42);
await uf.get('b.tif');                      // 42 — same row, either form
```

### Tables (structural)

```js
await sdb.tables();                         // ['userFiles', 'scratch']
await sdb.createTable('userFiles');         // false — already exists
await sdb.createTable('extra');             // true — created, version bumped
await sdb.dropTable('extra');               // true
await sdb.dropTable('nope');                // false — never existed
```

### Version-management primitives

```js
await uf.put('x', 1); await uf.put('y', 2); await uf.put('z', 3);
const changed = await uf.map((key, value) => (key === 'y' ? Storage.DELETE : value * 10));
changed;                                     // 3 — x and z updated, y deleted (1 delete + 2 updates)
await uf.list();

await sdb.clearAll();                        // wipes every table, keeps schema + version
await sdb.tables();                          // still ['userFiles', 'scratch']
```

`versionMigrate` (constructor option) only runs during an actual version-bumping open — demonstrate
it by re-opening at a higher version:

```js
const sdb2 = new Storage({ name: 'test-md-storage', version: 2, tables: ['userFiles', 'scratch', 'migrated'],
  versionMigrate: ({ db, transaction, oldVersion, newVersion }) => {
    console.log('migrating', oldVersion, '->', newVersion, [...db.objectStoreNames]);
  } });
await sdb2.tables();   // ['userFiles','scratch','migrated'] — versionMigrate ran, plus the new table
```

### Connection lifecycle

```js
await sdb2.close();    // drop the connection; data persists
await sdb2.tables();    // reopens transparently
await sdb.destroy();    // delete test-md-storage entirely
await sdb2.destroy();   // (same underlying DB name — second destroy is a clean no-op-ish delete)
```

---

## 7. COLOR_SCALE.md

Using `rl2`-style layer isn't required — `ColorScale` is fully standalone:

```js
const csScale = new ColorScale({ palette: 'blues', min: 0, max: 10, continuous: true, unit: 'm' });
```

### 1. Palette mode

```js
csScale.set({ palette: 'viridis' });
csScale.set({ palette: ['#000033', '#3366ff', '#ffffff'] });
csScale.set({ continuous: true });
csScale.set({ continuous: false });
csScale.set({ min: 0, max: 5 });
csScale.set({ palette: 'plasma', continuous: true, min: 0, max: 100 });   // one batch, one onChange
```

### 2. Classed / discrete stops

```js
csScale.setStops([
  { range: [0, 2],        color: '#08306b', label: 'low'  },
  { range: [2, 5],        color: '#4292c6', label: 'mid'  },
  { range: [5, Infinity], color: '#deebf7', label: 'high' },
]);
csScale.setRange(0, { min: 0, max: 3 });
csScale.setColor(0, '#ff0000');
csScale.setLabel(0, 'Shallow');
csScale.getStops(); csScale.getValues(); csScale.getRange(0); csScale.getColor(1); csScale.getRgb(1);
csScale.kind; csScale.isExplicit; csScale.discrete; csScale.source;

ColorScale.fromGdalLegend(
  [{ value: 0, color: '#ffffff', label: 'none' }, { value: 1, color: '#0000ff', label: 'flooded' }], 'm');
```

### 3. Continuous color stops

```js
const csCont = new ColorScale({ palette: 'blues', min: -1, max: 1 });
csCont.setColorStops([-1, 0, 1], ['#015498', '#ffffff', '#21bf90']);
csCont.set({ continuous: true });
csCont.getRgb(-0.5); csCont.getRgb(-5); csCont.getRgb(5);
csCont.set({ continuous: false });
csCont.getRgb(-0.9);
```

### The override callback

```js
csCont.colorFor = (v) => (v < 0 ? '#000000' : null);
csCont.getColor(-1);   // '#000000' — override wins
csCont.getColor(1);    // falls through to the normal scale (colorFor returned null)
csCont.colorFor = null;
```

### Reacting to changes

```js
const onEdit = (c) => console.log('scale changed, palette now:', c.palette);
csScale.onChange(onEdit);
csScale.set({ palette: 'reds' });   // triggers onEdit
csScale.offChange(onEdit);
csScale.set({ palette: 'heat' });   // silent now
```

### Attaching to a layer / precedence

```js
const rl3 = new RasterLayer({ map: fim, sources: [ds] });
await rl3.render();               // no explicit scale → auto-resolved (GDAL legend, else default "blues")
rl3.colorScale.source;             // 'gdal' | 'default'
rl3.set({ colorScale: new ColorScale({ palette: 'plasma', min: 0, max: 10, continuous: true }) });
rl3.colorScale.source;             // now the explicit one you attached
try { rl3.set({ colorScale: 'not-a-colorscale' }); } catch (e) { console.log(e.message); }   // validated, throws cleanly
await rl3.settings.set({ palette: 'viridis', continuous: false, opacity: 0.7 });
rl3.remove();
```

---

## 8. LEGEND.md

```js
const legendA = new Legend({ unit: 'm', kind: 'classed', source: 'custom',
  stops: [{ value: 1, color: '#000', label: 'one' }] });
legendA.unit; legendA.kind; legendA.source; legendA.stops;
legendA.formatValue(3.14159);        // '3.14'
legendA.formatLabel = (s) => `${s.label}!`;
legendA.toHtml();

const legendB = Legend.fromColorScale(csScale);   // derives unit/kind/stops from the ColorScale above
legendB.toHtml();                                  // classed → one row per stop
const legendC = Legend.fromColorScale(csCont);
legendC.toHtml();                                  // continuous → a gradient bar

const rl4 = new RasterLayer({ map: fim, sources: [ds] });
await rl4.render();
rl4.getLegend().toJSON();   // non-null — _draw() always attaches SOME ColorScale first
rl4.remove();
```

---

## 9. UI.md

### Toast

```js
const toast = createToast(document.body, { corner: 'br' });
toast.show('Hello from test.md', { level: 'success', timeout: 3000 });
// toast.clear(); toast.destroy();

connectToast(fim, toast);          // wires fim's 'notify' host event to this toast
fim.emit('notify', { message: 'wired via connectToast', level: 'info' });
```

### Tooltip (raster hover)

```js
fim.enableMapEvents();
const rl5 = new RasterLayer({ map: fim, sources: [ds] });
await rl5.render();
const hoverBinding = bindHoverValue(rl5, { format: (v) => v.toFixed(2) });
// hover the raster's footprint on the real map to see the tooltip; then:
hoverBinding.off();
rl5.remove();
```

### Info window (vector click)

```js
const vl3 = new VectorLayer({ map: fim, sources: [dsVector] });
vl3.render();
const infoBinding = bindFeatureInfo(vl3, { render: (f) => propsTable(f.properties) });
// click a feature on the real map to see the info window; then:
infoBinding.off();
vl3.remove();
```

### Tools panel

```js
const rl6 = new RasterLayer({ map: fim, sources: [ds] });
await rl6.render();
rasterControls(rl6);              // pure control spec — no DOM
const panelHost = document.createElement('div');
panelHost.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;background:#111';
document.body.appendChild(panelHost);
const toolsPanel = createToolsPanel(panelHost, { layer: rl6, pretty: true });
toolsPanel.update();
// toolsPanel.destroy(); panelHost.remove(); rl6.remove();

const vl4 = new VectorLayer({ map: fim, sources: [dsVector] });
vl4.render();
vectorControls(vl4);
```

### Legend/Stats renderers

```js
renderLegend(rl6.getLegend());              // → legend.toJSON()
renderLegend(rl6.getLegend(), { html: true }); // → legend.toHtml()
const statsForRender = await rl6.getStats();
renderStats(statsForRender);
renderStats(statsForRender, { html: true });
```

### Region draw

```js
const draw = createRegionDraw(fim, {
  onPoint: (points) => console.log('vertex added, total:', points.length),
  onComplete: (filter, points) => console.log('done', filter?.isEmpty(), points.length),
  onCancel: () => console.log('cancelled'),
});
draw.start();     // now click a few points on the real map, then:
draw.active;      // true while drawing
// draw.finish(); // or draw.cancel();
```

### Operations panel

```js
const rl7 = new RasterLayer({ map: fim, sources: [ds] });
await rl7.render();
let lastRegion = null;
const draw2 = createRegionDraw(fim, { onComplete: (f) => { lastRegion = f; } });
const opsHost = document.createElement('div');
opsHost.style.cssText = 'position:fixed;top:8px;left:8px;z-index:9999;background:#111';
document.body.appendChild(opsHost);
const ops = createOperationsPanel(opsHost, { layer: rl7, region: () => lastRegion, pretty: true,
  onApply: (layer, err) => console.log('applied', err?.message || 'ok') });
// click "Threshold" / "Mask to region" / "Reset" in the panel, or drive it manually:
// ops.destroy(); opsHost.remove(); rl7.remove();
```

---

## 10. DATASET_OPERATIONS.md

### Construction

```js
Dataset.fromURL(RASTER_URL, { format: 'geotiff' });         // lazy URL root — not fetched yet
const dsFromRecord = Dataset.fromRecord(ds.toRecord());
```

### Kind-agnostic

```js
ds.toRecord({ storeMaterialized: false });   // small — recipe only
await ds.load();                              // force it once so storeMaterialized:true is legal below
ds.toRecord({ storeMaterialized: true });     // now embeds the decoded grid too
ds.toJSON();
// ds.download();   // real file-save dialog — run manually to observe

// select/selectAxisEntry/reduce need a Dataset with .axes (a selection-axis series) — a plain
// parsed file (like `ds`) has none, so these correctly return null/throw here; that IS the
// documented behavior for a non-axis Dataset:
ds.selectAxisEntry(0);         // null — no axes on a plain parsed file
ds.select(0);                  // null
try { ds.reduce('mean'); } catch (e) { console.log(e.message); }   // throws — no axis to reduce
```

### Terminals

```js
await ds.load();          // RasterGrid, memoized
await ds.grid();           // load() + assert raster
try { await dsVector.grid(); } catch (e) { console.log(e.message); }   // throws — dsVector is vector
await dsVector.features(); // VectorFeatures
ds.isMaterialized;          // true, already forced above
ds.warnings;                 // [] unless something (e.g. a warp) logged one
ds.release();                 // evicts the memoized grid
ds.isMaterialized;            // false again
```

### Raster — unary

```js
const dsReproj = ds.reproject(ds.crs || 'EPSG:4326');   // lazy — same-CRS is a same-ref no-op
const dsClip = ds.clip({ north: grid.bounds.north, south: (grid.bounds.north + grid.bounds.south) / 2,
  east: grid.bounds.east, west: grid.bounds.west });
(await dsClip.grid()).height <= grid.height;             // true — cropped

const ring = [{ lat: grid.bounds.south, lng: grid.bounds.west },
              { lat: grid.bounds.north, lng: grid.bounds.west },
              { lat: grid.bounds.north, lng: grid.bounds.east },
              { lat: grid.bounds.south, lng: grid.bounds.east }];
const dsMask = ds.mask(ring, { invert: false });
await dsMask.grid();

const dsReclass = ds.reclassify([{ min: 0, max: 100, value: 1 }], { unmatched: 'nodata' });
await dsReclass.grid();

const dsResample = ds.resampleTo({ width: 50, height: 50, bw: grid.bounds.west, bs: grid.bounds.south,
  be: grid.bounds.east, bn: grid.bounds.north }, { method: 'nearest' });
(await dsResample.grid()).width;   // 50

const dsSlope = ds.slope({ unit: 'degrees' });   // meaningful cellsizeX/Y matter for real terrain —
await dsSlope.grid();                             //   see COLOR_SCALE-adjacent slope notes; this just
                                                    //   exercises the call
const dsAspect = ds.aspect();
await dsAspect.grid();
const dsHillshade = ds.hillshade({ altitude: 45, azimuth: 315 });
await dsHillshade.grid();

const zones = await ds.zonalStats([{ id: 'whole-extent', polygon: ring }]);   // terminal — returns data
zones;
```

### Raster — binary / N-ary

Two ALIGNED same-region rasters (not `ds`/`DEPTH_URL`, which cover unrelated areas — `combine` will
run either way, but a meaningless overlap makes the result all-noData, which defeats the point of
watching it work):

```js
const dsCmpA = await fim.addDataset(await urlToFile(CMP_A_URL, 'a.tif', 'image/tiff'));
const dsCmpB = await fim.addDataset(await urlToFile(CMP_B_URL, 'b.tif', 'image/tiff'));
const dsCombined = dsCmpA.combine(dsCmpB, { op: 'difference' });
await dsCombined.grid();
const dsDiff = dsCmpA.difference(dsCmpB);          // sugar for combine(..., {op:'difference'})
await dsDiff.grid();
const dsSum = dsCmpA.combine([dsCmpB], { op: 'sum' });   // N-ary form, one other Dataset here
await dsSum.grid();
```

### Vector — the one kind-changing op

```js
const dsRasterized = dsVector.rasterize({ width: 100, height: 100, burnValue: 1 });
dsRasterized.kind;   // 'raster'
await dsRasterized.grid();
try { ds.rasterize({ width: 10, height: 10 }); } catch (e) { console.log(e.message); }   // "vector-only op"
```

### Standalone grid functions (no Dataset needed)

```js
maskGrid(grid, ring, { invert: false });
clipGrid(grid, { north: grid.bounds.north, south: (grid.bounds.north + grid.bounds.south) / 2,
  east: grid.bounds.east, west: grid.bounds.west });
reclassifyGrid(grid, [{ min: 0, max: 100, value: 1 }], { unmatched: 'nodata' });
const gridB = await dsCmpB.grid();   // dsCmpB from the "binary/N-ary" snippet just above
combineGrids([grid, gridB], { op: 'difference' });
zonalStats(grid, [{ id: 'z1', polygon: ring }]);
slopeGrid(grid, { unit: 'degrees' });
aspectGrid(grid);
hillshadeGrid(grid, { altitude: 45, azimuth: 315 });
rasterizeFeatures((await dsVector.features()).features, dsVector.bounds, { width: 50, height: 50 });
```

Resample/align:

```js
GRID_POLICY;                                     // { LOW, HIGH, AVERAGE }
RESAMPLE_METHODS;                                 // the full gdalwarp -r vocabulary
resolveTargetGrid([gridMeta(grid), gridMeta(gridB)], GRID_POLICY.HIGH);
resampleGrid(grid.pixels, gridMeta(grid), gridMeta(gridB), { method: 'nearest' });
alignRasters([{ pixels: grid.pixels, meta: gridMeta(grid) }, { pixels: gridB.pixels, meta: gridMeta(gridB) }],
  { policy: 'high', method: 'nearest' });

Dataset.registerResampler((pixels, srcMeta, dstMeta, opts) => { console.log('custom resampler called', opts); return pixels; });
resampleGrid(grid.pixels, gridMeta(grid), { ...gridMeta(gridB), width: gridB.width + 1 }, { method: 'cubic' });
Dataset.registerResampler(null);   // un-register when done poking at it
```

Colorize:

```js
const rgba = colorizeGrid(grid, { colorScale: csScale, alpha: 255 });
rgba instanceof Uint8ClampedArray;   // true
const dataUrl = gridToDataURL(grid, { colorScale: csScale });
dataUrl.startsWith('data:image/png;base64,');   // true
```

### Standalone `reproject()`

```js
const eagerlyWarped = await warp(ds, 'EPSG:4326');   // eager — warps NOW, distinct from ds.reproject()
eagerlyWarped === ds;   // true if ds was already WGS84/equivalent; a new Dataset otherwise
```

### Vendored primitives

Already exercised in [§1](#1-usagemd) (`fromArrayBuffer`, `shp`) — `kml`/`Loader` too.

### GDAL escape hatch (`callGdal`)

```js
const gdalInFile = new File([await rasterFile.arrayBuffer()], 'in.tif', { type: 'image/tiff' });
const { datasets } = await callGdal('open', gdalInFile);
const outPath = await callGdal('gdal_translate', datasets[0],
  ['-of', 'GTiff', '-outsize', '50%', '50%'], 'out.tif');
await callGdal('close', datasets[0]);
const bytes = await callGdal('getFileBytes', outPath);   // Uint8Array
bytes.byteLength > 0;

try { await callGdal('not_a_real_gdal_method'); }
catch (e) { console.log(e.message); }   // lists every real method name available
```

---
