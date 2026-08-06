[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/parse](../README.md) / wktToGeometry

# Function: wktToGeometry()

> **wktToGeometry**(`wkt`): `object`

Defined in: [io/parse.js:308](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/parse.js#L308)

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
