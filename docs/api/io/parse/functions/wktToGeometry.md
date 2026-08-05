[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/parse](../README.md) / wktToGeometry

# Function: wktToGeometry()

> **wktToGeometry**(`wkt`): `object`

Defined in: [io/parse.js:308](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/parse.js#L308)

Parse a WKT geometry string into GeoJSON geometry. Supports POINT/MULTIPOINT/LINESTRING/
MULTILINESTRING/POLYGON/MULTIPOLYGON (2-D only). Throws on anything else.

## Parameters

### wkt

`string`

## Returns

`object`

### coordinates

> **coordinates**: `any`[]

### type

> **type**: `string`
