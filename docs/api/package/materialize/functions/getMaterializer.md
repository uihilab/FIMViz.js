[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / getMaterializer

# Function: getMaterializer()

> **getMaterializer**(`format`): [`Materializer`](../type-aliases/Materializer.md)

Defined in: [package/materialize.js:111](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/materialize.js#L111)

The decoder for `format`, or null. Dataset.#force calls this and turns a null into a "no
materializer registered for '<format>'" error naming fimviz/src/io/materializers.js.

## Parameters

### format

`string`

## Returns

[`Materializer`](../type-aliases/Materializer.md)
