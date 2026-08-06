[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / geomContains

# Function: geomContains()

> **geomContains**(`geom`, `x`, `y`): `boolean`

Defined in: [package/layer.js:1023](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/layer.js#L1023)

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
