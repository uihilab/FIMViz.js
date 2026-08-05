[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / dispatchMapEventToLayers

# Function: dispatchMapEventToLayers()

> **dispatchMapEventToLayers**(`layers`, `type`, `base`, `opts?`): `any`

Defined in: [package/layer.js:1044](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/layer.js#L1044)

Dispatch a normalized map event to the layers TOP-DOWN in z-order (last = top), hit-testing each.
Default (precedence): stop when a handler absorbs it (`evt.stopPropagation()`). With
`{ simultaneous: true }`: precedence/absorption is bypassed — EVERY hit-tested layer receives it,
`stopPropagation` is inert. Only visible layers with a listener for `type` and a passing hitTest
receive it either way. Pure over a layers array — FimMap wraps it. (PACKAGE_ROADMAP §1)

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
