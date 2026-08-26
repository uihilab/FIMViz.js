[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/parse](../README.md) / wktToGeometry

# Function: wktToGeometry()

> **wktToGeometry**(`wkt`): `object`

Defined in: [io/parse.js:389](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/io/parse.js#L389)

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
