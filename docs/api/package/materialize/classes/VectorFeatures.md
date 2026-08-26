[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / VectorFeatures

# Class: VectorFeatures

Defined in: [package/materialize.js:48](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L48)

A decoded vector: a GeoJSON FeatureCollection plus its bounds and CRS. VectorLayer draws one.

## Constructors

### Constructor

> **new VectorFeatures**(`init?`): `VectorFeatures`

Defined in: [package/materialize.js:56](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L56)

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

a GeoJSON FeatureCollection or Feature

###### meta?

`any` = `{}`

#### Returns

`VectorFeatures`

## Properties

### bounds

> **bounds**: `object`

Defined in: [package/materialize.js:59](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L59)

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

Defined in: [package/materialize.js:60](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L60)

***

### features

> **features**: `any`

Defined in: [package/materialize.js:58](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L58)

***

### kind

> **kind**: `string`

Defined in: [package/materialize.js:57](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L57)

***

### meta

> **meta**: `any`

Defined in: [package/materialize.js:61](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L61)

## Accessors

### count

#### Get Signature

> **get** **count**(): `number`

Defined in: [package/materialize.js:80](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L80)

How many features this holds.

##### Returns

`number`

## Methods

### \[iterator\]()

> **\[iterator\]**(): `Iterator`\<`any`, `any`, `any`\>

Defined in: [package/materialize.js:83](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L83)

`for (const feature of await ds.features())`.

#### Returns

`Iterator`\<`any`, `any`, `any`\>

***

### toArray()

> **toArray**(): `any`[]

Defined in: [package/materialize.js:70](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/materialize.js#L70)

The features as a plain array, whether the payload arrived as a FeatureCollection, a lone
Feature or an array. Without it, the user must know which of the three it got, and write
`(await ds.features()).features.features` in the common case.

#### Returns

`any`[]

GeoJSON Features, in document order
