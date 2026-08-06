[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / rasterizeFeatures

# Function: rasterizeFeatures()

> **rasterizeFeatures**(`featureCollection`, `bounds`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:422](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/rasterOps.js#L422)

Rasterize vector features onto a new grid (vector→raster, the kind-changing op). Each pixel
centre is point-tested against every feature's polygon; `field` burns the feature's property value,
omit for a constant `burnValue`. Later features in the collection win where they overlap (burn order
= draw order). Polygon/MultiPolygon geometry only — point/line features are ignored.

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
