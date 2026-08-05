[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / getLayerTypes

# Function: getLayerTypes()

> **getLayerTypes**(): `string`[]

Defined in: [package/layer.js:1088](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/layer.js#L1088)

Every layer type `fim.addLayer(type, …)` can currently construct — the built-ins plus anything a
host registered. The public query, mirroring `mapProviderNames()`/`materializerFormats()`.

NOTE these are REGISTRY KEYS, not `layer.type` values. The two overlap confusingly: 'depth' and
'ensemble' appear here as constructible types AND as `RasterLayer.type` discriminators among
sibling rasters ('extent'|'userRaster'|'depth'|'ensemble'), where they mean "which kind of raster
is this", not "which factory built it". This function only ever answers the first question.

## Returns

`string`[]
