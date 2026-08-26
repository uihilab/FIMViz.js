[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/readModels](../README.md) / bindStats

# Function: bindStats()

> **bindStats**(`layer`, `opts?`): `object`

Defined in: [ui/readModels.js:159](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/ui/readModels.js#L159)

Mount a statistics table that keeps itself current.

`filter` may be a value or a getter — a getter, because the usual filter is a drawn region that
changes independently of the layer. The layer emits nothing when a region is drawn, so call
`update()` after that; everything the LAYER can know about is already automatic.

## Parameters

### layer

[`Layer`](../../../package/layer/classes/Layer.md)

### opts?

#### empty?

`string` = `""`

#### filter?

`any`

#### html?

`boolean` = `true`

#### render?

`Function` = `renderStats`

#### root?

`Element`

## Returns

`object`

### destroy

> **destroy**: () => `void`

#### Returns

`void`

### el

> **el**: `Element`

### off

> **off**: () => `void`

#### Returns

`void`

### update

> **update**: () => `void`

#### Returns

`void`
