[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / Layer

# Class: Layer

Defined in: package/layer.js:32

## Extended by

- [`RasterLayer`](RasterLayer.md)
- [`VectorLayer`](VectorLayer.md)
- [`ComparisonLayer`](../../comparisonLayer/classes/ComparisonLayer.md)
- [`EnsembleAggregationLayer`](../../ensembleAggregationLayer/classes/EnsembleAggregationLayer.md)

## Constructors

### Constructor

> **new Layer**(`opts?`): `Layer`

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

`Layer`

## Properties

### \_emitter

> **\_emitter**: `any`

Defined in: package/layer.js:52

***

### \_map

> **\_map**: [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: package/layer.js:44

***

### \_name

> **\_name**: `any`

Defined in: package/layer.js:50

***

### \_removed

> **\_removed**: `boolean`

Defined in: package/layer.js:271

***

### \_teardown

> **\_teardown**: `any`

Defined in: package/layer.js:51

***

### exclusive

> **exclusive**: `any`

Defined in: package/layer.js:49

***

### id

> **id**: `string`

Defined in: package/layer.js:41

***

### result

> **result**: `any`

Defined in: package/layer.js:137

***

### sources

> **sources**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: package/layer.js:43

***

### type

> **type**: `string`

Defined in: package/layer.js:42

***

### visible

> **visible**: `boolean`

Defined in: package/layer.js:45

## Accessors

### dataset

#### Get Signature

> **get** **dataset**(): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: package/layer.js:62

Convenience = sources[0].

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

***

### map

#### Get Signature

> **get** **map**(): [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: package/layer.js:60

The owning FimMap.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)

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

***

### \_makeSettings()

> **\_makeSettings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: package/layer.js:333

#### Returns

[`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

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

***

### \_usesRasterImage()

> **\_usesRasterImage**(): `boolean`

Defined in: package/layer.js:235

Does this layer render a swappable raster image (the in-place-capable case)? RasterLayer overrides.

#### Returns

`boolean`

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

***

### deriveSources()

> **deriveSources**(`fn`, `opts?`): `Promise`\<`Layer`\>

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

`Promise`\<`Layer`\>

***

### emit()

> **emit**(`evt`, `payload?`): `Layer`

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

`Layer`

***

### fit()

> **fit**(): `void`

Defined in: package/layer.js:115

Fit the map to this layer's bounds.

#### Returns

`void`

***

### get()

> **get**(): `any`

Defined in: package/layer.js:352

Read current settings.

#### Returns

`any`

***

### getLegend()

> **getLegend**(): [`Legend`](../../legend/classes/Legend.md)

Defined in: package/layer.js:320

#### Returns

[`Legend`](../../legend/classes/Legend.md)

***

### getStats()

> **getStats**(): `Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

Defined in: package/layer.js:322

#### Returns

`Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

***

### hide()

> **hide**(): `void`

Defined in: package/layer.js:113

#### Returns

`void`

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

***

### on()

> **on**(`evt`, `fn`): `Layer`

Defined in: package/layer.js:66

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

`Layer`

***

### once()

> **once**(`evt`, `fn`): `Layer`

Defined in: package/layer.js:80

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

`Layer`

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

***

### render()

> **render**(`opts?`): `Promise`\<`Layer`\>

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

`Promise`\<`Layer`\>

***

### set()

> **set**(`partial`): `Layer`

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

`Layer`

***

### setSources()

> **setSources**(`sources`, `opts?`): `Promise`\<`Layer`\>

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

`Promise`\<`Layer`\>

***

### settled()

> **settled**(): `Promise`\<`Layer`\>

Defined in: package/layer.js:354

Resolves once any redraw kicked off by `set()` has finished.

#### Returns

`Promise`\<`Layer`\>

***

### show()

> **show**(): `void`

Defined in: package/layer.js:111

#### Returns

`void`

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
