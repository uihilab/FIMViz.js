[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/filter](../README.md) / PredicateFilter

# Class: PredicateFilter

Defined in: [package/filter.js:73](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/filter.js#L73)

## Extends

- [`Filter`](Filter.md)

## Constructors

### Constructor

> **new PredicateFilter**(`fn`): `PredicateFilter`

Defined in: [package/filter.js:75](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/filter.js#L75)

#### Parameters

##### fn

(...`args`) => `boolean`

#### Returns

`PredicateFilter`

#### Overrides

[`Filter`](Filter.md).[`constructor`](Filter.md#constructor)

## Properties

### fn

> **fn**: (...`args`) => `boolean`

Defined in: [package/filter.js:75](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/filter.js#L75)

#### Parameters

##### args

...`any`[]

#### Returns

`boolean`

## Methods

### isEmpty()

> **isEmpty**(): `boolean`

Defined in: [package/filter.js:34](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/filter.js#L34)

#### Returns

`boolean`

#### Inherited from

[`Filter`](Filter.md).[`isEmpty`](Filter.md#isempty)

***

### test()

> **test**(`unit`): `boolean`

Defined in: [package/filter.js:77](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/filter.js#L77)

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

Defined in: [package/filter.js:59](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/filter.js#L59)

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

Defined in: [package/filter.js:45](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/filter.js#L45)

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
