[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/parse](../README.md) / csvHeaders

# Function: csvHeaders()

> **csvHeaders**(`text`, `opts?`): `string`[]

Defined in: [io/parse.js:350](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/io/parse.js#L350)

The header row of a CSV text, trimmed — lets a host build a column-mapping UI (which column is
latitude/longitude/geometry?) BEFORE calling parseFile/parseSource with { latField, lngField } or
{ geometryField }.

## Parameters

### text

`string`

### opts?

#### delimiter?

`string` = `","`

## Returns

`string`[]
