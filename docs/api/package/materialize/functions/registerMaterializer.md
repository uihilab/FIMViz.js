[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / registerMaterializer

# Function: registerMaterializer()

> **registerMaterializer**(`format`, `fn`): `void`

Defined in: [package/materialize.js:102](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/materialize.js#L102)

Register the decoder for a `format` (e.g. 'geotiff', 'geojson'). Called by io/materializers.js on
import (and by tests). The decoder fetches (for a URL root) and decodes into a RasterGrid/
VectorFeatures. Keeping this out of Dataset's import graph is what preserves headlessness.

## Parameters

### format

`string`

### fn

[`Materializer`](../type-aliases/Materializer.md)

## Returns

`void`
