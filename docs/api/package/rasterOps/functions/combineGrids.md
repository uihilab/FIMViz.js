[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / combineGrids

# Function: combineGrids()

> **combineGrids**(`grids`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:163](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/rasterOps.js#L163)

Combines N aligned rasters pixel by pixel. Resamples the other grids onto grids[0]'s exact grid
in memory, then reduces with `op`. `difference` and `ratio` take two grids; `sum`, `mean`, `min`
and `max` take any number and skip absent inputs. The result carries grids[0]'s bounds and dims.

## Parameters

### grids

[`RasterGrid`](../../materialize/classes/RasterGrid.md)[]

### opts?

#### method?

`string` = `"nearest"`

#### op?

`"min"` \| `"max"` \| `"sum"` \| `"mean"` \| `"difference"` \| `"ratio"` = `"difference"`

## Returns

[`RasterGrid`](../../materialize/classes/RasterGrid.md)
