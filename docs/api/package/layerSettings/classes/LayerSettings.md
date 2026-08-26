[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layerSettings](../README.md) / LayerSettings

# Class: LayerSettings

Defined in: [package/layerSettings.js:17](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L17)

The declarative knob bag for a Layer. Subclasses implement `_apply(key, value)`.

## Extended by

- [`RasterSettings`](RasterSettings.md)
- [`VectorSettings`](VectorSettings.md)

## Constructors

### Constructor

> **new LayerSettings**(`layer`, `defaults?`): `LayerSettings`

Defined in: [package/layerSettings.js:22](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L22)

#### Parameters

##### layer

[`Layer`](../../layer/classes/Layer.md)

##### defaults?

`any` = `{}`

initial knob values, and the reset() target unless overridden

#### Returns

`LayerSettings`

## Properties

### \_defaults

> **\_defaults**: `object`

Defined in: [package/layerSettings.js:25](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L25)

#### hover

> **hover**: `boolean` = `false`

#### opacity

> **opacity**: `number` = `1`

***

### \_layer

> **\_layer**: [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:23](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L23)

***

### \_pending

> **\_pending**: `any`

Defined in: [package/layerSettings.js:91](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L91)

***

### \_state

> **\_state**: `any`

Defined in: [package/layerSettings.js:24](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L24)

## Methods

### \_apply()

> **\_apply**(`key`, `value`): `object`

Defined in: [package/layerSettings.js:126](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L126)

Applies one knob and reports its effect. Returns `null` for an unknown knob, which set()
ignores. Otherwise `redraw:true` asks for an in-place re-render, and `emit` names the effect
event, or is null when something else already emits it, i.e. ColorScale.onChange for palette.

#### Parameters

##### key

`string`

##### value

`any`

#### Returns

`object`

##### emit

> **emit**: `string`

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

***

### reset()

> **reset**(): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:118](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L118)

Restores the reset defaults.

#### Returns

[`Layer`](../../layer/classes/Layer.md)

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

***

### settled()

> **settled**(): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: [package/layerSettings.js:115](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layerSettings.js#L115)

Resolves once any redraw `set()` started has finished and its effect events have fired.
Resolves immediately when nothing is pending, so `await layer.settled()` is always safe.

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>
