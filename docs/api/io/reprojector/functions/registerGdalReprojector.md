[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/reprojector](../README.md) / registerGdalReprojector

# Function: registerGdalReprojector()

> **registerGdalReprojector**(): `void`

Defined in: [io/reprojector.js:68](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/reprojector.js#L68)

Wire the GDAL reprojector into the materialize seam so `ds.reproject(crs).grid()` warps in the
browser. Idempotent. Browser-only (pulls gdal3.js). See the module header.

## Returns

`void`
