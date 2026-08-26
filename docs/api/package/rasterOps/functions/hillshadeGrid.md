[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / hillshadeGrid

# Function: hillshadeGrid()

> **hillshadeGrid**(`grid`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:386](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/rasterOps.js#L386)

A shaded-relief illumination raster by Horn's method, the algorithm gdaldem hillshade uses by
default. Values run from 0, dark, to 255, bright. `altitude` and `azimuth` give the light
source's elevation and compass bearing in degrees, defaulting to gdaldem's own 45-degree sun from
the northwest.

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
