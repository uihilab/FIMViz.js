[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / hillshadeGrid

# Function: hillshadeGrid()

> **hillshadeGrid**(`grid`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:378](https://github.com/uihilab/FIMViz.js/blob/5f5ed4f732be60806d6924da01ee6b33fffc9ff0/src/package/rasterOps.js#L378)

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
