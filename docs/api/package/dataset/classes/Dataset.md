[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/dataset](../README.md) / Dataset

# Class: Dataset

Defined in: [package/dataset.js:136](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L136)

## Constructors

### Constructor

> **new Dataset**(`init?`): `Dataset`

Defined in: [package/dataset.js:169](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L169)

#### Parameters

##### init?

###### axes?

[`DatasetAxis`](../interfaces/DatasetAxis.md)[] = `null`

###### axis?

[`DatasetAxis`](../interfaces/DatasetAxis.md) = `null`

1-D sugar for a single selection axis

###### bounds?

[`DatasetBounds`](../interfaces/DatasetBounds.md) = `null`

expressed in `crs`

###### crs?

`string` = `null`

native CRS; `null` when unknown

###### data?

`any` = `null`

inlined payload only (raster bytes or parsed GeoJSON)

###### format?

`"geotiff"` \| `"geojson"` \| `"kml"` \| `"kmz"` \| `"shp"` \| `"hazus"` = `null`

###### id?

`string`

###### kind?

`"raster"` \| `"vector"` = `null`

###### meta?

`any` = `{}`

###### name?

`string`

###### resolveUrl?

(`url`) => `string` = `null`

url root only: resolver applied to the URL at force time

###### selector?

`any` = `null`

an in-file selection passed to the materializer as `root.select`
  normally produced by `select()` from a selector ref rather than passed by hand

###### url?

`string` = `null`

a URI root (set via Dataset.fromURL); leaves `data` null

#### Returns

`Dataset`

## Properties

### axes

> **axes**: [`DatasetAxis`](../interfaces/DatasetAxis.md)[]

Defined in: [package/dataset.js:183](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L183)

***

### crs

> **crs**: `string`

Defined in: [package/dataset.js:176](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L176)

***

### data

> **data**: `any`

Defined in: [package/dataset.js:179](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L179)

***

### format

> **format**: `"geotiff"` \| `"geojson"` \| `"kml"` \| `"kmz"` \| `"shp"` \| `"hazus"`

Defined in: [package/dataset.js:175](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L175)

***

### id

> **id**: `string`

Defined in: [package/dataset.js:172](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L172)

***

### kind

> **kind**: `"raster"` \| `"vector"`

Defined in: [package/dataset.js:174](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L174)

***

### name

> **name**: `string`

Defined in: [package/dataset.js:173](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L173)

## Accessors

### axis

#### Get Signature

> **get** **axis**(): [`DatasetAxis`](../interfaces/DatasetAxis.md)

Defined in: [package/dataset.js:309](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L309)

The primary (first) selection axis, or null.

##### Returns

[`DatasetAxis`](../interfaces/DatasetAxis.md)

***

### bounds

#### Get Signature

> **get** **bounds**(): [`DatasetBounds`](../interfaces/DatasetBounds.md)

Defined in: [package/dataset.js:298](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L298)

The footprint, in `crs`. Known at construction for a root, and for an op whose result is
predictable such as `clip`. Null when it genuinely is not, i.e. a fresh `reproject()` node, whose
real bounds depend on what the warp produces. Once this node is forced it reads the value off
the memoized result instead, so the reprojected node's `bounds` reports the true post-warp
footprint rather than the construction-time placeholder.

##### Returns

[`DatasetBounds`](../interfaces/DatasetBounds.md)

***

### isMaterialized

#### Get Signature

> **get** **isMaterialized**(): `boolean`

Defined in: [package/dataset.js:315](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L315)

Has this node been forced (decoded/warped) yet?

##### Returns

`boolean`

***

### meta

#### Get Signature

> **get** **meta**(): `any`

Defined in: [package/dataset.js:306](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L306)

Free-form metadata, i.e. a GDAL legend. Updates itself the way `bounds` does: once forced it
reads off the memoized result, which matters for an op like `reproject` whose reprojector
refreshes `width` and `height` that the pre-force value cannot know.

##### Returns

`any`

***

### selector

#### Get Signature

> **get** **selector**(): `any`

Defined in: [package/dataset.js:658](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L658)

The in-file selection this Dataset forces with, or null.

##### Returns

`any`

***

### warnings

#### Get Signature

> **get** **warnings**(): `string`[]

Defined in: [package/dataset.js:312](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L312)

Warnings collected when this node was forced (implicit reprojection, defaults, …).

##### Returns

`string`[]

## Methods

### aspect()

> **aspect**(): `Dataset`

Defined in: [package/dataset.js:494](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L494)

The downslope compass bearing by Horn's method (rasterOps.aspectGrid). Lazy.

#### Returns

`Dataset`

***

### clip()

> **clip**(`bbox`): `Dataset`

Defined in: [package/dataset.js:390](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L390)

Crops to a bbox, shrinking the footprint to the overlap and snapping to pixel edges. Lazy.

#### Parameters

##### bbox

###### east

`number`

###### north

`number`

###### south

`number`

###### west

`number`

#### Returns

`Dataset`

***

### combine()

> **combine**(`others`, `opts?`): `Dataset`

Defined in: [package/dataset.js:434](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L434)

Combines this raster with `others` pixel by pixel, resampling them onto this grid first. `op` is
difference or ratio for two rasters, or sum, mean, min or max for any number. Lazy.

#### Parameters

##### others

`Dataset` \| `Dataset`[]

##### opts?

###### method?

`string` = `"nearest"`

###### op?

`string` = `"difference"`

#### Returns

`Dataset`

***

### difference()

> **difference**(`other`): `Dataset`

Defined in: [package/dataset.js:443](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L443)

`combine([other], { op: "difference" })`.

#### Parameters

##### other

`Dataset`

#### Returns

`Dataset`

***

### download()

> **download**(): `void`

Defined in: [package/dataset.js:1121](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L1121)

Saves the original bytes to disk. Inline roots only, since a URL root holds no local bytes yet.
`document` is ambient, so this adds nothing to the import graph.

#### Returns

`void`

***

### features()

> **features**(): `Promise`\<[`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

Defined in: [package/dataset.js:789](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L789)

Force + assert vector.

#### Returns

`Promise`\<[`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

***

### grid()

> **grid**(): `Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md)\>

Defined in: [package/dataset.js:782](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L782)

Force + assert raster.

#### Returns

`Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md)\>

***

### groupBy()

> **groupBy**(`by`, `opts?`): `Promise`\<`any`[]\>

Defined in: [package/dataset.js:855](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L855)

Reduces this raster's pixels grouped by another raster's values. A terminal returning a table
rather than a Dataset, and the third kind of reduction here:

| verb | collapses | grouped by | returns |
|---|---|---|---|
| `reduce(op)` | a selection axis | — | a Dataset (one grid) |
| `zonalStats(zones)` | space | geometry | a table |
| `groupBy(by)` | space | **another raster's values** | a table |

This is one variable as a series against another: mean depth per land-use class, rainfall
binned by elevation, a rating curve. It is its own verb rather than an overload because the
grouping key comes from data, not from the axis model or from geometry.

`by` is resampled onto this Dataset's grid, the way `combine` conforms its inputs, and a pixel
counts only where both rasters hold a value.

```js
await depth.groupBy(landuse);                  // one row per distinct land-use code
await rain.groupBy(dem, { bins: 10 });          // ten equal-width elevation bands
await rain.groupBy(dem, { bins: [0, 100, 500, 2000] });
```

#### Parameters

##### by

`Dataset`

a raster Dataset whose values define the groups

##### opts?

###### bins?

`number` \| `number`[]

###### byNoData?

`number`

###### method?

`string`

###### noData?

`number`

#### Returns

`Promise`\<`any`[]\>

***

### hillshade()

> **hillshade**(`opts?`): `Dataset`

Defined in: [package/dataset.js:504](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L504)

A shaded-relief illumination raster by Horn's method (rasterOps.hillshadeGrid). Lazy.

#### Parameters

##### opts?

###### altitude?

`number`

###### azimuth?

`number`

###### cellsizeX?

`number`

###### cellsizeY?

`number`

###### zFactor?

`number`

#### Returns

`Dataset`

***

### load()

> **load**(): `Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md) \| [`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

Defined in: [package/dataset.js:775](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L775)

Forces this node. Fetches and decodes the root, or forces the parent and applies this op, then
memoizes and returns the RasterGrid or VectorFeatures. A repeat call reuses the memoized result.

#### Returns

`Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md) \| [`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

***

### mask()

> **mask**(`polygon`, `opts?`): `Dataset`

Defined in: [package/dataset.js:379](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L379)

Masks by a polygon. On force, pixels outside it become transparent, or inside it with
`{ invert }`. The footprint does not change. Lazy: this builds a node and the terminal runs it.

#### Parameters

##### polygon

`any`[] \| [`SpatialFilter`](../../filter/classes/SpatialFilter.md)

a SpatialFilter, or a ring/multi-ring of {lat,lng}|[lat,lng]

##### opts?

###### invert?

`boolean` = `false`

#### Returns

`Dataset`

***

### rasterize()

> **rasterize**(`opts?`): `Dataset`

Defined in: [package/dataset.js:517](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L517)

Rasterizes this vector Dataset onto a new grid, the one op that changes a Dataset's kind
(PACKAGE_ROADMAP §2). `field` burns each feature's property value; omit it for a constant
`burnValue`. Bounds default to this Dataset's footprint. `width` and `height` are required,
because a vector carries no pixel resolution. Lazy.

#### Parameters

##### opts?

###### bounds?

[`DatasetBounds`](../interfaces/DatasetBounds.md)

###### burnValue?

`number` = `1`

###### field?

`string`

###### height

`number`

###### width

`number`

#### Returns

`Dataset`

***

### ratio()

> **ratio**(`other`): `Dataset`

Defined in: [package/dataset.js:446](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L446)

`combine([other], { op: "ratio" })`.

#### Parameters

##### other

`Dataset`

#### Returns

`Dataset`

***

### reclassify()

> **reclassify**(`rules`, `opts?`): `Dataset`

Defined in: [package/dataset.js:418](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L418)

Remaps pixel values by `rules` (see rasterOps.reclassifyGrid), in one of two forms.

A range-rules array `[{min?,max?,value?}]`, first match wins, where a rule with no `value` keeps
the matched pixel's own value.

A callback `(value, index) => number|null|undefined`, run once per valid pixel with its raw
value and flat row-major index `row*width+col`, returning the new value directly. It is not
limited to a contiguous range and skips rule matching, one call per pixel instead of a
scan per rule, so past a couple of simple ranges it is both more general and cheaper.

Either form: returning `null` or `undefined`, or matching no rule, leaves the pixel unmatched,
which becomes transparent by default or is kept. Lazy.

A callback does not survive `toRecord()`, since structured clone cannot carry a function.
Forcing it with `.grid()` works in-session, but `toRecord()` on this node or a descendant throws
and names the op rather than dropping it. Use range rules for a chain that has to persist to
Storage and reload.

#### Parameters

##### rules

`object`[] \| ((`value`, `index`) => `number`)

##### opts?

###### unmatched?

`"nodata"` \| `"keep"` = `"nodata"`

#### Returns

`Dataset`

***

### reduce()

> **reduce**(`op?`, `opts?`): `Dataset`

Defined in: [package/dataset.js:536](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L536)

Collapses this Dataset's selection axis into one grid with a per-pixel reducer, i.e. a stage or
time series. Shorthand for select() then combine(): it resolves each axis entry to a child
Dataset, then conforms and reduces them as combine() does (PACKAGE_ROADMAP §2). Lazy.

#### Parameters

##### op?

`"min"` \| `"max"` \| `"sum"` \| `"mean"`

##### opts?

###### axis?

`string` \| `number` = `0`

###### method?

`string` = `"nearest"`

###### variant?

`string`

#### Returns

`Dataset`

***

### release()

> **release**(): `void`

Defined in: [package/dataset.js:865](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L865)

Drop the memoized decode (evictable cache — the slider's stale-load guard calls this).

#### Returns

`void`

***

### reproject()

> **reproject**(`toCrs`): `Dataset`

Defined in: [package/dataset.js:330](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L330)

Builds a lazy reproject to `toCrs` and returns a new Dataset. The warp runs on force, through
the registered reprojector, since this file imports no GDAL. Requesting the CRS it already has
returns `this` unchanged. Rasters only, as vectors are EPSG:4326 by spec.

#### Parameters

##### toCrs

`string`

#### Returns

`Dataset`

***

### resampleTo()

> **resampleTo**(`target`, `opts?`): `Dataset`

Defined in: [package/dataset.js:468](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L468)

Resamples onto a target grid on force, through geo/resample.js's resampleGrid. lib.js also
exports resampleGrid and alignRasters directly, so either this Dataset op or the raw function
over pixel arrays works.

`target` is either resample's own meta object `{ width, height, bw, bs, be, bn }` or anything
grid-shaped, `{ width, height, bounds: {north,south,east,west} }`, i.e. another forced Dataset's
`.grid()` result. `method` defaults to `'nearest'`, which is pure JS and always available. The
GDAL-only methods (cubic, lanczos, mode, min, max, med, q1, q3) need a resampler from
`Dataset.registerResampler`, or forcing throws. The result takes the target's footprint and
resolution, and `crs` does not change: this resamples, it does not reproject.

#### Parameters

##### target

\{ `be`: `number`; `bn`: `number`; `bs`: `number`; `bw`: `number`; `height`: `number`; `width`: `number`; \} \| \{ `bounds`: \{ `east`: `number`; `north`: `number`; `south`: `number`; `west`: `number`; \}; `height`: `number`; `width`: `number`; \}

##### opts?

###### method?

`string` = `"nearest"`

###### noData?

`number` = `null`

#### Returns

`Dataset`

***

### select()

> **select**(`coord`, `opts?`): `Dataset`

Defined in: [package/dataset.js:586](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L586)

Resolves one selection-axis entry into a lazy child Dataset. Shorthand for selectAxisEntry: it
picks the entry, resolves its `ref` and carries the entry's opaque `meta`. Returns null when no
entry matches. The user chooses the variant, raster or vector.

The `ref` decides what kind of child comes back (see [DatasetAxisEntry](../interfaces/DatasetAxisEntry.md)). A URL, bare or a
named variant chosen with `opts.variant`, gives a URL-rooted child whose format comes from the
URL, one file per entry. An in-file selector, `{ select: {…} }`, gives a child rooted on this
Dataset's own source, its bytes or URL plus the resolver, carrying the selector for the
materializer: one file with many entries, i.e. a NetCDF time axis.

Either way the child has no `axes` of its own. It is one payload rather than a series, so it
forces through `load()` and `grid()` like any Dataset and every op chains off it.

#### Parameters

##### coord

`string` \| `number`

##### opts?

###### axis?

`string` \| `number`

which axis (index or name) to look up on

###### base?

`string`

URL prefix prepended to a resolved URL `ref` (ignored by selector refs)

###### nearest?

`boolean`

fall back to the closest numeric coord on a miss

###### variant?

`string`

required when the matched entry's `ref` has named URL variants (e.g. `{raster, vector}`)

#### Returns

`Dataset`

***

### selectAxisEntry()

> **selectAxisEntry**(`coord`, `opts?`): [`DatasetAxisEntry`](../interfaces/DatasetAxisEntry.md)

Defined in: [package/dataset.js:746](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L746)

Looks up an entry on one axis by coordinate. Tries an exact match first, then the closest coord
when `{ nearest: true }`, the default, and the axis is numeric. `axis` takes an index or a name.

#### Parameters

##### coord

`string` \| `number`

##### opts?

###### axis?

`string` \| `number` = `0`

which axis (index or name) to look up on

###### nearest?

`boolean` = `true`

fall back to the closest numeric coord on a miss

#### Returns

[`DatasetAxisEntry`](../interfaces/DatasetAxisEntry.md)

***

### selectRange()

> **selectRange**(`from`, `to`, `opts?`): `Dataset`

Defined in: [package/dataset.js:718](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L718)

Narrows one axis to the window `[from, to]`, taking a series and returning a series. That is
what separates it from `select()`, which resolves to one payload and returns something
forceable. `selectRange` returns another selection-axis Dataset, still lazy and still not
forceable on its own, so everything that works on the full series works on the window.
`reduce()` most of all: the mean of six hours is `selectRange(a, b).reduce('mean')`, with no new
machinery.

Both bounds are inclusive and compared with plain `>=` and `<=` against the entry coords, so the
type does not matter. Numeric coords such as epoch milliseconds or a stage in feet compare
numerically, and ISO-8601 strings compare lexicographically, which for ISO-8601 matches
chronological order. Reversed bounds are swapped rather than rejected.

There is no nearest match, unlike `select()`. A window already tolerates falling between
samples, so a range narrower than the sampling interval matches nothing and returns `null`.
Snapping instead would hand back a wider span than was asked for.

Coords compare as given, so use `Date.parse(iso)` for the epoch-millisecond axes `parseSciwrid`
builds. The engine stays neutral about what a coordinate means.

```js
const storm = ds.selectRange(Date.parse('2023-08-29T00:00Z'), Date.parse('2023-08-30T00:00Z'));
storm.axis.entries.length;          // just that day's steps
await storm.reduce('max').grid();    // peak rainfall WITHIN the window
storm.select(coord);                  // and one step out of it, as usual
```

#### Parameters

##### from

`string` \| `number`

inclusive lower bound

##### to

`string` \| `number`

inclusive upper bound

##### opts?

###### axis?

`string` \| `number` = `0`

which axis (index or name) to narrow

#### Returns

`Dataset`

a Dataset whose chosen axis holds only the matching entries; `null` when
  the axis is missing/empty or nothing falls inside the window

***

### slope()

> **slope**(`opts?`): `Dataset`

Defined in: [package/dataset.js:485](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L485)

Per-pixel terrain steepness by Horn's method, in pure JS over the decoded grid with no GDAL.
See rasterOps.slopeGrid and PACKAGE_ROADMAP §2 "terrain". Lazy.

#### Parameters

##### opts?

###### cellsizeX?

`number`

###### cellsizeY?

`number`

###### unit?

`"degrees"` \| `"percent"`

###### zFactor?

`number`

#### Returns

`Dataset`

***

### stats()

> **stats**(`opts?`): `Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

Defined in: [package/dataset.js:811](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L811)

Statistics over this Dataset's own values: min, max, mean, median, stddev, sum, count, area and
a histogram. A terminal, so it forces the chain and returns a `Stats`, not a Dataset.

Rasters read the decoded pixels; vectors read the features, giving counts by geometry type plus
total area, length and bbox. `RasterLayer.getStats()` and `VectorLayer.getStats()` return the
same thing for a rendered layer, so this is the headless route to it.

#### Parameters

##### opts?

###### bins?

`number`

raster only: histogram bin count

###### classify?

[`ColorScale`](../../colorScale/classes/ColorScale.md)

buckets values into `byClass`

###### classifyBy?

`string`

vector only: the property `classify` reads

###### filter?

`Function` \| `any`[] \| [`Filter`](../../filter/classes/Filter.md)

scopes the computation

###### skipZero?

`boolean`

raster only: treat 0 as absent

#### Returns

`Promise`\<[`Stats`](../../stats/classes/Stats.md)\>

***

### toJSON()

> **toJSON**(): `any`

Defined in: [package/dataset.js:1139](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L1139)

The metadata without the heavy `data` payload. Axes are small, holding URLs, so they stay.

#### Returns

`any`

***

### toRecord()

> **toRecord**(`opts?`): `any`

Defined in: [package/dataset.js:1041](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L1041)

A structured-cloneable record for Storage.put(). By default it stores the source and the op
recipe, which is small: an inline root still serializes with `data` and round-trips as before, a
URL root carries `url`, and a derived node nests its input records under `inputs` beside its
`op`. Pass `{ storeMaterialized: true }` to embed the decoded RasterGrid or VectorFeatures too,
which requires the node to be materialized already, so call `await ds.load()` first.

#### Parameters

##### opts?

###### storeMaterialized?

`boolean`

also embed the decoded RasterGrid/VectorFeatures snapshot

#### Returns

`any`

***

### variantsAt()

> **variantsAt**(`coord`, `opts?`): `string`[]

Defined in: [package/dataset.js:650](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L650)

The named variants available at one axis coordinate, or `null` when that entry has none.

Variants are not an axis, so they need their own way to be discovered. Otherwise the only way to
learn an entry has them is to call `select()` without one and read the thrown error, which is no
way to build a picker.

They are not an axis because a variant switches the Dataset's kind: `.tif` gives a raster in an
unknown CRS and `.kmz` a vector in EPSG:4326, where a real axis preserves kind, CRS and bounds.
A variant chooses an encoding of the same datum rather than a coordinate in the data. See
DECISIONS §1.1.

```js
ds.variantsAt(19.5);                       // → ['raster', 'vector']  (or null)
ds.select(19.5, { variant: 'raster' });
```

#### Parameters

##### coord

`string` \| `number`

##### opts?

###### axis?

`string` \| `number`

###### nearest?

`boolean`

#### Returns

`string`[]

***

### zonalStats()

> **zonalStats**(`zones`, `opts?`): `Promise`\<`any`[]\>

Defined in: [package/dataset.js:824](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L824)

Per-zone min, max, mean, sum, count and area over this raster. Forces the chain and returns
one row per zone, so nothing chains off it.

#### Parameters

##### zones

`object`[]

##### opts?

###### noData?

`number`

#### Returns

`Promise`\<`any`[]\>

***

### formats()

> `static` **formats**(): `string`[]

Defined in: [package/dataset.js:246](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L246)

The formats that can be decoded right now, built-in and registered. Build a file picker's
`accept` list from it, or check an upload before parsing.

#### Returns

`string`[]

***

### fromGrid()

> `static` **fromGrid**(`value`, `opts?`): `Dataset`

Defined in: [package/dataset.js:272](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L272)

#### Parameters

##### value

`any`

##### opts?

#### Returns

`Dataset`

***

### fromRecord()

> `static` **fromRecord**(`record`): `Dataset`

Defined in: [package/dataset.js:1076](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L1076)

Rebuilds a Dataset from a record, recipe or materialized. Structured clone drops prototypes, so
a stored record cannot be used directly.

#### Parameters

##### record

`any`

#### Returns

`Dataset`

***

### fromURL()

> `static` **fromURL**(`url`, `opts?`): `Dataset`

Defined in: [package/dataset.js:200](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L200)

A URI-rooted Dataset. It fetches and decodes into a RasterGrid or VectorFeatures on force, and
does nothing before then. Format and kind come from the URL when not given.

#### Parameters

##### url

`string`

##### opts?

###### bounds?

[`DatasetBounds`](../interfaces/DatasetBounds.md)

###### crs?

`string`

defaults to `'EPSG:4326'` for vector formats, `null` (unknown) for raster

###### format?

`"geotiff"` \| `"geojson"` \| `"kml"` \| `"kmz"` \| `"shp"` \| `"hazus"`

inferred from the URL's extension when omitted

###### kind?

`"raster"` \| `"vector"`

inferred from `format` when omitted

###### meta?

`any`

###### name?

`string`

defaults to the URL's filename

###### resolveUrl?

(`url`) => `string`

a resolver (host CORS-proxy/mirror) applied to the URL at force time

#### Returns

`Dataset`

***

### registerDefaultReprojectorLoader()

> `static` **registerDefaultReprojectorLoader**(`fn`): `void`

Defined in: [package/dataset.js:261](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L261)

A fallback run at most once, on the first force that finds no reprojector registered. This is
how the GDAL warp loads itself with no setup call.

#### Parameters

##### fn

() => `Promise`\<`void`\>

#### Returns

`void`

***

### registerMaterializer()

> `static` **registerMaterializer**(`format`, `fn`): `void`

Defined in: [package/dataset.js:239](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L239)

Registers the decoder for a `format`, i.e. 'geotiff'.

#### Parameters

##### format

`string`

##### fn

(`root`, `ds`) => `Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md) \| [`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

#### Returns

`void`

***

### registerReprojector()

> `static` **registerReprojector**(`fn`): `void`

Defined in: [package/dataset.js:253](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L253)

Supplies the single warp implementation `reproject()` forces through.

#### Parameters

##### fn

(`grid`, `toCrs`) => `Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md)\>

#### Returns

`void`

***

### registerResampler()

> `static` **registerResampler**(`fn`): `void`

Defined in: [package/dataset.js:270](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/dataset.js#L270)

Supplies a resampler for the methods the pure-JS path does not implement, i.e. cubic, which
`resampleTo({ method })` otherwise throws on. Synchronous and pixel-level. GDAL's own richer
methods go through the reprojector instead (see geo/resample.js).

#### Parameters

##### fn

`Function`

#### Returns

`void`
