[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / registerDefaultReprojectorLoader

# Function: registerDefaultReprojectorLoader()

> **registerDefaultReprojectorLoader**(`fn`): `void`

Defined in: [package/materialize.js:161](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/materialize.js#L161)

Register the fallback used when a force finds no reprojector registered yet. `fn` is invoked AT
MOST ONCE (memoized) and is expected to call registerReprojector() itself before resolving.

## Parameters

### fn

() => `Promise`\<`void`\>

## Returns

`void`
