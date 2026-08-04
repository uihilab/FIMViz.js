[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/legend](../README.md) / Legend

# Class: Legend

Defined in: package/legend.js:16

## Constructors

### Constructor

> **new Legend**(`opts?`): `Legend`

Defined in: package/legend.js:24

#### Parameters

##### opts?

###### kind?

`"continuous"` \| `"classed"` = `"classed"`

###### source?

`"default"` \| `"palette"` \| `"custom"` \| `"gdal"` = `"palette"`

###### stops?

[`LegendStop`](../interfaces/LegendStop.md)[] = `[]`

###### unit?

`string` = `""`

#### Returns

`Legend`

## Properties

### formatLabel

> **formatLabel**: (`stop`) => `string`

Defined in: package/legend.js:30

#### Parameters

##### stop

[`LegendStop`](../interfaces/LegendStop.md)

#### Returns

`string`

***

### formatValue

> **formatValue**: (`value`) => `string`

Defined in: package/legend.js:32

#### Parameters

##### value

`string` \| `number`

#### Returns

`string`

***

### kind

> **kind**: `"continuous"` \| `"classed"`

Defined in: package/legend.js:26

***

### source

> **source**: `"default"` \| `"palette"` \| `"custom"` \| `"gdal"`

Defined in: package/legend.js:27

***

### stops

> **stops**: [`LegendStop`](../interfaces/LegendStop.md)[]

Defined in: package/legend.js:28

***

### unit

> **unit**: `string`

Defined in: package/legend.js:25

## Methods

### toHtml()

> **toHtml**(): `string`

Defined in: package/legend.js:71

HTML for the legend. Continuous → a gradient bar with min/max; classed → coloured rows.

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `object`

Defined in: package/legend.js:95

#### Returns

`object`

##### kind

> **kind**: `string`

##### source

> **source**: `string`

##### stops

> **stops**: [`LegendStop`](../interfaces/LegendStop.md)[]

##### unit

> **unit**: `string`

***

### fromColorScale()

> `static` **fromColorScale**(`cs`, `opts?`): `Legend`

Defined in: package/legend.js:41

#### Parameters

##### cs

[`ColorScale`](../../colorScale/classes/ColorScale.md)

##### opts?

###### source?

`string`

#### Returns

`Legend`
