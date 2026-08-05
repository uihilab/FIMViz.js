[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/fimMap](../README.md) / FimMap

# Class: FimMap

Defined in: [package/fimMap.js:71](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L71)

## Constructors

### Constructor

> **new FimMap**(`opts`): `FimMap`

Defined in: [package/fimMap.js:101](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L101)

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

Defined in: [package/fimMap.js:78](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L78)

## Accessors

### actionNames

#### Get Signature

> **get** **actionNames**(): `string`[]

Defined in: [package/fimMap.js:268](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L268)

All action names registered on THIS instance (excludes the window fallback).

##### Returns

`string`[]

***

### app

#### Get Signature

> **get** **app**(): [`FimVizInstance`](../../fimViz/classes/FimVizInstance.md)

Defined in: [package/fimMap.js:111](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L111)

The owning FimViz (default or private) — the up-chain reference.

##### Returns

[`FimVizInstance`](../../fimViz/classes/FimVizInstance.md)

***

### capturing

#### Get Signature

> **get** **capturing**(): `boolean`

Defined in: [package/fimMap.js:510](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L510)

Is a modal interaction currently capturing events?

##### Returns

`boolean`

***

### config

#### Get Signature

> **get** **config**(): `any`

Defined in: [package/fimMap.js:169](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L169)

This instance's runtime config — always the app that owns THIS map, so two isolated apps on one
page never read each other's settings. This is THE way the engine reads config: there is no
ambient config pointer (the only module-level runtime value is gdalPath, which is process-global
because GDAL is a per-page singleton). See package/config.js.

##### Returns

`any`

***

### datasets

#### Get Signature

> **get** **datasets**(): [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/fimMap.js:150](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L150)

Datasets parsed on this app — SHARED with every other map on it, exactly like `storage`.

A Dataset is a free value with no back-pointer to a map, so a file parsed here (by `addDataset`,
or implicitly by `addLayer(rawFile)`) is directly usable as a source for a Layer on another
map, of another provider, with no re-parse and no second decode. Rendering state — `layers` —
stays per-map.

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)[]

***

### exclusiveClaimant

#### Get Signature

> **get** **exclusiveClaimant**(): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/fimMap.js:447](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L447)

The Layer currently holding the exclusive display slot, or null.

##### Returns

[`Layer`](../../layer/classes/Layer.md)

***

### layerPanel

#### Get Signature

> **get** **layerPanel**(): `any`

Defined in: [package/fimMap.js:178](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L178)

This instance's Layer Panel — the per-instance UI object, lazily built against #root via the
factory mount.js injects (createLayerPanel). The model never imports ui/; the composition root
wires it in, same rule as getMap/teardown. Null when no factory was injected (headless boot).
Replaces the module-level `window.layerPanel` singleton, so two maps drive their own panels.

##### Returns

`any`

***

### map

#### Get Signature

> **get** **map**(): `any`

Defined in: [package/fimMap.js:124](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L124)

##### Returns

`any`

the provider's map object — a `google.maps.Map`, an `L.Map`, or another provider's type

***

### namedLayers

#### Get Signature

> **get** **namedLayers**(): [`Layer`](../../layer/classes/Layer.md)[]

Defined in: [package/fimMap.js:402](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L402)

All currently-registered named user-file Layers.

##### Returns

[`Layer`](../../layer/classes/Layer.md)[]

***

### root

#### Get Signature

> **get** **root**(): `Element`

Defined in: [package/fimMap.js:114](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L114)

The mount container element (query scope).

##### Returns

`Element`

***

### simultaneousLayerEvents

#### Get Signature

> **get** **simultaneousLayerEvents**(): `boolean`

Defined in: [package/fimMap.js:493](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L493)

##### Returns

`boolean`

#### Set Signature

> **set** **simultaneousLayerEvents**(`v`): `void`

Defined in: [package/fimMap.js:491](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L491)

Dispatch mode. false (default) = precedence: top hit layer first, absorption stops propagation.
true = simultaneous: every hit-tested layer receives the event (no veto). PACKAGE_ROADMAP §1.

##### Parameters

###### v

`boolean`

##### Returns

`void`

***

### storage

#### Get Signature

> **get** **storage**(): [`Storage`](../../../io/storage/classes/Storage.md)

Defined in: [package/fimMap.js:139](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L139)

Shared client-side storage (owned by the app).

##### Returns

[`Storage`](../../../io/storage/classes/Storage.md)

## Methods

### $()

> **$**(`sel`): `Element`

Defined in: [package/fimMap.js:201](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L201)

Scoped query helpers — resolve against this instance's root, not the whole document.
The linchpin for multi-instance: duplicate IDs across instances stop being ambiguous
Prefer these over `document.getElementById` so two widgets on one page cannot collide.

A bare `#id` is rewritten to the equivalent `[id="..."]`. Per spec these are identical, but
some engines optimize `#id` by routing through document.getElementById — which returns only
the FIRST match in the document and then filters to the subtree, so a scoped lookup finds
NOTHING when ids repeat across instances. That is precisely our case: two widgets both carry
`#layer-panel`. jsdom/nwsapi does exactly this (browsers do not), so without the rewrite the
property cannot even be tested. The attribute form is engine-independent.

Only an exact `#identifier` is rewritten — that is what the ~604 getElementById call sites
migrate to. Compound selectors are passed through untouched (rewriting inside them risks
mangling quoted attribute values), so they remain subject to the engine quirk above.

#### Parameters

##### sel

`string`

#### Returns

`Element`

***

### $$()

> **$$**(`sel`): `Element`[]

Defined in: [package/fimMap.js:203](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L203)

#### Parameters

##### sel

`string`

#### Returns

`Element`[]

***

### addDataset()

> **addDataset**(`source`, `options?`): `Promise`\<[`Dataset`](../../dataset/classes/Dataset.md)\>

Defined in: [package/fimMap.js:315](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L315)

Parse a source (File | Blob | ArrayBuffer | URL) into a Dataset and register it on this
instance. Returns the Dataset (not yet rendered — addLayer draws it).

#### Parameters

##### source

`string` \| `ArrayBuffer` \| `File` \| `Blob`

##### options?

`any` = `{}`

#### Returns

`Promise`\<[`Dataset`](../../dataset/classes/Dataset.md)\>

***

### addLayer()

> **addLayer**(`type?`, `opts?`): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: [package/fimMap.js:341](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L341)

Create a rendered Layer of `type`. Dispatches to the subsystem factory registered via
registerLayerType. `type` can be a bare Dataset instead of a registry string — `fim.addLayer(ds)`
— or omitted, in either case inferred from the (single) source's `Dataset.kind` (see
createLayer). A raw File/Blob/ArrayBuffer/URL works too, in the `type` slot or in
`opts.source`/`opts.sources` — it is parsed into a Dataset via addDataset() first (and lands in
`this.datasets`, same as calling addDataset() yourself), so `fim.addLayer(file)` needs no separate
addDataset() step. Throws for types with no registered factory. Some factories (e.g. 'raster', whose
RasterLayer.render() is the async base implementation) return a Promise rather than a Layer, so
this must await before pushing — pushing an un-awaited Promise onto `this.layers` would silently
corrupt the registry for every consumer that iterates it.

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

### adoptDataset()

> **adoptDataset**(`ds`): `any`

Defined in: [package/fimMap.js:153](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L153)

Register a Dataset parsed elsewhere on this map's app.

#### Parameters

##### ds

`any`

#### Returns

`any`

***

### bindActions()

> **bindActions**(): `FimMap`

Defined in: [package/fimMap.js:271](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L271)

Attach the delegated listener to this instance's root. Idempotent.

#### Returns

`FimMap`

***

### captureInteraction()

> **captureInteraction**(`handler`): () => `void`

Defined in: [package/fimMap.js:503](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L503)

Register a MODAL interaction (e.g. a region-draw tool) that takes ALL map events until released.
While captured, the normal layer dispatch + `map:${type}` mirror are suppressed — every event
goes only to `handler({ type, lat, lng, originalEvent })`. Returns a release function; only one
capture at a time (a new one replaces the prior). PACKAGE_ROADMAP §1.

#### Parameters

##### handler

(`evt`) => `void`

#### Returns

() => `void`

***

### destroy()

> **destroy**(): `void`

Defined in: [package/fimMap.js:528](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L528)

Best-effort teardown for SPA unmount. Detaches the map, removes injected markup, and
releases this map from its app (which frees the ambient default's shared services when
the last map goes). Module-level singletons in host subsystems are NOT reset.

#### Returns

`void`

***

### disableMapEvents()

> **disableMapEvents**(): `FimMap`

Defined in: [package/fimMap.js:480](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L480)

Stop routing provider map events.

#### Returns

`FimMap`

***

### emit()

> **emit**(`evt`, `payload?`): `FimMap`

Defined in: [package/fimMap.js:212](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L212)

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

Defined in: [package/fimMap.js:464](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L464)

Start routing provider map events (default: click + hover) to layers via hitTest + z-order
dispatch, and mirror each as `map:${type}` on the bus. Idempotent; needs a mounted map and a
provider that implements onMapEvent.

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

Defined in: [package/fimMap.js:263](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L263)

The handler for `name` — this instance's registry first, then the transitional window bridge.

#### Parameters

##### name

`string`

#### Returns

`Function`

***

### getLayer()

> **getLayer**(`id`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/fimMap.js:377](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L377)

The Layer with this id (or null).

#### Parameters

##### id

`string`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

***

### getLayerByName()

> **getLayerByName**(`name`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/fimMap.js:399](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L399)

The named user-file Layer for `name` (or null).

#### Parameters

##### name

`string`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

***

### off()

> **off**(`evt`, `fn`): `FimMap`

Defined in: [package/fimMap.js:210](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L210)

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

Defined in: [package/fimMap.js:208](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L208)

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

Defined in: [package/fimMap.js:242](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L242)

Register a handler for `data-action="name"`.

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

Defined in: [package/fimMap.js:253](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L253)

Register many at once: registerActions({ foo, bar }).

#### Parameters

##### map?

#### Returns

`FimMap`

***

### registerNamedLayer()

> **registerNamedLayer**(`name`, `layer`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/fimMap.js:388](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L388)

Register a Layer under a filename key — the user-file registry that floodExtent's
toggle_uploaded_file drives (one displayed user file → one Layer). Wires the up-chain `_map`
ref so layer.remove() can unregister itself, evicts any prior layer under the same name, and
adds the layer to `this.layers`.

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

Defined in: [package/fimMap.js:508](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L508)

Release any modal interaction, restoring normal layer dispatch.

#### Returns

`FimMap`

***

### removeDataset()

> **removeDataset**(`ds`, `opts?`): `boolean`

Defined in: [package/fimMap.js:160](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L160)

Forget a Dataset — drops it from the app registry and releases its decode. Throws while any
layer on this app still renders it (pass `{ force: true }` to override).

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

Defined in: [package/fimMap.js:405](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimMap.js#L405)

Remove a Layer by id or instance — tears down its render and unregisters it.

#### Parameters

##### idOrLayer

`string` \| [`Layer`](../../layer/classes/Layer.md)

#### Returns

`void`
