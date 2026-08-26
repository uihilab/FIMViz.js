[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / getMaterializer

# Function: getMaterializer()

> **getMaterializer**(`format`): [`Materializer`](../type-aliases/Materializer.md)

Defined in: [package/materialize.js:111](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L111)

The decoder for `format`, or null. Dataset.#force calls this and turns a null into a "no
materializer registered for '<format>'" error naming fimviz/src/io/materializers.js.

## Parameters

### format

`string`

## Returns

[`Materializer`](../type-aliases/Materializer.md)
