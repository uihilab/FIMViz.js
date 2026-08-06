[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/filter](../README.md) / Filter

# Class: Filter

Defined in: [package/filter.js:26](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/filter.js#L26)

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

Defined in: [package/filter.js:34](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/filter.js#L34)

#### Returns

`boolean`

***

### test()

> **test**(`unit`): `boolean`

Defined in: [package/filter.js:32](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/filter.js#L32)

#### Parameters

##### unit

[`FilterUnit`](../interfaces/FilterUnit.md)

#### Returns

`boolean`

***

### all()

> `static` **all**(`filters`): `Filter`

Defined in: [package/filter.js:68](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/filter.js#L68)

Combine filters as a conjunction (AND) — the semantics of chaining applyFilter().

#### Parameters

##### filters

(`Function` \| `any`[] \| `Filter`)[]

#### Returns

`Filter`

***

### from()

> `static` **from**(`input`): `Filter`

Defined in: [package/filter.js:53](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/filter.js#L53)

Coerce any friendly input into a Filter.
  Filter-like   → returned as-is (anything with a `test(unit)` method)
  function      → PredicateFilter
  Region-like   → input.toFilter()
  polygon       → SpatialFilter   ([[lat,lng],…] | [{lat,lng},…] | [[ring],[ring]…])

DUCK-TYPED, not `instanceof Filter`, for the same reason nothing in the engine does
`instanceof Dataset`: class identity is per-module-instance, and `fimviz` and `fimviz/ui` are
two separate bundles that each carry their own copy of this file. A `SpatialFilter` built by
`fimviz/ui`'s createRegionDraw is therefore NOT `instanceof` the engine bundle's `Filter`, so
`layer.getStats({ filter })` rejected the tool's own output. Testing for the method — the only
thing every call site actually uses — makes the seam work across bundles and lets a host pass
its own filter object.

#### Parameters

##### input

`Function` \| `any`[] \| `Filter` \| \{ `toFilter`: () => `Filter`; \}

#### Returns

`Filter`
