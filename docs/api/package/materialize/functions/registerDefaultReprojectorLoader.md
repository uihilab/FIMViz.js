[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / registerDefaultReprojectorLoader

# Function: registerDefaultReprojectorLoader()

> **registerDefaultReprojectorLoader**(`fn`): `void`

Defined in: [package/materialize.js:161](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/materialize.js#L161)

Register the fallback used when a force finds no reprojector registered yet. `fn` is invoked AT
MOST ONCE (memoized) and is expected to call registerReprojector() itself before resolving.

## Parameters

### fn

() => `Promise`\<`void`\>

## Returns

`void`
