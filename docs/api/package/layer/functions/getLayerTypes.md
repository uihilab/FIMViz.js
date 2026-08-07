[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / getLayerTypes

# Function: getLayerTypes()

> **getLayerTypes**(): `string`[]

Defined in: [package/layer.js:1131](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/layer.js#L1131)

Every layer type `fim.addLayer(type, …)` can currently construct — the built-ins plus anything a
host registered. The public query, mirroring `mapProviderNames()`/`materializerFormats()`.

NOTE these are REGISTRY KEYS, not `layer.type` values. The two overlap confusingly: 'depth' and
'ensemble' appear here as constructible types AND as `RasterLayer.type` discriminators among
sibling rasters ('extent'|'userRaster'|'depth'|'ensemble'), where they mean "which kind of raster
is this", not "which factory built it". This function only ever answers the first question.

## Returns

`string`[]
