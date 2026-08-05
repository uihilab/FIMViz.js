[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/dataset](../README.md) / Dataset

# Class: Dataset

Defined in: [package/dataset.js:113](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L113)

## Constructors

### Constructor

> **new Dataset**(`init?`): `Dataset`

Defined in: [package/dataset.js:146](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L146)

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

Defined in: [package/dataset.js:160](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L160)

***

### crs

> **crs**: `string`

Defined in: [package/dataset.js:153](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L153)

***

### data

> **data**: `any`

Defined in: [package/dataset.js:156](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L156)

***

### format

> **format**: `"geotiff"` \| `"geojson"` \| `"kml"` \| `"kmz"` \| `"shp"` \| `"hazus"`

Defined in: [package/dataset.js:152](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L152)

***

### id

> **id**: `string`

Defined in: [package/dataset.js:149](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L149)

***

### kind

> **kind**: `"raster"` \| `"vector"`

Defined in: [package/dataset.js:151](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L151)

***

### name

> **name**: `string`

Defined in: [package/dataset.js:150](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L150)

## Accessors

### axis

#### Get Signature

> **get** **axis**(): [`DatasetAxis`](../interfaces/DatasetAxis.md)

Defined in: [package/dataset.js:289](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L289)

The primary (first) selection axis, or null.

##### Returns

[`DatasetAxis`](../interfaces/DatasetAxis.md)

***

### bounds

#### Get Signature

> **get** **bounds**(): [`DatasetBounds`](../interfaces/DatasetBounds.md)

Defined in: [package/dataset.js:278](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L278)

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

Defined in: [package/dataset.js:295](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L295)

Has this node been forced (decoded/warped) yet?

##### Returns

`boolean`

***

### meta

#### Get Signature

> **get** **meta**(): `any`

Defined in: [package/dataset.js:286](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L286)

Free-form metadata (GDAL legend/unit/noData, …). Same self-updating rule as `bounds`: once forced,
reads off the memoized result — which matters for raster ops like `reproject` whose reprojector
refreshes dimension fields (`width`/`height`) that the pre-force value can't know.

##### Returns

`any`

***

### selector

#### Get Signature

> **get** **selector**(): `any`

Defined in: [package/dataset.js:589](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L589)

The in-file selection this Dataset forces with, or null.

##### Returns

`any`

***

### warnings

#### Get Signature

> **get** **warnings**(): `string`[]

Defined in: [package/dataset.js:292](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L292)

Warnings collected when this node was forced (implicit reprojection, defaults, …).

##### Returns

`string`[]

## Methods

### aspect()

> **aspect**(): `Dataset`

Defined in: [package/dataset.js:462](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L462)

Aspect — the downslope compass bearing via Horn's method (rasterOps.aspectGrid). Lazy.

#### Returns

`Dataset`

***

### clip()

> **clip**(`bbox`): `Dataset`

Defined in: [package/dataset.js:362](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L362)

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

Defined in: [package/dataset.js:402](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L402)

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

Defined in: [package/dataset.js:410](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L410)

Sugar: this − other, per pixel (LHS-conform).

#### Parameters

##### other

`Dataset`

#### Returns

`Dataset`

***

### download()

> **download**(): `void`

Defined in: [package/dataset.js:876](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L876)

Save the original bytes/content to disk. Inline roots only (a URL root has no local bytes yet).
`document` is ambient, so this costs nothing in the import graph.

#### Returns

`void`

***

### features()

> **features**(): `Promise`\<[`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

Defined in: [package/dataset.js:637](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L637)

Force + assert vector.

#### Returns

`Promise`\<[`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

***

### grid()

> **grid**(): `Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md)\>

Defined in: [package/dataset.js:630](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L630)

Force + assert raster.

#### Returns

`Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md)\>

***

### hillshade()

> **hillshade**(`opts?`): `Dataset`

Defined in: [package/dataset.js:472](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L472)

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

Defined in: [package/dataset.js:623](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L623)

Force this node: decode/fetch the root (or force the parent and apply this op), memoize, return the
decoded RasterGrid | VectorFeatures. Repeated calls reuse the memoized result.

#### Returns

`Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md) \| [`VectorFeatures`](../../materialize/classes/VectorFeatures.md)\>

***

### mask()

> **mask**(`polygon`, `opts?`): `Dataset`

Defined in: [package/dataset.js:351](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L351)

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

Defined in: [package/dataset.js:485](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L485)

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

Defined in: [package/dataset.js:386](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L386)

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

Defined in: [package/dataset.js:505](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L505)

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

Defined in: [package/dataset.js:644](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L644)

Drop the memoized decode (evictable cache — the slider's stale-load guard calls this).

#### Returns

`void`

***

### reproject()

> **reproject**(`toCrs`): `Dataset`

Defined in: [package/dataset.js:306](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L306)

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

Defined in: [package/dataset.js:426](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L426)

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

Defined in: [package/dataset.js:552](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L552)

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

Defined in: [package/dataset.js:600](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L600)

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

### slope()

> **slope**(`opts?`): `Dataset`

Defined in: [package/dataset.js:453](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L453)

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

Defined in: [package/dataset.js:894](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L894)

Metadata view (without the heavy `data` payload). Axes are lightweight (URLs), so they stay.

#### Returns

`any`

***

### toRecord()

> **toRecord**(`opts?`): `any`

Defined in: [package/dataset.js:797](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L797)

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

### zonalStats()

> **zonalStats**(`zones`, `opts?`): `Promise`\<`any`[]\>

Defined in: [package/dataset.js:442](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L442)

Zonal statistics — per-zone min/max/mean/sum/count/area over this raster. A TERMINAL (forces the
grid); returns data, not a Dataset.

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

Defined in: [package/dataset.js:225](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L225)

Every format that can be decoded right now — built-ins plus anything registered. Build a file
picker's `accept` list from it, or check an upload before parsing.

#### Returns

`string`[]

***

### fromGrid()

> `static` **fromGrid**(`value`, `opts?`): `Dataset`

Defined in: [package/dataset.js:251](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L251)

#### Parameters

##### value

`any`

##### opts?

#### Returns

`Dataset`

***

### fromRecord()

> `static` **fromRecord**(`record`): `Dataset`

Defined in: [package/dataset.js:831](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L831)

Rehydrate a record (recipe or materialized). Structured clone drops prototypes, so this is required.

#### Parameters

##### record

`any`

#### Returns

`Dataset`

***

### fromURL()

> `static` **fromURL**(`url`, `opts?`): `Dataset`

Defined in: [package/dataset.js:178](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L178)

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

Defined in: [package/dataset.js:240](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L240)

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

Defined in: [package/dataset.js:218](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L218)

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

Defined in: [package/dataset.js:232](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L232)

Supply the ONE warp implementation `reproject()` forces through.

#### Parameters

##### fn

(`grid`, `toCrs`) => `Promise`\<[`RasterGrid`](../../materialize/classes/RasterGrid.md)\>

#### Returns

`void`

***

### registerResampler()

> `static` **registerResampler**(`fn`): `void`

Defined in: [package/dataset.js:249](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/dataset.js#L249)

Supply a resampler for the methods the pure-JS path doesn't implement (cubic/lanczos/…), which
`resampleTo({ method })` otherwise throws on. Synchronous and pixel-level — GDAL's own richer
methods go through the warp seam instead (see geo/resample.js).

#### Parameters

##### fn

`Function`

#### Returns

`void`
