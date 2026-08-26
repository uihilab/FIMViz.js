[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / Layer

# Class: Layer

Defined in: [package/layer.js:50](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L50)

## Extended by

- [`RasterLayer`](RasterLayer.md)
- [`VectorLayer`](VectorLayer.md)
- [`ComparisonLayer`](../../comparisonLayer/classes/ComparisonLayer.md)
- [`EnsembleAggregationLayer`](../../ensembleAggregationLayer/classes/EnsembleAggregationLayer.md)

## Constructors

### Constructor

> **new Layer**(`opts?`): `Layer`

Defined in: [package/layer.js:58](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L58)

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

Defined in: [package/layer.js:206](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L206)

***

### \_emitter

> **\_emitter**: `any`

Defined in: [package/layer.js:70](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L70)

***

### \_map

> **\_map**: [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: [package/layer.js:62](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L62)

***

### \_name

> **\_name**: `any`

Defined in: [package/layer.js:68](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L68)

***

### \_origin

> **\_origin**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:299](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L299)

***

### \_removed

> **\_removed**: `boolean`

Defined in: [package/layer.js:410](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L410)

***

### \_teardown

> **\_teardown**: `any`

Defined in: [package/layer.js:69](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L69)

***

### exclusive

> **exclusive**: `any`

Defined in: [package/layer.js:67](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L67)

***

### id

> **id**: `string`

Defined in: [package/layer.js:59](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L59)

***

### result

> **result**: `any`

Defined in: [package/layer.js:177](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L177)

***

### sources

> **sources**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:61](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L61)

***

### type

> **type**: `string`

Defined in: [package/layer.js:60](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L60)

***

### visible

> **visible**: `boolean`

Defined in: [package/layer.js:63](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L63)

## Accessors

### \_providerHandle

#### Get Signature

> **get** **\_providerHandle**(): `any`

Defined in: [package/layer.js:509](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L509)

The one opaque provider handle this layer owns, or null when it is not on the map.

A subclass stores its handle under a name that suits it, `overlay` for a raster and `dataLayer`
for a vector. This pair is the type-agnostic view, so `FimMap.applyLayerOrder` can restack a
mixed stack without knowing what each layer is.

##### Returns

`any`

***

### dataset

#### Get Signature

> **get** **dataset**(): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: [package/layer.js:100](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L100)

Convenience = sources[0].

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

***

### dirty

#### Get Signature

> **get** **dirty**(): `boolean`

Defined in: [package/layer.js:309](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L309)

Has an op been applied that the last render() has not drawn yet?

##### Returns

`boolean`

***

### map

#### Get Signature

> **get** **map**(): [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: [package/layer.js:98](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L98)

The owning FimMap.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)

***

### settings

#### Get Signature

> **get** **settings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: [package/layer.js:469](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L469)

This layer's settings knobs, built lazily. A subclass overrides _makeSettings() to supply raster
or vector knobs. Writing one with `layer.set({...})` emits 'restyle' or 'recomputed' and
re-renders when the layer is live.

##### Returns

[`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

## Methods

### \_adoptProviderHandle()

> **\_adoptProviderHandle**(`handle`): `void`

Defined in: [package/layer.js:512](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L512)

Adopts a handle the provider replaced, since Google recreates ground overlays to restack.

#### Parameters

##### handle

`any`

#### Returns

`void`

***

### \_checkProviderCRS()

> **\_checkProviderCRS**(): `void`

Defined in: [package/layer.js:387](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L387)

Blocks the render when a source Dataset's native CRS is one the active provider cannot draw,
throwing an actionable error and emitting a host event so the app can react with a toast or an
auto-reproject. The mechanism lives here and the policy lives in the host: the engine never
reprojects on its own.

#### Returns

`void`

***

### \_draw()

> **\_draw**(`opts?`): `void` \| `Promise`\<`void`\>

Defined in: [package/layer.js:378](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L378)

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

Defined in: [package/layer.js:116](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L116)

Does this layer have at least one listener for `evt`? Lets the map dispatch skip uninterested layers.

#### Parameters

##### evt

`string`

#### Returns

`boolean`

***

### \_makeSettings()

> **\_makeSettings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: [package/layer.js:471](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L471)

#### Returns

[`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

***

### \_op()

> **\_op**(`name`, `fn`): `Layer`

Defined in: [package/layer.js:288](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L288)

Applies one Dataset op across the sources immediately. Invalidates the memoized compute and
marks the layer dirty, drawing nothing until `render()`.

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

Defined in: [package/layer.js:366](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L366)

Resolves the render update mode. An explicit 'in-place' or 'recreate' wins. 'auto' checks
whether the provider exposes setRasterImageUrl and whether this layer draws a swappable raster
image. A vector layer, or a provider without in-place swap, falls back to recreate.

#### Parameters

##### requested

`string`

#### Returns

`"in-place"` \| `"recreate"`

***

### \_usesRasterImage()

> **\_usesRasterImage**(): `boolean`

Defined in: [package/layer.js:375](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L375)

Does this layer render a swappable raster image (the in-place-capable case)? RasterLayer overrides.

#### Returns

`boolean`

***

### aspect()

> **aspect**(): `Layer`

Defined in: [package/layer.js:338](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L338)

Downslope compass bearing.

#### Returns

`Layer`

***

### clip()

> **clip**(`bbox`): `Layer`

Defined in: [package/layer.js:326](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L326)

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

Defined in: [package/layer.js:175](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L175)

Computes this layer's render-ready result. By default it forces the primary source Dataset into
its decoded grid or features and memoizes that on `this.result`. A derived subclass overrides
this to align and reduce several sources.

#### Parameters

##### opts?

`any` = `{}`

#### Returns

`Promise`\<`any`\>

***

### deriveSources()

> **deriveSources**(`fn`, `opts?`): `Promise`\<`Layer`\>

Defined in: [package/layer.js:257](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L257)

Derives new sources from the current ones and swaps them in. The derived Dataset shares memoized
ancestors with the old one, so only the changed tail recomputes, which makes a live tweak such as
reclassifying with a new threshold much cheaper than a cold swap. Shorthand for setSources.

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

Defined in: [package/layer.js:140](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L140)

Fires `evt`. A listener receives `{ ...payload, layer: this }`.

The event reaches two places, so both of these see it:

  layer.on('rendered')              this one layer
  fim.on('userRaster:rendered')     any layer of that type on this map

The second comes from the first, forwarded under `${type}:${evt}`, so a new layer type gets it
with no extra work.

Forwarding is skipped when the layer has no `type` to namespace with, or no owning map.
Subsystems emitting on the map bus themselves, i.e. velocity's `*:activated` names, are
unaffected, since those are different event names and nothing double-fires.

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

Defined in: [package/layer.js:153](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L153)

Fit the map to this layer's bounds.

#### Returns

`void`

***

### get()

> **get**(): `any`

Defined in: [package/layer.js:489](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L489)

Read current settings.

#### Returns

`any`

***

### getLegend()

> **getLegend**(): [`Legend`](../../legend/classes/Legend.md)

Defined in: [package/layer.js:458](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L458)

#### Returns

[`Legend`](../../legend/classes/Legend.md)

***

### getStats()

> **getStats**(): `Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

Defined in: [package/layer.js:460](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L460)

#### Returns

`Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

***

### hide()

> **hide**(): `void`

Defined in: [package/layer.js:151](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L151)

#### Returns

`void`

***

### hillshade()

> **hillshade**(`opts?`): `Layer`

Defined in: [package/layer.js:340](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L340)

Shaded relief.

#### Parameters

##### opts?

`any`

#### Returns

`Layer`

***

### hitTest()

> **hitTest**(`lat`, `lng`): `boolean`

Defined in: [package/layer.js:499](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L499)

True when the point falls on this layer. The base class has no geometry and returns false.
RasterLayer tests its footprint and VectorLayer tests feature geometry. The map event dispatch
uses this to route hover and click.

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

Defined in: [package/layer.js:328](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L328)

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

Defined in: [package/layer.js:110](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L110)

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

Defined in: [package/layer.js:104](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L104)

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

Defined in: [package/layer.js:118](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L118)

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

Defined in: [package/layer.js:352](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L352)

Not chainable, deliberately. `rasterize` turns a vector Dataset into a raster one, and this
layer draws the kind it was built for, so returning `this` would leave a VectorLayer pointing at
a raster it cannot draw. Call it on the Dataset and add the result as its own layer.

#### Returns

`never`

***

### reclassify()

> **reclassify**(`rules`, `opts?`): `Layer`

Defined in: [package/layer.js:330](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L330)

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

Defined in: [package/layer.js:344](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L344)

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

Defined in: [package/layer.js:408](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L408)

Tears down the render, emits 'removed', then unregisters from the owning FimMap. A subclass
calls super.remove() last. Any assigned `_teardown` hook runs once before the event; user-file
Layers built inline in floodExtent carry their google.maps teardown there rather than in a
subclass. 'removed' fires synchronously, so the tools panel reacts now rather than on
google.maps' later onRemove() frame, which makes layer switches deterministic.

#### Parameters

##### \_\_namedParameters?

###### purgeSource?

`boolean` = `false`

#### Returns

`void`

***

### render()

> **render**(`opts?`): `Promise`\<`Layer`\>

Defined in: [package/layer.js:191](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L191)

Renders this layer: computes if needed, checks the provider CRS precondition, then draws.

`opts.render` picks the update mechanism. `'in-place'` swaps the overlay's image, avoiding a
flicker and keeping z-order and identity. `'recreate'` tears down and redraws. `'auto'`, the
default, goes in-place when the provider and this layer's render type allow it and recreates
otherwise. On success it claims the exclusive display slot when `this.exclusive`.

#### Parameters

##### opts?

`any` = `{}`

{ render?: 'auto'|'in-place'|'recreate' }

#### Returns

`Promise`\<`Layer`\>

***

### reproject()

> **reproject**(`toCrs`): `Layer`

Defined in: [package/layer.js:334](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L334)

Warp to `toCrs` — forced at render, GDAL loaded then.

#### Parameters

##### toCrs

`string`

#### Returns

`Layer`

***

### resampleTo()

> **resampleTo**(`target`, `opts?`): `Layer`

Defined in: [package/layer.js:332](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L332)

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

Defined in: [package/layer.js:317](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L317)

Points the layer back at the sources it held before its first op. Async and atomic like any
source swap, so a live layer re-renders. Does nothing when no op has been applied.

#### Parameters

##### opts?

`any` = `{}`

{ render?: 'auto'|'in-place'|'recreate' }

#### Returns

`Promise`\<`Layer`\>

***

### select()

> **select**(`coord`, `opts?`): `Layer`

Defined in: [package/layer.js:342](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L342)

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

Defined in: [package/layer.js:487](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L487)

Changes how this layer looks. Synchronous and chainable, returning the layer.

  layer.set({ palette: 'viridis', continuous: true, opacity: 0.8 });

Raster knobs: `palette`, `continuous`, `colorScale`, `noData`, `opacity`, `hover`.
Vector knobs: `color`, `opacity`, `useFileColors`, `hover`.

This is the one path for changing a layer's appearance. `layer.colorScale` stays readable, and
`ColorScale` keeps its own `set()` for building a scale before attaching it.

Only `noData` forces a redraw. Await `layer.settled()` to know when that finished.

#### Parameters

##### partial

`any`

#### Returns

`Layer`

***

### setSources()

> **setSources**(`sources`, `opts?`): `Promise`\<`Layer`\>

Defined in: [package/layer.js:227](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L227)

Replaces this layer's source Datasets, re-rendering when the layer is live. Data is immutable,
so changing it means pointing at a new Dataset rather than mutating one. It acquires the new
sources before releasing the old, so a Dataset another layer shares is not evicted mid-swap.
`opts.render` chooses the update mechanism (see render()).

Atomic. If the re-render throws, because the new sources have an unrenderable CRS or a
materializer fetch failed, the swap rolls back: `sources` and `result` return to their previous
values, the new sources' acquire is undone, and the error rethrows. The screen never changed
either way, since a failed render draws nothing, so the layer's state matches it. The swap fully
succeeded, or the layer is exactly as it was, never pointing at broken sources with the working
ones already released.

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

Defined in: [package/layer.js:491](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L491)

Resolves once any redraw kicked off by `set()` has finished.

#### Returns

`Promise`\<`Layer`\>

***

### show()

> **show**(): `void`

Defined in: [package/layer.js:149](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L149)

#### Returns

`void`

***

### slope()

> **slope**(`opts?`): `Layer`

Defined in: [package/layer.js:336](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L336)

Slope (Horn's method).

#### Parameters

##### opts?

`any`

#### Returns

`Layer`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [package/layer.js:515](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L515)

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

Defined in: [package/layer.js:446](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L446)

A structured-cloneable description of this layer: its type, its sources and the display state
needed to rebuild an equivalent one, i.e. on a different map or provider:

  map2.addLayer(layer1.toSpec());

The result is a copy, not a handle. `addLayer(spec)` builds a new ColorScale from the
description, so the two layers diverge rather than sharing mutable color state. The layer's `id`
and its event subscribers are not carried either.

`sources` are the live `Dataset` objects, which are safe to share and already decoded. To
persist a spec rather than move it within a page, replace them with `ds.toRecord()`.

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

Defined in: [package/layer.js:88](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L88)

Registers the factory `fim.addLayer('<type>')` dispatches to.

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

Defined in: [package/layer.js:95](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L95)

The types `addLayer` can construct, built-in and host-registered. These are registry keys, not
`layer.type` values; see `getLayerTypes`.

#### Returns

`string`[]
