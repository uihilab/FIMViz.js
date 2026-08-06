[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / slopeGrid

# Function: slopeGrid()

> **slopeGrid**(`grid`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:234](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/rasterOps.js#L234)

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
