[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/parse](../README.md) / csvHeaders

# Function: csvHeaders()

> **csvHeaders**(`text`, `opts?`): `string`[]

Defined in: [io/parse.js:341](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/io/parse.js#L341)

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
