[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/filter](../README.md) / SpatialFilter

# Class: SpatialFilter

Defined in: [package/filter.js:118](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/filter.js#L118)

## Extends

- [`Filter`](Filter.md)

## Constructors

### Constructor

> **new SpatialFilter**(`polygon`): `SpatialFilter`

Defined in: [package/filter.js:120](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/filter.js#L120)

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

Defined in: [package/filter.js:123](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/filter.js#L123)

## Methods

### contains()

> **contains**(`lat`, `lng`): `boolean`

Defined in: [package/filter.js:135](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/filter.js#L135)

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

Defined in: [package/filter.js:127](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/filter.js#L127)

#### Returns

`boolean`

#### Overrides

[`Filter`](Filter.md).[`isEmpty`](Filter.md#isempty)

***

### pixelBbox()

> **pixelBbox**(`meta`): `object`

Defined in: [package/filter.js:151](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/filter.js#L151)

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

Defined in: [package/filter.js:143](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/filter.js#L143)

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

Defined in: [package/filter.js:68](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/filter.js#L68)

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

Defined in: [package/filter.js:53](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/filter.js#L53)

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
