[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / geomContains

# Function: geomContains()

> **geomContains**(`geom`, `x`, `y`): `boolean`

Defined in: [package/layer.js:1070](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/layer.js#L1070)

Point-in-geometry for GeoJSON, where x is lng and y is lat. Polygon and MultiPolygon are exact, a
Point matches within ~0.0005 degrees, a GeometryCollection recurses, and anything else is false.
Exported for tests.

## Parameters

### geom

`any`

### x

`number`

### y

`number`

## Returns

`boolean`
