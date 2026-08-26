[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/toolsPanel](../README.md) / vectorControls

# Function: vectorControls()

> **vectorControls**(`layer`): [`Control`](../interfaces/Control.md)[]

Defined in: [ui/toolsPanel.js:78](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/ui/toolsPanel.js#L78)

PURE: the control spec for a vector layer — fill/stroke colour + fill opacity, plus the palette
controls when the layer is grading features by a property (`colorScale` + `colorBy`). Those two
keys are the SAME ones `rasterControls` emits, because they write the same `ColorScale` — so a
host's palette picker is one control that fits either kind of layer.

## Parameters

### layer

[`VectorLayer`](../../../package/layer/classes/VectorLayer.md)

## Returns

[`Control`](../interfaces/Control.md)[]
