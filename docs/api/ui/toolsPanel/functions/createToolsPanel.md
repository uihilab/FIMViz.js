[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/toolsPanel](../README.md) / createToolsPanel

# Function: createToolsPanel()

> **createToolsPanel**(`root`, `opts?`): `object`

Defined in: [ui/toolsPanel.js:130](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/ui/toolsPanel.js#L130)

Mount a tools panel for `layer` into `root`. `controls` overrides the preset — an array or a
`(layer) => Control[]` function. `pretty:true` injects a scoped stylesheet; otherwise the panel is
bare structure the host styles.

## Parameters

### root

`string` \| `Element`

### opts?

#### controls?

`any`

#### layer

[`Layer`](../../../package/layer/classes/Layer.md)

#### pretty?

`boolean` = `false`

## Returns

`object`

### destroy

> **destroy**: () => `void`

#### Returns

`void`

### el

> **el**: `Element`

### update

> **update**: () => `void`

#### Returns

`void`
