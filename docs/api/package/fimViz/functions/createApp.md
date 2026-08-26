[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/fimViz](../README.md) / createApp

# Function: createApp()

> **createApp**(): [`FimVizInstance`](../classes/FimVizInstance.md)

Defined in: [package/fimViz.js:244](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/fimViz.js#L244)

An isolated app with its own config, event bus, storage and single-map guard, separate from the
default. This is what lets two widgets coexist on one page, i.e. a Google map beside a Leaflet
one: each `mount({ isolated: true })` gets a fresh app, so the per-app already-mounted guard does
not collide. The ambient DOM and config pointers remain last-writer-wins, which is fine for bare
maps, but the layer subsystems are not fully isolated yet.

## Returns

[`FimVizInstance`](../classes/FimVizInstance.md)
