[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/dataset](../README.md) / DatasetAxis

# Interface: DatasetAxis

Defined in: [package/dataset.js:120](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/dataset.js#L120)

## Properties

### commensurable?

> `optional` **commensurable?**: `boolean`

Defined in: [package/dataset.js:126](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/dataset.js#L126)

do the entries measure the same quantity in the same
  whether the entries share units, so averaging across them means something. Gates `reduce`.

***

### entries

> **entries**: [`DatasetAxisEntry`](DatasetAxisEntry.md)[]

Defined in: [package/dataset.js:128](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/dataset.js#L128)

***

### name

> **name**: `string`

Defined in: [package/dataset.js:121](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/dataset.js#L121)

***

### ordered?

> `optional` **ordered?**: `boolean`

Defined in: [package/dataset.js:123](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/dataset.js#L123)

do the coords have a magnitude, so that "between" and
  whether "nearest" means anything here. Gates `selectRange` and selectAxisEntry's nearest match,
  which would otherwise snap `select(1.5)` to band 2.

***

### unit?

> `optional` **unit?**: `string`

Defined in: [package/dataset.js:122](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/dataset.js#L122)
