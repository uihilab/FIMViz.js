[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / registerDefaultReprojectorLoader

# Function: registerDefaultReprojectorLoader()

> **registerDefaultReprojectorLoader**(`fn`): `void`

Defined in: [package/materialize.js:158](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/materialize.js#L158)

Registers the fallback used when a force finds no reprojector. `fn` runs at most once, memoized,
and must call registerReprojector() itself before it resolves.

## Parameters

### fn

() => `Promise`\<`void`\>

## Returns

`void`
