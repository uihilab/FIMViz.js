[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/toast](../README.md) / connectToast

# Function: connectToast()

> **connectToast**(`fim`, `toast?`): `object`

Defined in: [ui/toast.js:70](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/ui/toast.js#L70)

Subscribe a toast to the engine's `notify` host event (the host wires this — the engine never
reaches for the UI). Maps notify levels (info/warn/error) onto toast levels.

## Parameters

### fim

[`FimMap`](../../../package/fimMap/classes/FimMap.md) \| \{ `on`: `Function`; \}

### toast?

#### clear

() => `void`

#### destroy

() => `void`

#### el

`Element`

#### show

(`msg`, `o?`) => `Element`

## Returns

`object`

### clear

> **clear**: () => `void`

#### Returns

`void`

### destroy

> **destroy**: () => `void`

#### Returns

`void`

### el

> **el**: `Element`

### show

> **show**: (`msg`, `o?`) => `Element`

#### Parameters

##### msg

`string`

##### o?

###### level?

`string`

###### timeout?

`number`

#### Returns

`Element`
