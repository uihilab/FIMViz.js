[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/filter](../README.md) / PredicateFilter

# Class: PredicateFilter

Defined in: [package/filter.js:81](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L81)

## Extends

- [`Filter`](Filter.md)

## Constructors

### Constructor

> **new PredicateFilter**(`fn`): `PredicateFilter`

Defined in: [package/filter.js:83](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L83)

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

Defined in: [package/filter.js:83](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L83)

#### Parameters

##### args

...`any`[]

#### Returns

`boolean`

## Methods

### isEmpty()

> **isEmpty**(): `boolean`

Defined in: [package/filter.js:34](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L34)

#### Returns

`boolean`

#### Inherited from

[`Filter`](Filter.md).[`isEmpty`](Filter.md#isempty)

***

### test()

> **test**(`unit`): `boolean`

Defined in: [package/filter.js:85](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L85)

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

Defined in: [package/filter.js:67](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L67)

Combines filters with AND, matching what chaining applyFilter() does.

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

Defined in: [package/filter.js:52](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L52)

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

`Function` \| `any`[] \| [`Filter`](Filter.md) \| \{ `toFilter`: () => [`Filter`](Filter.md); \}

#### Returns

[`Filter`](Filter.md)

#### Inherited from

[`Filter`](Filter.md).[`from`](Filter.md#from)
