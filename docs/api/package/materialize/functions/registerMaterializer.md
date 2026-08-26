[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / registerMaterializer

# Function: registerMaterializer()

> **registerMaterializer**(`format`, `fn`): `void`

Defined in: [package/materialize.js:100](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L100)

Registers the decoder for a `format`, i.e. 'geotiff'. io/materializers.js calls this on import,
and so do tests. The decoder fetches a URL root when it has one, then decodes into a RasterGrid
or VectorFeatures. Keeping it out of Dataset's import graph is what keeps Dataset headless.

## Parameters

### format

`string`

### fn

[`Materializer`](../type-aliases/Materializer.md)

## Returns

`void`
