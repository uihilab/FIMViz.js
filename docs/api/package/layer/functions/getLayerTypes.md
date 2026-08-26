[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / getLayerTypes

# Function: getLayerTypes()

> **getLayerTypes**(): `string`[]

Defined in: [package/layer.js:1139](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L1139)

The layer types `fim.addLayer(type, ...)` can construct, built-in and host-registered. The public
query, matching `mapProviderNames()` and `materializerFormats()`.

These are registry keys, not `layer.type` values, and the two overlap. 'depth' and 'ensemble'
appear here as constructible types and also as `RasterLayer.type` values among sibling rasters,
alongside 'extent' and 'userRaster', where they say which kind of raster this is rather than which
factory built it. This function answers only the first question.

## Returns

`string`[]
