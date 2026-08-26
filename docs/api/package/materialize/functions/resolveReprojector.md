[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / resolveReprojector

# Function: resolveReprojector()

> **resolveReprojector**(): `Promise`\<[`Reprojector`](../type-aliases/Reprojector.md)\>

Defined in: [package/materialize.js:171](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/materialize.js#L171)

The reprojector to warp with, running the default loader once if nothing is registered yet.
Dataset's reproject force calls this rather than getReprojector(), so the lazy default gets a
chance before the force gives up.

## Returns

`Promise`\<[`Reprojector`](../type-aliases/Reprojector.md)\>
