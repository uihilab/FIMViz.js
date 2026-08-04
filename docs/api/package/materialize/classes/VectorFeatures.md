[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/materialize](../README.md) / VectorFeatures

# Class: VectorFeatures

Defined in: package/materialize.js:50

A decoded vector: a GeoJSON FeatureCollection plus its frame. What a VectorLayer draws.

## Constructors

### Constructor

> **new VectorFeatures**(`init?`): `VectorFeatures`

Defined in: package/materialize.js:58

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

Defined in: package/materialize.js:61

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

Defined in: package/materialize.js:62

***

### features

> **features**: `any`

Defined in: package/materialize.js:60

***

### kind

> **kind**: `string`

Defined in: package/materialize.js:59

***

### meta

> **meta**: `any`

Defined in: package/materialize.js:63
