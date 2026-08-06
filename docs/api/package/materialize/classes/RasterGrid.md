[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / RasterGrid

# Class: RasterGrid

Defined in: [package/materialize.js:22](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L22)

A decoded raster: the pixel grid plus the geometry needed to place and read it. This is what a
RasterLayer draws and what alignRasters/comparison consume — the anonymous `{ pixels, meta }` shape
that was already passed around everywhere, now a named value type.

## Constructors

### Constructor

> **new RasterGrid**(`init?`): `RasterGrid`

Defined in: [package/materialize.js:34](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L34)

#### Parameters

##### init?

###### bands?

`number` = `1`

###### bounds?

\{ `east`: `number`; `north`: `number`; `south`: `number`; `west`: `number`; \} = `null`

in `crs`

###### bounds.east

`number`

###### bounds.north

`number`

###### bounds.south

`number`

###### bounds.west

`number`

###### crs?

`string` = `null`

###### height

`number`

###### meta?

`any` = `{}`

carried through from the Dataset (GDAL legend/unit, …)

###### noData?

`string` \| `number` = `null`

###### pixels

`ArrayBufferView`\<`ArrayBufferLike`\>

the decoded band-0 pixel array (typed array)

###### width

`number`

#### Returns

`RasterGrid`

## Properties

### bands

> **bands**: `number`

Defined in: [package/materialize.js:42](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L42)

***

### bounds

> **bounds**: `object`

Defined in: [package/materialize.js:39](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L39)

#### east

> **east**: `number`

#### north

> **north**: `number`

#### south

> **south**: `number`

#### west

> **west**: `number`

***

### crs

> **crs**: `string`

Defined in: [package/materialize.js:40](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L40)

***

### height

> **height**: `number`

Defined in: [package/materialize.js:38](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L38)

***

### kind

> **kind**: `string`

Defined in: [package/materialize.js:35](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L35)

***

### meta

> **meta**: `any`

Defined in: [package/materialize.js:43](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L43)

***

### noData

> **noData**: `string` \| `number`

Defined in: [package/materialize.js:41](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L41)

***

### pixels

> **pixels**: `ArrayBufferView`\<`ArrayBufferLike`\>

Defined in: [package/materialize.js:36](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L36)

***

### width

> **width**: `number`

Defined in: [package/materialize.js:37](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L37)
