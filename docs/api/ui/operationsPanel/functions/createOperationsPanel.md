[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/operationsPanel](../README.md) / createOperationsPanel

# Function: createOperationsPanel()

> **createOperationsPanel**(`root`, `opts?`): `object`

Defined in: [ui/operationsPanel.js:36](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/ui/operationsPanel.js#L36)

Mount an operations panel for `layer` into `root`.

## Parameters

### root

`string` \| `Element`

### opts?

#### layer

[`RasterLayer`](../../../package/layer/classes/RasterLayer.md)

#### onApply?

(`layer`, `err?`) => `void`

#### pretty?

`boolean` = `false`

#### region?

() => `any`[] \| [`SpatialFilter`](../../../package/filter/classes/SpatialFilter.md)

## Returns

`object`

### destroy

> **destroy**: () => `void`

#### Returns

`void`

### el

> **el**: `Element`
