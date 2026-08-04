[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / VectorLayer

# Class: VectorLayer

Defined in: package/layer.js:669

## Extends

- [`Layer`](Layer.md)

## Constructors

### Constructor

> **new VectorLayer**(`opts?`): `VectorLayer`

Defined in: package/layer.js:40

#### Parameters

##### opts?

###### id?

`string`

stable id; auto-generated when omitted

###### map?

[`FimMap`](../../fimMap/classes/FimMap.md) = `null`

the owning FimMap

###### sources?

[`Dataset`](../../dataset/classes/Dataset.md)[] = `[]`

1 for most layers; 2 for comparison/velocity

###### type?

`string` = `null`

discriminator among siblings of one class (e.g. 'vector')

#### Returns

`VectorLayer`

#### Inherited from

[`Layer`](Layer.md).[`constructor`](Layer.md#constructor)

## Properties

### \_emitter

> **\_emitter**: `any`

Defined in: package/layer.js:52

#### Inherited from

[`Layer`](Layer.md).[`_emitter`](Layer.md#_emitter)

***

### \_map

> **\_map**: [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: package/layer.js:44

#### Inherited from

[`Layer`](Layer.md).[`_map`](Layer.md#_map)

***

### \_name

> **\_name**: `any`

Defined in: package/layer.js:50

#### Inherited from

[`Layer`](Layer.md).[`_name`](Layer.md#_name)

***

### \_removed

> **\_removed**: `boolean`

Defined in: package/layer.js:271

#### Inherited from

[`Layer`](Layer.md).[`_removed`](Layer.md#_removed)

***

### \_style

> **\_style**: `any`

Defined in: package/layer.js:691

***

### \_teardown

> **\_teardown**: `any`

Defined in: package/layer.js:51

#### Inherited from

[`Layer`](Layer.md).[`_teardown`](Layer.md#_teardown)

***

### dataLayer

> **dataLayer**: `any`

Defined in: package/layer.js:692

***

### exclusive

> **exclusive**: `any`

Defined in: package/layer.js:49

#### Inherited from

[`Layer`](Layer.md).[`exclusive`](Layer.md#exclusive)

***

### id

> **id**: `string`

Defined in: package/layer.js:41

#### Inherited from

[`Layer`](Layer.md).[`id`](Layer.md#id)

***

### result

> **result**: `any`

Defined in: package/layer.js:137

#### Inherited from

[`Layer`](Layer.md).[`result`](Layer.md#result)

***

### sources

> **sources**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: package/layer.js:43

#### Inherited from

[`Layer`](Layer.md).[`sources`](Layer.md#sources)

***

### type

> **type**: `string`

Defined in: package/layer.js:42

#### Inherited from

[`Layer`](Layer.md).[`type`](Layer.md#type)

***

### visible

> **visible**: `boolean`

Defined in: package/layer.js:45

#### Inherited from

[`Layer`](Layer.md).[`visible`](Layer.md#visible)

## Accessors

### dataset

#### Get Signature

> **get** **dataset**(): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: package/layer.js:62

Convenience = sources[0].

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

#### Inherited from

[`Layer`](Layer.md).[`dataset`](Layer.md#dataset)

***

### map

#### Get Signature

> **get** **map**(): [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: package/layer.js:60

The owning FimMap.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)

#### Inherited from

[`Layer`](Layer.md).[`map`](Layer.md#map)

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

[`Layer`](Layer.md).[`settings`](Layer.md#settings)

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

[`Layer`](Layer.md).[`_checkProviderCRS`](Layer.md#_checkprovidercrs)

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

[`Layer`](Layer.md).[`_draw`](Layer.md#_draw)

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

[`Layer`](Layer.md).[`_hasListeners`](Layer.md#_haslisteners)

***

### \_makeSettings()

> **\_makeSettings**(): [`VectorSettings`](../../layerSettings/classes/VectorSettings.md)

Defined in: package/layer.js:739

#### Returns

[`VectorSettings`](../../layerSettings/classes/VectorSettings.md)

#### Overrides

[`Layer`](Layer.md).[`_makeSettings`](Layer.md#_makesettings)

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

[`Layer`](Layer.md).[`_resolveRenderMode`](Layer.md#_resolverendermode)

***

### \_usesRasterImage()

> **\_usesRasterImage**(): `boolean`

Defined in: package/layer.js:235

Does this layer render a swappable raster image (the in-place-capable case)? RasterLayer overrides.

#### Returns

`boolean`

#### Inherited from

[`Layer`](Layer.md).[`_usesRasterImage`](Layer.md#_usesrasterimage)

***

### compute()

> **compute**(`opts?`): `Promise`\<`any`\>

Defined in: package/layer.js:135

Compute this layer's render-ready result. Default: force the primary source Dataset into its
decoded grid/features and memoize it on `this.result`. Subclasses override to align+reduce.

#### Parameters

##### opts?

`any` = `{}`

#### Returns

`Promise`\<`any`\>

#### Inherited from

[`Layer`](Layer.md).[`compute`](Layer.md#compute)

***

### deriveSources()

> **deriveSources**(`fn`, `opts?`): `Promise`\<[`Layer`](Layer.md)\>

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

`Promise`\<[`Layer`](Layer.md)\>

#### Inherited from

[`Layer`](Layer.md).[`deriveSources`](Layer.md#derivesources)

***

### emit()

> **emit**(`evt`, `payload?`): [`Layer`](Layer.md)

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

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`emit`](Layer.md#emit)

***

### featureAt()

> **featureAt**(`lat`, `lng`): `any`

Defined in: package/layer.js:784

The first feature whose geometry contains the point (polygons with holes; points within a small
epsilon), or null. Drives a marker/feature info window.

#### Parameters

##### lat

`number`

##### lng

`number`

#### Returns

`any`

***

### fit()

> **fit**(): `VectorLayer`

Defined in: package/layer.js:701

Fit the map to this layer's Dataset bounds, via the provider.

#### Returns

`VectorLayer`

#### Overrides

[`Layer`](Layer.md).[`fit`](Layer.md#fit)

***

### get()

> **get**(): `any`

Defined in: package/layer.js:352

Read current settings.

#### Returns

`any`

#### Inherited from

[`Layer`](Layer.md).[`get`](Layer.md#get)

***

### getLegend()

> **getLegend**(): [`Legend`](../../legend/classes/Legend.md)

Defined in: package/layer.js:320

#### Returns

[`Legend`](../../legend/classes/Legend.md)

#### Inherited from

[`Layer`](Layer.md).[`getLegend`](Layer.md#getlegend)

***

### getStats()

> **getStats**(`opts?`): `Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

Defined in: package/layer.js:751

Feature statistics over this layer's GeoJSON — counts by geometry type, total area/length, bbox.

Computed from the SOURCE (`dataset.data`), not from the provider's overlay handle, so it works
on every provider and before/without a render.

#### Parameters

##### opts?

###### filter?

`Function` \| `any`[] \| [`Filter`](../../filter/classes/Filter.md)

scope to a region/predicate

#### Returns

`Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

#### Overrides

[`Layer`](Layer.md).[`getStats`](Layer.md#getstats)

***

### hide()

> **hide**(): `VectorLayer`

Defined in: package/layer.js:715

Remove the vector overlay from the map (the provider contract has no vector "invisible" primitive
short of removing it). The base Layer.hide() only flips `.visible` — that alone doesn't touch
anything the provider drew, so the features stayed visible on the map through it. `show()` rebuilds
via `addVector` — the same remove-then-recreate shape `setStyle()` already uses. Chainable.

#### Returns

`VectorLayer`

#### Overrides

[`Layer`](Layer.md).[`hide`](Layer.md#hide)

***

### hitTest()

> **hitTest**(`lat`, `lng`): `boolean`

Defined in: package/layer.js:777

True if the point falls inside any feature geometry.

#### Parameters

##### lat

`number`

##### lng

`number`

#### Returns

`boolean`

#### Overrides

[`Layer`](Layer.md).[`hitTest`](Layer.md#hittest)

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

[`Layer`](Layer.md).[`off`](Layer.md#off)

***

### on()

> **on**(`evt`, `fn`): [`Layer`](Layer.md)

Defined in: package/layer.js:66

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`on`](Layer.md#on)

***

### once()

> **once**(`evt`, `fn`): [`Layer`](Layer.md)

Defined in: package/layer.js:80

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`once`](Layer.md#once)

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

[`Layer`](Layer.md).[`remove`](Layer.md#remove)

***

### render()

> **render**(`opts?`): `VectorLayer`

Defined in: package/layer.js:675

Draw this layer's Dataset on the map via the owning FimMap's provider.

#### Parameters

##### opts?

provider-native style (e.g. google.maps.Data style)

###### style?

`any`

#### Returns

`VectorLayer`

#### Overrides

[`Layer`](Layer.md).[`render`](Layer.md#render)

***

### set()

> **set**(`partial`): [`Layer`](Layer.md)

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

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`set`](Layer.md#set)

***

### setSources()

> **setSources**(`sources`, `opts?`): `Promise`\<[`Layer`](Layer.md)\>

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

`Promise`\<[`Layer`](Layer.md)\>

#### Inherited from

[`Layer`](Layer.md).[`setSources`](Layer.md#setsources)

***

### setStyle()

> **setStyle**(`patch?`): `VectorLayer`

Defined in: package/layer.js:765

Restyle: merge a neutral style patch and re-render (remove + re-add — the provider contract has
no in-place setVectorStyle).

#### Parameters

##### patch?

`any` = `{}`

#### Returns

`VectorLayer`

***

### settled()

> **settled**(): `Promise`\<[`Layer`](Layer.md)\>

Defined in: package/layer.js:354

Resolves once any redraw kicked off by `set()` has finished.

#### Returns

`Promise`\<[`Layer`](Layer.md)\>

#### Inherited from

[`Layer`](Layer.md).[`settled`](Layer.md#settled)

***

### show()

> **show**(): `VectorLayer`

Defined in: package/layer.js:727

Re-add the vector overlay to the map at its last style. Chainable.

#### Returns

`VectorLayer`

#### Overrides

[`Layer`](Layer.md).[`show`](Layer.md#show)

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

[`Layer`](Layer.md).[`toJSON`](Layer.md#tojson)

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

[`Layer`](Layer.md).[`toSpec`](Layer.md#tospec)
