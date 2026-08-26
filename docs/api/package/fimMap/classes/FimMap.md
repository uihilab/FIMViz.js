[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/fimMap](../README.md) / FimMap

# Class: FimMap

Defined in: [package/fimMap.js:69](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L69)

## Constructors

### Constructor

> **new FimMap**(`opts`): `FimMap`

Defined in: [package/fimMap.js:99](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L99)

#### Parameters

##### opts

###### app

[`FimVizInstance`](../../fimViz/classes/FimVizInstance.md)

the owning FimViz

###### createPanel?

(`root`) => `any` = `null`

per-instance Layer Panel factory

###### getMap?

() => `any` = `null`

fallback map accessor for a runtime that doesn't report its map

###### injected?

`boolean` = `false`

did FimViz inject widget markup into `root`

###### root?

`Element`

the mount container (query scope)

###### teardown?

() => `void` = `null`

runtime-supplied teardown, run by destroy()

#### Returns

`FimMap`

## Properties

### layers

> **layers**: [`Layer`](../../layer/classes/Layer.md)[] = `[]`

Defined in: [package/fimMap.js:76](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L76)

## Accessors

### actionNames

#### Get Signature

> **get** **actionNames**(): `string`[]

Defined in: [package/fimMap.js:265](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L265)

All action names registered on THIS instance (excludes the window fallback).

##### Returns

`string`[]

***

### app

#### Get Signature

> **get** **app**(): [`FimVizInstance`](../../fimViz/classes/FimVizInstance.md)

Defined in: [package/fimMap.js:109](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L109)

The owning FimViz (default or private) — the up-chain reference.

##### Returns

[`FimVizInstance`](../../fimViz/classes/FimVizInstance.md)

***

### capturing

#### Get Signature

> **get** **capturing**(): `boolean`

Defined in: [package/fimMap.js:629](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L629)

Is a modal interaction currently capturing events?

##### Returns

`boolean`

***

### config

#### Get Signature

> **get** **config**(): `any`

Defined in: [package/fimMap.js:167](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L167)

This instance's runtime config, always from the app owning this map, so two isolated apps on one
page never read each other's settings. The engine reads config only this way; there is no
ambient config pointer. The one module-level runtime value is gdalPath, which is process-global
because GDAL is a per-page singleton. See package/config.js.

##### Returns

`any`

***

### datasets

#### Get Signature

> **get** **datasets**(): [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/fimMap.js:148](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L148)

Datasets parsed on this app, shared with its other maps the way `storage` is.

A Dataset holds no back-pointer to a map, so a file parsed here by `addDataset`, or implicitly
by `addLayer(rawFile)`, works as a source for a Layer on another map and another provider, with
no re-parse and no second decode. Rendering state stays per map, in `layers`.

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)[]

***

### exclusiveClaimant

#### Get Signature

> **get** **exclusiveClaimant**(): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/fimMap.js:463](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L463)

The Layer currently holding the exclusive display slot, or null.

##### Returns

[`Layer`](../../layer/classes/Layer.md)

***

### layerPanel

#### Get Signature

> **get** **layerPanel**(): `any`

Defined in: [package/fimMap.js:176](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L176)

This instance's Layer Panel, built lazily against #root by the createLayerPanel factory mount.js
injects. The model never imports ui/; mount.js supplies it, as it does getMap and teardown.
Null when no factory was injected, which is the headless boot. Replaces the module-level
`window.layerPanel` singleton, so two maps drive their own panels.

##### Returns

`any`

***

### map

#### Get Signature

> **get** **map**(): `any`

Defined in: [package/fimMap.js:123](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L123)

##### Returns

`any`

the provider's map object — a `google.maps.Map`, an `L.Map`, or another provider's type

***

### namedLayers

#### Get Signature

> **get** **namedLayers**(): [`Layer`](../../layer/classes/Layer.md)[]

Defined in: [package/fimMap.js:406](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L406)

All currently-registered named user-file Layers.

##### Returns

[`Layer`](../../layer/classes/Layer.md)[]

***

### root

#### Get Signature

> **get** **root**(): `Element`

Defined in: [package/fimMap.js:112](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L112)

The mount container element (query scope).

##### Returns

`Element`

***

### simultaneousLayerEvents

#### Get Signature

> **get** **simultaneousLayerEvents**(): `boolean`

Defined in: [package/fimMap.js:511](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L511)

##### Returns

`boolean`

#### Set Signature

> **set** **simultaneousLayerEvents**(`v`): `void`

Defined in: [package/fimMap.js:509](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L509)

Dispatch mode. false, the default, gives precedence: the top hit layer goes first and
absorption stops propagation. true delivers the event to each hit layer, with no veto.
PACKAGE_ROADMAP §1.

##### Parameters

###### v

`boolean`

##### Returns

`void`

***

### storage

#### Get Signature

> **get** **storage**(): [`Storage`](../../../io/storage/classes/Storage.md)

Defined in: [package/fimMap.js:138](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L138)

Shared client-side storage (owned by the app).

##### Returns

[`Storage`](../../../io/storage/classes/Storage.md)

## Methods

### $()

> **$**(`sel`): `Element`

Defined in: [package/fimMap.js:198](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L198)

Query helpers resolving against this instance's root rather than the whole document. Use these
instead of `document.getElementById`, so duplicate ids across two widgets stay unambiguous.

A bare `#id` is rewritten to `[id="..."]`. The spec calls them identical, but some engines
optimize `#id` through document.getElementById, which returns the first match in the document
and then filters to the subtree, so a scoped lookup finds nothing when ids repeat. That is this
case exactly: two widgets both carry `#layer-panel`. jsdom and nwsapi do this where browsers do
not, so without the rewrite the behavior cannot even be tested. The attribute form behaves the
same everywhere.

Only an exact `#identifier` is rewritten, which is what the migrated getElementById call sites
use. A compound selector passes through untouched, because rewriting inside one risks mangling
a quoted attribute value, so it stays subject to the engine quirk above.

#### Parameters

##### sel

`string`

#### Returns

`Element`

***

### $$()

> **$$**(`sel`): `Element`[]

Defined in: [package/fimMap.js:200](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L200)

#### Parameters

##### sel

`string`

#### Returns

`Element`[]

***

### addDataset()

> **addDataset**(`source`, `options?`): `Promise`\<[`Dataset`](../../dataset/classes/Dataset.md)\>

Defined in: [package/fimMap.js:317](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L317)

Parses a File, Blob, ArrayBuffer or URL into a Dataset and registers it on this instance. The
Dataset comes back unrendered; addLayer draws it.

The extension decides the format. Alongside geotiff, geojson, kml, kmz, shp, csv and xyz, the
multi-dimensional scientific formats (.nc, .nc4, .cdf, .grib, .grib2, .grb2, .zarr) return a
Dataset carrying a time axis for `select()` and `reduce()`. `options` passes through to the
parser; `parseSource` lists the per-format keys.

#### Parameters

##### source

`string` \| `ArrayBuffer` \| `Blob` \| `File`

##### options?

`any` = `{}`

see `io/parse.js`'s `parseSource`

#### Returns

`Promise`\<[`Dataset`](../../dataset/classes/Dataset.md)\>

***

### addLayer()

> **addLayer**(`type?`, `opts?`): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: [package/fimMap.js:344](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L344)

Creates and renders a Layer of `type`, dispatching to the factory registerLayerType recorded.

`type` may be a bare Dataset, as in `fim.addLayer(ds)`, or omitted; either way
createLayer infers it from the single source's `Dataset.kind`. A raw File, Blob, ArrayBuffer or
URL works too, in the `type` slot or in `opts.source` or `opts.sources`: addDataset() parses it
first and it joins `this.datasets`, so `fim.addLayer(file)` needs no separate addDataset() call.

Throws for a type with no registered factory. Some factories return a Promise rather than a
Layer, i.e. 'raster', whose RasterLayer.render() is async, so this awaits before pushing.
Pushing an un-awaited Promise onto `this.layers` would corrupt the registry for anything that
iterates it.

#### Parameters

##### type?

`any`

a registry name, a bare source to infer
  from, or a raw file/URL to parse first

##### opts?

`any` = `{}`

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

***

### addScratchVector()

> **addScratchVector**(`geojson`, `opts?`): `any`

Defined in: [package/fimMap.js:569](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L569)

Draws a GeoJSON overlay that is not a Layer: a tool's in-progress shape, a rubber band, a
highlight. It never enters `fim.layers`, so nothing hit-tests it, reorders it, lists it in the
layer panel or saves it. It is scaffolding the user is looking at, not data they loaded.

The selection tools are headless by design, producing `{lat,lng}` and naming no map SDK, which
left "show me what I am drawing" with nowhere to live. Keeping it here rather than in
`fimviz/ui` keeps the provider registry, and Leaflet with it, out of the `dist/ui.js` bundle.

#### Parameters

##### geojson

`any`

a Feature or FeatureCollection

##### opts?

the neutral style vocabulary `VectorLayer` uses

###### style?

`any`

#### Returns

`any`

an opaque handle to pass to [removeScratchVector](#removescratchvector), or null if there is no map

***

### adoptDataset()

> **adoptDataset**(`ds`): `any`

Defined in: [package/fimMap.js:151](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L151)

Register a Dataset parsed elsewhere on this map's app.

#### Parameters

##### ds

`any`

#### Returns

`any`

***

### applyLayerOrder()

> **applyLayerOrder**(): `FimMap`

Defined in: [package/fimMap.js:612](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L612)

Pushes this instance's layer order down to the map, so what is drawn on top matches what
`layers` says is on top.

`dispatchMapEventToLayers` already walks `layers` top down and treats the last entry as topmost
for hit-testing, but visual stacking was whatever order the provider inserted overlays in. The
two could disagree, so the layer receiving a click was not necessarily the one drawn on top.
This makes the array decide both.

#### Returns

`FimMap`

***

### bindActions()

> **bindActions**(): `FimMap`

Defined in: [package/fimMap.js:268](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L268)

Attach the delegated listener to this instance's root. Idempotent.

#### Returns

`FimMap`

***

### captureInteraction()

> **captureInteraction**(`handler`): () => `void`

Defined in: [package/fimMap.js:521](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L521)

Registers a modal interaction, i.e. a region-draw tool, that takes all map events until it is
released. While captured, layer dispatch and the `map:${type}` mirror are suppressed and each
event goes only to `handler({ type, lat, lng, originalEvent })`. Returns a release function. One
capture at a time; a new one replaces the previous. PACKAGE_ROADMAP §1.

#### Parameters

##### handler

(`evt`) => `void`

#### Returns

() => `void`

***

### destroy()

> **destroy**(): `void`

Defined in: [package/fimMap.js:647](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L647)

Best-effort teardown for an SPA unmount. Detaches the map, removes injected markup, and
releases this map from its app, which frees the default app's shared services once the last map
goes. Module-level singletons inside host subsystems are left alone.

#### Returns

`void`

***

### disableMapEvents()

> **disableMapEvents**(): `FimMap`

Defined in: [package/fimMap.js:497](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L497)

Stop routing provider map events.

#### Returns

`FimMap`

***

### emit()

> **emit**(`evt`, `payload?`): `FimMap`

Defined in: [package/fimMap.js:209](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L209)

#### Parameters

##### evt

`string`

##### payload?

`any`

#### Returns

`FimMap`

***

### enableMapEvents()

> **enableMapEvents**(`types?`, `opts?`): `FimMap`

Defined in: [package/fimMap.js:481](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L481)

Starts routing provider map events, click and hover by default, to layers by hit test and
z-order, and mirrors each as `map:${type}` on the bus. Idempotent. Needs a mounted map and a
provider implementing onMapEvent.

#### Parameters

##### types?

`string`[] = `...`

##### opts?

simultaneous:true → every hit layer gets the event

###### simultaneous?

`boolean`

#### Returns

`FimMap`

***

### getAction()

> **getAction**(`name`): `Function`

Defined in: [package/fimMap.js:260](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L260)

The handler for `name`, from this instance's registry first, then the window bridge.

#### Parameters

##### name

`string`

#### Returns

`Function`

***

### getLayer()

> **getLayer**(`id`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/fimMap.js:381](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L381)

The Layer with this id (or null).

#### Parameters

##### id

`string`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

***

### getLayerByName()

> **getLayerByName**(`name`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/fimMap.js:403](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L403)

The named user-file Layer for `name` (or null).

#### Parameters

##### name

`string`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

***

### off()

> **off**(`evt`, `fn`): `FimMap`

Defined in: [package/fimMap.js:207](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L207)

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

`FimMap`

***

### on()

> **on**(`evt`, `fn`): `FimMap`

Defined in: [package/fimMap.js:205](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L205)

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

`FimMap`

***

### registerAction()

> **registerAction**(`name`, `fn`): `FimMap`

Defined in: [package/fimMap.js:239](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L239)

Registers a handler for `data-action="name"`.

#### Parameters

##### name

`string`

##### fn

(`this`, ...`args`) => `void`

#### Returns

`FimMap`

***

### registerActions()

> **registerActions**(`map?`): `FimMap`

Defined in: [package/fimMap.js:250](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L250)

Registers several at once: registerActions({ foo, bar }).

#### Parameters

##### map?

#### Returns

`FimMap`

***

### registerNamedLayer()

> **registerNamedLayer**(`name`, `layer`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/fimMap.js:392](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L392)

Registers a Layer under a filename key, the user-file registry floodExtent's
toggle_uploaded_file drives, where one displayed user file means one Layer. Sets the layer's
`_map` reference so layer.remove() can unregister itself, evicts any prior layer under the same
name, and adds this one to `this.layers`.

#### Parameters

##### name

`string`

##### layer

[`Layer`](../../layer/classes/Layer.md)

#### Returns

[`Layer`](../../layer/classes/Layer.md)

***

### releaseInteraction()

> **releaseInteraction**(): `FimMap`

Defined in: [package/fimMap.js:627](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L627)

Release any modal interaction, restoring normal layer dispatch.

#### Returns

`FimMap`

***

### removeDataset()

> **removeDataset**(`ds`, `opts?`): `boolean`

Defined in: [package/fimMap.js:158](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L158)

Drops a Dataset from the app registry and releases its decode. Throws while a layer on this app
still renders it, unless given `{ force: true }`.

#### Parameters

##### ds

`any`

##### opts?

###### force?

`boolean`

#### Returns

`boolean`

***

### removeLayer()

> **removeLayer**(`idOrLayer`): `void`

Defined in: [package/fimMap.js:409](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L409)

Remove a Layer by id or instance — tears down its render and unregisters it.

#### Parameters

##### idOrLayer

`string` \| [`Layer`](../../layer/classes/Layer.md)

#### Returns

`void`

***

### removeScratchVector()

> **removeScratchVector**(`handle`): `FimMap`

Defined in: [package/fimMap.js:576](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L576)

Tear down a handle from [addScratchVector](#addscratchvector). Safe on null.

#### Parameters

##### handle

`any`

#### Returns

`FimMap`

***

### setMapDraggable()

> **setMapDraggable**(`on`): `FimMap`

Defined in: [package/fimMap.js:550](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L550)

Turns pan-by-drag on or off.

Drag-based selection needs it: a freehand or brush stroke is the same gesture as a map pan, so
one has to yield. The tool suppresses dragging for the length of the stroke and restores it on
finish or cancel, which is why the restore sits in a `finally` rather than the success path.

Does nothing when the provider declares no `setDraggable`, so no feature detection is needed.

#### Parameters

##### on

`boolean`

#### Returns

`FimMap`

***

### viewMetrics()

> **viewMetrics**(): `object`

Defined in: [package/fimMap.js:589](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L589)

Ground meters per screen pixel, with the map's pixel size. A tool uses these to size itself in
screen units, i.e. a brush that keeps its width as the user zooms, without touching a map SDK.

#### Returns

`object`

null when unavailable

##### height

> **height**: `number`

##### metresPerPixel

> **metresPerPixel**: `number`

##### width

> **width**: `number`

***

### whenIdle()

> **whenIdle**(`opts?`): `Promise`\<`void`\>

Defined in: [package/fimMap.js:595](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimMap.js#L595)

#### Parameters

##### opts?

#### Returns

`Promise`\<`void`\>
