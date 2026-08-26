[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / maskGrid

# Function: maskGrid()

> **maskGrid**(`grid`, `polygon`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:37](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/rasterOps.js#L37)

Masks a grid by a polygon. Pixels outside it become NaN, or inside it with `invert`. The bounds
do not change. Scans only the polygon's pixel bbox rather than the whole grid.

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
