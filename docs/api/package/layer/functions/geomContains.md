[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / geomContains

# Function: geomContains()

> **geomContains**(`geom`, `x`, `y`): `boolean`

Defined in: [package/layer.js:1066](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/layer.js#L1066)

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
