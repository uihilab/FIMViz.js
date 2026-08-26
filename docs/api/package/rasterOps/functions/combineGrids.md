[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / combineGrids

# Function: combineGrids()

> **combineGrids**(`grids`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:153](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/rasterOps.js#L153)

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
