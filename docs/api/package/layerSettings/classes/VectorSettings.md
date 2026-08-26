[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layerSettings](../README.md) / VectorSettings

# Class: VectorSettings

Defined in: [package/layerSettings.js:200](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L200)

Vector knobs. `color` and `opacity` restyle the overlay: no provider implements setVectorStyle,
so VectorLayer.setStyle re-adds it with a merged neutral style. `hover` affects interaction only.

## Extends

- [`LayerSettings`](LayerSettings.md)

## Constructors

### Constructor

> **new VectorSettings**(`layer`): `VectorSettings`

Defined in: [package/layerSettings.js:201](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L201)

#### Parameters

##### layer

`any`

#### Returns

`VectorSettings`

#### Overrides

[`LayerSettings`](LayerSettings.md).[`constructor`](LayerSettings.md#constructor)

## Properties

### \_defaults

> **\_defaults**: `object`

Defined in: [package/layerSettings.js:25](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L25)

#### hover

> **hover**: `boolean` = `false`

#### opacity

> **opacity**: `number` = `1`

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_defaults`](LayerSettings.md#_defaults)

***

### \_layer

> **\_layer**: [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:23](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L23)

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_layer`](LayerSettings.md#_layer)

***

### \_pending

> **\_pending**: `any`

Defined in: [package/layerSettings.js:91](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L91)

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_pending`](LayerSettings.md#_pending)

***

### \_state

> **\_state**: `any`

Defined in: [package/layerSettings.js:24](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L24)

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_state`](LayerSettings.md#_state)

## Methods

### \_apply()

> **\_apply**(`key`, `v`): `object`

Defined in: [package/layerSettings.js:210](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L210)

Applies one knob and reports its effect. Returns `null` for an unknown knob, which set()
ignores. Otherwise `redraw:true` asks for an in-place re-render, and `emit` names the effect
event, or is null when something else already emits it, i.e. ColorScale.onChange for palette.

#### Parameters

##### key

`any`

##### v

`any`

#### Returns

`object`

##### emit

> **emit**: `string` = `"restyle"`

##### redraw

> **redraw**: `boolean` = `false`

#### Overrides

[`LayerSettings`](LayerSettings.md).[`_apply`](LayerSettings.md#_apply)

***

### get()

> **get**(`key`): `any`

Defined in: [package/layerSettings.js:29](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L29)

Reads one knob, or a copy of the whole state object when given no key.

#### Parameters

##### key

`any`

#### Returns

`any`

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`get`](LayerSettings.md#get)

***

### reset()

> **reset**(): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:118](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L118)

Restores the reset defaults.

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`reset`](LayerSettings.md#reset)

***

### set()

> **set**(`partial?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:50](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L50)

Writes a batch of knobs. Applies each known one, re-renders if any needs a redraw, then emits
each distinct effect event once plus a 'settings' summary. Synchronous and chainable: it returns
the Layer, not a Promise.

Across Raster and Vector settings, only `noData` triggers a redraw. When it does, the render
runs and the effect events fire after it, so a subscriber never reads a half-updated grid. Await
it with `await layer.settled()`, or subscribe to 'recomputed' or 'rendered'. A render failure
arrives on the layer's 'error' event.

Partial and best-effort: one key throwing, i.e. an invalid palette name failing ColorScale's
validation, does not abort the batch. The other keys still apply, commit to `_state` and fire
their effect events. Failures are collected and thrown together as one error at the end, after
the successful keys have taken effect, naming each failed key with its message and listing the
keys that succeeded. The user then sees exactly what went wrong and what did not, instead of
silent failure or one bad key blocking unrelated ones.

#### Parameters

##### partial?

`any` = `{}`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

the layer, for chaining

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`set`](LayerSettings.md#set)

***

### settled()

> **settled**(): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: [package/layerSettings.js:115](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layerSettings.js#L115)

Resolves once any redraw `set()` started has finished and its effect events have fired.
Resolves immediately when nothing is pending, so `await layer.settled()` is always safe.

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`settled`](LayerSettings.md#settled)
