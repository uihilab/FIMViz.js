[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/readModels](../README.md) / bindLegend

# Function: bindLegend()

> **bindLegend**(`layer`, `opts?`): `object`

Defined in: [ui/readModels.js:141](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/ui/readModels.js#L141)

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
