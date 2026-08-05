[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/fimViz](../README.md) / createApp

# Function: createApp()

> **createApp**(): [`FimVizInstance`](../classes/FimVizInstance.md)

Defined in: [package/fimViz.js:246](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/fimViz.js#L246)

An ISOLATED app — its own config, event bus, storage and single-map guard, NOT the shared
default. This is what lets two independent widgets (e.g. a Google map and a Leaflet map) coexist
on one page: each `mount({ isolated: true })` gets a fresh app, so the per-app "already-mounted"
guard does not collide. (The ambient DOM/config pointers are still last-writer-wins — fine for
bare maps; the layer subsystems are not yet fully isolated.)

## Returns

[`FimVizInstance`](../classes/FimVizInstance.md)
