[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/parse](../README.md) / csvHeaders

# Function: csvHeaders()

> **csvHeaders**(`text`, `opts?`): `string`[]

Defined in: [io/parse.js:341](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/io/parse.js#L341)

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
