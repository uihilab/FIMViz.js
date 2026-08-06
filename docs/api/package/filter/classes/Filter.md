[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/filter](../README.md) / Filter

# Class: Filter

Defined in: [package/filter.js:26](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/filter.js#L26)

## Extended by

- [`PredicateFilter`](PredicateFilter.md)
- [`SpatialFilter`](SpatialFilter.md)

## Constructors

### Constructor

> **new Filter**(): `Filter`

#### Returns

`Filter`

## Methods

### isEmpty()

> **isEmpty**(): `boolean`

Defined in: [package/filter.js:34](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/filter.js#L34)

#### Returns

`boolean`

***

### test()

> **test**(`unit`): `boolean`

Defined in: [package/filter.js:32](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/filter.js#L32)

#### Parameters

##### unit

[`FilterUnit`](../interfaces/FilterUnit.md)

#### Returns

`boolean`

***

### all()

> `static` **all**(`filters`): `Filter`

Defined in: [package/filter.js:59](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/filter.js#L59)

Combine filters as a conjunction (AND) — the semantics of chaining applyFilter().

#### Parameters

##### filters

(`Function` \| `any`[] \| `Filter`)[]

#### Returns

`Filter`

***

### from()

> `static` **from**(`input`): `Filter`

Defined in: [package/filter.js:45](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/filter.js#L45)

Coerce any friendly input into a Filter.
  Filter        → returned as-is
  function      → PredicateFilter
  Region-like   → input.toFilter()
  polygon       → SpatialFilter   ([[lat,lng],…] | [{lat,lng},…] | [[ring],[ring]…])

#### Parameters

##### input

`Function` \| `any`[] \| `Filter` \| \{ `toFilter`: () => `Filter`; \}

#### Returns

`Filter`
