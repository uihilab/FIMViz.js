[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [geo/warp](../README.md) / warp

# Function: warp()

> **warp**(`ds`, `toCrs`): `Promise`\<[`Dataset`](../../../package/dataset/classes/Dataset.md)\>

Defined in: [geo/warp.js:44](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/geo/warp.js#L44)

Reproject `ds` to `toCrs` (e.g. 'EPSG:4326'). Returns a NEW Dataset — value semantics — with a
new id, since reprojected pixels are a new value rather than an edit of the old one. Returns
`ds` unchanged when it is already in an equivalent CRS (no copy, no GDAL).

Rasters only: geojson/kml/kmz/shp are EPSG:4326 by spec, so the vector path has no consumer and
would mean running proj4 over every coordinate.

## Parameters

### ds

[`Dataset`](../../../package/dataset/classes/Dataset.md)

### toCrs

`string`

## Returns

`Promise`\<[`Dataset`](../../../package/dataset/classes/Dataset.md)\>
