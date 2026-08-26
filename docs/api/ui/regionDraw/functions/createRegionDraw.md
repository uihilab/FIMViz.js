[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/regionDraw](../README.md) / createRegionDraw

# Function: createRegionDraw()

> **createRegionDraw**(`fim`, `opts?`): `object`

Defined in: [ui/regionDraw.js:125](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/ui/regionDraw.js#L125)

Mount a modal selection tool over `fim`.

**Do not `start()` while the camera is moving.** `fit()`/`fitBounds` are animated on both
providers, and a click resolved mid-animation lands at the pre-animation projection — off by
exactly 2× when the fit changed zoom by one level. Await the map first:

```js
layer.fit();
await fim.whenIdle();     // resolves immediately-ish when the map is already still
regionDraw.start();
```

This module cannot enforce that itself: it is headless by design (it knows only `fim`'s own
methods, never a map SDK), so the wait belongs to the caller that moved the camera.

**Event types the host must enable.** `polygon` and `rectangle` need only `click`; `rectangle`
additionally uses `hover` for its rubber band. `freehand` and `brush` prefer
`mousedown`/`mouseup`, so enable them:

```js
fim.enableMapEvents(["click", "hover", "mousedown", "mouseup"]);
```

Without those two, the drag modes fall back to click-to-start / click-to-stop rather than
silently doing nothing — which is also how they behave on a touch device that never reports a
button press.

## Parameters

### fim

[`FimMap`](../../../package/fimMap/classes/FimMap.md)

### opts?

#### brushRadius?

`string` \| `number` = `250`

#### brushSides?

`number` = `16`

#### freezeCamera?

`boolean` = `true`

#### keys?

`boolean` = `true`

#### keyTarget?

`any`

#### minSampleMetres?

`number` = `0`

#### mode?

`"polygon"` \| `"rectangle"` \| `"freehand"` \| `"brush"` = `"polygon"`

#### onCancel?

() => `void`

#### onComplete?

(`filter`, `points`, `rings`) => `void`

#### onPoint?

(`points`, `evt`) => `void`

#### onPreview?

(`rings`, `points`) => `void`

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

### mode

> **mode**: `string`

### points

> **points**: `object`[]

### rings

> **rings**: `object`[][]

### setMode

> **setMode**: (`m`) => `void`

#### Parameters

##### m

`string`

#### Returns

`void`

### start

> **start**: () => `void`

#### Returns

`void`

### undo

> **undo**: () => `void`

#### Returns

`void`
