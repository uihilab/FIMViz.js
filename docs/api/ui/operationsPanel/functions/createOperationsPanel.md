[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/operationsPanel](../README.md) / createOperationsPanel

# Function: createOperationsPanel()

> **createOperationsPanel**(`root`, `opts?`): `object`

Defined in: [ui/operationsPanel.js:245](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/ui/operationsPanel.js#L245)

Mount an operations panel for `layer` into `root`.

## Parameters

### root

`string` \| `Element`

### opts?

#### fim?

[`FimMap`](../../../package/fimMap/classes/FimMap.md)

#### layer

[`Layer`](../../../package/layer/classes/Layer.md)

#### layers?

() => [`Layer`](../../../package/layer/classes/Layer.md)[]

#### onApply?

(`layer`, `err?`) => `void`

#### onResult?

(`id`, `data`) => `void`

#### open?

`string`[] = `...`

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

### ops

> **ops**: `string`[]
