[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / getMaterializer

# Function: getMaterializer()

> **getMaterializer**(`format`): [`Materializer`](../type-aliases/Materializer.md)

Defined in: package/materialize.js:92

The decoder for `format`, or null. Dataset.#force uses this; a null result becomes a clear
"no materializer registered for '<format>' — import fimviz/src/io/materializers.js" error.

## Parameters

### format

`string`

## Returns

[`Materializer`](../type-aliases/Materializer.md)
