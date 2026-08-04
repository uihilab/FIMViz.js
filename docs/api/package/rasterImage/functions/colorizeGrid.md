[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterImage](../README.md) / colorizeGrid

# Function: colorizeGrid()

> **colorizeGrid**(`grid`, `opts?`): `Uint8ClampedArray`\<`ArrayBufferLike`\>

Defined in: package/rasterImage.js:41

Colorize a RasterGrid to an RGBA buffer (PURE — no DOM). A pixel becomes transparent when it is
NaN, equal to the grid's `noData`, optionally zero (`skipZero`), or unmapped by the scale. With no
`colorScale`, a continuous blues ramp (ColorScale's own default palette) over the grid's own
min/max is used — this is the last-resort fallback; RasterLayer._draw() builds and ATTACHES a real
ColorScale before ever reaching here (explicit → GDAL-embedded legend → this default), so a caller
going through RasterLayer never actually exercises this branch. A caller using colorizeGrid
directly, without a Layer, still gets a sensible default.

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

### opts?

`any` = `{}`

{ colorScale?, alpha?, skipZero?, noData? } (noData overrides grid.noData)

## Returns

`Uint8ClampedArray`\<`ArrayBufferLike`\>

width*height*4 RGBA
