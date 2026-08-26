[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / getLayerTypes

# Function: getLayerTypes()

> **getLayerTypes**(): `string`[]

Defined in: [package/layer.js:1135](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L1135)

The layer types `fim.addLayer(type, ...)` can construct, built-in and host-registered. The public
query, matching `mapProviderNames()` and `materializerFormats()`.

These are registry keys, not `layer.type` values, and the two overlap. 'depth' and 'ensemble'
appear here as constructible types and also as `RasterLayer.type` values among sibling rasters,
alongside 'extent' and 'userRaster', where they say which kind of raster this is rather than which
factory built it. This function answers only the first question.

## Returns

`string`[]
