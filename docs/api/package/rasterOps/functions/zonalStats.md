[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / zonalStats

# Function: zonalStats()

> **zonalStats**(`grid`, `zones`, `opts?`): `object`[]

Defined in: [package/rasterOps.js:276](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/rasterOps.js#L276)

Per-zone min, max, mean, sum, count and area over a raster. Each zone is
`{ id?, polygon | filter }`, where polygon is a ring or multi-ring of {lat,lng} or [lat,lng].
Absent pixels are excluded. `area` is in the square of the bounds' units, so WGS84 gives degrees
squared and the user scales it to meters.

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

### zones

`object`[]

### opts?

#### noData?

`number`

## Returns

`object`[]
