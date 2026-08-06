[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/operationsPanel](../README.md) / createOperationsPanel

# Function: createOperationsPanel()

> **createOperationsPanel**(`root`, `opts?`): `object`

Defined in: [ui/operationsPanel.js:36](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/ui/operationsPanel.js#L36)

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
