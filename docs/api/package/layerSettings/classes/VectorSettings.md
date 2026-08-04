[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layerSettings](../README.md) / VectorSettings

# Class: VectorSettings

Defined in: package/layerSettings.js:206

Vector knobs: colour/opacity re-style the overlay (VectorLayer.setStyle re-adds with a merged
neutral style — no provider setVectorStyle in the contract); hover is interaction-only.

## Extends

- [`LayerSettings`](LayerSettings.md)

## Constructors

### Constructor

> **new VectorSettings**(`layer`): `VectorSettings`

Defined in: package/layerSettings.js:207

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

Defined in: package/layerSettings.js:27

#### hover

> **hover**: `boolean` = `false`

#### opacity

> **opacity**: `number` = `1`

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_defaults`](LayerSettings.md#_defaults)

***

### \_layer

> **\_layer**: [`Layer`](../../layer/classes/Layer.md)

Defined in: package/layerSettings.js:25

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_layer`](LayerSettings.md#_layer)

***

### \_pending

> **\_pending**: `any`

Defined in: package/layerSettings.js:96

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_pending`](LayerSettings.md#_pending)

***

### \_state

> **\_state**: `any`

Defined in: package/layerSettings.js:26

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`_state`](LayerSettings.md#_state)

## Methods

### \_apply()

> **\_apply**(`key`, `v`): `object`

Defined in: package/layerSettings.js:210

Apply one knob and report its effect. Return `null` for an unknown knob (ignored), else
`{ redraw, emit }` — `redraw:true` to re-render in place, `emit` the effect event name (or null
when another mechanism already emits it, e.g. ColorScale.onChange for palette).

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

Defined in: package/layerSettings.js:31

Read one knob, or the whole state object (a copy) when called with no key.

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

Defined in: package/layerSettings.js:123

Restore the reset defaults.

#### Returns

[`Layer`](../../layer/classes/Layer.md)

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`reset`](LayerSettings.md#reset)

***

### set()

> **set**(`partial?`): [`Layer`](../../layer/classes/Layer.md)

Defined in: package/layerSettings.js:54

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

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`set`](LayerSettings.md#set)

***

### settled()

> **settled**(): `Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

Defined in: package/layerSettings.js:120

Resolves once any redraw a `set()` kicked off has finished (and its effect events have fired).
Resolves immediately when nothing is pending — so `await layer.settled()` is always safe.

#### Returns

`Promise`\<[`Layer`](../../layer/classes/Layer.md)\>

#### Inherited from

[`LayerSettings`](LayerSettings.md).[`settled`](LayerSettings.md#settled)
