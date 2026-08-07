[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / maskGrid

# Function: maskGrid()

> **maskGrid**(`grid`, `polygon`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:26](https://github.com/uihilab/FIMViz.js/blob/5f5ed4f732be60806d6924da01ee6b33fffc9ff0/src/package/rasterOps.js#L26)

Mask a grid by a polygon: pixels OUTSIDE the polygon become NaN (or inside, with `invert`). The
footprint/bounds are unchanged. Restricts the point-in-polygon scan to the polygon's pixel bbox.

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

### polygon

`any`[] \| [`SpatialFilter`](../../filter/classes/SpatialFilter.md)

a SpatialFilter, or a ring/multi-ring of {lat,lng}|[lat,lng]

### opts?

#### invert?

`boolean` = `false`

## Returns

[`RasterGrid`](../../materialize/classes/RasterGrid.md)
