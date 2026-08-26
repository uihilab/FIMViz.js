[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / rasterizeFeatures

# Function: rasterizeFeatures()

> **rasterizeFeatures**(`featureCollection`, `bounds`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:431](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/rasterOps.js#L431)

Rasterizes vector features onto a new grid, the one op that changes a Dataset's kind. Each pixel
center is point-tested against the features' polygons. `field` burns that feature property's
value; omit it to burn a constant `burnValue`. Where features overlap, the later one in the
collection wins, so burn order follows draw order. Reads Polygon and MultiPolygon geometry only,
ignoring point and line features.

## Parameters

### featureCollection

`any`

a GeoJSON FeatureCollection (VectorFeatures.features)

### bounds

the OUTPUT grid's footprint

#### east

`number`

#### north

`number`

#### south

`number`

#### west

`number`

### opts?

#### burnValue?

`number` = `1`

#### field?

`string`

#### height

`number`

#### width

`number`

## Returns

[`RasterGrid`](../../materialize/classes/RasterGrid.md)
