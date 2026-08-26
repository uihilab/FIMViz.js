[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layerSettings](../README.md) / RasterSettings

# Class: RasterSettings

Defined in: [package/layerSettings.js:134](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L134)

Raster knobs. `palette` and `continuous` go to the layer's ColorScale, whose onChange emits
'restyle' and repaints. `noData` changes the data, so it emits 'recomputed' and forces a redraw.
`opacity` sets provider opacity with no redraw. `hover` affects interaction only.

## Extends

- [`LayerSettings`](LayerSettings.md)

## Constructors

### Constructor

> **new RasterSettings**(`layer`): `RasterSettings`

Defined in: [package/layerSettings.js:135](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L135)

#### Parameters

##### layer

`any`

#### Returns

`RasterSettings`

#### Overrides

[`LayerSettings`](LayerSettings.md).[`constructor`](LayerSettings.md#constructor)

## Properties

### \_defaults

> **\_defaults**: `object`

Defined in: [package/layerSettings.js:137](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L137)

#### hover

> **hover**: `boolean` = `true`

#### opacity

> **opacity**: `number` = `1`

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_defaults`](LayerSettings.md#_defaults)

***

### \_layer

> **\_layer**: [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:23](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L23)

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_layer`](LayerSettings.md#_layer)

***

### \_pending

> **\_pending**: `any`

Defined in: [package/layerSettings.js:91](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L91)

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_pending`](LayerSettings.md#_pending)

***

### \_state

> **\_state**: `any`

Defined in: [package/layerSettings.js:24](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L24)

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_state`](LayerSettings.md#_state)

***

### SCALE\_KEYS

> `static` **SCALE\_KEYS**: `string`[]

Defined in: [package/layerSettings.js:143](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L143)

The knobs belonging to the attached ColorScale. One list, so the group pass and the per-key
fallback below cannot drift apart.

## Methods

### \_apply()

> **\_apply**(`key`, `v`): `object`

Defined in: [package/layerSettings.js:164](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L164)

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

> **emit**: `string` = `"recomputed"`

##### redraw

> **redraw**: `boolean` = `true`

#### Overrides

[`LayerSettings`](LayerSettings.md).[`_apply`](LayerSettings.md#_apply)

***

### \_applyGroup()

> **\_applyGroup**(`partial`): `object`

Defined in: [package/layerSettings.js:150](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L150)

Folds the ColorScale-bound knobs into one `colorScale.set(patch)`, giving one onChange, one
'restyle' and one repaint however many of them the patch holds.

#### Parameters

##### partial

`any`

#### Returns

`object`

##### emit

> **emit**: `string`

##### keys

> **keys**: `Set`\<`string`\>

##### redraw

> **redraw**: `boolean`

***

### get()

> **get**(`key`): `any`

Defined in: [package/layerSettings.js:29](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L29)

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

Defined in: [package/layerSettings.js:118](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L118)

Restores the reset defaults.

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`reset`](LayerSettings.md#reset)

***

### set()

> **set**(`partial?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:50](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L50)

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

Defined in: [package/layerSettings.js:115](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L115)

Resolves once any redraw `set()` started has finished and its effect events have fired.
Resolves immediately when nothing is pending, so `await layer.settled()` is always safe.

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`settled`](LayerSettings.md#settled)
