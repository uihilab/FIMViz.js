import { FimViz, Dataset, ColorScale, RasterGrid, ComparisonLayer } from "fimviz";

const BASE = "https://raw.githubusercontent.com/uihilab/FIMViz.js/main/assets/SampleFiles";

//

const fim   = await FimViz.mount("#map", { provider: "leaflet" });

const depth = await fim.addDataset(`${BASE}/Compare_0-0-DEP-12840.tif`);
depth.crs;              // 'EPSG:4326' — the file's own; parsing never reprojects
depth.isMaterialized;   // false — header read, no pixel decoded

const layer = await fim.addLayer(depth);   // decodes, colorizes, draws
layer.fit();

//

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

//

await layer.set({ palette: "viridis", continuous: true, min: 0, max: 10, opacity: 0.85 });

const legend = layer.getLegend();       // { unit, kind, source, stops } + toHtml()
const stats  = await layer.getStats();
stats.describe();                       // 'mean 3.11, range 0.00–9.60 over 52,264 cells (6.92 km²)'
stats.percentile(95);

const other = await fim.addDataset(`${BASE}/Compare_0-0-DEP-17780.tif`);
const rows  = await depth.groupBy(other, { bins: 4 });
// one row per band of `other`: { class, range, count, sum, min, max, mean, area }

//

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

//

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
  