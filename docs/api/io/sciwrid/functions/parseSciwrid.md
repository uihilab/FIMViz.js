[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/sciwrid](../README.md) / parseSciwrid

# Function: parseSciwrid()

> **parseSciwrid**(`source`, `opts?`): `Promise`\<[`Dataset`](../../../package/dataset/classes/Dataset.md)\>

Defined in: [io/sciwrid.js:273](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/io/sciwrid.js#L273)

Read a multi-dimensional scientific file into a `Dataset` with a real temporal axis.

Nothing is decoded here — `scan()` reads metadata only, and the returned Dataset is a lazy series.
Each axis entry is an **in-file selector** (`ref: { select: { variable, time } }`), so selecting a
timestep costs no second fetch: the child shares this Dataset's bytes and decodes one slice on
force. Every op, `Stats`, `ColorScale` and `RasterLayer` then work on it unchanged.

```js
const ds = await parseSciwrid(file);           // a 120-step NetCDF4 → a time axis
const t  = ds.select(Date.parse('2023-08-28T06:00:00Z'));   // → one grid, lazily
await fim.addLayer(t);
await ds.reduce('mean').grid();                 // temporal mean over the whole axis
```

**Axis coordinates are epoch milliseconds**, not ISO strings, so `select()`'s nearest-match works
(it is numeric-only) — which is what a time slider needs. The ISO string is kept on each entry's
`meta.time`. This deliberately differs from the WaterML/NWIS adapter's string coords, where exact
match was acceptable because `latest()` covered the common case.

One variable per Dataset: call it once per variable you want. (Folding variable in as a second axis
is roadmapped — §8 — but a variable axis cannot be `reduce()`d meaningfully, so it needs a guard
this first slice does not yet have.)

## Parameters

### source

`string` \| `ArrayBuffer` \| `ArrayBufferView`\<`ArrayBufferLike`\> \| `File` \| `Blob` \| `URL`

### opts?

#### allowExtraDims?

`boolean`

proceed with a variable carrying dimensions beyond
  (lat, lon) + time — a vertical level, ensemble member or band. Off by default: the reader collapses
  them with no say from the caller, so this is an acknowledgement, not a fix. Recorded on
  `meta.extraDims`

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

#### name?

`string`

Dataset name; defaults to the filename/URL tail

#### resolveUrl?

(`url`) => `string`

host CORS-proxy/mirror, applied at force time

#### variable?

`string`

which variable; defaults to the first `supported` one

#### workers?

`number`

extractGrid's worker count; defaults to SciWrid's own in a browser
  and to `0` (inline) under Node, where the worker pool never resolves

## Returns

`Promise`\<[`Dataset`](../../../package/dataset/classes/Dataset.md)\>
