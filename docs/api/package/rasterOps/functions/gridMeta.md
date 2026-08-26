[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / gridMeta

# Function: gridMeta()

> **gridMeta**(`g`): `object`

Defined in: [package/rasterOps.js:24](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/rasterOps.js#L24)

Converts a RasterGrid to the `{bw,bs,be,bn,width,height}` meta that resample, pixelBbox and
Stats.raster read. Exported because every headless user needs it: a RasterGrid carries
`bounds.west`, those readers want `bw`, and rewriting the conversion by hand is the only
alternative.

## Parameters

### g

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

## Returns

`object`

### be

> **be**: `number`

### bn

> **bn**: `number`

### bs

> **bs**: `number`

### bw

> **bw**: `number`

### height

> **height**: `number`

### noData

> **noData**: `string` \| `number`

### unit

> **unit**: `string`

### width

> **width**: `number`
