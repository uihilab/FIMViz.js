[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / Materializer

# Type Alias: Materializer

> **Materializer** = (`root`, `ds`) => `Promise`\<[`RasterGrid`](../classes/RasterGrid.md) \| [`VectorFeatures`](../classes/VectorFeatures.md)\>

Defined in: [package/materialize.js:90](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/materialize.js#L90)

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
