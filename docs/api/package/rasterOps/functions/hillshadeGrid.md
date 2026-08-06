[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / hillshadeGrid

# Function: hillshadeGrid()

> **hillshadeGrid**(`grid`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:285](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/rasterOps.js#L285)

Hillshade — a shaded-relief illumination raster via Horn's method (gdaldem's default hillshade
algorithm): 0 (dark) – 255 (bright). `altitude`/`azimuth` are the light source's elevation/compass
bearing in degrees (defaults: gdaldem's own — a 45°-high sun from the NW).

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

### opts?

#### altitude?

`number` = `45`

#### azimuth?

`number` = `315`

#### cellsizeX?

`number`

#### cellsizeY?

`number`

#### zFactor?

`number` = `1`

## Returns

[`RasterGrid`](../../materialize/classes/RasterGrid.md)
