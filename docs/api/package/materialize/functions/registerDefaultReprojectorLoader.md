[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / registerDefaultReprojectorLoader

# Function: registerDefaultReprojectorLoader()

> **registerDefaultReprojectorLoader**(`fn`): `void`

Defined in: [package/materialize.js:161](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/materialize.js#L161)

Register the fallback used when a force finds no reprojector registered yet. `fn` is invoked AT
MOST ONCE (memoized) and is expected to call registerReprojector() itself before resolving.

## Parameters

### fn

() => `Promise`\<`void`\>

## Returns

`void`
