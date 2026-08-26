[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/dataset](../README.md) / DatasetAxis

# Interface: DatasetAxis

Defined in: [package/dataset.js:121](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L121)

## Properties

### commensurable?

> `optional` **commensurable?**: `boolean`

Defined in: [package/dataset.js:127](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L127)

do the entries measure the same quantity in the same
  whether the entries share units, so averaging across them means something. Gates `reduce`.

***

### entries

> **entries**: [`DatasetAxisEntry`](DatasetAxisEntry.md)[]

Defined in: [package/dataset.js:129](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L129)

***

### name

> **name**: `string`

Defined in: [package/dataset.js:122](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L122)

***

### ordered?

> `optional` **ordered?**: `boolean`

Defined in: [package/dataset.js:124](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L124)

do the coords have a magnitude, so that "between" and
  whether "nearest" means anything here. Gates `selectRange` and selectAxisEntry's nearest match,
  which would otherwise snap `select(1.5)` to band 2.

***

### unit?

> `optional` **unit?**: `string`

Defined in: [package/dataset.js:123](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L123)
