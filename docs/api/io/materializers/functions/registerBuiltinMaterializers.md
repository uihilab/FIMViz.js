[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/materializers](../README.md) / registerBuiltinMaterializers

# Function: registerBuiltinMaterializers()

> **registerBuiltinMaterializers**(): `void`

Defined in: [io/materializers.js:79](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/io/materializers.js#L79)

Register the built-in decoders into the materialize seam. Idempotent. Called once on import (so a
node test that `import`s this file — or any consumer of the barrel — gets them), and exported so a
raw-browser page using the dist bundle can call it explicitly. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1.

## Returns

`void`
