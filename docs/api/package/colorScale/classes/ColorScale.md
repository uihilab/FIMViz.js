[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/colorScale](../README.md) / ColorScale

# Class: ColorScale

Defined in: [package/colorScale.js:154](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L154)

## Constructors

### Constructor

> **new ColorScale**(`opts?`): `ColorScale`

Defined in: [package/colorScale.js:168](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L168)

#### Parameters

##### opts?

###### continuous?

`boolean` = `false`

###### max?

`number` = `1`

###### min?

`number` = `0`

###### missingColor?

`string` = `null`

color for an absent value (`null`, `undefined`,
  `NaN` or `''`). Defaults to `null`, meaning no color: a vector feature keeps its base style
  and a raster pixel stays transparent. Set it to draw missing data as an explicit swatch.

###### palette?

`string` \| `string`[] = `"blues"`

a `PALETTES`/registered name, or a custom array of >=2 hex colors

###### source?

`"palette"` \| `"custom"` \| `"gdal"` = `null`

###### stops?

`object`[] = `null`

explicit stops; presence switches to explicit mode

###### unit?

`string` = `""`

#### Returns

`ColorScale`

## Properties

### \_colorStopColors

> **\_colorStopColors**: `string`[]

Defined in: [package/colorScale.js:185](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L185)

***

### \_colorStopValues

> **\_colorStopValues**: `number`[]

Defined in: [package/colorScale.js:184](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L184)

***

### \_continuous

> **\_continuous**: `boolean`

Defined in: [package/colorScale.js:176](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L176)

***

### \_listeners

> **\_listeners**: `any`[]

Defined in: [package/colorScale.js:188](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L188)

***

### \_max

> **\_max**: `number`

Defined in: [package/colorScale.js:175](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L175)

***

### \_min

> **\_min**: `number`

Defined in: [package/colorScale.js:174](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L174)

***

### \_stops

> **\_stops**: `object`[]

Defined in: [package/colorScale.js:178](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L178)

#### color

> **color**: `any` = `s.color`

#### label

> **label**: `any` = `s.label`

***

### colorFor

> **colorFor**: (`value`) => `string`

Defined in: [package/colorScale.js:187](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L187)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### missingColor

> **missingColor**: `string`

Defined in: [package/colorScale.js:172](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L172)

***

### palette

> **palette**: `string` \| `any`[]

Defined in: [package/colorScale.js:173](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L173)

***

### source

> **source**: `"palette"` \| `"custom"` \| `"gdal"`

Defined in: [package/colorScale.js:179](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L179)

***

### unit

> **unit**: `string`

Defined in: [package/colorScale.js:177](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L177)

## Accessors

### continuous

#### Get Signature

> **get** **continuous**(): `boolean`

Defined in: [package/colorScale.js:290](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L290)

True when interpolation is on. Read-only; write it with `set({ continuous })`.

##### Returns

`boolean`

***

### discrete

#### Get Signature

> **get** **discrete**(): `boolean`

Defined in: [package/colorScale.js:285](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L285)

##### Returns

`boolean`

***

### isExplicit

#### Get Signature

> **get** **isExplicit**(): `boolean`

Defined in: [package/colorScale.js:283](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L283)

##### Returns

`boolean`

***

### kind

#### Get Signature

> **get** **kind**(): `"continuous"` \| `"classed"`

Defined in: [package/colorScale.js:245](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L245)

##### Returns

`"continuous"` \| `"classed"`

## Methods

### getColor()

> **getColor**(`value`): `string`

Defined in: [package/colorScale.js:348](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L348)

Resolves a value to a CSS color string. `colorFor` takes precedence. An absent value returns
`missingColor`, and a value matching no stop returns null.

#### Parameters

##### value

`number`

#### Returns

`string`

***

### getRange()

> **getRange**(`i`): `object`

Defined in: [package/colorScale.js:337](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L337)

#### Parameters

##### i

`number`

band index (as returned by `getStops()`)

#### Returns

`object`

##### max

> **max**: `number`

##### min

> **min**: `number`

***

### getRgb()

> **getRgb**(`value`): \[`number`, `number`, `number`\]

Defined in: [package/colorScale.js:366](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L366)

Returns [r,g,b] for the render loop. Returns null when no stop matches, or when the value is
absent and no `missingColor` is set, and colorizeGrid leaves that pixel transparent.

#### Parameters

##### value

`number`

#### Returns

\[`number`, `number`, `number`\]

***

### getStops()

> **getStops**(): [`ColorStop`](../interfaces/ColorStop.md)[]

Defined in: [package/colorScale.js:299](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L299)

The stops as [{ min?, max?, value?, color, label }]. Explicit mode returns the stored stops,
palette mode derives them, and setColorStops() mode returns one `{ value, color }` per point.

#### Returns

[`ColorStop`](../interfaces/ColorStop.md)[]

***

### getValues()

> **getValues**(): `number`[]

Defined in: [package/colorScale.js:322](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L322)

#### Returns

`number`[]

***

### offChange()

> **offChange**(`fn`): `ColorScale`

Defined in: [package/colorScale.js:577](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L577)

#### Parameters

##### fn

(`scale`) => `void`

#### Returns

`ColorScale`

***

### onChange()

> **onChange**(`fn`): `ColorScale`

Defined in: [package/colorScale.js:572](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L572)

#### Parameters

##### fn

(`scale`) => `void`

#### Returns

`ColorScale`

***

### set()

> **set**(`patch?`): `ColorScale`

Defined in: [package/colorScale.js:420](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L420)

Writes any whole-object setting in one call:

  cs.set({ palette: 'viridis', min: 0, max: 46, continuous: true, unit: 'm' });

Synchronous and chainable. Fires `onChange` once for the whole batch, not once per key, so a
repaint listener redraws once for one logical edit.

Recognised keys: `palette`, `min`, `max`, `continuous`, `unit`, `stops`, `colorStops`
(`{values, colors}`) and `missingColor`. `stops` and `colorStops` switch mode and are also
available as `setStops()` and `setColorStops()`. Per-band edits keep their own verbs:
`setColor(i, c)`, `setRange(i, r)`, `setLabel(i, s)`. An unknown key throws.

#### Parameters

##### patch?

###### colorStops?

\{ `colors`: `string`[]; `values`: `number`[]; \}

###### colorStops.colors

`string`[]

###### colorStops.values

`number`[]

###### continuous?

`boolean`

###### max?

`number`

###### min?

`number`

###### palette?

`string` \| `string`[]

###### stops?

`any`[]

###### unit?

`string`

#### Returns

`ColorScale`

***

### setColor()

> **setColor**(`i`, `color`): `ColorScale`

Defined in: [package/colorScale.js:547](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L547)

#### Parameters

##### i

`number`

band index

##### color

`string`

#### Returns

`ColorScale`

***

### setColorStops()

> **setColorStops**(`values`, `colors`): `ColorScale`

Defined in: [package/colorScale.js:490](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L490)

Defines a continuous gradient from explicit control points, sorted on the way in and not
required to be evenly spaced. Pair it with `set({ continuous: true })` to interpolate between
the bracketing pair:

  setColorStops([-1, 0, 1], ['#015498', '#ffffff', '#21bf90']).set({ continuous: true })

gives a diverging blue-to-white-to-green gradient skewed by the point spacing, not an even
three-way split of [min, max]. A value past the outermost point clamps to that end's color.
With `continuous` false it takes the nearest point's color. setStops() differs: one flat
color per range, never interpolated.

The control points drive the color mapping alone. `set({ min, max })` still governs the legend
axis label and the stats classification range, so set both when they should differ.

#### Parameters

##### values

`number`[]

breakpoint values; >= 2 required

##### colors

`string`[]

one "#rrggbb" hex color per value, same length as `values`

#### Returns

`ColorScale`

***

### setLabel()

> **setLabel**(`i`, `label`): `ColorScale`

Defined in: [package/colorScale.js:559](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L559)

#### Parameters

##### i

`number`

band index

##### label

`string`

#### Returns

`ColorScale`

***

### setRange()

> **setRange**(`i`, `range`): `ColorScale`

Defined in: [package/colorScale.js:535](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L535)

#### Parameters

##### i

`number`

band index

##### range

###### max?

`number`

###### min?

`number`

#### Returns

`ColorScale`

***

### setStops()

> **setStops**(`stops`): `ColorScale`

Defined in: [package/colorScale.js:465](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L465)

#### Parameters

##### stops

`object`[]

#### Returns

`ColorScale`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [package/colorScale.js:258](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L258)

A structured-cloneable description of this scale, enough to rebuild an equivalent one with
`new ColorScale(spec)`, capturing whichever of the three modes is active. The result is a copy,
so two layers rebuilt from one spec can diverge. It omits `colorFor` and the `onChange`
listeners because functions do not survive serialization.

#### Returns

`object`

##### colorStops

> **colorStops**: `object`

###### colorStops.colors

> **colors**: `string`[]

###### colorStops.values

> **values**: `number`[]

##### continuous

> **continuous**: `boolean`

##### max

> **max**: `number`

##### min

> **min**: `number`

##### palette

> **palette**: `string` \| `string`[]

##### source

> **source**: `string`

##### stops

> **stops**: `any`[]

##### unit

> **unit**: `string`

***

### fromGdalLegend()

> `static` **fromGdalLegend**(`legend`, `unit?`): `ColorScale`

Defined in: [package/colorScale.js:196](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L196)

#### Parameters

##### legend

`object`[]

##### unit?

`string` = `""`

#### Returns

`ColorScale`

***

### fromJSON()

> `static` **fromJSON**(`spec?`): `ColorScale`

Defined in: [package/colorScale.js:275](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L275)

Rebuilds a scale from `toJSON()` output, including the control-point mode that the constructor
alone cannot express.

#### Parameters

##### spec?

`any` = `{}`

#### Returns

`ColorScale`

***

### getGdalLegendParser()

> `static` **getGdalLegendParser**(): `Function`

Defined in: [package/colorScale.js:242](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L242)

The registered GDAL legend parser, or null if nothing has registered one yet.

#### Returns

`Function`

***

### palettes()

> `static` **palettes**(): `string`[]

Defined in: [package/colorScale.js:218](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L218)

Every palette name `{ palette }` accepts, built-in and registered.

#### Returns

`string`[]

***

### registerGdalLegendParser()

> `static` **registerGdalLegendParser**(`fn`): `void`

Defined in: [package/colorScale.js:236](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L236)

Register the GDAL_METADATA XML parser used to auto-detect an embedded legend. Called by
layers/depthMap.js on import.

#### Parameters

##### fn

(`xmlStr`) => `object`

#### Returns

`void`

***

### registerPalette()

> `static` **registerPalette**(`name`, `colors`): `void`

Defined in: [package/colorScale.js:212](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/colorScale.js#L212)

Add a palette by name. `colors`: >= 2 hex strings.

#### Parameters

##### name

`string`

##### colors

`string`[]

#### Returns

`void`
