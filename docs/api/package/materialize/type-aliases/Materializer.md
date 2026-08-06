[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / Materializer

# Type Alias: Materializer

> **Materializer** = (`root`, `ds`) => `Promise`\<[`RasterGrid`](../classes/RasterGrid.md) \| [`VectorFeatures`](../classes/VectorFeatures.md)\>

Defined in: [package/materialize.js:90](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/materialize.js#L90)

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
