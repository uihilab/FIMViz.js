[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/stats](../README.md) / Stats

# Class: Stats

Defined in: package/stats.js:23

## Constructors

### Constructor

> **new Stats**(`fields?`): `Stats`

Defined in: package/stats.js:25

Not usually called directly — use the `Stats.raster()`/`Stats.vector()` factories.

#### Parameters

##### fields?

`any` = `{}`

#### Returns

`Stats`

## Methods

### describe()

> **describe**(): `string`

Defined in: package/stats.js:186

#### Returns

`string`

***

### diff()

> **diff**(`other`): `object`

Defined in: package/stats.js:176

Deltas between two Stats of the same kind (this − other) over shared numeric fields.

#### Parameters

##### other

`Stats`

#### Returns

`object`

***

### download()

> **download**(`name?`): `void`

Defined in: package/stats.js:223

#### Parameters

##### name?

`string` = `"stats.csv"`

#### Returns

`void`

***

### percentile()

> **percentile**(`p`): `number`

Defined in: package/stats.js:156

Approximate percentile p (0–100) from the histogram. Raster only.

#### Parameters

##### p

`number`

#### Returns

`number`

***

### toCSV()

> **toCSV**(): `string`

Defined in: package/stats.js:203

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `any`

Defined in: package/stats.js:200

#### Returns

`any`

***

### raster()

> `static` **raster**(`pixelData`, `meta`, `opts?`): `Stats`

Defined in: package/stats.js:38

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

Defined in: package/stats.js:113

Vector statistics over any feature source.

Accepts **GeoJSON** (a FeatureCollection, a single Feature, a Feature[], or the engine's
`VectorFeatures`) — what a headless caller and `VectorLayer.getStats()` have — **or** a
`google.maps.Data`-shaped layer.

#### Parameters

##### source

`any`

GeoJSON FeatureCollection|Feature|Feature[]|VectorFeatures, or a `google.maps.Data` layer

##### opts?

###### filter?

`Function` \| `any`[] \| [`Filter`](../../filter/classes/Filter.md) = `null`

#### Returns

`Stats`
