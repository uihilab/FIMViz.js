[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/infoWindow](../README.md) / createInfoWindow

# Function: createInfoWindow()

> **createInfoWindow**(`fim?`, `opts?`): `object`

Defined in: [ui/infoWindow.js:16](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/ui/infoWindow.js#L16)

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
