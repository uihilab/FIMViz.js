[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/infoWindow](../README.md) / createInfoWindow

# Function: createInfoWindow()

> **createInfoWindow**(`fim?`, `opts?`): `object`

Defined in: [ui/infoWindow.js:16](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/ui/infoWindow.js#L16)

A dismissible info window positioned at the pointer.

## Parameters

### fim?

[`FimMap`](../../../package/fimMap/classes/FimMap.md) \| \{ `root?`: `Element`; \}

### opts?

#### style?

`any`

## Returns

`object`

### close

> **close**: () => `void`

#### Returns

`void`

### destroy

> **destroy**: () => `void`

#### Returns

`void`

### el

> **el**: `Element`

### open

> **open**: (`evt`, `html`) => `void`

#### Parameters

##### evt

`any`

##### html

`string` \| `Node`

#### Returns

`void`
