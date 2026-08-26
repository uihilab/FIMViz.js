[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / clipGrid

# Function: clipGrid()

> **clipGrid**(`grid`, `bbox`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:66](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/rasterOps.js#L66)

Crops a grid to a bbox, intersected with the grid's own footprint and snapped to pixel edges,
giving a smaller grid with new bounds. Keeps the pixel array's type.

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

### bbox

#### east

`number`

#### north

`number`

#### south

`number`

#### west

`number`

## Returns

[`RasterGrid`](../../materialize/classes/RasterGrid.md)
