[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/regionDraw](../README.md) / createRegionDraw

# Function: createRegionDraw()

> **createRegionDraw**(`fim`, `opts?`): `object`

Defined in: [ui/regionDraw.js:32](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/ui/regionDraw.js#L32)

**Do not `start()` while the camera is moving.** `fit()`/`fitBounds` are animated on both
providers, and a click resolved mid-animation lands at the pre-animation projection — off by
exactly 2× when the fit changed zoom by one level. Await the map first:

```js
layer.fit();
await fim.whenIdle();     // resolves immediately-ish when the map is already still
regionDraw.start();
```

This module cannot enforce that itself: it is headless by design (it knows only
`fim.captureInteraction`, never a map SDK), so the wait belongs to the caller that moved the camera.

## Parameters

### fim

[`FimMap`](../../../package/fimMap/classes/FimMap.md)

### opts?

#### onCancel?

() => `void`

#### onComplete?

(`filter`, `points`) => `void`

#### onPoint?

(`points`, `evt`) => `void`

## Returns

`object`

### active

> **active**: `boolean`

### cancel

> **cancel**: () => `void`

#### Returns

`void`

### finish

> **finish**: () => [`SpatialFilter`](../../../package/filter/classes/SpatialFilter.md)

#### Returns

[`SpatialFilter`](../../../package/filter/classes/SpatialFilter.md)

### points

> **points**: `object`[]

### start

> **start**: () => `void`

#### Returns

`void`
