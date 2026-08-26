[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/readModels](../README.md) / bindLegend

# Function: bindLegend()

> **bindLegend**(`layer`, `opts?`): `object`

Defined in: [ui/readModels.js:141](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/ui/readModels.js#L141)

Mount a legend that keeps itself current.

```js
const legend = bindLegend(layer, { root: document.querySelector('#legend') });
layer.set({ palette: 'viridis' });     // the panel repaints itself
```

## Parameters

### layer

[`Layer`](../../../package/layer/classes/Layer.md)

### opts?

`render` overrides `renderLegend` — take the Legend, return an HTML string.

#### empty?

`string` = `""`

#### html?

`boolean` = `true`

#### render?

`Function` = `renderLegend`

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
