[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / slopeGrid

# Function: slopeGrid()

> **slopeGrid**(`grid`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:334](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/rasterOps.js#L334)

Per-pixel terrain steepness by Horn's method, the algorithm gdaldem slope uses, in pure JS over
the decoded grid. `unit` is 'degrees' or 'percent'. `zFactor` scales elevation before the
gradient, for vertical exaggeration or a unit conversion such as feet to meters.

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
