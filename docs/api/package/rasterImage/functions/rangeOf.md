[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterImage](../README.md) / rangeOf

# Function: rangeOf()

> **rangeOf**(`grid`): `object`

Defined in: [package/rasterImage.js:17](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/rasterImage.js#L17)

Min/max over a grid's pixels, skipping noData/NaN — to seed a default continuous scale when the
caller attaches none. Exported so a caller building its own default ColorScale (e.g.
RasterLayer._draw's precedence chain) matches colorizeGrid's own fallback ranging exactly.

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

## Returns

`object`

### max

> **max**: `number`

### min

> **min**: `number`
