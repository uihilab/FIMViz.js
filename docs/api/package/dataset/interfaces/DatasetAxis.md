[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/dataset](../README.md) / DatasetAxis

# Interface: DatasetAxis

Defined in: [package/dataset.js:121](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/dataset.js#L121)

## Properties

### commensurable?

> `optional` **commensurable?**: `boolean`

Defined in: [package/dataset.js:127](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/dataset.js#L127)

do the entries measure the same quantity in the same
  units, so that averaging across them is meaningful? Gates `reduce`.

***

### entries

> **entries**: [`DatasetAxisEntry`](DatasetAxisEntry.md)[]

Defined in: [package/dataset.js:129](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/dataset.js#L129)

***

### name

> **name**: `string`

Defined in: [package/dataset.js:122](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/dataset.js#L122)

***

### ordered?

> `optional` **ordered?**: `boolean`

Defined in: [package/dataset.js:124](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/dataset.js#L124)

do the coords have a magnitude, so that "between" and
  "nearest" mean something? Gates `selectRange` and `selectAxisEntry`'s nearest-match. Without it,
  nearest-match would happily snap `select(1.5)` to band 2.

***

### unit?

> `optional` **unit?**: `string`

Defined in: [package/dataset.js:123](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/dataset.js#L123)
