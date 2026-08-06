[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / VectorFeatures

# Class: VectorFeatures

Defined in: [package/materialize.js:50](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L50)

A decoded vector: a GeoJSON FeatureCollection plus its frame. What a VectorLayer draws.

## Constructors

### Constructor

> **new VectorFeatures**(`init?`): `VectorFeatures`

Defined in: [package/materialize.js:58](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L58)

#### Parameters

##### init?

###### bounds?

\{ `east`: `number`; `north`: `number`; `south`: `number`; `west`: `number`; \} = `null`

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

###### features

`any`

a GeoJSON FeatureCollection (or Feature)

###### meta?

`any` = `{}`

#### Returns

`VectorFeatures`

## Properties

### bounds

> **bounds**: `object`

Defined in: [package/materialize.js:61](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L61)

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

Defined in: [package/materialize.js:62](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L62)

***

### features

> **features**: `any`

Defined in: [package/materialize.js:60](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L60)

***

### kind

> **kind**: `string`

Defined in: [package/materialize.js:59](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L59)

***

### meta

> **meta**: `any`

Defined in: [package/materialize.js:63](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L63)

## Accessors

### count

#### Get Signature

> **get** **count**(): `number`

Defined in: [package/materialize.js:82](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L82)

How many features this holds.

##### Returns

`number`

## Methods

### \[iterator\]()

> **\[iterator\]**(): `Iterator`\<`any`, `any`, `any`\>

Defined in: [package/materialize.js:85](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L85)

`for (const feature of await ds.features())`.

#### Returns

`Iterator`\<`any`, `any`, `any`\>

***

### toArray()

> **toArray**(): `any`[]

Defined in: [package/materialize.js:72](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/materialize.js#L72)

The features as a plain array, whatever shape the payload arrived in — a FeatureCollection, a
lone Feature, or an array. Without this, reading them means knowing which of those you got and
writing `(await ds.features()).features.features` for the common case.

#### Returns

`any`[]

GeoJSON Features, in document order
