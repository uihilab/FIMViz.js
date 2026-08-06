[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / groupByGrid

# Function: groupByGrid()

> **groupByGrid**(`grid`, `by`, `opts?`): `object`[]

Defined in: [package/rasterOps.js:196](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/rasterOps.js#L196)

Group a raster's pixels by **another raster's values** and reduce each group — the third kind of
reduction, alongside `reduce()` (collapse a selection axis) and `zonalStats()` (collapse space by
geometry). This one collapses space by *value*: "mean depth per land-use class", "rainfall binned
by elevation", a rating curve of one variable against another.

It is deliberately NOT `select`/`reduce`, and not an overload of `zonalStats`: the grouping key
comes from DATA rather than from the axis model or from geometry, so it earns its own verb rather
than making an existing one mean two things.

`by` is conformed to `grid` (resampled onto its cells) exactly as `combineGrids` conforms its
inputs — same LHS-conform rule, same resampler, so the two agree on what "aligned" means.

Two grouping modes:
- **discrete** (default) — every distinct value of `by` is a class. For classification rasters
  (land use, soil type) where the values ARE the categories.
- **binned** — `bins: [0, 100, 500]` uses those edges; `bins: 5` cuts `by`'s finite range into five
  equal-width bands. For continuous `by` (elevation, discharge), where distinct values are useless.

A pixel is skipped when EITHER raster is absent there (NaN or the respective noData), so the result
only covers cells where both rasters actually have a value.

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
