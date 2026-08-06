[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / geomContains

# Function: geomContains()

> **geomContains**(`geom`, `x`, `y`): `boolean`

Defined in: [package/layer.js:1023](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/layer.js#L1023)

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
