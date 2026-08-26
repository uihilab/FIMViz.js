[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/stats](../README.md) / Stats

# Class: Stats

Defined in: [package/stats.js:23](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L23)

## Constructors

### Constructor

> **new Stats**(`fields?`): `Stats`

Defined in: [package/stats.js:25](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L25)

Use `Stats.raster()` or `Stats.vector()` instead of calling this.

#### Parameters

##### fields?

`any` = `{}`

#### Returns

`Stats`

## Methods

### describe()

> **describe**(): `string`

Defined in: [package/stats.js:204](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L204)

#### Returns

`string`

***

### diff()

> **diff**(`other`): `object`

Defined in: [package/stats.js:194](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L194)

Subtracts `other` from this, field by field, over the numeric fields both kinds share.

#### Parameters

##### other

`Stats`

#### Returns

`object`

***

### download()

> **download**(`name?`): `void`

Defined in: [package/stats.js:241](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L241)

#### Parameters

##### name?

`string` = `"stats.csv"`

#### Returns

`void`

***

### percentile()

> **percentile**(`p`): `number`

Defined in: [package/stats.js:174](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L174)

Approximates percentile p, from 0 to 100, from the histogram. Raster only.

#### Parameters

##### p

`number`

#### Returns

`number`

***

### toCSV()

> **toCSV**(): `string`

Defined in: [package/stats.js:221](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L221)

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `any`

Defined in: [package/stats.js:218](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L218)

#### Returns

`any`

***

### raster()

> `static` **raster**(`pixelData`, `meta`, `opts?`): `Stats`

Defined in: [package/stats.js:38](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L38)

Raster statistics over pixelData. A Filter scopes it and a ColorScale classifies it.

#### Parameters

##### pixelData

`ArrayLike`\<`number`\>

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

###### noData?

`number`

###### unit?

`string`

###### width

`number`

##### opts?

###### bins?

`number` = `64`

###### classify?

[`ColorScale`](../../colorScale/classes/ColorScale.md) = `null`

###### filter?

`Function` \| `any`[] \| [`Filter`](../../filter/classes/Filter.md) = `null`

###### skipZero?

`boolean` = `false`

#### Returns

`Stats`

***

### vector()

> `static` **vector**(`source`, `opts?`): `Stats`

Defined in: [package/stats.js:118](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/stats.js#L118)

Vector statistics over any feature source.

Takes GeoJSON as a FeatureCollection, a Feature, a Feature array or the engine's
`VectorFeatures`, which is what `VectorLayer.getStats()` and headless code hold. Also takes a
`google.maps.Data`-shaped layer.

#### Parameters

##### source

`any`

GeoJSON FeatureCollection|Feature|Feature[]|VectorFeatures, or a `google.maps.Data` layer

##### opts?

###### classify?

[`ColorScale`](../../colorScale/classes/ColorScale.md) = `null`

buckets features into
  `byClass` by the scale that colors them, so they line up with the legend as a raster's do.
  Needs `classifyBy` to know which property holds the value. `VectorLayer.getStats()` passes
  both from the layer.

###### classifyBy?

`string` = `null`

the feature property `classify` reads

###### filter?

`Function` \| `any`[] \| [`Filter`](../../filter/classes/Filter.md) = `null`

#### Returns

`Stats`
