[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/colorScale](../README.md) / ColorScale

# Class: ColorScale

Defined in: [package/colorScale.js:149](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L149)

## Constructors

### Constructor

> **new ColorScale**(`opts?`): `ColorScale`

Defined in: [package/colorScale.js:164](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L164)

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

Defined in: [package/colorScale.js:182](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L182)

***

### \_colorStopValues

> **\_colorStopValues**: `number`[]

Defined in: [package/colorScale.js:181](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L181)

***

### \_continuous

> **\_continuous**: `boolean`

Defined in: [package/colorScale.js:173](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L173)

***

### \_listeners

> **\_listeners**: `any`[]

Defined in: [package/colorScale.js:185](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L185)

***

### \_max

> **\_max**: `number`

Defined in: [package/colorScale.js:172](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L172)

***

### \_min

> **\_min**: `number`

Defined in: [package/colorScale.js:171](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L171)

***

### \_stops

> **\_stops**: `object`[]

Defined in: [package/colorScale.js:175](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L175)

#### color

> **color**: `any` = `s.color`

#### label

> **label**: `any` = `s.label`

***

### colorFor

> **colorFor**: (`value`) => `string`

Defined in: [package/colorScale.js:184](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L184)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### missingColor

> **missingColor**: `string`

Defined in: [package/colorScale.js:169](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L169)

***

### palette

> **palette**: `string` \| `any`[]

Defined in: [package/colorScale.js:170](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L170)

***

### source

> **source**: `"palette"` \| `"custom"` \| `"gdal"`

Defined in: [package/colorScale.js:176](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L176)

***

### unit

> **unit**: `string`

Defined in: [package/colorScale.js:174](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L174)

## Accessors

### continuous

#### Get Signature

> **get** **continuous**(): `boolean`

Defined in: [package/colorScale.js:291](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L291)

Is interpolation on? A read-only flag — write it with `set({ continuous })`.

##### Returns

`boolean`

***

### discrete

#### Get Signature

> **get** **discrete**(): `boolean`

Defined in: [package/colorScale.js:286](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L286)

##### Returns

`boolean`

***

### isExplicit

#### Get Signature

> **get** **isExplicit**(): `boolean`

Defined in: [package/colorScale.js:284](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L284)

##### Returns

`boolean`

***

### kind

#### Get Signature

> **get** **kind**(): `"continuous"` \| `"classed"`

Defined in: [package/colorScale.js:244](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L244)

##### Returns

`"continuous"` \| `"classed"`

## Methods

### getColor()

> **getColor**(`value`): `string`

Defined in: [package/colorScale.js:347](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L347)

Resolve any value → css color string (colorFor override wins; null if nothing matches).

#### Parameters

##### value

`number`

#### Returns

`string`

***

### getRange()

> **getRange**(`i`): `object`

Defined in: [package/colorScale.js:337](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L337)

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

Defined in: [package/colorScale.js:361](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L361)

Hot-path [r,g,b] for the render loop; null → pixel is transparent (no matching stop).

#### Parameters

##### value

`number`

#### Returns

\[`number`, `number`, `number`\]

***

### getStops()

> **getStops**(): [`ColorStop`](../interfaces/ColorStop.md)[]

Defined in: [package/colorScale.js:300](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L300)

[{ min?, max?, value?, color, label }] — explicit→stored | palette→derived | colorStops→one
`{ value, color }` per control point (setColorStops).

#### Returns

[`ColorStop`](../interfaces/ColorStop.md)[]

***

### getValues()

> **getValues**(): `number`[]

Defined in: [package/colorScale.js:323](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L323)

#### Returns

`number`[]

***

### offChange()

> **offChange**(`fn`): `ColorScale`

Defined in: [package/colorScale.js:578](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L578)

#### Parameters

##### fn

(`scale`) => `void`

#### Returns

`ColorScale`

***

### onChange()

> **onChange**(`fn`): `ColorScale`

Defined in: [package/colorScale.js:573](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L573)

#### Parameters

##### fn

(`scale`) => `void`

#### Returns

`ColorScale`

***

### set()

> **set**(`patch?`): `ColorScale`

Defined in: [package/colorScale.js:419](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L419)

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

Defined in: [package/colorScale.js:548](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L548)

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

Defined in: [package/colorScale.js:492](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L492)

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

Defined in: [package/colorScale.js:560](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L560)

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

Defined in: [package/colorScale.js:536](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L536)

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

Defined in: [package/colorScale.js:464](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L464)

#### Parameters

##### stops

`object`[]

#### Returns

`ColorScale`

***

### toJSON()

> **toJSON**(): `object`

Defined in: [package/colorScale.js:259](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L259)

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

Defined in: [package/colorScale.js:193](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L193)

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

Defined in: [package/colorScale.js:276](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L276)

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

Defined in: [package/colorScale.js:241](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L241)

The registered GDAL legend parser, or null if nothing has registered one yet.

#### Returns

`Function`

***

### palettes()

> `static` **palettes**(): `string`[]

Defined in: [package/colorScale.js:215](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L215)

Every palette name available to `{ palette }` — the built-ins plus anything registered.

#### Returns

`string`[]

***

### registerGdalLegendParser()

> `static` **registerGdalLegendParser**(`fn`): `void`

Defined in: [package/colorScale.js:235](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L235)

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

Defined in: [package/colorScale.js:209](https://github.com/uihilab/FIMViz.js/blob/4b876c479bb0db4bb7fbe6632ef6f5073c3e1350/src/package/colorScale.js#L209)

Add a palette by name. `colors`: >= 2 hex strings.

#### Parameters

##### name

`string`

##### colors

`string`[]

#### Returns

`void`
