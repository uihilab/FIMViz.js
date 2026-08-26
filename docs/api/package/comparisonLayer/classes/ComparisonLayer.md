[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/comparisonLayer](../README.md) / ComparisonLayer

# Class: ComparisonLayer

Defined in: [package/comparisonLayer.js:54](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L54)

## Extends

- [`Layer`](../../layer/classes/Layer.md)

## Constructors

### Constructor

> **new ComparisonLayer**(`opts?`): `ComparisonLayer`

Defined in: [package/comparisonLayer.js:77](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L77)

Source order decides the metrics. With two sources, `sources[0]` is scored as the prediction
and `sources[1]` as the observation, so `metrics.fp` counts wet-in-[0]-only and `metrics.fn`
counts wet-in-[1]-only. Swapping them inverts `b`, `h`, `fp` and `fn` while leaving `pc` and
`f` unchanged, which is a wrong answer that still looks reasonable. The engine cannot tell
which raster is the benchmark, so it uses the order given.

`{ prediction, observation }` names the two instead of ordering them, and builds the same
`sources` array. Use whichever reads better:

  new ComparisonLayer({ sources: [pred, obs] });
  new ComparisonLayer({ prediction: pred, observation: obs });

`sources` wins when both are given. The named pair covers two sources only, since
classification takes 2 to 8 and neither name means anything at three.

Classification and coloring do not care about order.

#### Parameters

##### opts?

as `Layer`, except `sources` take `{pixels, meta}` or a `RasterLayer`

###### observation?

`any`

scored as `sources[1]`. Ignored when `sources` is given.

###### prediction?

`any`

scored as `sources[0]`. Ignored when `sources` is given.

#### Returns

`ComparisonLayer`

#### Overrides

[`Layer`](../../layer/classes/Layer.md).[`constructor`](../../layer/classes/Layer.md#constructor)

## Properties

### \_aligned

> **\_aligned**: `any`

Defined in: [package/comparisonLayer.js:83](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L83)

***

### \_dirty

> **\_dirty**: `boolean`

Defined in: [package/layer.js:206](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L206)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_dirty`](../../layer/classes/Layer.md#_dirty)

***

### \_dryValue

> **\_dryValue**: `number`

Defined in: [package/comparisonLayer.js:86](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L86)

***

### \_emitter

> **\_emitter**: `any`

Defined in: [package/layer.js:70](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L70)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_emitter`](../../layer/classes/Layer.md#_emitter)

***

### \_grid

> **\_grid**: `object`

Defined in: [package/comparisonLayer.js:84](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L84)

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

Defined in: [package/layer.js:62](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L62)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_map`](../../layer/classes/Layer.md#_map)

***

### \_name

> **\_name**: `any`

Defined in: [package/layer.js:68](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L68)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_name`](../../layer/classes/Layer.md#_name)

***

### \_origin

> **\_origin**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:299](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L299)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_origin`](../../layer/classes/Layer.md#_origin)

***

### \_palette

> **\_palette**: `any`

Defined in: [package/comparisonLayer.js:85](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L85)

***

### \_removed

> **\_removed**: `boolean`

Defined in: [package/layer.js:410](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L410)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_removed`](../../layer/classes/Layer.md#_removed)

***

### \_teardown

> **\_teardown**: `any`

Defined in: [package/layer.js:69](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L69)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_teardown`](../../layer/classes/Layer.md#_teardown)

***

### exclusive

> **exclusive**: `any`

Defined in: [package/layer.js:67](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L67)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`exclusive`](../../layer/classes/Layer.md#exclusive)

***

### id

> **id**: `string`

Defined in: [package/layer.js:59](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L59)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`id`](../../layer/classes/Layer.md#id)

***

### result

> **result**: `any`

Defined in: [package/comparisonLayer.js:82](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L82)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`result`](../../layer/classes/Layer.md#result)

***

### sources

> **sources**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:61](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L61)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`sources`](../../layer/classes/Layer.md#sources)

***

### type

> **type**: `string`

Defined in: [package/layer.js:60](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L60)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`type`](../../layer/classes/Layer.md#type)

***

### visible

> **visible**: `boolean`

Defined in: [package/layer.js:63](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L63)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`visible`](../../layer/classes/Layer.md#visible)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_providerHandle`](../../layer/classes/Layer.md#_providerhandle)

***

### dataset

#### Get Signature

> **get** **dataset**(): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: [package/layer.js:100](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L100)

Convenience = sources[0].

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`dataset`](../../layer/classes/Layer.md#dataset)

***

### dirty

#### Get Signature

> **get** **dirty**(): `boolean`

Defined in: [package/layer.js:309](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L309)

Has an op been applied that the last render() has not drawn yet?

##### Returns

`boolean`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`dirty`](../../layer/classes/Layer.md#dirty)

***

### map

#### Get Signature

> **get** **map**(): [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: [package/layer.js:98](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L98)

The owning FimMap.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`map`](../../layer/classes/Layer.md#map)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`settings`](../../layer/classes/Layer.md#settings)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_adoptProviderHandle`](../../layer/classes/Layer.md#_adoptproviderhandle)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_checkProviderCRS`](../../layer/classes/Layer.md#_checkprovidercrs)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_draw`](../../layer/classes/Layer.md#_draw)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_hasListeners`](../../layer/classes/Layer.md#_haslisteners)

***

### \_makeSettings()

> **\_makeSettings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: [package/layer.js:471](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L471)

#### Returns

[`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_makeSettings`](../../layer/classes/Layer.md#_makesettings)

***

### \_op()

> **\_op**(`name`, `fn`): [`Layer`](../../layer/classes/Layer.md)

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

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_op`](../../layer/classes/Layer.md#_op)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_resolveRenderMode`](../../layer/classes/Layer.md#_resolverendermode)

***

### \_usesRasterImage()

> **\_usesRasterImage**(): `boolean`

Defined in: [package/layer.js:375](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L375)

Does this layer render a swappable raster image (the in-place-capable case)? RasterLayer overrides.

#### Returns

`boolean`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`_usesRasterImage`](../../layer/classes/Layer.md#_usesrasterimage)

***

### aspect()

> **aspect**(): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:338](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L338)

Downslope compass bearing.

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`aspect`](../../layer/classes/Layer.md#aspect)

***

### clip()

> **clip**(`bbox`): [`Layer`](../../layer/classes/Layer.md)

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

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`clip`](../../layer/classes/Layer.md#clip)

***

### compute()

> **compute**(`o?`): `object`

Defined in: [package/comparisonLayer.js:112](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L112)

Aligns the sources, classifies and colors them, and scores them when there are two. Emits
`computed` with the returned object, which reaches the map bus as `comparison:computed`. The
payload carries `aligned` and `dryValue` so ui/comparisonTools.js can recompute the metrics
under a draw mask without reaching back into the layer.

An omitted or unknown `policy` or `method` falls back to high and nearest, and records a message
in `result.warnings`. A silent default would hide that no resampling choice was made.

`metrics` is non-null only with exactly two sources, and it reads `sources[0]` as the
prediction and `sources[1]` as the observation (see the constructor).

`categories` is the per-pixel answer that `counts` totals: `categories[i]` is the bitmask of
which layers are wet at pixel i, on `grid`, matching a `value` in getLegend()'s stops.

#### Parameters

##### o?

###### colors?

`any`[] = `null`

2^n-1 colors, see combineExtentRgba

###### dryValue?

`number` = `DRY_DEFAULT`

the "dry" sentinel, -99999 by default

###### mask?

`any`[] = `null`

draw polygon scoping the metrics

###### method?

`string`

sentinel-safe resampling method

###### policy?

`"low"` \| `"high"` \| `"average"`

target resolution; high is finest

#### Returns

`object`

##### aligned

> **aligned**: `any`[]

##### categories

> **categories**: `Uint8Array`

##### counts

> **counts**: `any`

##### dryValue

> **dryValue**: `number`

##### grid

> **grid**: `any`

##### method

> **method**: `string`

##### metrics

> **metrics**: `any`

##### nLayers

> **nLayers**: `number`

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

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`deriveSources`](../../layer/classes/Layer.md#derivesources)

***

### emit()

> **emit**(`evt`, `payload?`): [`Layer`](../../layer/classes/Layer.md)

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

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`emit`](../../layer/classes/Layer.md#emit)

***

### fit()

> **fit**(): `void`

Defined in: [package/layer.js:153](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L153)

Fit the map to this layer's bounds.

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`fit`](../../layer/classes/Layer.md#fit)

***

### get()

> **get**(): `any`

Defined in: [package/layer.js:489](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L489)

Read current settings.

#### Returns

`any`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`get`](../../layer/classes/Layer.md#get)

***

### getAligned()

> **getAligned**(): `any`[]

Defined in: [package/comparisonLayer.js:158](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L158)

Per-layer pixel arrays from the last compute(), all on `result.grid`.

#### Returns

`any`[]

***

### getLegend()

> **getLegend**(): [`Legend`](../../legend/classes/Legend.md)

Defined in: [package/comparisonLayer.js:170](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L170)

A Legend for the colors the last compute() drew, or null before one has run.

One row per non-empty category, in bitmask order. Category 0 is every layer dry, which draws
transparent, so it gets no row. A label names the 1-based source indices whose bit is set:
"layer 1 only" for 0b01, "layers 1 + 2" for 0b11.

`value` on each stop is the bitmask itself, so a UI can match a row against `result.counts`.

#### Returns

[`Legend`](../../legend/classes/Legend.md)

#### Overrides

[`Layer`](../../layer/classes/Layer.md).[`getLegend`](../../layer/classes/Layer.md#getlegend)

***

### getStats()

> **getStats**(): `Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

Defined in: [package/layer.js:460](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L460)

#### Returns

`Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`getStats`](../../layer/classes/Layer.md#getstats)

***

### hide()

> **hide**(): `void`

Defined in: [package/layer.js:151](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L151)

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`hide`](../../layer/classes/Layer.md#hide)

***

### hillshade()

> **hillshade**(`opts?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:340](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L340)

Shaded relief.

#### Parameters

##### opts?

`any`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`hillshade`](../../layer/classes/Layer.md#hillshade)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`hitTest`](../../layer/classes/Layer.md#hittest)

***

### mask()

> **mask**(`polygon`, `opts?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:328](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L328)

Pixels outside `polygon` (or inside, with `{invert:true}`) become noData.

#### Parameters

##### polygon

`any`

##### opts?

`any`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`mask`](../../layer/classes/Layer.md#mask)

***

### metricsForMask()

> **metricsForMask**(`mask`): `any`

Defined in: [package/comparisonLayer.js:194](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L194)

Recomputes the metrics alone under a new draw `mask`, reusing the aligned pixels. The Metrics
tab calls this when the user draws a region. Returns null unless there are exactly two layers.

#### Parameters

##### mask

`any`[]

draw polygon

#### Returns

`any`

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`off`](../../layer/classes/Layer.md#off)

***

### on()

> **on**(`evt`, `fn`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:104](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L104)

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

Defined in: [package/layer.js:118](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L118)

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

> **prepare**(): `Promise`\<`ComparisonLayer`\>

Defined in: [package/comparisonLayer.js:151](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/comparisonLayer.js#L151)

Forces any Dataset sources into RasterGrids so the synchronous compute() can read them:
`await layer.prepare(); layer.compute(opts)`. This async pre-step is what lets a Dataset reach
the compare without compute() becoming async. Other sources pass through untouched.

#### Returns

`Promise`\<`ComparisonLayer`\>

***

### rasterize()

> **rasterize**(): `never`

Defined in: [package/layer.js:352](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L352)

Not chainable, deliberately. `rasterize` turns a vector Dataset into a raster one, and this
layer draws the kind it was built for, so returning `this` would leave a VectorLayer pointing at
a raster it cannot draw. Call it on the Dataset and add the result as its own layer.

#### Returns

`never`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`rasterize`](../../layer/classes/Layer.md#rasterize)

***

### reclassify()

> **reclassify**(`rules`, `opts?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:330](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L330)

Remap pixel values by rules or a callback.

#### Parameters

##### rules

`Function` \| `any`[]

##### opts?

`any`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`reclassify`](../../layer/classes/Layer.md#reclassify)

***

### reduce()

> **reduce**(`op?`, `opts?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:344](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L344)

Collapse a selection axis to one grid.

#### Parameters

##### op?

`string`

##### opts?

`any`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`reduce`](../../layer/classes/Layer.md#reduce)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`remove`](../../layer/classes/Layer.md#remove)

***

### render()

> **render**(`opts?`): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

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

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`render`](../../layer/classes/Layer.md#render)

***

### reproject()

> **reproject**(`toCrs`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:334](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L334)

Warp to `toCrs` — forced at render, GDAL loaded then.

#### Parameters

##### toCrs

`string`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`reproject`](../../layer/classes/Layer.md#reproject)

***

### resampleTo()

> **resampleTo**(`target`, `opts?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:332](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L332)

Resample onto an explicit target grid (does not reproject).

#### Parameters

##### target

`any`

##### opts?

`any`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`resampleTo`](../../layer/classes/Layer.md#resampleto)

***

### reset()

> **reset**(`opts?`): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: [package/layer.js:317](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L317)

Points the layer back at the sources it held before its first op. Async and atomic like any
source swap, so a live layer re-renders. Does nothing when no op has been applied.

#### Parameters

##### opts?

`any` = `{}`

{ render?: 'auto'|'in-place'|'recreate' }

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`reset`](../../layer/classes/Layer.md#reset)

***

### select()

> **select**(`coord`, `opts?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:342](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L342)

Resolve one selection-axis entry (the scenario-slider op).

#### Parameters

##### coord

`string` \| `number`

##### opts?

`any`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`select`](../../layer/classes/Layer.md#select)

***

### set()

> **set**(`partial`): [`Layer`](../../layer/classes/Layer.md)

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

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`set`](../../layer/classes/Layer.md#set)

***

### setSources()

> **setSources**(`sources`, `opts?`): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

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

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`setSources`](../../layer/classes/Layer.md#setsources)

***

### settled()

> **settled**(): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: [package/layer.js:491](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L491)

Resolves once any redraw kicked off by `set()` has finished.

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`settled`](../../layer/classes/Layer.md#settled)

***

### show()

> **show**(): `void`

Defined in: [package/layer.js:149](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L149)

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`show`](../../layer/classes/Layer.md#show)

***

### slope()

> **slope**(`opts?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layer.js:336](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L336)

Slope (Horn's method).

#### Parameters

##### opts?

`any`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`slope`](../../layer/classes/Layer.md#slope)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`toJSON`](../../layer/classes/Layer.md#tojson)

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

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`toSpec`](../../layer/classes/Layer.md#tospec)

***

### registerType()

> `static` **registerType**(`type`, `factory`): `void`

Defined in: [package/layer.js:88](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L88)

Registers the factory `fim.addLayer('<type>')` dispatches to.

#### Parameters

##### type

`string`

##### factory

(`fim`, `opts`) => [`Layer`](../../layer/classes/Layer.md) \| `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Returns

`void`

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`registerType`](../../layer/classes/Layer.md#registertype)

***

### types()

> `static` **types**(): `string`[]

Defined in: [package/layer.js:95](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L95)

The types `addLayer` can construct, built-in and host-registered. These are registry keys, not
`layer.type` values; see `getLayerTypes`.

#### Returns

`string`[]

#### Inherited from

[`Layer`](../../layer/classes/Layer.md).[`types`](../../layer/classes/Layer.md#types)
