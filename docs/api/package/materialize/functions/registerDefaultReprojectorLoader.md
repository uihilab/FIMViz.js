[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / registerDefaultReprojectorLoader

# Function: registerDefaultReprojectorLoader()

> **registerDefaultReprojectorLoader**(`fn`): `void`

Defined in: [package/materialize.js:161](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/materialize.js#L161)

Register the fallback used when a force finds no reprojector registered yet. `fn` is invoked AT
MOST ONCE (memoized) and is expected to call registerReprojector() itself before resolving.

## Parameters

### fn

() => `Promise`\<`void`\>

## Returns

`void`
