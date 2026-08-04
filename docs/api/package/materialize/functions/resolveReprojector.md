[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / resolveReprojector

# Function: resolveReprojector()

> **resolveReprojector**(): `Promise`\<[`Reprojector`](../type-aliases/Reprojector.md)\>

Defined in: package/materialize.js:153

The reprojector to warp with, running the default loader (once, memoized) if nothing is registered
yet. Dataset's reproject force calls this instead of getReprojector() so the JIT default gets a
chance before giving up.

## Returns

`Promise`\<[`Reprojector`](../type-aliases/Reprojector.md)\>
