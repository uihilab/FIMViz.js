[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/tooltip](../README.md) / createTooltip

# Function: createTooltip()

> **createTooltip**(`fim?`, `opts?`): `object`

Defined in: [ui/tooltip.js:13](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/ui/tooltip.js#L13)

A tooltip element that shows/hides and follows the pointer.

## Parameters

### fim?

[`FimMap`](../../../package/fimMap/classes/FimMap.md) \| \{ `root?`: `Element`; \}

### opts?

#### style?

`any`

## Returns

`object`

### destroy

> **destroy**: () => `void`

#### Returns

`void`

### el

> **el**: `Element`

### hide

> **hide**: () => `void`

#### Returns

`void`

### show

> **show**: (`evt`, `html`) => `void`

#### Parameters

##### evt

`any`

##### html

`string`

#### Returns

`void`
