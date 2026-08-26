[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/filter](../README.md) / SpatialFilter

# Class: SpatialFilter

Defined in: [package/filter.js:117](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L117)

## Extends

- [`Filter`](Filter.md)

## Constructors

### Constructor

> **new SpatialFilter**(`polygon`): `SpatialFilter`

Defined in: [package/filter.js:119](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L119)

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

Defined in: [package/filter.js:122](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L122)

## Methods

### contains()

> **contains**(`lat`, `lng`): `boolean`

Defined in: [package/filter.js:134](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L134)

True when the point falls inside any ring, i.e. the union of a multi-polygon.

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

Defined in: [package/filter.js:126](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L126)

#### Returns

`boolean`

#### Overrides

[`Filter`](Filter.md).[`isEmpty`](Filter.md#isempty)

***

### pixelBbox()

> **pixelBbox**(`meta`): `object`

Defined in: [package/filter.js:150](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L150)

A fast-reject window in pixel space, covering all rings. Mirrors polygonPixelBbox in
ui/rasterTools.js.

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

Defined in: [package/filter.js:142](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/filter.js#L142)

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
