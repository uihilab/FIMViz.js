[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/sciwrid](../README.md) / parseSciwrid

# Function: parseSciwrid()

> **parseSciwrid**(`source`, `opts?`): `Promise`\<[`Dataset`](../../../package/dataset/classes/Dataset.md)\>

Defined in: [io/sciwrid.js:491](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/io/sciwrid.js#L491)

Read a multi-dimensional scientific file into a `Dataset` with a real temporal axis. This is the
implementation behind `FimViz.parseFile`/`fim.addDataset` for `.nc`/`.grib2`/`.zarr` — **use those**;
this export exists for the composition root and tests, exactly like `parseSource`. Every option
documented below is passed straight through from them.

Nothing is decoded here — `scan()` reads metadata only, and the returned Dataset is a lazy series.
Each axis entry is an **in-file selector** (`ref: { select: { variable, time } }`), so selecting a
timestep costs no second fetch: the child shares this Dataset's bytes and decodes one slice on
force. Every op, `Stats`, `ColorScale` and `RasterLayer` then work on it unchanged.

```js
const ds = await fim.addDataset(file);         // a 120-step NetCDF4 → a time axis
const t  = ds.select(Date.parse('2023-08-28T06:00:00Z'));   // → one grid, lazily
await fim.addLayer(t);
await ds.reduce('mean').grid();                 // temporal mean over the whole axis
```

**Axis coordinates are numbers**, not ISO strings, so `select()`'s nearest-match works (it is
numeric-only) — which is what a time slider needs. Epoch milliseconds (`axis.unit === 'ms'`) when the
file carries CF times or the caller supplies dates; plain **positions** (`'index'`) when the file
declares a leading dimension but no labels for it, which is the NetCDF3 case. The original label is
kept on each entry's `meta.time`. This deliberately differs from the WaterML/NWIS adapter's string
coords, where exact match was acceptable because `latest()` covered the common case.

One variable per Dataset: call it once per variable you want. (Folding variable in as a second axis
is roadmapped — §8 — but a variable axis cannot be `reduce()`d meaningfully, so it needs a guard
this first slice does not yet have.)

## Parameters

### source

`string` \| `ArrayBuffer` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `Blob` \| `File` \| `URL`

### opts?

#### allowExtraDims?

`boolean`

proceed with a variable carrying dimensions beyond
  (lat, lon) + the series axis — a vertical level, ensemble member or band. Off by default: the
  reader collapses them with no say from the caller, so this is an acknowledgement, not a fix.
  Recorded on `meta.extraDims`

#### dims?

\{ `order?`: `"yx"` \| `"xy"`; \}

which trailing pair of the shape is (lat, lon). `'yx'`
  (CF order, the default) or `'xy'` for a variable declared (…, lon, lat). Decides native
  height/width only — `extractGrid` resamples onto whatever is requested

#### dims.order?

`"yx"` \| `"xy"`

#### grid?

\{ `bbox?`: `number`[]; `height?`: `number`; `width?`: `number`; \}

PARTIAL override of the
  native grid; anything omitted comes from the variable's own shape / `scan().bbox`. Pass `bbox`
  alone for a file whose extent scan() could not derive (2-D curvilinear coordinates — ocean
  `tos`-style products, rotated poles, Zarr with no CF coords); pass `width`/`height` alone to
  decode coarser than native

#### grid.bbox?

`number`[]

#### grid.height?

`number`

#### grid.width?

`number`

#### lon?

`"native"` \| `"-180..180"` \| `"0..360"`

re-express the extent in a longitude
  convention. A global grid is genuinely **rolled** (the reader cannot do this — asking it for a
  shifted bbox returns the same pixels relabelled); a regional extent a whole turn away is
  relabelled with no pixel work; anything else throws rather than splitting the grid

#### name?

`string`

Dataset name; defaults to the filename/URL tail

#### resolveUrl?

(`url`) => `string`

host CORS-proxy/mirror, applied at force time

#### series?

`false` \| \{ `coords?`: `Function` \| (`string` \| `number` \| `Date`)[]; `length?`: `number`; `name?`: `string`; `unit?`: `string`; \}

the series (time) axis. Omit for the default: the file's CF times
  when it has them, otherwise integer indices over its leading dimension. `false` forces a single
  grid. `coords` is an array of one coordinate per step, or a generator `(i, n) => coord`; ISO
  strings and `Date`s become epoch ms, so an unlabelled file gains a REAL time axis —
  `{ series: { coords: i => new Date(Date.UTC(2001, i, 1)) } }`. `length` caps the step count
  (default: the leading dimension), `name` defaults to `'time'`, and `unit` defaults to `'ms'` for
  dates or `'index'` for synthesized positions

#### variable?

`string`

which variable; defaults to the first `supported` one

#### workers?

`number`

extractGrid's worker count; defaults to SciWrid's own in a browser
  and to `0` (inline) under Node, where the worker pool never resolves

## Returns

`Promise`\<[`Dataset`](../../../package/dataset/classes/Dataset.md)\>
