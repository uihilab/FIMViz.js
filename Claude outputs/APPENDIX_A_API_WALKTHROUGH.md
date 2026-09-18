# Appendix A. A worked walkthrough of the API

Each listing runs in a browser module against rasters published with the repository, and `BASE`
points at that directory. The Leaflet provider is used throughout because it needs no credentials;
`{ provider: "google", apiKey }` changes nothing else below. Numbers in comments are from one run of
these listings.

```js
import { FimViz, Dataset, ColorScale, RasterGrid, ComparisonLayer } from "fimviz";

const BASE = "https://raw.githubusercontent.com/uihilab/FIMViz.js/main/assets/SampleFiles";
```

## A.1 Initialization, one dataset, one layer

Three calls put a flood raster on a map. `provider` is required and has no default, since the two
backends differ in credentials and in which layer types they draw. `addDataset` accepts a `File`,
`Blob`, `ArrayBuffer`, or URL string, reads the header, and returns a lazy `Dataset`. The decode
happens in `addLayer`, which infers the layer type from `ds.kind`.

```js
const fim   = await FimViz.mount("#map", { provider: "leaflet" });

const depth = await fim.addDataset(`${BASE}/Compare_0-0-DEP-12840.tif`);
depth.crs;              // 'EPSG:4326' — the file's own; parsing never reprojects
depth.isMaterialized;   // false — header read, no pixel decoded

const layer = await fim.addLayer(depth);   // decodes, colorizes, draws
layer.fit();
```

## A.2 Composing ops before anything decodes

Ops compose without reading the source. `Dataset.fromURL` issues no request, each op returns a new
`Dataset`, and the parent is never modified. The chain runs once, at the terminal `grid()`. Only the
parse path applies a file's `GDAL_NODATA` tag, so a URL root takes its sentinel from the host.

```js
const bbox = { north: 34.39, south: 34.35, west: -89.96, east: -89.87 };

const wet = Dataset
  .fromURL(`${BASE}/Compare_0-0-DEP-12840.tif`,
           { format: "geotiff", crs: "EPSG:4326", meta: { noData: -99999 } })
  .clip(bbox)
  .reclassify([{ min: 0.3, max: Infinity, value: 1 }]);   // one unbounded rule = a threshold

wet.isMaterialized;            // false — the chain is a description, not a result
const grid = await wet.grid(); // 793 × 353, EPSG:4326 — fetch, decode, clip, reclassify, once
wet.warnings;                  // 1,594 pixels matched no rule and became no-data
await fim.addLayer(wet);       // the derived node draws like any other Dataset
```

## A.3 Color, the derived legend, and grouped statistics

`layer.set()` is the one writer, and a batch of keys is one write and one repaint. The `Legend` is
derived from the `ColorScale` that colored the pixels, so a legend cannot describe a classification
the map has stopped using. `getStats()` is a single pass over the decoded grid, and `groupBy`
collapses space by a second raster's values.

```js
await layer.set({ palette: "viridis", continuous: true, min: 0, max: 10, opacity: 0.85 });

const legend = layer.getLegend();       // { unit, kind, source, stops } + toHtml()
const stats  = await layer.getStats();
stats.describe();                       // 'mean 3.11, range 0.00–9.60 over 52,264 cells (6.92 km²)'
stats.percentile(95);

const other = await fim.addDataset(`${BASE}/Compare_0-0-DEP-17780.tif`);
const rows  = await depth.groupBy(other, { bins: 4 });
// one row per band of `other`: { class, range, count, sum, min, max, mean, area }
```

## A.4 A multi-dimensional dataset, selected, windowed, and reduced

Gridded products enter through the same `addDataset` call as a single image, and a declared time
dimension becomes a selection axis. This file is one variable of NLDAS-2 (North American Land Data
Assimilation System, phase 2) over Hurricane Idalia, at 120 hourly steps. `select` peels the axis to
one grid, `selectRange` narrows it and returns a series, and `reduce` collapses it. Each is an op, so
the window and the sum compose before anything is fetched twice.

```js
const rain = await fim.addDataset(`${BASE}/idalia-nldas2.nc`);
rain.format;                  // 'netcdf4' — read from the header, not the extension
rain.meta.variable;           // 'Rainf', in kg m-2
rain.axis.name;               // 'time', 120 entries, coords in epoch milliseconds

const hour = rain.select(Date.parse("2023-08-29T12:00:00Z"));   // nearest coordinate
hour.selector;                // { variable: 'Rainf', time: 36 } — same bytes, one slice

const entries = rain.axis.entries;
const day     = rain.selectRange(entries[0].coord, entries[23].coord).reduce("sum");
const total   = await day.grid();   // 104 × 96, the first 24 hours accumulated

await fim.addLayer(day);
```

## A.5 Two extents scored against each other

`ComparisonLayer` aligns N rasters onto a common grid under a stated policy, then scores them when
there are exactly two. `sources[0]` is read as the prediction and `sources[1]` as the observation, so
the order decides false positives against false negatives. The wet mask is host code, because the
scorer counts any pixel that is not the dry sentinel as wet: a depth raster carrying a nodata
sentinel has to become a 0/1 grid with `noData: null` before the contingency table means what it
says.

```js
const wetMask = (g, threshold) => {
  const px = new Uint8Array(g.pixels.length);
  for (let i = 0; i < px.length; i++) {
    const v = g.pixels[i];
    if (Number.isFinite(v) && v !== g.noData && v > threshold) px[i] = 1;
  }
  return new RasterGrid({ pixels: px, width: g.width, height: g.height,
                          bounds: g.bounds, crs: g.crs, noData: null });
};

const cmp = new ComparisonLayer({
  sources: [wetMask(await depth.grid(), 0.3), wetMask(await other.grid(), 0.3)],
});
const { metrics, counts } = cmp.compute({ policy: "low", method: "nearest", dryValue: 0 });

// pc 0.987 · h (POD) 0.822 · f (CSI) 0.822 · b (bias) 0.822 · k (kappa) 0.896 · n 871,168
// counts holds the per-category pixel totals the legend rows key on.
```

A score with a zero denominator returns `null` rather than `0`, and `metricsForMask(polygon)`
re-scores the same aligned pixels inside a region without a second decode.

Every listing above runs unchanged in Node with `FimViz.parseFile(url)` in place of
`fim.addDataset` and no `addLayer` call, which is the headless path of Section 3.5.
