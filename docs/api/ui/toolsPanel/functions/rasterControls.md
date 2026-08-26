[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/toolsPanel](../README.md) / rasterControls

# Function: rasterControls()

> **rasterControls**(`layer`): [`Control`](../interfaces/Control.md)[]

Defined in: [ui/toolsPanel.js:37](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/ui/toolsPanel.js#L37)

PURE: the control spec for a raster layer.

With a `ColorScale` attached this is every knob `RasterSettings.SCALE_KEYS` accepts — palette,
continuous, min, max, unit, stops, colorStops — plus opacity and the hover toggle. All seven route
through `layer.settings.set()`, which coalesces them into ONE `colorScale.set(patch)`, so editing
several at once is one repaint.

The read side is `colorScale.toJSON()` rather than the scale's fields: it is the documented,
structured-cloneable description, and it is the only thing that reports which of the three
mutually-exclusive colouring modes (palette / discrete bands / gradient control points) is live.

## Parameters

### layer

[`RasterLayer`](../../../package/layer/classes/RasterLayer.md)

## Returns

[`Control`](../interfaces/Control.md)[]
