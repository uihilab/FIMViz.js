[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layerSettings](../README.md) / RasterSettings

# Class: RasterSettings

Defined in: package/layerSettings.js:139

Raster knobs: palette/continuous route to the layer's ColorScale (style axis → 'restyle', which the
ColorScale's own onChange emits + repaints); noData is the data axis (→ 'recomputed' + a redraw);
opacity is placement (provider opacity, no redraw); hover is interaction-only (no map change).

## Extends

- [`LayerSettings`](LayerSettings.md)

## Constructors

### Constructor

> **new RasterSettings**(`layer`): `RasterSettings`

Defined in: package/layerSettings.js:140

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

Defined in: package/layerSettings.js:142

#### hover

> **hover**: `boolean` = `true`

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

***

### SCALE\_KEYS

> `static` **SCALE\_KEYS**: `string`[]

Defined in: package/layerSettings.js:148

Every knob that belongs to the attached ColorScale. Kept in one place so the group pass and the
per-key fallback below can't drift apart.

## Methods

### \_apply()

> **\_apply**(`key`, `v`): `object`

Defined in: package/layerSettings.js:169

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

> **emit**: `string` = `"recomputed"`

##### redraw

> **redraw**: `boolean` = `true`

#### Overrides

[`LayerSettings`](LayerSettings.md).[`_apply`](LayerSettings.md#_apply)

***

### \_applyGroup()

> **\_applyGroup**(`partial`): `object`

Defined in: package/layerSettings.js:155

Coalesce all ColorScale-bound knobs into ONE `colorScale.set(patch)` — one onChange, one
'restyle', one repaint, no matter how many of them are in the patch.

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
