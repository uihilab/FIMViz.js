[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / clipGrid

# Function: clipGrid()

> **clipGrid**(`grid`, `bbox`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:55](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/rasterOps.js#L55)

Crop a grid to a bbox (intersected with the grid footprint), snapped to pixel edges → a smaller
grid with new bounds. Preserves the pixel array's type.

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
