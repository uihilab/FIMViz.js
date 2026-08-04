[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/infoWindow](../README.md) / createInfoWindow

# Function: createInfoWindow()

> **createInfoWindow**(`fim?`, `opts?`): `object`

Defined in: ui/infoWindow.js:16

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
