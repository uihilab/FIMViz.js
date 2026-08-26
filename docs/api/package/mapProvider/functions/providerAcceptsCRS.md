[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / providerAcceptsCRS

# Function: providerAcceptsCRS()

> **providerAcceptsCRS**(`name?`, `crs?`): `boolean`

Defined in: [package/mapProvider.js:806](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L806)

True when the named provider can render content in `crs`. The Layer render precondition asks
before drawing, so a non-WGS84 raster raises a clear "reproject first" error rather than showing
a blank overlay. A provider declaring no `acceptsCRS` accepts anything.

## Parameters

### name?

`string` = `DEFAULT_PROVIDER`

### crs?

`string` = `null`

## Returns

`boolean`
