[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/layer](../README.md) / geomContains

# Function: geomContains()

> **geomContains**(`geom`, `x`, `y`): `boolean`

Defined in: [package/layer.js:1074](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/layer.js#L1074)

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
