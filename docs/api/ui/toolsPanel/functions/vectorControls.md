[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/toolsPanel](../README.md) / vectorControls

# Function: vectorControls()

> **vectorControls**(`layer`): [`Control`](../interfaces/Control.md)[]

Defined in: [ui/toolsPanel.js:51](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/ui/toolsPanel.js#L51)

PURE: the control spec for a vector layer — fill/stroke colour + fill opacity, plus the palette
controls when the layer is grading features by a property (`colorScale` + `colorBy`). Those two
keys are the SAME ones `rasterControls` emits, because they write the same `ColorScale` — so a
host's palette picker is one control that fits either kind of layer.

## Parameters

### layer

[`VectorLayer`](../../../package/layer/classes/VectorLayer.md)

## Returns

[`Control`](../interfaces/Control.md)[]
