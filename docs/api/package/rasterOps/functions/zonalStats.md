[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / zonalStats

# Function: zonalStats()

> **zonalStats**(`grid`, `zones`, `opts?`): `object`[]

Defined in: [package/rasterOps.js:176](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/rasterOps.js#L176)

Zonal statistics: per-zone min/max/mean/sum/count/area over a raster. `zones` = [{ id?, polygon | filter }]
(a ring/multi-ring of {lat,lng}|[lat,lng], or a SpatialFilter). noData/NaN pixels are excluded; `area`
is in the bounds' units² (WGS84 → deg²; scale to metres in the caller if needed).

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
