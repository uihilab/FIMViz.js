[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/reprojector](../README.md) / registerGdalReprojector

# Function: registerGdalReprojector()

> **registerGdalReprojector**(): `void`

Defined in: [io/reprojector.js:68](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/io/reprojector.js#L68)

Wire the GDAL reprojector into the materialize seam so `ds.reproject(crs).grid()` warps in the
browser. Idempotent. Browser-only (pulls gdal3.js). See the module header.

## Returns

`void`
