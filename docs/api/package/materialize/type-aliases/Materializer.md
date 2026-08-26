[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / Materializer

# Type Alias: Materializer

> **Materializer** = (`root`, `ds`) => `Promise`\<[`RasterGrid`](../classes/RasterGrid.md) \| [`VectorFeatures`](../classes/VectorFeatures.md)\>

Defined in: [package/materialize.js:88](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/materialize.js#L88)

## Type Parameters

## Parameters

### root

#### data?

`any`

#### kind

`"inline"` \| `"url"`

#### url?

`string`

### ds

[`Dataset`](../../dataset/classes/Dataset.md)

## Returns

`Promise`\<[`RasterGrid`](../classes/RasterGrid.md) \| [`VectorFeatures`](../classes/VectorFeatures.md)\>
