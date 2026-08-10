[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/filter](../README.md) / PredicateFilter

# Class: PredicateFilter

Defined in: [package/filter.js:82](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/filter.js#L82)

## Extends

- [`Filter`](Filter.md)

## Constructors

### Constructor

> **new PredicateFilter**(`fn`): `PredicateFilter`

Defined in: [package/filter.js:84](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/filter.js#L84)

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

Defined in: [package/filter.js:84](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/filter.js#L84)

#### Parameters

##### args

...`any`[]

#### Returns

`boolean`

## Methods

### isEmpty()

> **isEmpty**(): `boolean`

Defined in: [package/filter.js:34](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/filter.js#L34)

#### Returns

`boolean`

#### Inherited from

[`Filter`](Filter.md).[`isEmpty`](Filter.md#isempty)

***

### test()

> **test**(`unit`): `boolean`

Defined in: [package/filter.js:86](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/filter.js#L86)

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

Defined in: [package/filter.js:68](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/filter.js#L68)

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

Defined in: [package/filter.js:53](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/filter.js#L53)

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

`Function` \| `any`[] \| [`Filter`](Filter.md) \| \{ `toFilter`: () => [`Filter`](Filter.md); \}

#### Returns

[`Filter`](Filter.md)

#### Inherited from

[`Filter`](Filter.md).[`from`](Filter.md#from)
