[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / slopeGrid

# Function: slopeGrid()

> **slopeGrid**(`grid`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:327](https://github.com/uihilab/FIMViz.js/blob/5f5ed4f732be60806d6924da01ee6b33fffc9ff0/src/package/rasterOps.js#L327)

Slope — per-pixel terrain steepness via Horn's method (gdaldem's slope algorithm), computed in pure
JS on the decoded grid. `unit:'degrees'|'percent'`; `zFactor` scales elevation before the gradient
(vertical exaggeration / unit conversion, e.g. feet→metres).

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

### opts?

#### cellsizeX?

`number`

#### cellsizeY?

`number`

#### unit?

`"degrees"` \| `"percent"` = `"degrees"`

#### zFactor?

`number` = `1`

## Returns

[`RasterGrid`](../../materialize/classes/RasterGrid.md)
