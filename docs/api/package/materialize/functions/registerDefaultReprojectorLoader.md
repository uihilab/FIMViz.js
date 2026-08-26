[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / registerDefaultReprojectorLoader

# Function: registerDefaultReprojectorLoader()

> **registerDefaultReprojectorLoader**(`fn`): `void`

Defined in: [package/materialize.js:158](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L158)

Registers the fallback used when a force finds no reprojector. `fn` runs at most once, memoized,
and must call registerReprojector() itself before it resolves.

## Parameters

### fn

() => `Promise`\<`void`\>

## Returns

`void`
