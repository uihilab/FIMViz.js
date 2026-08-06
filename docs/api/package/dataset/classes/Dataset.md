[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/dataset](../README.md) / Dataset

# Class: Dataset

Defined in: [package/dataset.js:136](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L136)

## Constructors

### Constructor

> **new Dataset**(`init?`): `Dataset`

Defined in: [package/dataset.js:169](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L169)

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
  (normally produced by `select()` off a selector ref, not passed by hand)

###### url?

`string` = `null`

a URI root (set via Dataset.fromURL); leaves `data` null

#### Returns

`Dataset`

## Properties

### axes

> **axes**: [`DatasetAxis`](../interfaces/DatasetAxis.md)[]

Defined in: [package/dataset.js:183](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L183)

***

### crs

> **crs**: `string`

Defined in: [package/dataset.js:176](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L176)

***

### data

> **data**: `any`

Defined in: [package/dataset.js:179](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L179)

***

### format

> **format**: `"geotiff"` \| `"geojson"` \| `"kml"` \| `"kmz"` \| `"shp"` \| `"hazus"`

Defined in: [package/dataset.js:175](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L175)

***

### id

> **id**: `string`

Defined in: [package/dataset.js:172](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L172)

***

### kind

> **kind**: `"raster"` \| `"vector"`

Defined in: [package/dataset.js:174](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L174)

***

### name

> **name**: `string`

Defined in: [package/dataset.js:173](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L173)

## Accessors

### axis

#### Get Signature

> **get** **axis**(): [`DatasetAxis`](../interfaces/DatasetAxis.md)

Defined in: [package/dataset.js:312](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L312)

The primary (first) selection axis, or null.

##### Returns

[`DatasetAxis`](../interfaces/DatasetAxis.md)

***

### bounds

#### Get Signature

> **get** **bounds**(): [`DatasetBounds`](../interfaces/DatasetBounds.md)

Defined in: [package/dataset.js:301](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L301)

The footprint, in `crs`. Constructor-known for a root (or an op whose result is knowable upfront,
e.g. `clip`), `null` when it genuinely isn't (e.g. a fresh `reproject()` node — the real bounds
depend on what the warp actually produces). Once this node is FORCED, reads the real value off the
memoized result instead — so `ds.reproject(crs).grid().then(() => ds2.bounds)` (`ds2` being the
reprojected node) reflects the true post-warp footprint rather than staying stuck at the
construction-time placeholder.

##### Returns

[`DatasetBounds`](../interfaces/DatasetBounds.md)

***

### isMaterialized

#### Get Signature

> **get** **isMaterialized**(): `boolean`

Defined in: [package/dataset.js:318](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L318)

Has this node been forced (decoded/warped) yet?

##### Returns

`boolean`

***

### meta

#### Get Signature

> **get** **meta**(): `any`

Defined in: [package/dataset.js:309](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L309)

Free-form metadata (GDAL legend/unit/noData, …). Same self-updating rule as `bounds`: once forced,
reads off the memoized result — which matters for raster ops like `reproject` whose reprojector
refreshes dimension fields (`width`/`height`) that the pre-force value can't know.

##### Returns

`any`

***

### selector

#### Get Signature

> **get** **selector**(): `any`

Defined in: [package/dataset.js:685](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L685)

The in-file selection this Dataset forces with, or null.

##### Returns

`any`

***

### warnings

#### Get Signature

> **get** **warnings**(): `string`[]

Defined in: [package/dataset.js:315](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L315)

Warnings collected when this node was forced (implicit reprojection, defaults, …).

##### Returns

`string`[]

## Methods

### aspect()

> **aspect**(): `Dataset`

Defined in: [package/dataset.js:520](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L520)

Aspect — the downslope compass bearing via Horn's method (rasterOps.aspectGrid). Lazy.

#### Returns

`Dataset`

***

### clip()

> **clip**(`bbox`): `Dataset`

Defined in: [package/dataset.js:385](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L385)

Clip (crop) to a bbox — the footprint shrinks to the overlap, snapped to pixel edges. Lazy.

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

Defined in: [package/dataset.js:425](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L425)

Band math: combine this raster with `others` per pixel (LHS-conform — the others are resampled onto
THIS grid). `op`: difference/ratio (binary) or sum/mean/min/max (N-ary). Lazy N-ary op node.

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

Defined in: [package/dataset.js:433](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L433)

Sugar: this − other, per pixel (LHS-conform).

#### Parameters

##### other

`Dataset`

#### Returns

`Dataset`

***

### download()

> **download**(): `void`

Defined in: [package/dataset.js:1063](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L1063)

Save the original bytes/content to disk. Inline roots only (a URL root has no local bytes yet).
`document` is ambient, so this costs nothing in the import graph.

#### Returns

`void`

***

### features()

> **features**(): `Promise`\<[`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

Defined in: [package/dataset.js:812](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L812)

Force + assert vector.

#### Returns

`Promise`\<[`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

***

### grid()

> **grid**(): `Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md)\>

Defined in: [package/dataset.js:805](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L805)

Force + assert raster.

#### Returns

`Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md)\>

***

### groupBy()

> **groupBy**(`by`, `opts?`): `Promise`\<`any`[]\>

Defined in: [package/dataset.js:491](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L491)

Reduce this raster's pixels **grouped by another raster's values** — a TERMINAL returning a table,
not a Dataset. The third kind of reduction in the model:

| verb | collapses | grouped by | returns |
|---|---|---|---|
| `reduce(op)` | a selection axis | — | a Dataset (one grid) |
| `zonalStats(zones)` | space | geometry | a table |
| `groupBy(by)` | space | **another raster's values** | a table |

This is what "one variable as a series against another" means concretely — mean depth per
land-use class, rainfall binned by elevation, a rating curve. It is a distinct verb rather than an
overload because the grouping key comes from data, not from the axis model or from geometry.

`by` is conformed onto THIS Dataset's grid (the same LHS-conform rule `combine` uses), and a pixel
counts only where both rasters have a value.

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

Defined in: [package/dataset.js:530](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L530)

Hillshade — a shaded-relief illumination raster via Horn's method (rasterOps.hillshadeGrid). Lazy.

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

Defined in: [package/dataset.js:798](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L798)

Force this node: decode/fetch the root (or force the parent and apply this op), memoize, return the
decoded RasterGrid | VectorFeatures. Repeated calls reuse the memoized result.

#### Returns

`Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md) \| [`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

***

### mask()

> **mask**(`polygon`, `opts?`): `Dataset`

Defined in: [package/dataset.js:374](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L374)

Mask by a polygon: pixels outside the polygon become transparent (NaN) on force — or inside, with
`{ invert }`. Footprint unchanged. Lazy: builds a node; the transform runs at terminal.

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

Defined in: [package/dataset.js:543](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L543)

Rasterize this vector Dataset onto a new grid (vector→raster, the kind-changing op —
PACKAGE_ROADMAP §2 "vectorize/rasterize"). `field` burns each feature's property value; omit for a
constant `burnValue`. Bounds default to this Dataset's own footprint; `width`/`height` are required
(a vector carries no inherent pixel resolution). Lazy.

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

### reclassify()

> **reclassify**(`rules`, `opts?`): `Dataset`

Defined in: [package/dataset.js:409](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L409)

Reclassify pixel values by `rules` (see rasterOps.reclassifyGrid) — EITHER a range-rules array
(`[{min?,max?,value?}]`, first-match-wins; a rule with no `value` is a "keep matched pixel's
value" band) OR a single callback `(value, index) => number|null|undefined` called once per
valid pixel with its raw value and flat row-major index (`row*width+col`), returning the new
value directly — not limited to a contiguous range, and skips rule-matching entirely (one call
per pixel instead of a per-rule scan), so it's both the more general and the cheaper form once
you need more than a couple of simple ranges. Either form: returning `null`/`undefined` (or no
rule matching) → unmatched → transparent (default) or kept. Lazy.

⚠️ A callback does NOT survive `toRecord()` (structured-clone can't carry functions) — forcing it
(`.grid()`) works fine in-session, but `toRecord()` on this node (or a descendant of it) throws
naming the op, rather than silently dropping it. Use range rules for a chain you need to
persist/reload from Storage.

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

Defined in: [package/dataset.js:563](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L563)

Reduce this Dataset's selection axis to ONE grid — collapse a temporal/vertical stack (e.g. a
stage/time series) via a per-pixel reducer. Sugar over select()+combine(): resolves every axis
entry to a child Dataset, then LHS-conforms/reduces them exactly like combine() (PACKAGE_ROADMAP §2
"3-D / aggregation", the payoff of the axes model). Lazy.

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

Defined in: [package/dataset.js:819](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L819)

Drop the memoized decode (evictable cache — the slider's stale-load guard calls this).

#### Returns

`void`

***

### reproject()

> **reproject**(`toCrs`): `Dataset`

Defined in: [package/dataset.js:329](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L329)

Reproject to `toCrs` as a LAZY op. Returns a new Dataset; the warp runs only on force, dispatched
through the registered reprojector (this file imports no GDAL). An exact same-CRS request is a
no-op that returns `this`. Rasters only (vectors are EPSG:4326 by spec).

#### Parameters

##### toCrs

`string`

#### Returns

`Dataset`

***

### resampleTo()

> **resampleTo**(`target`, `opts?`): `Dataset`

Defined in: [package/dataset.js:449](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L449)

Resample onto a specific target grid — lazy: the resample runs on force, via geo/resample.js's
resampleGrid (also directly barrel-exported as `resampleGrid`/`alignRasters`, so a caller can use
either this Dataset-shaped convenience or the raw function on pixel arrays). `target` is either a
resample-native meta object `{ width, height, bw, bs, be, bn }`, or anything grid-shaped —
`{ width, height, bounds: {north,south,east,west} }` — e.g. another (already-forced) Dataset's
`.grid()` result. `method` defaults to `'nearest'` (pure-JS, always available); the GDAL-only
methods (cubic/lanczos/mode/min/max/med/q1/q3) need a resampler registered via
`registerResampler` (the escape hatch) or forcing throws a clear error. The result adopts the
target's footprint/resolution; `crs` is unchanged (this resamples, it does not reproject).

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

Defined in: [package/dataset.js:614](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L614)

Resolve one selection-axis entry into a child Dataset (lazy). Sugar over selectAxisEntry: it picks
the entry, resolves its `ref`, and carries the entry's opaque `meta`. Returns null when no entry
matches. Kind-neutral: which variant (raster vs vector) is the caller's call.

The `ref` decides what kind of child comes back (see [DatasetAxisEntry](../interfaces/DatasetAxisEntry.md)):
- a **URL** (bare, or a named variant picked via `opts.variant`) → a URL-rooted child, format
  inferred from the URL. One file per entry.
- an **in-file selector** (`{ select: {…} }`) → a child rooted on the SAME source as this Dataset
  (its bytes or URL, plus resolver), carrying the selector for the materializer. One file, many
  entries — a NetCDF/GRIB2/Zarr time axis.

Either way the child has no `axes` of its own: it is one payload, not a series, so it forces
through `load()`/`grid()` like any other Dataset and every op chains off it normally.

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

Defined in: [package/dataset.js:773](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L773)

Look up an entry on one axis by coordinate. Exact match first; with { nearest: true } (default) and
a NUMERIC axis, falls back to the closest coord. `axis` selects which axis (index or name).

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

Defined in: [package/dataset.js:745](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L745)

Narrow one axis to the window `[from, to]` — a **series in, series out** operation, which is what
separates it from `select()`. `select(coord)` resolves to ONE payload and hands back something
forceable; `selectRange` hands back another selection-axis Dataset, still lazy, still unforceable
on its own. That is the point: everything that works on the full series works on the window,
`reduce()` most of all — "the mean of these six hours" is `selectRange(a, b).reduce('mean')`,
with no new machinery on either side.

Both bounds are **inclusive**, and the comparison is a plain `>=`/`<=` on the entry coords, so it
is type-agnostic: numeric coords (epoch milliseconds, a stage in feet) compare numerically, and
ISO-8601 strings compare lexicographically, which for ISO-8601 is the same as chronologically.
Reversed bounds are swapped rather than rejected. Unlike `select()` there is no nearest-match: a
window is already tolerant of falling between samples, so a range narrower than the sampling
interval matches nothing and returns `null` — which is honest, where snapping would silently hand
back a wider span than asked for.

Coords are compared as given — `Date.parse(iso)` for the epoch-millisecond axes `parseSciwrid`
builds. The engine stays domain-neutral about what a coordinate means.

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

Defined in: [package/dataset.js:511](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L511)

Slope — per-pixel terrain steepness via Horn's method, computed in pure JS on the decoded grid (no
GDAL — see rasterOps.slopeGrid; PACKAGE_ROADMAP §2 "terrain"). Lazy.

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

### toJSON()

> **toJSON**(): `any`

Defined in: [package/dataset.js:1081](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L1081)

Metadata view (without the heavy `data` payload). Axes are lightweight (URLs), so they stay.

#### Returns

`any`

***

### toRecord()

> **toRecord**(`opts?`): `any`

Defined in: [package/dataset.js:984](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L984)

A structured-cloneable record for Storage.put(). Default: the SOURCE + op recipe (small) — a root
inline Dataset still serializes with `data` and round-trips exactly as before (back-compat); a URL
root carries `url`; a derived node nests its INPUT records under `inputs` with its `op`. Pass
{ storeMaterialized: true } to also embed the decoded RasterGrid/VectorFeatures (the node must be
materialized already — call `await ds.load()` first).

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

Defined in: [package/dataset.js:677](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L677)

The named variants available at one axis coordinate, or `null` when that entry has none.

Variants are **not** an axis and deliberately never became one, so they need their own way to be
discovered — previously the only way to learn an entry had them was to call `select()` without one
and read the thrown error, which is no way to build a picker.

Why not an axis (see DECISIONS §1.1): a variant switches the Dataset's **kind** — `.tif` gives a
raster in an unknown CRS, `.kmz` a vector in EPSG:4326 — while every genuine axis preserves kind,
CRS and bounds. It is a choice of *encoding of the same datum*, not a coordinate in the data.

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

> **zonalStats**(`zones`, `opts?`): `Promise`\<`object`[]\>

Defined in: [package/dataset.js:500](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L500)

#### Parameters

##### zones

`any`

##### opts?

#### Returns

`Promise`\<`object`[]\>

***

### formats()

> `static` **formats**(): `string`[]

Defined in: [package/dataset.js:248](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L248)

Every format that can be decoded right now — built-ins plus anything registered. Build a file
picker's `accept` list from it, or check an upload before parsing.

#### Returns

`string`[]

***

### fromGrid()

> `static` **fromGrid**(`value`, `opts?`): `Dataset`

Defined in: [package/dataset.js:274](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L274)

#### Parameters

##### value

`any`

##### opts?

#### Returns

`Dataset`

***

### fromRecord()

> `static` **fromRecord**(`record`): `Dataset`

Defined in: [package/dataset.js:1018](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L1018)

Rehydrate a record (recipe or materialized). Structured clone drops prototypes, so this is required.

#### Parameters

##### record

`any`

#### Returns

`Dataset`

***

### fromURL()

> `static` **fromURL**(`url`, `opts?`): `Dataset`

Defined in: [package/dataset.js:201](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L201)

A URI-rooted Dataset. It fetches + decodes into a RasterGrid/VectorFeatures on FORCE — nothing
happens now. Format/kind are inferred from the URL when not given. This is what folds the decoded
Grid/Features back into Dataset: a URL Dataset IS the materialized value, lazily.

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

Defined in: [package/dataset.js:263](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L263)

A JIT fallback invoked at most once, on the first force that finds no reprojector registered —
how the GDAL warp auto-loads with no setup call.

#### Parameters

##### fn

() => `Promise`\<`void`\>

#### Returns

`void`

***

### registerMaterializer()

> `static` **registerMaterializer**(`format`, `fn`): `void`

Defined in: [package/dataset.js:241](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L241)

Register the decoder for a `format` (e.g. 'geotiff', 'nc').

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

Defined in: [package/dataset.js:255](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L255)

Supply the ONE warp implementation `reproject()` forces through.

#### Parameters

##### fn

(`grid`, `toCrs`) => `Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md)\>

#### Returns

`void`

***

### registerResampler()

> `static` **registerResampler**(`fn`): `void`

Defined in: [package/dataset.js:272](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/dataset.js#L272)

Supply a resampler for the methods the pure-JS path doesn't implement (cubic/lanczos/…), which
`resampleTo({ method })` otherwise throws on. Synchronous and pixel-level — GDAL's own richer
methods go through the warp seam instead (see geo/resample.js).

#### Parameters

##### fn

`Function`

#### Returns

`void`
