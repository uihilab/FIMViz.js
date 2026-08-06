[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/filter](../README.md) / SpatialFilter

# Class: SpatialFilter

Defined in: [package/filter.js:109](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/filter.js#L109)

## Extends

- [`Filter`](Filter.md)

## Constructors

### Constructor

> **new SpatialFilter**(`polygon`): `SpatialFilter`

Defined in: [package/filter.js:111](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/filter.js#L111)

#### Parameters

##### polygon

`any`[]

[{lat,lng}|[lat,lng]…] for one ring, or [[ring],[ring]…] for many.

#### Returns

`SpatialFilter`

#### Overrides

[`Filter`](Filter.md).[`constructor`](Filter.md#constructor)

## Properties

### features

> **features**: `object`[][]

Defined in: [package/filter.js:114](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/filter.js#L114)

## Methods

### contains()

> **contains**(`lat`, `lng`): `boolean`

Defined in: [package/filter.js:126](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/filter.js#L126)

Inside ANY ring (multi-polygon union).

#### Parameters

##### lat

`number`

##### lng

`number`

#### Returns

`boolean`

***

### isEmpty()

> **isEmpty**(): `boolean`

Defined in: [package/filter.js:118](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/filter.js#L118)

#### Returns

`boolean`

#### Overrides

[`Filter`](Filter.md).[`isEmpty`](Filter.md#isempty)

***

### pixelBbox()

> **pixelBbox**(`meta`): `object`

Defined in: [package/filter.js:142](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/filter.js#L142)

Fast-reject window in pixel space (union across rings), mirroring
ui/rasterTools.js `polygonPixelBbox`.

#### Parameters

##### meta

###### be

`number`

###### bn

`number`

###### bs

`number`

###### bw

`number`

###### height

`number`

###### width

`number`

#### Returns

`object`

##### x0

> **x0**: `number`

##### x1

> **x1**: `number`

##### y0

> **y0**: `number`

##### y1

> **y1**: `number`

***

### test()

> **test**(`unit`): `boolean`

Defined in: [package/filter.js:134](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/filter.js#L134)

#### Parameters

##### unit

[`FilterUnit`](../interfaces/FilterUnit.md)

#### Returns

`boolean`

#### Overrides

[`Filter`](Filter.md).[`test`](Filter.md#test)

***

### all()

> `static` **all**(`filters`): [`Filter`](Filter.md)

Defined in: [package/filter.js:59](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/filter.js#L59)

Combine filters as a conjunction (AND) — the semantics of chaining applyFilter().

#### Parameters

##### filters

(`Function` \| `any`[] \| [`Filter`](Filter.md))[]

#### Returns

[`Filter`](Filter.md)

#### Inherited from

[`Filter`](Filter.md).[`all`](Filter.md#all)

***

### from()

> `static` **from**(`input`): [`Filter`](Filter.md)

Defined in: [package/filter.js:45](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/filter.js#L45)

Coerce any friendly input into a Filter.
  Filter        → returned as-is
  function      → PredicateFilter
  Region-like   → input.toFilter()
  polygon       → SpatialFilter   ([[lat,lng],…] | [{lat,lng},…] | [[ring],[ring]…])

#### Parameters

##### input

`Function` \| `any`[] \| [`Filter`](Filter.md) \| \{ `toFilter`: () => [`Filter`](Filter.md); \}

#### Returns

[`Filter`](Filter.md)

#### Inherited from

[`Filter`](Filter.md).[`from`](Filter.md#from)
