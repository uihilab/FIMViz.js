[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / providerAcceptsCRS

# Function: providerAcceptsCRS()

> **providerAcceptsCRS**(`name?`, `crs?`): `boolean`

Defined in: [package/mapProvider.js:652](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L652)

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
