[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / combineGrids

# Function: combineGrids()

> **combineGrids**(`grids`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:146](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/rasterOps.js#L146)

Combine N aligned rasters per pixel (band math). LHS-conform: every other grid is resampled onto
grids[0]'s exact grid in memory, then reduced by `op`. `difference`/`ratio` are binary; `sum`/`mean`/
`min`/`max` are N-ary and skip noData/NaN inputs. Result carries grids[0]'s bounds/dims.

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
