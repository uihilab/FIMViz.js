[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/toast](../README.md) / connectToast

# Function: connectToast()

> **connectToast**(`fim`, `toast?`, `opts?`): `object` & `object`

Defined in: [ui/toast.js:86](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/ui/toast.js#L86)

Subscribe a toast to the engine's user-facing host events (the host wires this — the engine never
reaches for the UI). `notify` maps its levels (info/warn/error/success) onto toast levels;
`layer:raster-oversized` and `layer:crs-unrenderable` become warnings, since both describe
something visibly wrong with what was just drawn.

## Parameters

### fim

[`FimMap`](../../../package/fimMap/classes/FimMap.md) \| \{ `off?`: `Function`; `on`: `Function`; \}

### toast?

#### clear

() => `void`

#### destroy

() => `void`

#### el

`Element`

#### show

(`msg`, `o?`) => `Element`

### opts?

`warnings:false` keeps this to `notify` only

#### warnings?

`boolean` = `true`

## Returns

`object` & `object`

the toast, plus an unsubscribe
