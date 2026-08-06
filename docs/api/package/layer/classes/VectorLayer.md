[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / VectorLayer

# Class: VectorLayer

Defined in: [package/layer.js:800](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L800)

## Extends

- [`Layer`](Layer.md)

## Constructors

### Constructor

> **new VectorLayer**(`opts?`): `VectorLayer`

Defined in: [package/layer.js:806](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L806)

#### Parameters

##### opts?

the base Layer options, plus:

###### colorBy?

`string`

the feature property whose value the scale reads

###### colorScale?

[`ColorScale`](../../colorScale/classes/ColorScale.md)

value → colour for `colorBy`

#### Returns

`VectorLayer`

#### Overrides

[`Layer`](Layer.md).[`constructor`](Layer.md#constructor)

## Properties

### \_dirty

> **\_dirty**: `boolean`

Defined in: [package/layer.js:202](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L202)

#### Inherited from

[`Layer`](Layer.md).[`_dirty`](Layer.md#_dirty)

***

### \_emitter

> **\_emitter**: `any`

Defined in: [package/layer.js:68](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L68)

#### Inherited from

[`Layer`](Layer.md).[`_emitter`](Layer.md#_emitter)

***

### \_map

> **\_map**: [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: [package/layer.js:60](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L60)

#### Inherited from

[`Layer`](Layer.md).[`_map`](Layer.md#_map)

***

### \_name

> **\_name**: `any`

Defined in: [package/layer.js:66](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L66)

#### Inherited from

[`Layer`](Layer.md).[`_name`](Layer.md#_name)

***

### \_onScaleChange

> **\_onScaleChange**: () => `void`

Defined in: [package/layer.js:827](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L827)

#### Returns

`void`

***

### \_origin

> **\_origin**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:295](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L295)

#### Inherited from

[`Layer`](Layer.md).[`_origin`](Layer.md#_origin)

***

### \_removed

> **\_removed**: `boolean`

Defined in: [package/layer.js:407](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L407)

#### Inherited from

[`Layer`](Layer.md).[`_removed`](Layer.md#_removed)

***

### \_style

> **\_style**: `any`

Defined in: [package/layer.js:894](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L894)

***

### \_teardown

> **\_teardown**: `any`

Defined in: [package/layer.js:67](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L67)

#### Inherited from

[`Layer`](Layer.md).[`_teardown`](Layer.md#_teardown)

***

### colorBy

> **colorBy**: `string`

Defined in: [package/layer.js:812](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L812)

***

### colorScale

> **colorScale**: [`ColorScale`](../../colorScale/classes/ColorScale.md)

Defined in: [package/layer.js:811](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L811)

***

### dataLayer

> **dataLayer**: `any`

Defined in: [package/layer.js:895](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L895)

***

### exclusive

> **exclusive**: `any`

Defined in: [package/layer.js:65](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L65)

#### Inherited from

[`Layer`](Layer.md).[`exclusive`](Layer.md#exclusive)

***

### id

> **id**: `string`

Defined in: [package/layer.js:57](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L57)

#### Inherited from

[`Layer`](Layer.md).[`id`](Layer.md#id)

***

### result

> **result**: `any`

Defined in: [package/layer.js:174](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L174)

#### Inherited from

[`Layer`](Layer.md).[`result`](Layer.md#result)

***

### sources

> **sources**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:59](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L59)

#### Inherited from

[`Layer`](Layer.md).[`sources`](Layer.md#sources)

***

### type

> **type**: `string`

Defined in: [package/layer.js:58](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L58)

#### Inherited from

[`Layer`](Layer.md).[`type`](Layer.md#type)

***

### visible

> **visible**: `boolean`

Defined in: [package/layer.js:61](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L61)

#### Inherited from

[`Layer`](Layer.md).[`visible`](Layer.md#visible)

## Accessors

### dataset

#### Get Signature

> **get** **dataset**(): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: [package/layer.js:99](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L99)

Convenience = sources[0].

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

#### Inherited from

[`Layer`](Layer.md).[`dataset`](Layer.md#dataset)

***

### dirty

#### Get Signature

> **get** **dirty**(): `boolean`

Defined in: [package/layer.js:305](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L305)

Has an op been applied that the last render() has not drawn yet?

##### Returns

`boolean`

#### Inherited from

[`Layer`](Layer.md).[`dirty`](Layer.md#dirty)

***

### map

#### Get Signature

> **get** **map**(): [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: [package/layer.js:97](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L97)

The owning FimMap.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)

#### Inherited from

[`Layer`](Layer.md).[`map`](Layer.md#map)

***

### settings

#### Get Signature

> **get** **settings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: [package/layer.js:467](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L467)

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

Defined in: [package/layer.js:383](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L383)

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

Defined in: [package/layer.js:374](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L374)

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

Defined in: [package/layer.js:115](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L115)

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

Defined in: [package/layer.js:943](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L943)

#### Returns

[`VectorSettings`](../../layerSettings/classes/VectorSettings.md)

#### Overrides

[`Layer`](Layer.md).[`_makeSettings`](Layer.md#_makesettings)

***

### \_op()

> **\_op**(`name`, `fn`): [`Layer`](Layer.md)

Defined in: [package/layer.js:284](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L284)

Apply one Dataset op across every source, immediately. Invalidates the memoized compute and
marks the layer dirty; draws nothing until `render()`.

#### Parameters

##### name

`string`

the op, for error messages

##### fn

(`ds`) => [`Dataset`](../../dataset/classes/Dataset.md)

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`_op`](Layer.md#_op)

***

### \_resolveRenderMode()

> **\_resolveRenderMode**(`requested`): `"in-place"` \| `"recreate"`

Defined in: [package/layer.js:362](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L362)

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

### \_resolveStyle()

> **\_resolveStyle**(): `any`

Defined in: [package/layer.js:851](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L851)

The style handed to the provider. With a ColorScale + `colorBy` attached this is a per-feature
FUNCTION — each feature's `properties[colorBy]` goes through the scale — merged over whatever
flat style `setStyle()`/`render({style})` set, so an explicit `strokeWidth` still applies. With
no scale (or no `colorBy`) it is just that flat style, exactly as before.

A feature whose property is missing or non-numeric is coloured by the scale's `missingColor`
when one is set, and otherwise keeps the base style — never a value from the ramp, since
"no data for this feature" must not be able to look like a real reading.

#### Returns

`any`

***

### \_usesRasterImage()

> **\_usesRasterImage**(): `boolean`

Defined in: [package/layer.js:371](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L371)

Does this layer render a swappable raster image (the in-place-capable case)? RasterLayer overrides.

#### Returns

`boolean`

#### Inherited from

[`Layer`](Layer.md).[`_usesRasterImage`](Layer.md#_usesrasterimage)

***

### aspect()

> **aspect**(): [`Layer`](Layer.md)

Defined in: [package/layer.js:334](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L334)

Downslope compass bearing.

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`aspect`](Layer.md#aspect)

***

### clip()

> **clip**(`bbox`): [`Layer`](Layer.md)

Defined in: [package/layer.js:322](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L322)

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

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`clip`](Layer.md#clip)

***

### compute()

> **compute**(`opts?`): `Promise`\<`any`\>

Defined in: [package/layer.js:172](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L172)

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

Defined in: [package/layer.js:253](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L253)

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

Defined in: [package/layer.js:139](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L139)

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

Defined in: [package/layer.js:994](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L994)

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

Defined in: [package/layer.js:905](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L905)

Fit the map to this layer's Dataset bounds, via the provider.

#### Returns

`VectorLayer`

#### Overrides

[`Layer`](Layer.md).[`fit`](Layer.md#fit)

***

### get()

> **get**(): `any`

Defined in: [package/layer.js:488](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L488)

Read current settings.

#### Returns

`any`

#### Inherited from

[`Layer`](Layer.md).[`get`](Layer.md#get)

***

### getLegend()

> **getLegend**(): [`Legend`](../../legend/classes/Legend.md)

Defined in: [package/layer.js:869](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L869)

The display read-model, derived from the ColorScale (null until one is attached) — so a vector
layer coloured by a property gets the same legend a raster does.

#### Returns

[`Legend`](../../legend/classes/Legend.md)

#### Overrides

[`Layer`](Layer.md).[`getLegend`](Layer.md#getlegend)

***

### getStats()

> **getStats**(`opts?`): `Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

Defined in: [package/layer.js:955](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L955)

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

Defined in: [package/layer.js:919](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L919)

Remove the vector overlay from the map (the provider contract has no vector "invisible" primitive
short of removing it). The base Layer.hide() only flips `.visible` — that alone doesn't touch
anything the provider drew, so the features stayed visible on the map through it. `show()` rebuilds
via `addVector` — the same remove-then-recreate shape `setStyle()` already uses. Chainable.

#### Returns

`VectorLayer`

#### Overrides

[`Layer`](Layer.md).[`hide`](Layer.md#hide)

***

### hillshade()

> **hillshade**(`opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:336](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L336)

Shaded relief.

#### Parameters

##### opts?

`any`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`hillshade`](Layer.md#hillshade)

***

### hitTest()

> **hitTest**(`lat`, `lng`): `boolean`

Defined in: [package/layer.js:987](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L987)

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

### mask()

> **mask**(`polygon`, `opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:324](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L324)

Pixels outside `polygon` (or inside, with `{invert:true}`) become noData.

#### Parameters

##### polygon

`any`

##### opts?

`any`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`mask`](Layer.md#mask)

***

### off()

> **off**(`evt`, `fn`): `void`

Defined in: [package/layer.js:109](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L109)

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

Defined in: [package/layer.js:103](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L103)

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

Defined in: [package/layer.js:117](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L117)

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

### rasterize()

> **rasterize**(): `never`

Defined in: [package/layer.js:348](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L348)

NOT chainable, on purpose. `rasterize` changes a Dataset's kind (vector → raster), and this
layer draws the kind it was built for — returning `this` would leave a VectorLayer pointing at a
raster it cannot draw. Do it on the Dataset and add the result as its own layer.

#### Returns

`never`

#### Inherited from

[`Layer`](Layer.md).[`rasterize`](Layer.md#rasterize)

***

### reclassify()

> **reclassify**(`rules`, `opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:326](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L326)

Remap pixel values by rules or a callback.

#### Parameters

##### rules

`Function` \| `any`[]

##### opts?

`any`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`reclassify`](Layer.md#reclassify)

***

### reduce()

> **reduce**(`op?`, `opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:340](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L340)

Collapse a selection axis to one grid.

#### Parameters

##### op?

`string`

##### opts?

`any`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`reduce`](Layer.md#reduce)

***

### remove()

> **remove**(`__namedParameters?`): `void`

Defined in: [package/layer.js:405](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L405)

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

Defined in: [package/layer.js:878](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L878)

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

### reproject()

> **reproject**(`toCrs`): [`Layer`](Layer.md)

Defined in: [package/layer.js:330](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L330)

Warp to `toCrs` — forced at render, GDAL loaded then.

#### Parameters

##### toCrs

`string`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`reproject`](Layer.md#reproject)

***

### resampleTo()

> **resampleTo**(`target`, `opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:328](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L328)

Resample onto an explicit target grid (does not reproject).

#### Parameters

##### target

`any`

##### opts?

`any`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`resampleTo`](Layer.md#resampleto)

***

### reset()

> **reset**(`opts?`): `Promise`\<[`Layer`](Layer.md)\>

Defined in: [package/layer.js:313](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L313)

Point the layer back at the sources it held before its first op. Async and atomic, like any
source swap — a live layer re-renders. A no-op if nothing has been applied.

#### Parameters

##### opts?

`any` = `{}`

{ render?: 'auto'|'in-place'|'recreate' }

#### Returns

`Promise`\<[`Layer`](Layer.md)\>

#### Inherited from

[`Layer`](Layer.md).[`reset`](Layer.md#reset)

***

### select()

> **select**(`coord`, `opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:338](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L338)

Resolve one selection-axis entry (the scenario-slider op).

#### Parameters

##### coord

`string` \| `number`

##### opts?

`any`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`select`](Layer.md#select)

***

### set()

> **set**(`partial`): [`Layer`](Layer.md)

Defined in: [package/layer.js:486](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L486)

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

Defined in: [package/layer.js:223](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L223)

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

Defined in: [package/layer.js:975](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L975)

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

Defined in: [package/layer.js:490](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L490)

Resolves once any redraw kicked off by `set()` has finished.

#### Returns

`Promise`\<[`Layer`](Layer.md)\>

#### Inherited from

[`Layer`](Layer.md).[`settled`](Layer.md#settled)

***

### show()

> **show**(): `VectorLayer`

Defined in: [package/layer.js:931](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L931)

Re-add the vector overlay to the map at its last style. Chainable.

#### Returns

`VectorLayer`

#### Overrides

[`Layer`](Layer.md).[`show`](Layer.md#show)

***

### slope()

> **slope**(`opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:332](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L332)

Slope (Horn's method).

#### Parameters

##### opts?

`any`

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`slope`](Layer.md#slope)

***

### toJSON()

> **toJSON**(): `object`

Defined in: [package/layer.js:500](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L500)

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

Defined in: [package/layer.js:444](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L444)

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

***

### registerType()

> `static` **registerType**(`type`, `factory`): `void`

Defined in: [package/layer.js:87](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L87)

Register the factory `fim.addLayer('<type>')` dispatches to.

#### Parameters

##### type

`string`

##### factory

(`fim`, `opts`) => [`Layer`](Layer.md) \| `Promise`\<[`Layer`](Layer.md)\>

#### Returns

`void`

#### Inherited from

[`Layer`](Layer.md).[`registerType`](Layer.md#registertype)

***

### types()

> `static` **types**(): `string`[]

Defined in: [package/layer.js:94](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/layer.js#L94)

Every type `addLayer` can currently construct — built-ins plus anything a host registered.
REGISTRY KEYS, not `layer.type` values (see `getLayerTypes`).

#### Returns

`string`[]

#### Inherited from

[`Layer`](Layer.md).[`types`](Layer.md#types)
