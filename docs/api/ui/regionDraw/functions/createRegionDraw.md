[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [ui/regionDraw](../README.md) / createRegionDraw

# Function: createRegionDraw()

> **createRegionDraw**(`fim`, `opts?`): `object`

Defined in: [ui/regionDraw.js:19](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/ui/regionDraw.js#L19)

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
