[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/parse](../README.md) / csvHeaders

# Function: csvHeaders()

> **csvHeaders**(`text`, `opts?`): `string`[]

Defined in: [io/parse.js:269](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/io/parse.js#L269)

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
