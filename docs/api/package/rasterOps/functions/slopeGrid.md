[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / slopeGrid

# Function: slopeGrid()

> **slopeGrid**(`grid`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:327](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/rasterOps.js#L327)

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
