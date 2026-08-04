[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / RasterGrid

# Class: RasterGrid

Defined in: package/materialize.js:22

A decoded raster: the pixel grid plus the geometry needed to place and read it. This is what a
RasterLayer draws and what alignRasters/comparison consume — the anonymous `{ pixels, meta }` shape
that was already passed around everywhere, now a named value type.

## Constructors

### Constructor

> **new RasterGrid**(`init?`): `RasterGrid`

Defined in: package/materialize.js:34

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

Defined in: package/materialize.js:42

***

### bounds

> **bounds**: `object`

Defined in: package/materialize.js:39

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

Defined in: package/materialize.js:40

***

### height

> **height**: `number`

Defined in: package/materialize.js:38

***

### kind

> **kind**: `string`

Defined in: package/materialize.js:35

***

### meta

> **meta**: `any`

Defined in: package/materialize.js:43

***

### noData

> **noData**: `string` \| `number`

Defined in: package/materialize.js:41

***

### pixels

> **pixels**: `ArrayBufferView`\<`ArrayBufferLike`\>

Defined in: package/materialize.js:36

***

### width

> **width**: `number`

Defined in: package/materialize.js:37
