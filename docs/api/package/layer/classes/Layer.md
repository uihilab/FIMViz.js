[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / Layer

# Class: Layer

Defined in: [package/layer.js:48](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L48)

## Extended by

- [`RasterLayer`](RasterLayer.md)
- [`VectorLayer`](VectorLayer.md)
- [`ComparisonLayer`](../../comparisonLayer/classes/ComparisonLayer.md)
- [`EnsembleAggregationLayer`](../../ensembleAggregationLayer/classes/EnsembleAggregationLayer.md)

## Constructors

### Constructor

> **new Layer**(`opts?`): `Layer`

Defined in: [package/layer.js:56](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L56)

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

### \_dirty

> **\_dirty**: `boolean`

Defined in: [package/layer.js:202](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L202)

***

### \_emitter

> **\_emitter**: `any`

Defined in: [package/layer.js:68](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L68)

***

### \_map

> **\_map**: [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: [package/layer.js:60](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L60)

***

### \_name

> **\_name**: `any`

Defined in: [package/layer.js:66](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L66)

***

### \_origin

> **\_origin**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:295](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L295)

***

### \_removed

> **\_removed**: `boolean`

Defined in: [package/layer.js:407](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L407)

***

### \_teardown

> **\_teardown**: `any`

Defined in: [package/layer.js:67](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L67)

***

### exclusive

> **exclusive**: `any`

Defined in: [package/layer.js:65](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L65)

***

### id

> **id**: `string`

Defined in: [package/layer.js:57](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L57)

***

### result

> **result**: `any`

Defined in: [package/layer.js:174](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L174)

***

### sources

> **sources**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:59](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L59)

***

### type

> **type**: `string`

Defined in: [package/layer.js:58](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L58)

***

### visible

> **visible**: `boolean`

Defined in: [package/layer.js:61](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L61)

## Accessors

### dataset

#### Get Signature

> **get** **dataset**(): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: [package/layer.js:99](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L99)

Convenience = sources[0].

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

***

### dirty

#### Get Signature

> **get** **dirty**(): `boolean`

Defined in: [package/layer.js:305](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L305)

Has an op been applied that the last render() has not drawn yet?

##### Returns

`boolean`

***

### map

#### Get Signature

> **get** **map**(): [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: [package/layer.js:97](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L97)

The owning FimMap.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)

***

### settings

#### Get Signature

> **get** **settings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: [package/layer.js:467](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L467)

This layer's settings knobs. Lazily built; subclasses override
_makeSettings() to supply Raster/Vector knobs. Mutating a knob (`layer.set({...})`)
emits the effect event (restyle/recomputed) and re-renders when live.

##### Returns

[`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

## Methods

### \_checkProviderCRS()

> **\_checkProviderCRS**(): `void`

Defined in: [package/layer.js:383](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L383)

Strict CRS precondition: every source Dataset whose native CRS the active provider CANNOT render
blocks the render with an actionable error, AND emits a host event so the app can react (toast, or
auto-reproject as an app-tier policy). Mechanism here; policy in the host — the engine never
silently reprojects.

#### Returns

`void`

***

### \_draw()

> **\_draw**(`opts?`): `void` \| `Promise`\<`void`\>

Defined in: [package/layer.js:374](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L374)

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

Defined in: [package/layer.js:115](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L115)

Does this layer have at least one listener for `evt`? Lets the map dispatch skip uninterested layers.

#### Parameters

##### evt

`string`

#### Returns

`boolean`

***

### \_makeSettings()

> **\_makeSettings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: [package/layer.js:469](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L469)

#### Returns

[`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

***

### \_op()

> **\_op**(`name`, `fn`): `Layer`

Defined in: [package/layer.js:284](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L284)

Apply one Dataset op across every source, immediately. Invalidates the memoized compute and
marks the layer dirty; draws nothing until `render()`.

#### Parameters

##### name

`string`

the op, for error messages

##### fn

(`ds`) => [`Dataset`](../../dataset/classes/Dataset.md)

#### Returns

`Layer`

***

### \_resolveRenderMode()

> **\_resolveRenderMode**(`requested`): `"in-place"` \| `"recreate"`

Defined in: [package/layer.js:362](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L362)

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

Defined in: [package/layer.js:371](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L371)

Does this layer render a swappable raster image (the in-place-capable case)? RasterLayer overrides.

#### Returns

`boolean`

***

### aspect()

> **aspect**(): `Layer`

Defined in: [package/layer.js:334](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L334)

Downslope compass bearing.

#### Returns

`Layer`

***

### clip()

> **clip**(`bbox`): `Layer`

Defined in: [package/layer.js:322](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L322)

Crop to a bbox.

#### Parameters

##### bbox

###### east

`number`

###### north

`number`

###### south

`number`

###### west

`number`

#### Returns

`Layer`

***

### compute()

> **compute**(`opts?`): `Promise`\<`any`\>

Defined in: [package/layer.js:172](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L172)

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

Defined in: [package/layer.js:253](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L253)

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

Defined in: [package/layer.js:139](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L139)

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

Defined in: [package/layer.js:152](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L152)

Fit the map to this layer's bounds.

#### Returns

`void`

***

### get()

> **get**(): `any`

Defined in: [package/layer.js:488](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L488)

Read current settings.

#### Returns

`any`

***

### getLegend()

> **getLegend**(): [`Legend`](../../legend/classes/Legend.md)

Defined in: [package/layer.js:456](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L456)

#### Returns

[`Legend`](../../legend/classes/Legend.md)

***

### getStats()

> **getStats**(): `Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

Defined in: [package/layer.js:458](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L458)

#### Returns

`Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

***

### hide()

> **hide**(): `void`

Defined in: [package/layer.js:150](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L150)

#### Returns

`void`

***

### hillshade()

> **hillshade**(`opts?`): `Layer`

Defined in: [package/layer.js:336](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L336)

Shaded relief.

#### Parameters

##### opts?

`any`

#### Returns

`Layer`

***

### hitTest()

> **hitTest**(`lat`, `lng`): `boolean`

Defined in: [package/layer.js:497](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L497)

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

### mask()

> **mask**(`polygon`, `opts?`): `Layer`

Defined in: [package/layer.js:324](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L324)

Pixels outside `polygon` (or inside, with `{invert:true}`) become noData.

#### Parameters

##### polygon

`any`

##### opts?

`any`

#### Returns

`Layer`

***

### off()

> **off**(`evt`, `fn`): `void`

Defined in: [package/layer.js:109](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L109)

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

Defined in: [package/layer.js:103](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L103)

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

Defined in: [package/layer.js:117](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L117)

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

`Layer`

***

### rasterize()

> **rasterize**(): `never`

Defined in: [package/layer.js:348](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L348)

NOT chainable, on purpose. `rasterize` changes a Dataset's kind (vector → raster), and this
layer draws the kind it was built for — returning `this` would leave a VectorLayer pointing at a
raster it cannot draw. Do it on the Dataset and add the result as its own layer.

#### Returns

`never`

***

### reclassify()

> **reclassify**(`rules`, `opts?`): `Layer`

Defined in: [package/layer.js:326](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L326)

Remap pixel values by rules or a callback.

#### Parameters

##### rules

`Function` \| `any`[]

##### opts?

`any`

#### Returns

`Layer`

***

### reduce()

> **reduce**(`op?`, `opts?`): `Layer`

Defined in: [package/layer.js:340](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L340)

Collapse a selection axis to one grid.

#### Parameters

##### op?

`string`

##### opts?

`any`

#### Returns

`Layer`

***

### remove()

> **remove**(`__namedParameters?`): `void`

Defined in: [package/layer.js:405](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L405)

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

Defined in: [package/layer.js:187](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L187)

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

### reproject()

> **reproject**(`toCrs`): `Layer`

Defined in: [package/layer.js:330](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L330)

Warp to `toCrs` — forced at render, GDAL loaded then.

#### Parameters

##### toCrs

`string`

#### Returns

`Layer`

***

### resampleTo()

> **resampleTo**(`target`, `opts?`): `Layer`

Defined in: [package/layer.js:328](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L328)

Resample onto an explicit target grid (does not reproject).

#### Parameters

##### target

`any`

##### opts?

`any`

#### Returns

`Layer`

***

### reset()

> **reset**(`opts?`): `Promise`\<`Layer`\>

Defined in: [package/layer.js:313](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L313)

Point the layer back at the sources it held before its first op. Async and atomic, like any
source swap — a live layer re-renders. A no-op if nothing has been applied.

#### Parameters

##### opts?

`any` = `{}`

{ render?: 'auto'|'in-place'|'recreate' }

#### Returns

`Promise`\<`Layer`\>

***

### select()

> **select**(`coord`, `opts?`): `Layer`

Defined in: [package/layer.js:338](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L338)

Resolve one selection-axis entry (the scenario-slider op).

#### Parameters

##### coord

`string` \| `number`

##### opts?

`any`

#### Returns

`Layer`

***

### set()

> **set**(`partial`): `Layer`

Defined in: [package/layer.js:486](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L486)

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

Defined in: [package/layer.js:223](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L223)

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

Defined in: [package/layer.js:490](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L490)

Resolves once any redraw kicked off by `set()` has finished.

#### Returns

`Promise`\<`Layer`\>

***

### show()

> **show**(): `void`

Defined in: [package/layer.js:148](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L148)

#### Returns

`void`

***

### slope()

> **slope**(`opts?`): `Layer`

Defined in: [package/layer.js:332](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L332)

Slope (Horn's method).

#### Parameters

##### opts?

`any`

#### Returns

`Layer`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [package/layer.js:500](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L500)

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

Defined in: [package/layer.js:444](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L444)

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

***

### registerType()

> `static` **registerType**(`type`, `factory`): `void`

Defined in: [package/layer.js:87](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L87)

Register the factory `fim.addLayer('<type>')` dispatches to.

#### Parameters

##### type

`string`

##### factory

(`fim`, `opts`) => `Layer` \| `Promise`\<`Layer`\>

#### Returns

`void`

***

### types()

> `static` **types**(): `string`[]

Defined in: [package/layer.js:94](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L94)

Every type `addLayer` can currently construct — built-ins plus anything a host registered.
REGISTRY KEYS, not `layer.type` values (see `getLayerTypes`).

#### Returns

`string`[]
