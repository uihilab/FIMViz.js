[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterImage](../README.md) / colorizeGrid

# Function: colorizeGrid()

> **colorizeGrid**(`grid`, `opts?`): `Uint8ClampedArray`\<`ArrayBufferLike`\>

Defined in: [package/rasterImage.js:40](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/rasterImage.js#L40)

Colorizes a RasterGrid into an RGBA buffer. Pure, with no DOM. A pixel goes transparent when it
is NaN, equals the grid's `noData`, equals zero and `skipZero` is set, or maps to no color.

Without a `colorScale` it falls back to a continuous blues ramp over the grid's own min and max.
RasterLayer._draw() attaches a real scale first, preferring an explicit one, then a GDAL-embedded
legend, then this default, so only code calling colorizeGrid outside a Layer reaches it.

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

### opts?

`any` = `{}`

{ colorScale?, alpha?, skipZero?, noData? } (noData overrides grid.noData)

## Returns

`Uint8ClampedArray`\<`ArrayBufferLike`\>

width*height*4 RGBA
