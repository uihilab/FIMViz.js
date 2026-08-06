[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / getMaterializer

# Function: getMaterializer()

> **getMaterializer**(`format`): [`Materializer`](../type-aliases/Materializer.md)

Defined in: [package/materialize.js:113](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/materialize.js#L113)

The decoder for `format`, or null. Dataset.#force uses this; a null result becomes a clear
"no materializer registered for '<format>' — import fimviz/src/io/materializers.js" error.

## Parameters

### format

`string`

## Returns

[`Materializer`](../type-aliases/Materializer.md)
