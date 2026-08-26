[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / aspectGrid

# Function: aspectGrid()

> **aspectGrid**(`grid`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:359](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/rasterOps.js#L359)

The downslope compass bearing by Horn's method, the algorithm gdaldem aspect uses. Runs from 0 at
north through 90 at east, clockwise. It needs no cellsize, assuming square pixels as GDAL's does.
A flat pixel, having no gradient, returns -1, which is gdaldem's flat sentinel.

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

## Returns

[`RasterGrid`](../../materialize/classes/RasterGrid.md)
