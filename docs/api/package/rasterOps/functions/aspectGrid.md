[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / aspectGrid

# Function: aspectGrid()

> **aspectGrid**(`grid`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:259](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/rasterOps.js#L259)

Aspect — the downslope compass bearing via Horn's method (gdaldem's aspect algorithm, cellsize-free
like GDAL's own — it assumes square pixels): 0=north, 90=east, clockwise. Flat pixels (no gradient)
→ -1 (gdaldem's flat sentinel).

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

## Returns

[`RasterGrid`](../../materialize/classes/RasterGrid.md)
