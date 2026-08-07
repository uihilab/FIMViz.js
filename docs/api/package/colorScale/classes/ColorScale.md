[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/colorScale](../README.md) / ColorScale

# Class: ColorScale

Defined in: [package/colorScale.js:164](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L164)

## Constructors

### Constructor

> **new ColorScale**(`opts?`): `ColorScale`

Defined in: [package/colorScale.js:179](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L179)

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

the colour for a value that ISN'T one: `null`/`undefined`/
  `NaN`/`''`. `null` (the default) means "no colour" — the consumer decides what absent looks
  like (a vector layer leaves the feature at its base style; a raster leaves the pixel
  transparent). Set it to render missing data explicitly, e.g. a grey "no data" swatch.

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

Defined in: [package/colorScale.js:197](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L197)

***

### \_colorStopValues

> **\_colorStopValues**: `number`[]

Defined in: [package/colorScale.js:196](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L196)

***

### \_continuous

> **\_continuous**: `boolean`

Defined in: [package/colorScale.js:188](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L188)

***

### \_listeners

> **\_listeners**: `any`[]

Defined in: [package/colorScale.js:200](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L200)

***

### \_max

> **\_max**: `number`

Defined in: [package/colorScale.js:187](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L187)

***

### \_min

> **\_min**: `number`

Defined in: [package/colorScale.js:186](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L186)

***

### \_stops

> **\_stops**: `object`[]

Defined in: [package/colorScale.js:190](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L190)

#### color

> **color**: `any` = `s.color`

#### label

> **label**: `any` = `s.label`

***

### colorFor

> **colorFor**: (`value`) => `string`

Defined in: [package/colorScale.js:199](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L199)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### missingColor

> **missingColor**: `string`

Defined in: [package/colorScale.js:184](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L184)

***

### palette

> **palette**: `string` \| `any`[]

Defined in: [package/colorScale.js:185](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L185)

***

### source

> **source**: `"palette"` \| `"custom"` \| `"gdal"`

Defined in: [package/colorScale.js:191](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L191)

***

### unit

> **unit**: `string`

Defined in: [package/colorScale.js:189](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L189)

## Accessors

### continuous

#### Get Signature

> **get** **continuous**(): `boolean`

Defined in: [package/colorScale.js:306](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L306)

Is interpolation on? A read-only flag — write it with `set({ continuous })`.

##### Returns

`boolean`

***

### discrete

#### Get Signature

> **get** **discrete**(): `boolean`

Defined in: [package/colorScale.js:301](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L301)

##### Returns

`boolean`

***

### isExplicit

#### Get Signature

> **get** **isExplicit**(): `boolean`

Defined in: [package/colorScale.js:299](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L299)

##### Returns

`boolean`

***

### kind

#### Get Signature

> **get** **kind**(): `"continuous"` \| `"classed"`

Defined in: [package/colorScale.js:259](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L259)

##### Returns

`"continuous"` \| `"classed"`

## Methods

### getColor()

> **getColor**(`value`): `string`

Defined in: [package/colorScale.js:366](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L366)

Resolve any value → css color string. `colorFor` wins; a value that isn't one resolves to
`missingColor` (or null); null when nothing matches.

#### Parameters

##### value

`number`

#### Returns

`string`

***

### getRange()

> **getRange**(`i`): `object`

Defined in: [package/colorScale.js:355](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L355)

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

Defined in: [package/colorScale.js:384](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L384)

Hot-path [r,g,b] for the render loop; null → pixel is transparent (no matching stop, or an
absent value with no `missingColor`).

#### Parameters

##### value

`number`

#### Returns

\[`number`, `number`, `number`\]

***

### getStops()

> **getStops**(): [`ColorStop`](../interfaces/ColorStop.md)[]

Defined in: [package/colorScale.js:315](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L315)

[{ min?, max?, value?, color, label }] — explicit→stored | palette→derived | colorStops→one
`{ value, color }` per control point (setColorStops).

#### Returns

[`ColorStop`](../interfaces/ColorStop.md)[]

***

### getValues()

> **getValues**(): `number`[]

Defined in: [package/colorScale.js:338](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L338)

#### Returns

`number`[]

***

### offChange()

> **offChange**(`fn`): `ColorScale`

Defined in: [package/colorScale.js:602](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L602)

#### Parameters

##### fn

(`scale`) => `void`

#### Returns

`ColorScale`

***

### onChange()

> **onChange**(`fn`): `ColorScale`

Defined in: [package/colorScale.js:597](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L597)

#### Parameters

##### fn

(`scale`) => `void`

#### Returns

`ColorScale`

***

### set()

> **set**(`patch?`): `ColorScale`

Defined in: [package/colorScale.js:443](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L443)

THE knob writer. One mutation idiom for every whole-object knob:

  cs.set({ palette: 'viridis', min: 0, max: 46, continuous: true, unit: 'm' });

Sync and chainable (returns `this`) — a ColorScale is a pure value type, so nothing here awaits.
Fires `onChange` ONCE for the whole batch, not once per key, so a repaint hook wired via
`onChange` doesn't redraw N times for one logical edit.

Recognised keys: `palette`, `min`, `max`, `continuous`, `unit`, `stops`, `colorStops`
(`{values, colors}`). `stops`/`colorStops` are MODE switches and remain available as the explicit
`setStops()`/`setColorStops()` methods too; the INDEX-addressed ops (`setColor(i,·)`,
`setRange(i,·)`, `setLabel(i,·)`) are not knobs and stay as their own verbs.

An unknown key throws, naming the recognised set, rather than being silently ignored.

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

Defined in: [package/colorScale.js:572](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L572)

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

Defined in: [package/colorScale.js:516](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L516)

Define a CONTINUOUS color gradient via explicit control points — arbitrary breakpoint VALUES
(need not be evenly spaced, or even given in order — sorted internally), each paired with its own
color. Distinct from setStops(): that's discrete, flat bands (one solid color per range/value, no
interpolation); this interpolates smoothly between the nearest bracketing pair when
set({continuous:true}) is set (the intended pairing) —
  setColorStops([-1, 0, 1], ['#015498', '#ffffff', '#21bf90']).set({ continuous: true })
gives a diverging blue→white→green gradient skewed however the control points are spaced, not an
even 3-way split of some [min,max]. Values outside the outermost control point clamp to that end's
color (no extrapolation). With continuous false, a value takes the NEAREST control point's color
instead of interpolating — flat, but not "banded" in the setStops() sense, since these are point
positions, not ranges.

set({min,max})'s domain keeps governing peripheral things (a legend axis label, a stats-classification
range) but the actual color mapping is driven entirely by these control points, not by min/max —
the two are complementary, not conflicting: set both if you want a labeled axis range that differs
from where the color control points themselves sit.

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

Defined in: [package/colorScale.js:584](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L584)

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

Defined in: [package/colorScale.js:560](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L560)

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

Defined in: [package/colorScale.js:488](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L488)

#### Parameters

##### stops

`object`[]

#### Returns

`ColorScale`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [package/colorScale.js:274](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L274)

A plain, structured-cloneable description of this scale — enough to rebuild an equivalent one
with `new ColorScale(spec)`. It captures whichever of the three modes is active.

This is a COPY, not a handle: rebuilding from it gives an independent scale, so two layers
built from one spec can diverge. `colorFor` (a function) and `onChange` listeners are
deliberately not included — neither survives serialization.

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

Defined in: [package/colorScale.js:208](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L208)

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

Defined in: [package/colorScale.js:291](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L291)

Rebuild a scale from `toJSON()` output. Restores the continuous-control-point mode too, which
the constructor alone cannot express.

#### Parameters

##### spec?

`any` = `{}`

#### Returns

`ColorScale`

***

### getGdalLegendParser()

> `static` **getGdalLegendParser**(): `Function`

Defined in: [package/colorScale.js:256](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L256)

The registered GDAL legend parser, or null if nothing has registered one yet.

#### Returns

`Function`

***

### palettes()

> `static` **palettes**(): `string`[]

Defined in: [package/colorScale.js:230](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L230)

Every palette name available to `{ palette }` — the built-ins plus anything registered.

#### Returns

`string`[]

***

### registerGdalLegendParser()

> `static` **registerGdalLegendParser**(`fn`): `void`

Defined in: [package/colorScale.js:250](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L250)

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

Defined in: [package/colorScale.js:224](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/colorScale.js#L224)

Add a palette by name. `colors`: >= 2 hex strings.

#### Parameters

##### name

`string`

##### colors

`string`[]

#### Returns

`void`
