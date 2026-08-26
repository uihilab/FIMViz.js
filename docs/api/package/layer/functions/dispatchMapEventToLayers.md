[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / dispatchMapEventToLayers

# Function: dispatchMapEventToLayers()

> **dispatchMapEventToLayers**(`layers`, `type`, `base`, `opts?`): `any`

Defined in: [package/layer.js:1091](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L1091)

Dispatches a normalized map event to the layers top down in z-order, where the last entry is
topmost, hit-testing each. By default it stops once a handler absorbs the event with
`evt.stopPropagation()`. With `{ simultaneous: true }` each hit layer receives it and
`stopPropagation` does nothing. Either way, only a visible layer with a listener for `type` and a
passing hitTest receives it. Pure over a layers array, and FimMap wraps it. (PACKAGE_ROADMAP §1)

## Parameters

### layers

[`Layer`](../classes/Layer.md)[]

### type

`string`

### base

#### lat

`number`

#### lng

`number`

### opts?

#### simultaneous?

`boolean` = `false`

## Returns

`any`

the event object (carries `stopPropagation`)
