[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / RasterLayer

# Class: RasterLayer

Defined in: [package/layer.js:528](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L528)

## Extends

- [`Layer`](Layer.md)

## Constructors

### Constructor

> **new RasterLayer**(`opts?`): `RasterLayer`

Defined in: [package/layer.js:529](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L529)

#### Parameters

##### opts?

#### Returns

`RasterLayer`

#### Overrides

[`Layer`](Layer.md).[`constructor`](Layer.md#constructor)

## Properties

### \_dirty

> **\_dirty**: `boolean`

Defined in: [package/layer.js:206](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L206)

#### Inherited from

[`Layer`](Layer.md).[`_dirty`](Layer.md#_dirty)

***

### \_emitter

> **\_emitter**: `any`

Defined in: [package/layer.js:70](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L70)

#### Inherited from

[`Layer`](Layer.md).[`_emitter`](Layer.md#_emitter)

***

### \_map

> **\_map**: [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: [package/layer.js:62](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L62)

#### Inherited from

[`Layer`](Layer.md).[`_map`](Layer.md#_map)

***

### \_name

> **\_name**: `any`

Defined in: [package/layer.js:68](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L68)

#### Inherited from

[`Layer`](Layer.md).[`_name`](Layer.md#_name)

***

### \_onScaleChange

> **\_onScaleChange**: () => `void`

Defined in: [package/layer.js:548](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L548)

#### Returns

`void`

***

### \_origin

> **\_origin**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:299](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L299)

#### Inherited from

[`Layer`](Layer.md).[`_origin`](Layer.md#_origin)

***

### \_removed

> **\_removed**: `boolean`

Defined in: [package/layer.js:410](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L410)

#### Inherited from

[`Layer`](Layer.md).[`_removed`](Layer.md#_removed)

***

### \_teardown

> **\_teardown**: `any`

Defined in: [package/layer.js:69](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L69)

#### Inherited from

[`Layer`](Layer.md).[`_teardown`](Layer.md#_teardown)

***

### colorScale

> **colorScale**: [`ColorScale`](../../colorScale/classes/ColorScale.md)

Defined in: [package/layer.js:547](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L547)

***

### exclusive

> **exclusive**: `any`

Defined in: [package/layer.js:67](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L67)

#### Inherited from

[`Layer`](Layer.md).[`exclusive`](Layer.md#exclusive)

***

### id

> **id**: `string`

Defined in: [package/layer.js:59](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L59)

#### Inherited from

[`Layer`](Layer.md).[`id`](Layer.md#id)

***

### loadSeq

> **loadSeq**: `number`

Defined in: [package/layer.js:533](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L533)

***

### meta

> **meta**: `object`

Defined in: [package/layer.js:535](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L535)

#### be

> **be**: `any` = `bounds.east`

#### bn

> **bn**: `any` = `bounds.north`

#### bs

> **bs**: `any` = `bounds.south`

#### bw

> **bw**: `any` = `bounds.west`

#### height

> **height**: `any` = `grid.height`

#### noData

> **noData**: `any`

#### unit

> **unit**: `any`

#### width

> **width**: `any` = `grid.width`

***

### moveListener

> **moveListener**: () => `void`

Defined in: [package/layer.js:532](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L532)

#### Returns

`void`

***

### noData

> **noData**: `any`

Defined in: [package/layer.js:540](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L540)

***

### opacity

> **opacity**: `any`

Defined in: [package/layer.js:541](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L541)

***

### overlay

> **overlay**: `any`

Defined in: [package/layer.js:531](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L531)

***

### raster

> **raster**: `any`

Defined in: [package/layer.js:546](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L546)

***

### rasterData

> **rasterData**: `any`

Defined in: [package/layer.js:534](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L534)

***

### result

> **result**: `any`

Defined in: [package/layer.js:177](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L177)

#### Inherited from

[`Layer`](Layer.md).[`result`](Layer.md#result)

***

### sources

> **sources**: [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/layer.js:61](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L61)

#### Inherited from

[`Layer`](Layer.md).[`sources`](Layer.md#sources)

***

### type

> **type**: `string`

Defined in: [package/layer.js:60](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L60)

#### Inherited from

[`Layer`](Layer.md).[`type`](Layer.md#type)

***

### visible

> **visible**: `boolean`

Defined in: [package/layer.js:63](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L63)

#### Inherited from

[`Layer`](Layer.md).[`visible`](Layer.md#visible)

## Accessors

### \_providerHandle

#### Get Signature

> **get** **\_providerHandle**(): `any`

Defined in: [package/layer.js:605](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L605)

##### Returns

`any`

the raster-image overlay handle.

#### Overrides

[`Layer`](Layer.md).[`_providerHandle`](Layer.md#_providerhandle)

***

### dataset

#### Get Signature

> **get** **dataset**(): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: [package/layer.js:100](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L100)

Convenience = sources[0].

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

#### Inherited from

[`Layer`](Layer.md).[`dataset`](Layer.md#dataset)

***

### dirty

#### Get Signature

> **get** **dirty**(): `boolean`

Defined in: [package/layer.js:309](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L309)

Has an op been applied that the last render() has not drawn yet?

##### Returns

`boolean`

#### Inherited from

[`Layer`](Layer.md).[`dirty`](Layer.md#dirty)

***

### map

#### Get Signature

> **get** **map**(): [`FimMap`](../../fimMap/classes/FimMap.md)

Defined in: [package/layer.js:98](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L98)

The owning FimMap.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)

#### Inherited from

[`Layer`](Layer.md).[`map`](Layer.md#map)

***

### settings

#### Get Signature

> **get** **settings**(): [`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

Defined in: [package/layer.js:469](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L469)

This layer's settings knobs, built lazily. A subclass overrides _makeSettings() to supply raster
or vector knobs. Writing one with `layer.set({...})` emits 'restyle' or 'recomputed' and
re-renders when the layer is live.

##### Returns

[`LayerSettings`](../../layerSettings/classes/LayerSettings.md)

#### Inherited from

[`Layer`](Layer.md).[`settings`](Layer.md#settings)

## Methods

### \_adoptProviderHandle()

> **\_adoptProviderHandle**(`handle`): `void`

Defined in: [package/layer.js:606](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L606)

Adopts a handle the provider replaced, since Google recreates ground overlays to restack.

#### Parameters

##### handle

`any`

#### Returns

`void`

#### Overrides

[`Layer`](Layer.md).[`_adoptProviderHandle`](Layer.md#_adoptproviderhandle)

***

### \_bounds()

> **\_bounds**(): `any`

Defined in: [package/layer.js:591](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L591)

The geographic footprint { north, south, east, west } (from meta, else the grid).

#### Returns

`any`

***

### \_checkProviderCRS()

> **\_checkProviderCRS**(): `void`

Defined in: [package/layer.js:387](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L387)

Blocks the render when a source Dataset's native CRS is one the active provider cannot draw,
throwing an actionable error and emitting a host event so the app can react with a toast or an
auto-reproject. The mechanism lives here and the policy lives in the host: the engine never
reprojects silently.

#### Returns

`void`

#### Inherited from

[`Layer`](Layer.md).[`_checkProviderCRS`](Layer.md#_checkprovidercrs)

***

### \_draw()

> **\_draw**(`opts?`): `void`

Defined in: [package/layer.js:719](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L719)

Draws this raster on the map. It resolves a ColorScale when none is attached (see
_resolveColorScale), colorizes the materialized grid into a canvas data URL, then positions that
over the grid's bounds through the map provider. `mode === 'in-place'` swaps the existing
overlay's image without a flicker; otherwise it removes and re-adds. Provider-neutral, since the
SDK-specific work sits behind addRasterImage and setRasterImageUrl.

It also fills `rasterData` and `meta` from the grid for hover, installs a teardown that removes
the overlay, and fires `rendered` with the grid and the data URL.

#### Parameters

##### opts?

`any` = `{}`

{ mode?: 'in-place'|'recreate', raster?: Object } — `raster` overrides
  this layer's projection/budget options for one draw (see `RasterLayer#raster`)

#### Returns

`void`

#### Overrides

[`Layer`](Layer.md).[`_draw`](Layer.md#_draw)

***

### \_hasListeners()

> **\_hasListeners**(`evt`): `boolean`

Defined in: [package/layer.js:116](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L116)

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

> **\_makeSettings**(): [`RasterSettings`](../../layerSettings/classes/RasterSettings.md)

Defined in: [package/layer.js:588](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L588)

#### Returns

[`RasterSettings`](../../layerSettings/classes/RasterSettings.md)

#### Overrides

[`Layer`](Layer.md).[`_makeSettings`](Layer.md#_makesettings)

***

### \_op()

> **\_op**(`name`, `fn`): [`Layer`](Layer.md)

Defined in: [package/layer.js:288](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L288)

Applies one Dataset op across the sources immediately. Invalidates the memoized compute and
marks the layer dirty, drawing nothing until `render()`.

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

### \_resolveColorScale()

> **\_resolveColorScale**(`grid`): `any`[]

Defined in: [package/layer.js:694](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L694)

Resolves which ColorScale colors this raster, trying three sources in order.

An already-attached scale wins and is left alone; a host attaches one with set({ colorScale }) or
by passing { colorScale } to the "raster" factory. Failing that, a GDAL_METADATA legend embedded
in the file is detected through ColorScale's registered parser, which layers/depthMap.js supplies
(see registerGdalLegendParser). Failing that, a continuous scale on ColorScale's default palette,
ranged to the grid's own min and max.

Whichever is chosen is attached to the layer, so getLegend() and getStats() always describe what
is drawn rather than a discarded fallback. This runs synchronously inside the current render
pass, before the image is drawn, so there is no window where a generic default draws first and a
correct GDAL legend never arrives because nothing repaints on its own.

#### Parameters

##### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

#### Returns

`any`[]

the raw parsed GDAL legend, if one was detected (for the 'rendered' event's
  `originalLegend`. Null when an explicit or default scale was used instead.

***

### \_resolveRenderMode()

> **\_resolveRenderMode**(`requested`): `"in-place"` \| `"recreate"`

Defined in: [package/layer.js:366](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L366)

Resolves the render update mode. An explicit 'in-place' or 'recreate' wins. 'auto' checks
whether the provider exposes setRasterImageUrl and whether this layer draws a swappable raster
image. A vector layer, or a provider without in-place swap, falls back to recreate.

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

Defined in: [package/layer.js:675](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L675)

A RasterLayer renders a single positioned image, so the provider CAN swap it in place.

#### Returns

`boolean`

#### Overrides

[`Layer`](Layer.md).[`_usesRasterImage`](Layer.md#_usesrasterimage)

***

### aspect()

> **aspect**(): [`Layer`](Layer.md)

Defined in: [package/layer.js:338](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L338)

Downslope compass bearing.

#### Returns

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`aspect`](Layer.md#aspect)

***

### clip()

> **clip**(`bbox`): [`Layer`](Layer.md)

Defined in: [package/layer.js:326](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L326)

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

Defined in: [package/layer.js:175](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L175)

Computes this layer's render-ready result. By default it forces the primary source Dataset into
its decoded grid or features and memoizes that on `this.result`. A derived subclass overrides
this to align and reduce several sources.

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

Defined in: [package/layer.js:257](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L257)

Derives new sources from the current ones and swaps them in. The derived Dataset shares memoized
ancestors with the old one, so only the changed tail recomputes, which makes a live tweak such as
reclassifying with a new threshold much cheaper than a cold swap. Shorthand for setSources.

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

### disableHover()

> **disableHover**(): `RasterLayer`

Defined in: [package/layer.js:668](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L668)

Stop the hover readout wired by enableHover() — a no-op if none is active.

#### Returns

`RasterLayer`

***

### emit()

> **emit**(`evt`, `payload?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:140](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L140)

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

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`emit`](Layer.md#emit)

***

### enableHover()

> **enableHover**(`opts?`): `RasterLayer`

Defined in: [package/layer.js:653](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L653)

Starts a live hover readout: it subscribes to the map provider's mouse-move, calls valueAt() on
each move, and emits 'hover' with a displayable `{lat, lng, value, text}`. Idempotent, so
calling it again replaces the previous subscription rather than stacking listeners. Opt-in
rather than automatic on render, since a layer nobody hovers should not pay for a mousemove
listener. remove() tears it down (see _draw()'s _teardown).

This replaces the bounds and row/column lookup DepthLayer hand-rolled in layers/depthMap.js,
which valueAt() now shares. It does not generalize one thing: treating an otherwise valid value
as nothing to report, i.e. depth's rule that zero means no flooding, is domain knowledge, so
pass `isEmpty` for that.

#### Parameters

##### opts?

###### formatValue?

(`v`) => `string` = `...`

value → display text. Defaults to `String(v)`.

###### isEmpty?

(`v`) => `boolean` = `null`

an in-range value to ALSO treat as absent
  so event.value becomes null, as it does outside the footprint. Use it for a domain rule such
  as zero meaning nothing, which is not really about noData.

###### noDataTolerance?

`number` = `0`

forwarded to valueAt().

#### Returns

`RasterLayer`

***

### fit()

> **fit**(): `RasterLayer`

Defined in: [package/layer.js:777](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L777)

Fit the map to this raster's bounds (after render).

#### Returns

`RasterLayer`

#### Overrides

[`Layer`](Layer.md).[`fit`](Layer.md#fit)

***

### get()

> **get**(): `any`

Defined in: [package/layer.js:489](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L489)

Read current settings.

#### Returns

`any`

#### Inherited from

[`Layer`](Layer.md).[`get`](Layer.md#get)

***

### getLegend()

> **getLegend**(): [`Legend`](../../legend/classes/Legend.md)

Defined in: [package/layer.js:821](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L821)

The legend, derived from the ColorScale. Null until one is attached.

#### Returns

[`Legend`](../../legend/classes/Legend.md)

#### Overrides

[`Layer`](Layer.md).[`getLegend`](Layer.md#getlegend)

***

### getStats()

> **getStats**(`opts?`): `Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

Defined in: [package/layer.js:831](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L831)

Statistics over this raster's pixels, classified by the attached ColorScale when there is one,
so the histogram buckets match the legend. Null until pixels load.

#### Parameters

##### opts?

`any` = `{}`

#### Returns

`Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

#### Overrides

[`Layer`](Layer.md).[`getStats`](Layer.md#getstats)

***

### hide()

> **hide**(): `RasterLayer`

Defined in: [package/layer.js:568](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L568)

Hides the overlay by setting its provider opacity to 0. The overlay stays on the map, so show()
is instant. The base Layer.hide() only flips `.visible`, which touches nothing the provider
drew, so a raster overlay stayed visible through it. Chainable.

#### Returns

`RasterLayer`

#### Overrides

[`Layer`](Layer.md).[`hide`](Layer.md#hide)

***

### hillshade()

> **hillshade**(`opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:340](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L340)

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

Defined in: [package/layer.js:602](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L602)

A pixel-level hit test (PACKAGE_ROADMAP §1), true only where a real pixel sits under the point.
A click over a transparent or noData part of the footprint falls through to the layers below,
rather than the whole bounding rectangle absorbing it.

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

Defined in: [package/layer.js:328](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L328)

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

Defined in: [package/layer.js:110](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L110)

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

Defined in: [package/layer.js:104](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L104)

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

Defined in: [package/layer.js:118](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L118)

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

Defined in: [package/layer.js:352](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L352)

Not chainable, deliberately. `rasterize` turns a vector Dataset into a raster one, and this
layer draws the kind it was built for, so returning `this` would leave a VectorLayer pointing at
a raster it cannot draw. Call it on the Dataset and add the result as its own layer.

#### Returns

`never`

#### Inherited from

[`Layer`](Layer.md).[`rasterize`](Layer.md#rasterize)

***

### reclassify()

> **reclassify**(`rules`, `opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:330](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L330)

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

Defined in: [package/layer.js:344](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L344)

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

Defined in: [package/layer.js:408](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L408)

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

[`Layer`](Layer.md).[`remove`](Layer.md#remove)

***

### render()

> **render**(`opts?`): `Promise`\<[`Layer`](Layer.md)\>

Defined in: [package/layer.js:191](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L191)

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

`Promise`\<[`Layer`](Layer.md)\>

#### Inherited from

[`Layer`](Layer.md).[`render`](Layer.md#render)

***

### reproject()

> **reproject**(`toCrs`): [`Layer`](Layer.md)

Defined in: [package/layer.js:334](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L334)

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

Defined in: [package/layer.js:332](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L332)

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

Defined in: [package/layer.js:317](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L317)

Points the layer back at the sources it held before its first op. Async and atomic like any
source swap, so a live layer re-renders. Does nothing when no op has been applied.

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

Defined in: [package/layer.js:342](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L342)

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

Defined in: [package/layer.js:487](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L487)

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

[`Layer`](Layer.md)

#### Inherited from

[`Layer`](Layer.md).[`set`](Layer.md#set)

***

### setNoData()

> **setNoData**(`v`): `RasterLayer`

Defined in: [package/layer.js:552](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L552)

Set the no-data sentinel (transparent + excluded from stats). Chainable.

#### Parameters

##### v

`number`

#### Returns

`RasterLayer`

***

### setOpacity()

> **setOpacity**(`v`): `RasterLayer`

Defined in: [package/layer.js:555](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L555)

Set overlay opacity (0..1), applied live via the provider (no redraw). Chainable.

#### Parameters

##### v

`number`

#### Returns

`RasterLayer`

***

### setSources()

> **setSources**(`sources`, `opts?`): `Promise`\<[`Layer`](Layer.md)\>

Defined in: [package/layer.js:227](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L227)

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

`Promise`\<[`Layer`](Layer.md)\>

#### Inherited from

[`Layer`](Layer.md).[`setSources`](Layer.md#setsources)

***

### settled()

> **settled**(): `Promise`\<[`Layer`](Layer.md)\>

Defined in: [package/layer.js:491](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L491)

Resolves once any redraw kicked off by `set()` has finished.

#### Returns

`Promise`\<[`Layer`](Layer.md)\>

#### Inherited from

[`Layer`](Layer.md).[`settled`](Layer.md#settled)

***

### show()

> **show**(): `RasterLayer`

Defined in: [package/layer.js:578](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L578)

Re-show the overlay at its configured opacity. Chainable.

#### Returns

`RasterLayer`

#### Overrides

[`Layer`](Layer.md).[`show`](Layer.md#show)

***

### slope()

> **slope**(`opts?`): [`Layer`](Layer.md)

Defined in: [package/layer.js:336](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L336)

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

Defined in: [package/layer.js:515](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L515)

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

Defined in: [package/layer.js:446](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L446)

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

[`Layer`](Layer.md).[`toSpec`](Layer.md#tospec)

***

### valueAt()

> **valueAt**(`lat`, `lng`, `opts?`): `number`

Defined in: [package/layer.js:619](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L619)

The pixel value at a lat/lng, from the nearest cell. Null outside the footprint, at a no-data
pixel, or before pixels load. A tooltip, or enableHover() below, reads it.

#### Parameters

##### lat

`number`

##### lng

`number`

##### opts?

widen the noData check to `|v - noData| <=
  tolerance` rather than exact equality, for a raster whose sentinel drifts after resampling,
  i.e. a GDAL bilinear warp blending a real value with an adjacent nodata pixel near an edge.
  Defaults to 0, an exact match. hitTest() always uses the default, so widening this changes
  nothing about what a click resolves to unless valueAt() is called directly.

###### noDataTolerance?

`number` = `0`

#### Returns

`number`

***

### registerType()

> `static` **registerType**(`type`, `factory`): `void`

Defined in: [package/layer.js:88](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L88)

Registers the factory `fim.addLayer('<type>')` dispatches to.

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

Defined in: [package/layer.js:95](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L95)

The types `addLayer` can construct, built-in and host-registered. These are registry keys, not
`layer.type` values; see `getLayerTypes`.

#### Returns

`string`[]

#### Inherited from

[`Layer`](Layer.md).[`types`](Layer.md#types)
