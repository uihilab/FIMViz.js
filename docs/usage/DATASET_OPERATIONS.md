# Dataset operations — usage reference

`Dataset` (barrel-exported) is a **lazy, immutable** node in an op-chain: a
ROOT wraps a source (inline bytes/GeoJSON, or a URL); a DERIVED node is a parent + one op. Nothing
decodes/warps/transforms until a **terminal** forces it. Every op returns a **new** Dataset — the
original is never mutated, so one Dataset safely backs many Layers. `kind` is `'raster'` or
`'vector'` — most ops are gated to one kind and **throw immediately** (not at force time) if called
on the wrong kind.

## Contents

[Construction](#construction) · [Kind-agnostic](#kind-agnostic) · [Terminals](#terminals-force-the-chain--nothing-exists-until-one-of-these-runs) ·
[Raster — unary](#raster--unary) · [Raster — binary / N-ary](#raster--binary--n-ary) ·
[Vector](#vector--the-one-kind-changing-op) · [Notes](#notes) ·
[Standalone grid functions](#standalone-grid-functions-no-dataset-needed) ·
[Standalone reproject()](#standalone-reproject-distinct-from-datasetreproject) ·
[Vendored primitives](#vendored-primitives) ·
[GDAL escape hatch (callGdal)](#gdal-escape-hatch-callgdal)

## Construction

```js
new Dataset({ id?, name?, kind?, format?, crs?, bounds?, meta?, data?, url?, axis?, axes? })
// id: auto ("ds_...") · name: defaults to id · kind: 'raster'|'vector'|null
// format: 'geotiff'|'geojson'|'kml'|'kmz'|'shp'|'hazus'|null · crs: native CRS string|null
// bounds: {north,south,east,west}|null · data: ArrayBuffer|Object (inline payload) · url: a URI root
// axis: one DatasetAxis (sugar for axes:[axis]) · axes: DatasetAxis[] (selection-axis series)

Dataset.fromURL(url, { format?, name?, kind?, crs?, bounds?, meta? })
// A lazy URL root — fetches + decodes only on force. format/kind inferred from the URL extension
// when omitted; crs defaults to EPSG:4326 for vector formats, null (unknown) for raster.

Dataset.fromRecord(record)   // rehydrate a toRecord() snapshot (recipe or materialized)

Dataset.fromGrid(value, { name?, format?, meta? })
// A Dataset around an ALREADY-DECODED RasterGrid/VectorFeatures — one you got from ds.grid(),
// computed with the standalone grid functions, or built by hand. Pre-materialized: no fetch, no
// decode, no materializer needed, and load()/grid() return the value you passed in. `kind`/`crs`/
// `bounds` come from the value; `format` stays null, since there are no encoded bytes to claim one.
// This is the way BACK into the op chain, so `ds.grid()` isn't a one-way door.
```

Normally you don't construct directly — `fim.addDataset(file)` / `FimViz.parseFile(source)` parse a
raw File/Blob/ArrayBuffer/URL into a Dataset for you.

## Kind-agnostic


| Method                          | Params                                                                                                    | Returns                                      | Notes                                                                                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select(coord, opts?)`          | `coord: number|string`; `opts.axis=0` (index/name), `opts.nearest=true`, `opts.variant`, `opts.base`      | `Dataset|null`                               | Resolves one axis entry to a child Dataset — URL-rooted, or rooted on this Dataset's own source for an in-file selector ([below](#axis-entries-one-file-per-entry-or-one-file-many-entries)). Only meaningful on a Dataset with `.axes` (a selection-axis series) — a plain parsed file has none. `null` on no match. `opts.variant` required when the entry's `ref` is `{raster, vector}`-shaped. |
| `selectAxisEntry(coord, opts?)` | same `opts` (no `variant`/`base`)                                                                         | `DatasetAxisEntry|null`                      | What `select` looks up before resolving the URL — exact match first, nearest **numeric** coord on a miss (`nearest:true`, default).                                                                                                                         |
| `reduce(op?, opts?)`            | `op: 'sum'|'mean'|'min'|'max'` (default `'mean'`); `opts.axis=0`, `opts.method='nearest'`, `opts.variant` | `Dataset`                                    | Collapse a temporal/vertical axis to one grid — sugar over `select()` every entry + `combine()`. Throws if no axis / empty axis / an entry fails to resolve.                                                                                                |
| `toRecord(opts?)`               | `opts.storeMaterialized=false`                                                                            | `Object`                                     | Structured-cloneable snapshot for `Storage.put()`. Default = source + op recipe (small); `storeMaterialized:true` also embeds the decoded grid/features (call `await ds.load()` first, or it throws).                                                       |
| `toJSON()`                      | —                                                                                                         | `{id,name,kind,format,crs,bounds,meta,axes}` | Metadata view, no heavy `data` payload.                                                                                                                                                                                                                     |
| `download()`                    | —                                                                                                         | `void`                                       | Saves the original bytes to disk. Inline roots only (a URL root has no local bytes yet).                                                                                                                                                                    |




### Axis entries: one file per entry, or one file many entries

An axis entry's `ref` says how to GET that entry's payload, and takes three forms. `select()` and
`reduce()` behave identically across all three — the axis model doesn't care which you built:

```js
// 1. A URL — one file per entry (the FIM Scenario shape: each stage/timestep its own raster).
{ coord: 19.5, ref: 'stage_19p5.tif' }                       // → a URL-rooted child

// 2. Named URL variants — pick one with select(coord, { variant }).
{ coord: 19.5, ref: { raster: 'a.tif', vector: 'a.kmz' } }    // → select(19.5, { variant: 'raster' })

// 3. An IN-FILE selector — the entry is a slice of the SAME source, not a separate download.
{ coord: 6, ref: { select: { variable: 'TMP', t: 1 } } }      // → a child sharing this file's bytes
```

Form 3 is what lets **one multi-dimensional file** (NetCDF/GRIB2/Zarr, every timestep inside it) back a
whole temporal axis. The child shares the parent's bytes or URL — no second fetch — carries the same
`format`, and the selection reaches the decoder as `root.select`:

```js
const child = ds.select(6);      // ds.format 'netcdf4', ds.data the file's bytes
child.selector;                   // → { variable: 'TMP', t: 1 }
child.axes;                       // → null — a child is ONE payload, so it forces like any Dataset
await child.grid();               // materializer receives { kind:'inline', data, select: {…} }
await ds.reduce('mean').grid();   // every entry resolved + reduced — no extra machinery
```

`select`'s `base` applies to URL refs only. A selector ref may also carry `name`/`crs`/`bounds` to
override what the child would otherwise inherit from its parent. Selecting on a Dataset with no source
of its own (no `data`, no `url`) throws — there is nothing to select *from*. Selector children round-trip
through `toRecord()`/`fromRecord()` like any root.

Writing a materializer that understands selectors is one `if`: `root.select` is simply absent for
ordinary sources, so existing decoders are unaffected. See
[APP_STARTUP_ADVANCED.md → Materialize / decode extension seam](./APP_STARTUP_ADVANCED.md#materialize--decode-extension-seam).

### Reading NetCDF / GRIB2 / Zarr (`parseSciwrid`)

The concrete producer of selector axes — multi-dimensional scientific formats, via
[SciWrid Toolkit](https://github.com/uihilab/SciWrid-Toolkit). **Opt-in and not on the barrel**: the
engine never imports it, so the ~193 KB wasm stays out of every other consumer's bundle.

Tested end-to-end on **NetCDF4**, **GRIB2** and **Zarr v2** (`netcdf3` is registered but not yet
exercised). One call covers all of them — the differences between formats live inside the adapter:
GRIB2 reports `nx`/`ny` instead of a `shape`, Zarr reports `shape` as an array rather than a string.

```js
import { parseSciwrid } from 'fimviz/src/io/sciwrid.js';

const ds = await parseSciwrid(file);              // scan() only — nothing decoded
ds.axis.entries.length;                            // 120 timesteps
ds.meta.grid;                                      // { width, height, bbox, bounds } — the file's NATIVE grid
ds.meta.unit;                                      // 'kg m-2'

const t = ds.select(Date.parse('2023-08-28T06:00:00Z'));   // → one grid, lazily, off the same bytes
await fim.addLayer(t);                                       // renders like any raster (already EPSG:4326)

await ds.reduce('mean').grid();    // temporal mean over the whole axis
await ds.reduce('max').grid();     // …or the storm peak
```

| Option | Notes |
|---|---|
| `variable` | which variable; defaults to the first `supported` one. **One variable per Dataset** — call it again for another. |
| `grid` | **Partial** override of the native grid — anything omitted comes from the variable's own shape and `scan().bbox`. Pass `width`/`height` alone to decode coarser than native; pass `bbox` alone when the file's extent can't be derived (below). |
| `workers` | `extractGrid`'s worker count. Defaults to SciWrid's own in a browser, and to `0` under Node, where the worker pool never resolves. |
| `name` / `resolveUrl` | as elsewhere. |

**Axis coordinates are epoch milliseconds**, not ISO strings — `select()`'s nearest-match is
numeric-only, and that is what a time slider needs. The ISO timestamp is on each entry's `meta.time`,
so `ds.selectAxisEntry(Date.parse(iso)).meta.time` reads it back.

No GDAL is involved: `extractGrid` resamples onto a geographic bbox, so these arrive as `EPSG:4326`
and render directly. Missing values arrive as `NaN`, which colorize and `Stats` already treat as
absent. Rehydrating a stored selector Dataset skips the parser, so call `registerSciwridFormats()`
once at boot before `Dataset.fromRecord`.

#### "has no usable geographic extent"

A common failure on real-world files, and a recoverable one. It happens for two different reasons,
and the message says which:

- **No bbox was derived.** `scan()` reads **1-D** coordinate variables only, so a **curvilinear** grid
  (2-D `lat(j,i)`/`lon(j,i)` — ocean `tos` products, NEMO, tripolar and polar-stereographic grids like
  NCEP Stage IV) or a **Zarr store with no CF coordinates** yields nothing to place the data with.
- **A bbox was derived and rejected.** `scan()`'s matcher accepts variables *named* `x`/`y`, so a
  **projected** file (HRRR, RAP, NAM, WRF) reports its extent in **metres** — e.g.
  `[-2699020, -1588806, 2697980, 1588806]`. That is checked as degrees (`|lat| ≤ 90`, `|lon| ≤ 360`)
  and refused, because placing it would be silently wrong rather than loudly broken.

> **Not caught:** a **rotated-pole** grid (CORDEX/COSMO, `rlat`/`rlon`) reports plausible small
> degree-like numbers that are not geographic. Detecting it needs the `grid_mapping` attribute, which
> `scan()` does not expose — so such a file will render in the wrong place without complaint. See
> [PACKAGE_ROADMAP.md §8.1](../PACKAGE_ROADMAP.md#81-which-grids-we-actually-support-scope-and-the-silent-failure-guard).

The pixels are perfectly readable; only the *extent* is unknown, so nothing can place them on a map.
FIMViz will not guess one — a wrong extent silently puts every pixel in the wrong place, which is the
same failure the CRS precondition exists to prevent. Supply it instead:

```js
await parseSciwrid(file, { grid: { bbox: [-180, -90, 180, 90] } });   // width/height stay native
```

The thrown error names the variable, its shape, and the variables present, so you can tell which case
you are in. `examples/temporal-netcdf.html` has an "extent override" box that does exactly this.

## Terminals (force the chain — nothing exists until one of these runs)


| Method                | Returns                       | Notes                                                                                                   |
| --------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `await ds.load()`     | `RasterGrid | VectorFeatures` | Decodes the root (or forces the parent + applies this node's op), **memoized** — repeat calls are free. |
| `await ds.grid()`     | `RasterGrid`                  | `load()` + assert raster; throws if this Dataset is vector.                                             |
| `await ds.features()` | `VectorFeatures`              | `load()` + assert vector; throws if this Dataset is raster. **Iterable** — see below.                   |
| `ds.release()`        | `void`                        | Evicts the memoized result (not async).                                                                 |
| `ds.isMaterialized`   | `boolean` (getter)            | Has this exact node been forced yet.                                                                    |
| `ds.warnings`         | `string[]` (getter)           | Collected at force time (e.g. "reprojected X→Y", "resampled onto...") — empty until forced.             |




### Reading the features out of `VectorFeatures`

A decoder may hand back a FeatureCollection, a lone Feature, or a bare array, so `.features` is
whatever the format produced. Iterate the wrapper instead and the shape stops mattering:

```js
const vf = await ds.features();

for (const feature of vf) console.log(feature.properties);   // iterable
vf.toArray();      // Feature[] in document order — normalized from all three payload shapes
vf.count;          // how many features
vf.features;       // the raw payload, if you specifically want the GeoJSON object as decoded
vf.bounds; vf.crs; // the frame it was decoded in
```

## Raster — unary

All throw `"<op>: raster-only op"` if called on a vector Dataset.


| Method                                           | Params                                                                                                                                                                               | Notes                                                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reproject(toCrs)`                               | `toCrs: string` (required, `"EPSG:<code>"` — validated + case-normalized)                                                                                                            | Lazy CRS warp. Same-CRS request (case-insensitive) → no-op, returns `this`. The actual GDAL warp runs on force, JIT-loaded automatically — see [COLOR_SCALE.md](./COLOR_SCALE.md)-adjacent reprojector note, or just call it; no setup needed. Works on a plain source, a reproject-only chain (reuses the original file's bytes — cheap), **and** on a node derived via `combine`/`clip`/`mask`/`reclassify`/`resample`/`rasterize` (the actually-computed grid is encoded to a fresh GeoTIFF and warped directly — see `geo/gdal.js`'s `warpGrid`/`encodeGridAsGeoTiff` — rather than silently re-warping the untouched original file). |
| `clip(bbox)`                                     | `bbox: {north,south,east,west}` (required)                                                                                                                                           | Crop to overlap, snapped to pixel edges.                                                                                                                                                                                    |
| `mask(polygon, opts?)`                           | `polygon`: `SpatialFilter` or a ring/multi-ring of `{lat,lng}`|`[lat,lng]`; `opts.invert=false`                                                                                      | Pixels outside the polygon → transparent (or inside, with `invert:true`). Footprint unchanged.                                                                                                                              |
| `reclassify(rules, opts?)`                       | `rules: [{min?,max?,value?}]` (non-empty) **or** `(value, index) => number\|null\|undefined` (required either way); `opts.unmatched='nodata'|'keep'`                                                                                                | Remap pixel values. The **rules-array** form is first-match-wins (unbounded `{min:-Infinity,max:Infinity,value:v}` maps every valid pixel to one constant, e.g. a single-color silhouette; a range with no `value` = "keep in range" band). The **callback** form is called once per valid pixel with its raw value and its flat row-major index (`row*width+col`), returning the new value directly — not limited to a contiguous range (any per-pixel or index-dependent logic), and cheaper than the rules form once you need more than a couple of ranges (one call per pixel instead of a per-rule scan). Either form: `null`/`undefined` (or no rule match) → unmatched. Existing noData/NaN pixels are never passed to a rule or the callback — shape/footprint is always preserved. On force, a pixel that matched no rule/returned nullish becomes noData under the default `unmatched:'nodata'` — if that actually happened (a real hole, not pre-existing noData), it's reported on `ds.warnings` naming how many pixels, so incomplete coverage doesn't silently punch holes. A callback does NOT survive `toRecord()` (functions can't structured-clone) — use range rules for a chain you need to persist. |
| `resampleTo(target, opts?)`                      | `target`: `{width,height,bw,bs,be,bn}` **or** grid-shaped `{width,height,bounds:{north,south,east,west}}` (e.g. another Dataset's `.grid()`); `opts.method='nearest'`, `opts.noData` | Resample onto an explicit target grid. `crs` unchanged (resamples, doesn't reproject). GDAL-only methods (`cubic`/`lanczos`/...) need `Dataset.registerResampler` or force throws.                                                  |
| `slope(opts?)`                                   | `opts.zFactor`, `opts.cellsizeX`, `opts.cellsizeY`, `opts.unit='degrees'|'percent'`                                                                                                  | Horn's method, pure JS, no GDAL.                                                                                                                                                                                            |
| `aspect()`                                       | —                                                                                                                                                                                    | Downslope compass bearing, Horn's method.                                                                                                                                                                                   |
| `hillshade(opts?)`                               | `opts.altitude`, `opts.azimuth`, `opts.zFactor`, `opts.cellsizeX`, `opts.cellsizeY`                                                                                                  | Shaded-relief illumination.                                                                                                                                                                                                 |
| `zonalStats(zones, opts?)` — **terminal, async** | `zones: [{id?,polygon?,filter?}]`; `opts.noData`                                                                                                                                     | Returns data (an array), not a Dataset. Forces the grid.                                                                                                                                                                    |




## Raster — binary / N-ary


| Method                   | Params                                                                                                                         | Notes                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `combine(others, opts?)` | `others: Dataset | Dataset[]` (required, ≥1); `opts.op='difference'|'ratio'|'sum'|'mean'|'min'|'max'`, `opts.method='nearest'` | Band math, **LHS-conform** (every other input resampled onto *this* grid). `difference`/`ratio` are strictly binary (this + 1 other); `sum`/`mean`/`min`/`max` are N-ary (this + many). |
| `difference(other)`      | `other: Dataset`                                                                                                               | Sugar for `combine([other], {op:'difference'})`.                                                                                                                                        |


```js
ds128.combine(ds177, { op: 'difference' });        // ds128 − ds177
ds128.combine([ds177, ds3], { op: 'mean' });        // N-ary
ds128.difference(ds177);                            // same as combine(..., {op:'difference'})
```



## Vector — the one kind-changing op


| Method            | Params                                                                                                                                                                                                            | Notes                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `rasterize(opts)` | `opts.width`, `opts.height` (required); `opts.bounds` (defaults to the Dataset's own footprint — throws if neither is available); `opts.field` (burn a feature property; omit for a constant); `opts.burnValue=1` | Vector → raster. Throws `"vector-only op"` on a raster Dataset. |




## Notes

- **Kind gating throws immediately** at op-build time (not on force) — a mistake is caught the moment you call the wrong op, not several awaits later.'
- **Op-chain replay**: every op above also has a matching case in `Dataset.fromRecord`'s internal replay, so a `toRecord()`'d chain round-trips through `Storage` and rebuilds identically via `fromRecord()`.
- **Sharing**: a "hot-modify" (e.g. via a `Layer.deriveSources`) that changes only the tail op reuses the shared parent's memoized decode — cheap compared to a cold new chain.
- **Across maps**: a Dataset has no back-pointer to a map, so one instance can back Layers on several maps (even of different providers) at once, decoded once. The registry and the reference count live on the **app** (`app.datasets`), so a Layer removed on one map never evicts a decode another map is still rendering.



## Standalone grid functions (no Dataset needed)

Every raster `Dataset` op above is a thin lazy wrapper over a **pure, directly-callable function** on
an already-decoded `RasterGrid` — barrel-exported, so if you already have a grid (e.g. from
`await ds.grid()`, or built by hand), you can call these without a `Dataset` at all. Same signatures
as the `Dataset` methods, minus the laziness — each takes a `RasterGrid` first and returns a new one:

Finished with a grid and want the op chain back? `Dataset.fromGrid(grid)` wraps it (above).

```js
maskGrid(grid, polygon, opts?)          // opts: { invert? }
clipGrid(grid, bbox)
reclassifyGrid(grid, rules, opts?)      // opts: { unmatched? }
combineGrids(grids, opts?)               // grids: RasterGrid[]; opts: { op?, method? }
zonalStats(grid, zones, opts?)          // → data, not a RasterGrid
slopeGrid(grid, opts?)
aspectGrid(grid)
hillshadeGrid(grid, opts?)
rasterizeFeatures(featureCollection, bounds, opts)   // opts: { width, height, field?, burnValue? }
```

Resample/align (`geo/resample.js`, also barrel-exported):

```js
GRID_POLICY                 // { LOW, HIGH, AVERAGE } — target-resolution policy
RESAMPLE_METHODS             // ['nearest','bilinear','average', 'cubic','cubicspline','lanczos','mode','min','max','med','q1','q3']
resolveTargetGrid(metas, policy)          // metas: [{width,height,bw,bs,be,bn}, ...] → the common target grid
resampleGrid(pixels, srcMeta, dstMeta, opts?)   // opts: { method?, noData? }
alignRasters(rasters, opts?)              // rasters: [{pixels,meta}, ...] → { grid, rasters: [{pixels,meta}, ...] }
Dataset.registerResampler(fn)   // the escape hatch for cubic/lanczos/etc. — nothing registered by default
```

Colorize (`package/rasterImage.js`, also barrel-exported — see [COLOR_SCALE.md](./COLOR_SCALE.md) for
the `ColorScale` side of this):

```js
colorizeGrid(grid, opts?)     // opts: { colorScale?, alpha?, skipZero?, noData? } → Uint8ClampedArray RGBA
gridToDataURL(grid, opts?)    // colorizeGrid + canvas encode → a PNG data URL
```



## Standalone `warp()` (the EAGER twin of `Dataset.reproject()`)

```js
import { warp } from 'fimviz';   // geo/warp.js — NOT the same as ds.reproject(toCrs)

const warped = await warp(ds, toCrs);   // async — warps immediately, returns a NEW Dataset
```

`Dataset.reproject(toCrs)` (documented above) is **lazy** — it builds an op node, and the warp only
runs when something forces the chain. This standalone `warp(ds, toCrs)` is the **eager**
equivalent — it warps immediately and returns a new, already-reprojected `Dataset` (still rasters
only; same-CRS request returns `ds` unchanged, no copy). Both dispatch to the same GDAL warp
underneath; pick the lazy method for a chain you're building up before rendering, or this function
when you want the result right away.

## Vendored primitives

Re-exported so the engine stays the single owner of these third-party dependencies — a host never
imports `geotiff`/`@tmcw/togeojson`/`shpjs`/`@googlemaps/js-api-loader` directly:

```js
fromArrayBuffer   // geotiff's buffer → GeoTIFF image accessor (pixel-level access beyond parseFile)
kml               // @tmcw/togeojson's KML XML DOM → GeoJSON
shp               // shpjs's zipped shapefile buffer → GeoJSON
Loader            // @googlemaps/js-api-loader's script loader class
```



## GDAL escape hatch (`callGdal`)

`Dataset.reproject`/`resampleTo` (above) cover the one GDAL utility (`gdalwarp`) most callers need.
For anything else gdal3.js offers — `gdal_translate`, `gdal_rasterize`, `ogr2ogr`, `gdalinfo`,
`ogrinfo`, `gdaltransform`, or `gdalwarp` options those two don't expose — `callGdal(method, ...params)` dispatches to **any** method on the gdal3.js instance by name, passing your params
through verbatim. No fimviz-specific wrapper exists (or is needed) per GDAL utility:

```js
import { callGdal } from 'fimviz';

const file = new File([arrayBuffer], 'in.tif', { type: 'image/tiff' });
const { datasets } = await callGdal('open', file);
const outPath = await callGdal('gdal_translate', datasets[0],
  ['-of', 'GTiff', '-outsize', '50%', '50%'], 'out.tif');
await callGdal('close', datasets[0]);
const bytes = await callGdal('getFileBytes', outPath);   // Uint8Array
```

gdal3.js's methods fall into a few parameter shapes (see its own `index.d.ts` for exact
signatures): **lifecycle** — `open(fileOrFiles, options?, VFSHandlers?)` → `{datasets, errors}`,
`close(dataset)`, `getFileBytes(path)`, `getOutputFiles()`, `getInfo(dataset)`; **dataset-based
utilities**, output written to gdal3.js's virtual FS — `gdalwarp`/`gdal_translate`/
`gdal_rasterize`/`ogr2ogr(dataset, options?, outputName?)`; **info-only**, no output file —
`gdalinfo`/`ogrinfo(dataset, options?)`; **no dataset at all** — `gdaltransform(coords, options)`.
An unknown method name throws immediately, listing every real method available.

`callGdal` dynamically imports `geo/gdal.js` (→ gdal3.js, ~38 MB wasm) on first call — never just
from importing the `fimviz` barrel, so a consumer who never calls it pays nothing for GDAL, same as
the reproject seam. Browser-only (gdal3.js's Emscripten loader fails in Node), so — like `reproject`
and the warp path generally — this isn't covered by `npm test`; verify it by exercising the site or
an example page.

`callGdal` is deliberately raw — it dispatches by method name but leaves the whole open/run/close/
read-bytes lifecycle to the caller, spelled out in full above. For `gdalwarp` specifically, `warpTo`
and `warpToGrid` already hide that ceremony.