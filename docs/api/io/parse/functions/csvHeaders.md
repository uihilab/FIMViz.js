[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/parse](../README.md) / csvHeaders

# Function: csvHeaders()

> **csvHeaders**(`text`, `opts?`): `string`[]

Defined in: [io/parse.js:269](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/io/parse.js#L269)

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
