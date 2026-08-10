[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/stats](../README.md) / Stats

# Class: Stats

Defined in: [package/stats.js:23](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L23)

## Constructors

### Constructor

> **new Stats**(`fields?`): `Stats`

Defined in: [package/stats.js:25](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L25)

Not usually called directly — use the `Stats.raster()`/`Stats.vector()` factories.

#### Parameters

##### fields?

`any` = `{}`

#### Returns

`Stats`

## Methods

### describe()

> **describe**(): `string`

Defined in: [package/stats.js:204](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L204)

#### Returns

`string`

***

### diff()

> **diff**(`other`): `object`

Defined in: [package/stats.js:194](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L194)

Deltas between two Stats of the same kind (this − other) over shared numeric fields.

#### Parameters

##### other

`Stats`

#### Returns

`object`

***

### download()

> **download**(`name?`): `void`

Defined in: [package/stats.js:241](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L241)

#### Parameters

##### name?

`string` = `"stats.csv"`

#### Returns

`void`

***

### percentile()

> **percentile**(`p`): `number`

Defined in: [package/stats.js:174](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L174)

Approximate percentile p (0–100) from the histogram. Raster only.

#### Parameters

##### p

`number`

#### Returns

`number`

***

### toCSV()

> **toCSV**(): `string`

Defined in: [package/stats.js:221](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L221)

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `any`

Defined in: [package/stats.js:218](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L218)

#### Returns

`any`

***

### raster()

> `static` **raster**(`pixelData`, `meta`, `opts?`): `Stats`

Defined in: [package/stats.js:38](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L38)

Raster statistics over pixelData, optionally scoped by a Filter and classified by a ColorScale.

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

Defined in: [package/stats.js:118](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/stats.js#L118)

Vector statistics over any feature source.

Accepts **GeoJSON** (a FeatureCollection, a single Feature, a Feature[], or the engine's
`VectorFeatures`) — what a headless caller and `VectorLayer.getStats()` have — **or** a
`google.maps.Data`-shaped layer.

#### Parameters

##### source

`any`

GeoJSON FeatureCollection|Feature|Feature[]|VectorFeatures, or a `google.maps.Data` layer

##### opts?

###### classify?

[`ColorScale`](../../colorScale/classes/ColorScale.md) = `null`

bucket features into `byClass`
  by the SAME scale that colours them. Needs `classifyBy` to know which property carries the
  value; `VectorLayer.getStats()` passes both from the layer, so the buckets line up with the
  legend exactly as they do for a raster.

###### classifyBy?

`string` = `null`

the feature property `classify` reads

###### filter?

`Function` \| `any`[] \| [`Filter`](../../filter/classes/Filter.md) = `null`

#### Returns

`Stats`
