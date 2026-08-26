[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/toolsPanel](../README.md) / createToolsPanel

# Function: createToolsPanel()

> **createToolsPanel**(`root`, `opts?`): `object`

Defined in: [ui/toolsPanel.js:288](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/ui/toolsPanel.js#L288)

Mount a tools panel for `layer` into `root`. `controls` overrides the preset — an array or a
`(layer) => Control[]` function. `pretty:true` injects a scoped stylesheet; otherwise the panel is
bare structure the host styles.

`reactive:true` keeps the panel in step with changes made anywhere else — `layer.set()`, another
panel, a preset button. See the focus rule below; it is the reason this is opt-in rather than
always on.

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

#### reactive?

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
