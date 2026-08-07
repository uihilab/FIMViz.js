[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / resolveReprojector

# Function: resolveReprojector()

> **resolveReprojector**(): `Promise`\<[`Reprojector`](../type-aliases/Reprojector.md)\>

Defined in: [package/materialize.js:174](https://github.com/uihilab/FIMViz.js/blob/5f5ed4f732be60806d6924da01ee6b33fffc9ff0/src/package/materialize.js#L174)

The reprojector to warp with, running the default loader (once, memoized) if nothing is registered
yet. Dataset's reproject force calls this instead of getReprojector() so the JIT default gets a
chance before giving up.

## Returns

`Promise`\<[`Reprojector`](../type-aliases/Reprojector.md)\>
