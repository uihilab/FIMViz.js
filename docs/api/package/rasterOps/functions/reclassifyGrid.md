[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / reclassifyGrid

# Function: reclassifyGrid()

> **reclassifyGrid**(`grid`, `rules`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:94](https://github.com/uihilab/FIMViz.js/blob/132070e57c5fba6497cf50686eaa685279f6b6d6/src/package/rasterOps.js#L94)

Value remap. `rules` is EITHER an array of `{ min?, max?, value? }` range rules (a pixel v matches
the first rule whose `(min==null||v>=min) && (max==null||v<max)`; the output is `value` when
present, else v — a "keep in range" band) OR a single CALLBACK `(value, index) => number|null` —
called once per valid pixel with its raw value and its flat row-major index (`row*width+col`),
returning the new value directly (bypassing rule-matching entirely, so it isn't limited to a
contiguous range — any per-pixel logic, including index-dependent logic, works). Either form:
`null`/`undefined` means "unmatched" → NaN (`unmatched:'nodata'`, default) or v (`'keep'`).
Existing NaN/noData pixels stay transparent, never passed to a rule or the callback. NOTE: a
callback does NOT survive Dataset.toRecord() (structured-clone can't carry functions) — that call
throws naming the op rather than silently dropping it; use range rules for a chain that needs to
persist/reload.

## Parameters

### grid

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

### rules

`object`[] \| ((`value`, `index`) => `number`)

### opts?

#### unmatched?

`"nodata"` \| `"keep"` = `"nodata"`

## Returns

[`RasterGrid`](../../materialize/classes/RasterGrid.md)

- carries `meta.unmatchedCount` (omitted when 0) when `unmatched: 'nodata'`
  (the default) actually turned some previously-VALID pixels into holes — i.e. the rules/callback
  didn't cover this raster's value range. Dataset's reclassify op reads this to warn.
