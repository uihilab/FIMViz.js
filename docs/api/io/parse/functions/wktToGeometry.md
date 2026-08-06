[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/parse](../README.md) / wktToGeometry

# Function: wktToGeometry()

> **wktToGeometry**(`wkt`): `object`

Defined in: [io/parse.js:380](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/io/parse.js#L380)

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
