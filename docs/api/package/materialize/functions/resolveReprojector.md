[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / resolveReprojector

# Function: resolveReprojector()

> **resolveReprojector**(): `Promise`\<[`Reprojector`](../type-aliases/Reprojector.md)\>

Defined in: [package/materialize.js:171](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L171)

The reprojector to warp with, running the default loader once if nothing is registered yet.
Dataset's reproject force calls this rather than getReprojector(), so the lazy default gets a
chance before the force gives up.

## Returns

`Promise`\<[`Reprojector`](../type-aliases/Reprojector.md)\>
