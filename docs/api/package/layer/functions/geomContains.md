[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / geomContains

# Function: geomContains()

> **geomContains**(`geom`, `x`, `y`): `boolean`

Defined in: [package/layer.js:1023](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/layer.js#L1023)

Point-in-geometry for GeoJSON (x=lng, y=lat). Polygon/MultiPolygon exact; Point within ~0.0005°;
GeometryCollection recurses; lines/others → false. Exported for tests.

## Parameters

### geom

`any`

### x

`number`

### y

`number`

## Returns

`boolean`
