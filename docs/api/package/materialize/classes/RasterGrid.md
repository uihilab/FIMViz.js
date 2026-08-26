[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / RasterGrid

# Class: RasterGrid

Defined in: [package/materialize.js:20](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L20)

A decoded raster: the pixel grid plus the geometry needed to place and read it. RasterLayer draws
one, and alignRasters and the comparison path consume one.

## Constructors

### Constructor

> **new RasterGrid**(`init?`): `RasterGrid`

Defined in: [package/materialize.js:32](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L32)

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

carried through from the Dataset, i.e. a GDAL legend

###### noData?

`string` \| `number` = `null`

###### pixels

`ArrayBufferView`\<`ArrayBufferLike`\>

decoded band-0 pixels

###### width

`number`

#### Returns

`RasterGrid`

## Properties

### bands

> **bands**: `number`

Defined in: [package/materialize.js:40](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L40)

***

### bounds

> **bounds**: `object`

Defined in: [package/materialize.js:37](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L37)

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

Defined in: [package/materialize.js:38](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L38)

***

### height

> **height**: `number`

Defined in: [package/materialize.js:36](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L36)

***

### kind

> **kind**: `string`

Defined in: [package/materialize.js:33](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L33)

***

### meta

> **meta**: `any`

Defined in: [package/materialize.js:41](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L41)

***

### noData

> **noData**: `string` \| `number`

Defined in: [package/materialize.js:39](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L39)

***

### pixels

> **pixels**: `ArrayBufferView`\<`ArrayBufferLike`\>

Defined in: [package/materialize.js:34](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L34)

***

### width

> **width**: `number`

Defined in: [package/materialize.js:35](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L35)
