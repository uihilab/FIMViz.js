[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/ensembleAggregationLayer](../README.md) / EnsembleAggregationLayer

# Class: EnsembleAggregationLayer

Defined in: package/ensembleAggregationLayer.js:35

## Extends

- [`Layer`](../../layer/classes/Layer.md)

## Constructors

### Constructor

> **new EnsembleAggregationLayer**(`opts?`): `EnsembleAggregationLayer`

Defined in: package/ensembleAggregationLayer.js:39

#### Parameters

##### opts?

`any` = `{}`

see `Layer`'s constructor; `sources` here are `{pixels, meta}` or `RasterLayer`

#### Returns

`EnsembleAggregationLayer`

#### Overrides

[`Layer`](../../layer/classes/Layer.md).[`constructor`](../../layer/classes/Layer.md#constructor)

## Properties

### \_aligned

> **\_aligned**: `any`

Defined in: package/ensembleAggregationLayer.js:42

***

### \_emitter

> **\_emitter**: `any`

Defined in: package/layer.js:52

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_emitter`](../../layer/classes/Layer.md#_emitter)

***

### \_grid

> **\_grid**: `object`

Defined in: package/ensembleAggregationLayer.js:43

#### be

> **be**: `number`

#### bn

> **bn**: `number`

#### bs

> **bs**: `number`

#### bw

> **bw**: `number`

#### height

> **height**: `number`

#### width

> **width**: `number`

***

### \_map

> **\_map**: [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: package/layer.js:44

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_map`](../../layer/classes/Layer.md#_map)

***

### \_name

> **\_name**: `any`

Defined in: package/layer.js:50

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_name`](../../layer/classes/Layer.md#_name)

***

### \_removed

> **\_removed**: `boolean`

Defined in: package/layer.js:271

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_removed`](../../layer/classes/Layer.md#_removed)

***

### \_teardown

> **\_teardown**: `any`

Defined in: package/layer.js:51

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_teardown`](../../layer/classes/Layer.md#_teardown)

***

### exclusive

> **exclusive**: `any`

Defined in: package/layer.js:49

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`exclusive`](../../layer/classes/Layer.md#exclusive)

***

### id

> **id**: `string`

Defined in: package/layer.js:41

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`id`](../../layer/classes/Layer.md#id)

***

### result

> **result**: `any`

Defined in: package/ensembleAggregationLayer.js:41

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`result`](../../layer/classes/Layer.md#result)

***

### sources

> **sources**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: package/layer.js:43

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`sources`](../../layer/classes/Layer.md#sources)

***

### type

> **type**: `string`

Defined in: package/layer.js:42

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`type`](../../layer/classes/Layer.md#type)

***

### visible

> **visible**: `boolean`

Defined in: package/layer.js:45

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`visible`](../../layer/classes/Layer.md#visible)

## Accessors

### dataset

#### Get Signature

> **get** **dataset**(): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: package/layer.js:62

Convenience = sources[0].

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`dataset`](../../layer/classes/Layer.md#dataset)

***

### map

#### Get Signature

> **get** **map**(): [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: package/layer.js:60

The owning FimMap.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`map`](../../layer/classes/Layer.md#map)

***

### settings

#### Get Signature

> **get** **settings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: package/layer.js:331

This layer's settings knobs. Lazily built; subclasses override
_makeSettings() to supply Raster/Vector knobs. Mutating a knob (`layer.set({...})`)
emits the effect event (restyle/recomputed) and re-renders when live.

##### Returns

[`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`settings`](../../layer/classes/Layer.md#settings)

## Methods

### \_checkProviderCRS()

> **\_checkProviderCRS**(): `void`

Defined in: package/layer.js:247

Strict CRS precondition: every source Dataset whose native CRS the active provider CANNOT render
blocks the render with an actionable error, AND emits a host event so the app can react (toast, or
auto-reproject as an app-tier policy). Mechanism here; policy in the host — the engine never
silently reprojects.

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_checkProviderCRS`](../../layer/classes/Layer.md#_checkprovidercrs)

***

### \_draw()

> **\_draw**(`opts?`): `void` \| `Promise`\<`void`\>

Defined in: package/layer.js:238

The provider-specific draw step. Base is a no-op (headless layers render via a binder).

#### Parameters

##### opts?

`any`

carries the resolved `mode`.

#### Returns

`void` \| `Promise`\<`void`\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_draw`](../../layer/classes/Layer.md#_draw)

***

### \_hasListeners()

> **\_hasListeners**(`evt`): `boolean`

Defined in: package/layer.js:78

Does this layer have at least one listener for `evt`? Lets the map dispatch skip uninterested layers.

#### Parameters

##### evt

`string`

#### Returns

`boolean`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_hasListeners`](../../layer/classes/Layer.md#_haslisteners)

***

### \_makeSettings()

> **\_makeSettings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: package/layer.js:333

#### Returns

[`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_makeSettings`](../../layer/classes/Layer.md#_makesettings)

***

### \_resolveRenderMode()

> **\_resolveRenderMode**(`requested`): `"in-place"` \| `"recreate"`

Defined in: package/layer.js:226

Resolve the render update mode. An explicit 'in-place'/'recreate' wins; 'auto' asks provider
CAPABILITY (does it expose setRasterImageUrl?) + layer TYPE (does this layer render a swappable
raster image?). Vector layers and providers without in-place swap fall back to recreate.

#### Parameters

##### requested

`string`

#### Returns

`"in-place"` \| `"recreate"`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_resolveRenderMode`](../../layer/classes/Layer.md#_resolverendermode)

***

### \_usesRasterImage()

> **\_usesRasterImage**(): `boolean`

Defined in: package/layer.js:235

Does this layer render a swappable raster image (the in-place-capable case)? RasterLayer overrides.

#### Returns

`boolean`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_usesRasterImage`](../../layer/classes/Layer.md#_usesrasterimage)

***

### compute()

> **compute**(`o?`): `object`

Defined in: package/ensembleAggregationLayer.js:60

Align the members → agreement count → N-colour ramp. Emits `computed` with
{ grid, rgba, perPixel, histogram, nLayers, policy, method, warnings } and returns it.

`policy`/`method` default (high/nearest) with a warning when omitted/unknown; `colors` is the
N-colour agreement ramp (omitted → a viridis ramp + a warning, from the reducer). All warnings —
resampling + colour — are merged so the host surfaces one list.

#### Parameters

##### o?

###### colors?

`string`[] = `null`

###### dryValue?

`number` = `DRY_DEFAULT`

###### method?

`string`

###### policy?

`"low"` \| `"high"` \| `"average"`

#### Returns

`object`

##### grid

> **grid**: `any`

##### histogram

> **histogram**: `Uint32Array`

##### method

> **method**: `string`

##### nLayers

> **nLayers**: `number`

##### perPixel

> **perPixel**: `Uint8Array`

##### policy

> **policy**: `string`

##### rgba

> **rgba**: `Uint8ClampedArray`

##### warnings

> **warnings**: `string`[]

#### Overrides

[`Layer`](../../layer/classes/Layer.md).[`compute`](../../layer/classes/Layer.md#compute)

***

### deriveSources()

> **deriveSources**(`fn`, `opts?`): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: package/layer.js:215

"Hot-modify": derive new sources FROM the current ones and swap them in. Because the derived
Dataset shares memoized ancestors with the old, only the changed tail recomputes — a cheap live
tweak (e.g. re-classify with a new threshold) versus a cold source swap. Sugar over setSources.

#### Parameters

##### fn

(`current`) => [`Dataset`](../../dataset/classes/Dataset.md) \| [`Dataset`](../../dataset/classes/Dataset.md)[]

##### opts?

`any` = `{}`

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`deriveSources`](../../layer/classes/Layer.md#derivesources)

***

### emit()

> **emit**(`evt`, `payload?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: package/layer.js:102

Fire `evt`. Listeners receive `{ ...payload, layer: this }`.

The event goes to TWO places, so these two subscriptions see the same event:

  layer.on('rendered')              — this ONE layer's lifecycle (per-object subscription)
  fim.on('userRaster:rendered')     — ANY layer of that type on this map (per-map subscription)

The per-map form is derived from the per-layer one by forwarding under `${type}:${evt}`, so a new
layer type gets it with no extra wiring.

Forwarding is skipped when the layer has no `type` (nothing to namespace with) or no owning map.
Subsystems that emit on the map bus directly (velocity/ensemble/depth emit their own
`*:activated` names) are unaffected — those are distinct event names, so nothing double-fires.

#### Parameters

##### evt

`string`

##### payload?

`any` = `{}`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`emit`](../../layer/classes/Layer.md#emit)

***

### fit()

> **fit**(): `void`

Defined in: package/layer.js:115

Fit the map to this layer's bounds.

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`fit`](../../layer/classes/Layer.md#fit)

***

### get()

> **get**(): `any`

Defined in: package/layer.js:352

Read current settings.

#### Returns

`any`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`get`](../../layer/classes/Layer.md#get)

***

### getAligned()

> **getAligned**(): `any`[]

Defined in: package/ensembleAggregationLayer.js:93

The aligned per-member pixel arrays from the last compute() (all on `result.grid`).

#### Returns

`any`[]

***

### getLegend()

> **getLegend**(): [`Legend`](../../legend/classes/Legend.md)

Defined in: package/layer.js:320

#### Returns

[`Legend`](../../legend/classes/Legend.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`getLegend`](../../layer/classes/Layer.md#getlegend)

***

### getStats()

> **getStats**(): `Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

Defined in: package/layer.js:322

#### Returns

`Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`getStats`](../../layer/classes/Layer.md#getstats)

***

### hide()

> **hide**(): `void`

Defined in: package/layer.js:113

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`hide`](../../layer/classes/Layer.md#hide)

***

### hitTest()

> **hitTest**(`lat`, `lng`): `boolean`

Defined in: package/layer.js:361

Does the point fall on this layer? Base: no geometry → false. RasterLayer tests its footprint;
VectorLayer tests feature geometry. The map event dispatch uses this to route hover/click.

#### Parameters

##### lat

`number`

##### lng

`number`

#### Returns

`boolean`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`hitTest`](../../layer/classes/Layer.md#hittest)

***

### off()

> **off**(`evt`, `fn`): `void`

Defined in: package/layer.js:72

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`off`](../../layer/classes/Layer.md#off)

***

### on()

> **on**(`evt`, `fn`): [`Layer`](../../layer/classes/Layer.md)

Defined in: package/layer.js:66

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`on`](../../layer/classes/Layer.md#on)

***

### once()

> **once**(`evt`, `fn`): [`Layer`](../../layer/classes/Layer.md)

Defined in: package/layer.js:80

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`once`](../../layer/classes/Layer.md#once)

***

### prepare()

> **prepare**(): `Promise`\<`EnsembleAggregationLayer`\>

Defined in: package/ensembleAggregationLayer.js:86

Materialize any Dataset members into RasterGrids so the synchronous compute() can consume them
(`await layer.prepare(); layer.compute(opts)`). Non-Dataset members pass through untouched.

#### Returns

`Promise`\<`EnsembleAggregationLayer`\>

***

### remove()

> **remove**(`__namedParameters?`): `void`

Defined in: package/layer.js:269

Tear down render, emit 'removed', then unregister from the owning FimMap. Subclasses
super.remove() last. If a `_teardown` hook was assigned (transitional: user-file Layers built
inline in floodExtent carry their google.maps teardown here instead of in a dedicated
subclass), it runs once before the event. 'removed' fires SYNCHRONOUSLY here — a subscriber
(the tools panel) reacts now, not on google.maps' later onRemove() frame, which is what makes
layer switches deterministic instead of racing.

#### Parameters

##### \_\_namedParameters?

###### purgeSource?

`boolean` = `false`

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`remove`](../../layer/classes/Layer.md#remove)

***

### render()

> **render**(`opts?`): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: package/layer.js:150

Render this layer: compute if needed, enforce the provider CRS precondition, then draw. `opts.render`
picks the update mechanism — `'in-place'` (swap the overlay's image, no flicker, keeps z-order/
identity), `'recreate'` (teardown + redraw), or `'auto'` (default: in-place when the provider + this
layer's render type support it, else recreate). Claims the exclusive
display slot on success when `this.exclusive`.

#### Parameters

##### opts?

`any` = `{}`

{ render?: 'auto'|'in-place'|'recreate' }

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`render`](../../layer/classes/Layer.md#render)

***

### set()

> **set**(`partial`): [`Layer`](../../layer/classes/Layer.md)

Defined in: package/layer.js:350

THE way to change how this layer looks. Sync and chainable — returns the layer.

  layer.set({ palette: 'viridis', continuous: true, opacity: 0.8 });

Raster knobs: `palette`, `continuous`, `colorScale`, `noData`, `opacity`, `hover`.
Vector knobs: `color`, `opacity`, `useFileColors`, `hover`.

This is the single path for changing a layer's appearance. `layer.colorScale` stays readable,
and `ColorScale` keeps its own `set()` for building a scale before you hand it over.

A knob that needs a redraw (only `noData`) redraws; `await layer.settled()` if you need to know
it finished.

#### Parameters

##### partial

`any`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`set`](../../layer/classes/Layer.md#set)

***

### setSources()

> **setSources**(`sources`, `opts?`): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: package/layer.js:185

Replace this layer's source Datasets and, if the layer is already live, re-render. Immutable data
means "the data changed" == "point at a new Dataset" — never mutate. Drives the FimMap's Dataset
ref-count (acquire the new before releasing the old, so a Dataset shared with another layer is not
evicted mid-swap). `opts.render` chooses the update mechanism (see render()).

ATOMIC: if the re-render throws (e.g. the new sources have an unrenderable CRS, or a materializer
fetch fails), the swap is rolled back — `sources`/`result` revert to their previous values, the
new sources' ref-count acquire is undone, and the error rethrows. What's actually on screen never
changed either way (a failed render draws nothing new), so this keeps the layer's own state
truthful to that: either the swap fully succeeded, or the layer is left exactly as it was before
the call — never pointing at broken new sources with the working old ones already let go.

#### Parameters

##### sources

[`Dataset`](../../dataset/classes/Dataset.md) \| [`Dataset`](../../dataset/classes/Dataset.md)[]

##### opts?

`any` = `{}`

{ render?: 'auto'|'in-place'|'recreate' }

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`setSources`](../../layer/classes/Layer.md#setsources)

***

### settled()

> **settled**(): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: package/layer.js:354

Resolves once any redraw kicked off by `set()` has finished.

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`settled`](../../layer/classes/Layer.md#settled)

***

### show()

> **show**(): `void`

Defined in: package/layer.js:111

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`show`](../../layer/classes/Layer.md#show)

***

### toJSON()

> **toJSON**(): `object`

Defined in: package/layer.js:364

#### Returns

`object`

##### id

> **id**: `string`

##### sources

> **sources**: `string`[]

##### type

> **type**: `string`

##### visible

> **visible**: `boolean`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`toJSON`](../../layer/classes/Layer.md#tojson)

***

### toSpec()

> **toSpec**(): `object`

Defined in: package/layer.js:308

A plain, structured-cloneable DESCRIPTION of this layer — its type, its sources, and the
display state needed to rebuild an equivalent one, e.g. on a different map or provider:

  map2.addLayer(layer1.toSpec());

This is deliberately a COPY, not a handle. `addLayer(spec)` builds a NEW ColorScale from the
description, so the two layers diverge rather than silently sharing mutable colour state —
which is exactly the question a `clone()` API cannot answer for the caller. The layer's `id`
and its event subscribers are not carried either.

`sources` are the live `Dataset` objects (free values, safe to share and already decoded). To
persist a spec instead of transferring it in-page, swap them for `ds.toRecord()`.

#### Returns

`object`

##### colorScale

> **colorScale**: `any`

##### settings

> **settings**: `any`

##### sources

> **sources**: `any`[]

##### type

> **type**: `string`

##### visible

> **visible**: `boolean`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`toSpec`](../../layer/classes/Layer.md#tospec)
