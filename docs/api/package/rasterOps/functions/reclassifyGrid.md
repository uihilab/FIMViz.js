[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/rasterOps](../README.md) / reclassifyGrid

# Function: reclassifyGrid()

> **reclassifyGrid**(`grid`, `rules`, `opts?`): [`RasterGrid`](../../materialize/classes/RasterGrid.md)

Defined in: [package/rasterOps.js:101](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/rasterOps.js#L101)

Remaps pixel values. `rules` takes one of two forms.

An array of `{ min?, max?, value? }` range rules: a pixel v matches the first rule where
`(min==null||v>=min) && (max==null||v<max)`, and the output is that rule's `value`, or v itself
when it has none, which keeps the band unchanged.

A callback `(value, index) => number|null`: it runs once per valid pixel with the raw value and
the flat row-major index `row*width+col`, and returns the new value directly. It skips rule
matching, so it is not limited to a contiguous range and index-dependent logic works.

Either form returning `null` or `undefined` marks the pixel unmatched, which becomes NaN under
the default `unmatched:'nodata'` or keeps v under `'keep'`. A pixel already NaN or noData stays
transparent and reaches neither a rule nor the callback.

A callback does not survive Dataset.toRecord(), because structured clone cannot carry a function.
That call throws and names the op rather than dropping it silently, so use range rules for a
chain that has to persist and reload.

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

- carries `meta.unmatchedCount` when the default `unmatched: 'nodata'`
  turned previously valid pixels into holes, meaning the rules did not cover this raster's value
  range. Omitted at 0. Dataset's reclassify op reads it to warn.
