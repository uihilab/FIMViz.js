[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/filter](../README.md) / Filter

# Class: Filter

Defined in: [package/filter.js:26](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/filter.js#L26)

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

Defined in: [package/filter.js:34](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/filter.js#L34)

#### Returns

`boolean`

***

### test()

> **test**(`unit`): `boolean`

Defined in: [package/filter.js:32](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/filter.js#L32)

#### Parameters

##### unit

[`FilterUnit`](../interfaces/FilterUnit.md)

#### Returns

`boolean`

***

### all()

> `static` **all**(`filters`): `Filter`

Defined in: [package/filter.js:67](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/filter.js#L67)

Combines filters with AND, matching what chaining applyFilter() does.

#### Parameters

##### filters

(`Function` \| `any`[] \| `Filter`)[]

#### Returns

`Filter`

***

### from()

> `static` **from**(`input`): `Filter`

Defined in: [package/filter.js:52](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/filter.js#L52)

Turns any accepted input into a Filter.
  anything with test(unit) → returned unchanged
  function                 → PredicateFilter
  anything with toFilter() → input.toFilter()
  polygon                  → SpatialFilter ([[lat,lng],…] | [{lat,lng},…] | [[ring],[ring]…])

Checks for the method rather than `instanceof Filter`, for the reason nothing in the engine
uses `instanceof Dataset`: class identity is per module instance, and `fimviz` and `fimviz/ui`
are separate bundles each carrying their own copy of this file. A SpatialFilter from
`fimviz/ui`'s createRegionDraw is not `instanceof` the engine bundle's Filter, so
`layer.getStats({ filter })` rejected the tool's own output. Checking for test() works across
bundles and lets a host pass its own filter object.

#### Parameters

##### input

`Function` \| `any`[] \| `Filter` \| \{ `toFilter`: () => `Filter`; \}

#### Returns

`Filter`
