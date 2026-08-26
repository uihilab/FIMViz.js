[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / groupByGrid

# Function: groupByGrid()

> **groupByGrid**(`grid`, `by`, `opts?`): `object`[]

Defined in: [package/rasterOps.js:212](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/rasterOps.js#L212)

Groups a raster's pixels by another raster's values and reduces each group. It is the third kind
of reduction here: `reduce()` collapses a selection axis, `zonalStats()` collapses space by
geometry, and this collapses space by value. That gives mean depth per land-use class, rainfall
binned by elevation, or a rating curve of one variable against another.

It is neither `select`/`reduce` nor an overload of `zonalStats`, because the grouping key comes
from data rather than from the axis model or from geometry.

`by` is resampled onto `grid`'s cells the same way `combineGrids` conforms its inputs, using the
same rule and resampler, so both agree on what aligned means.

Two grouping modes. Discrete, the default, makes each distinct value of `by` a class, which suits
a classification raster such as land use where the values are already the categories. Binned takes
`bins: [0, 100, 500]` as explicit edges, or `bins: 5` to cut `by`'s finite range into five
equal-width bands, which suits a continuous `by` such as elevation where distinct values are
useless.

A pixel is skipped when either raster is absent there, so the result covers only cells where both
hold a value.

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

the values being reduced

### by

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

the values that define the groups

### opts?

#### bins?

`number` \| `number`[]

#### byNoData?

`number`

#### method?

`string` = `"nearest"`

#### noData?

`number`

## Returns

`object`[]

one row per non-empty
  group, ordered by class/bin
