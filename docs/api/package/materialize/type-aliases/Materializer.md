[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / Materializer

# Type Alias: Materializer

> **Materializer** = (`root`, `ds`) => `Promise`\<[`RasterGrid`](../classes/RasterGrid.md) \| [`VectorFeatures`](../classes/VectorFeatures.md)\>

Defined in: [package/materialize.js:90](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/materialize.js#L90)

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
