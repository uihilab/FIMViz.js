[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/reprojector](../README.md) / registerGdalReprojector

# Function: registerGdalReprojector()

> **registerGdalReprojector**(): `void`

Defined in: [io/reprojector.js:68](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/io/reprojector.js#L68)

Wire the GDAL reprojector into the materialize seam so `ds.reproject(crs).grid()` warps in the
browser. Idempotent. Browser-only (pulls gdal3.js). See the module header.

## Returns

`void`
