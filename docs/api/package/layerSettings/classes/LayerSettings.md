[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layerSettings](../README.md) / LayerSettings

# Class: LayerSettings

Defined in: [package/layerSettings.js:19](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L19)

The declarative knob bag for a Layer. Subclasses implement `_apply(key, value)`.

## Extended by

- [`RasterSettings`](RasterSettings.md)
- [`VectorSettings`](VectorSettings.md)

## Constructors

### Constructor

> **new LayerSettings**(`layer`, `defaults?`): `LayerSettings`

Defined in: [package/layerSettings.js:24](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L24)

#### Parameters

##### layer

[`Layer`](../../layer/classes/Layer.md)

##### defaults?

`any` = `{}`

initial knob values (also the reset() target unless overridden)

#### Returns

`LayerSettings`

## Properties

### \_defaults

> **\_defaults**: `object`

Defined in: [package/layerSettings.js:27](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L27)

#### hover

> **hover**: `boolean` = `false`

#### opacity

> **opacity**: `number` = `1`

***

### \_layer

> **\_layer**: [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:25](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L25)

***

### \_pending

> **\_pending**: `any`

Defined in: [package/layerSettings.js:96](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L96)

***

### \_state

> **\_state**: `any`

Defined in: [package/layerSettings.js:26](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L26)

## Methods

### \_apply()

> **\_apply**(`key`, `value`): `object`

Defined in: [package/layerSettings.js:131](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L131)

Apply one knob and report its effect. Return `null` for an unknown knob (ignored), else
`{ redraw, emit }` — `redraw:true` to re-render in place, `emit` the effect event name (or null
when another mechanism already emits it, e.g. ColorScale.onChange for palette).

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

Defined in: [package/layerSettings.js:31](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L31)

Read one knob, or the whole state object (a copy) when called with no key.

#### Parameters

##### key

`any`

#### Returns

`any`

***

### reset()

> **reset**(): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:123](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L123)

Restore the reset defaults.

#### Returns

[`Layer`](../../layer/classes/Layer.md)

***

### set()

> **set**(`partial?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: [package/layerSettings.js:54](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L54)

Batch write. Applies each known knob, re-renders if any change needs a redraw, then emits the
distinct effect events (restyle/recomputed) once each plus a 'settings' summary.

SYNC AND CHAINABLE — returns the Layer, not a Promise.

Of every knob across Raster and Vector settings, exactly ONE (`noData`) triggers a redraw. When
it does, the render runs and the effect events fire AFTER it, so a subscriber never reads a
half-updated grid. To await that, use `await layer.settled()`, or subscribe to the
'recomputed'/'rendered' event. A render failure is reported via the layer's 'error' event.

PARTIAL, BEST-EFFORT: one key throwing (e.g. an invalid palette name failing `ColorScale`'s
validation) does not abort the rest of the batch — every OTHER key still
gets applied, committed to `_state`, and its effect event still fires. Failures are collected and,
if any occurred, thrown together as ONE aggregate error at the end — after the successful keys
have already taken effect — naming every failed key with its own message, plus which keys DID
succeed. This is deliberate: a caller sees exactly what went wrong and what didn't, rather than
either silently swallowing errors or having one bad key block unrelated ones in the same call.

#### Parameters

##### partial?

`any` = `{}`

#### Returns

[`Layer`](../../layer/classes/Layer.md)

the layer, for chaining

***

### settled()

> **settled**(): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: [package/layerSettings.js:120](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/layerSettings.js#L120)

Resolves once any redraw a `set()` kicked off has finished (and its effect events have fired).
Resolves immediately when nothing is pending — so `await layer.settled()` is always safe.

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>
