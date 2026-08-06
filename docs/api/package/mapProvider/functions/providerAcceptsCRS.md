[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / providerAcceptsCRS

# Function: providerAcceptsCRS()

> **providerAcceptsCRS**(`name?`, `crs?`): `boolean`

Defined in: [package/mapProvider.js:652](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/mapProvider.js#L652)

Can the named provider render content in `crs`? The Layer render precondition asks this before
drawing so a non-WGS84 raster surfaces a clear "reproject first" error instead of a blank overlay.
A provider that declares no `acceptsCRS` is treated as accepting anything (permissive default).

## Parameters

### name?

`string` = `DEFAULT_PROVIDER`

### crs?

`string` = `null`

## Returns

`boolean`
