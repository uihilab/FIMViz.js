[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/legend](../README.md) / Legend

# Class: Legend

Defined in: [package/legend.js:16](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L16)

## Constructors

### Constructor

> **new Legend**(`opts?`): `Legend`

Defined in: [package/legend.js:24](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L24)

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

Defined in: [package/legend.js:30](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L30)

#### Parameters

##### stop

[`LegendStop`](../interfaces/LegendStop.md)

#### Returns

`string`

***

### formatValue

> **formatValue**: (`value`) => `string`

Defined in: [package/legend.js:32](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L32)

#### Parameters

##### value

`string` \| `number`

#### Returns

`string`

***

### kind

> **kind**: `"continuous"` \| `"classed"`

Defined in: [package/legend.js:26](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L26)

***

### source

> **source**: `"default"` \| `"palette"` \| `"custom"` \| `"gdal"`

Defined in: [package/legend.js:27](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L27)

***

### stops

> **stops**: [`LegendStop`](../interfaces/LegendStop.md)[]

Defined in: [package/legend.js:28](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L28)

***

### unit

> **unit**: `string`

Defined in: [package/legend.js:25](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L25)

## Methods

### toHtml()

> **toHtml**(): `string`

Defined in: [package/legend.js:70](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L70)

Renders the legend as HTML: a gradient bar with min and max when continuous, colored rows
when classed.

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [package/legend.js:94](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L94)

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

Defined in: [package/legend.js:41](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/legend.js#L41)

#### Parameters

##### cs

[`ColorScale`](../../colorScale/classes/ColorScale.md)

##### opts?

###### source?

`string`

#### Returns

`Legend`
