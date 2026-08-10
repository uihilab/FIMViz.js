# FIMViz examples

Six runnable pages, each a standalone HTML file that imports the built bundle through an import map —
no bundler, no framework, no build step of their own. Each page reads top to bottom: an explanation,
the code, and the live result of running it on the same page.

They are meant to be read in order, but nothing depends on that — every page mounts its own map and
loads its own data.

## Running them

```bash
npm run build      # writes dist/fimviz.js and dist/ui.js — the pages import these, not src/
npx serve .        # from the REPO ROOT, not from examples/
```

Then open <http://localhost:3000/examples/01-quickstart.html>.

Three things go wrong most often:

- **Serving `examples/` instead of the repo root.** The pages read `../dist/*` and
  `../assets/SampleFiles/*`; both are above `examples/`, so they 404 and the page looks dead.
- **Forgetting `npm run build` after changing `src/`.** The pages load `dist/`, so source edits are
  invisible until you rebuild.
- **`file://`.** ES modules, `fetch` and IndexedDB all need a real HTTP origin.

## The pages

| Page | What it covers |
|---|---|
| [`01-quickstart.html`](01-quickstart.html) | `mount` → `addDataset` → `addLayer` → `fit`. The ColorScale precedence chain, recolouring through `layer.set`, `getLegend`/`getStats`, a hover readout, a vector layer with the neutral style vocabulary, and teardown. |
| [`02-datasets-and-ops.html`](02-datasets-and-ops.html) | The lazy op chain and its terminals. `clip` · `mask` · `reclassify` (both forms) · terrain · `combine`/`difference` · `zonalStats` · `groupBy` · the ops straight off a Layer · `rasterize` · the CRS precondition and the GDAL warp · the pure grid functions and `Dataset.fromGrid`. Two maps: source and result. |
| [`03-color-and-read-models.html`](03-color-and-read-models.html) | `ColorScale`'s three mutually exclusive modes, `missingColor`, `colorFor`, batched writes. `Legend`, `Stats` over rasters and vectors, and the `Filter` family. **No map** — the picture is `gridToDataURL`. |
| [`04-temporal.html`](04-temporal.html) | NetCDF4 / Zarr / GRIB2 / NetCDF3 through the ordinary `addDataset`. The selection axis, `select`, `selectRange`, `reduce`, the axis slider, what differs per format, and every override the reader takes. |
| [`05-ui-toolkit.html`](05-ui-toolkit.html) | Every `fimviz/ui` export, mounted the way an app would mount it: toast and busy indicator, dropzone, layer panel and click-to-select, tools panel, live legend/stats, tooltip and info window, the four selection tools with their overlay, the operations panel, and the raster-metadata binding. |
| [`06-storage-and-records.html`](06-storage-and-records.html) | `toRecord`/`fromRecord`, why values are stored verbatim, database discovery, rows, `map()` data migration versus structural version bumps, and a full store → rehydrate → force round trip. **No map.** |

## API keys

Every page runs on Leaflet and needs no credentials. `01-quickstart.html` and `05-ui-toolkit.html`
also accept `?provider=google`, which prompts once for a Maps JS API key and keeps it in
`localStorage` — never committed.

`04-temporal.html` additionally maps `sciwrid-toolkit` to `../node_modules/sciwrid-toolkit/dist/index.js`
in its import map. That reader is external to the bundle by design (it loads its own wasm and
workers), so any page opening `.nc`/`.grib2`/`.zarr` needs that entry and nothing else does.

## Automated coverage, and where it stops

`npm test` runs the Node suite over the pure modules, including jsdom coverage of every `fimviz/ui`
export. It cannot see a browser: no `google.maps`, no Leaflet, no canvas, no GDAL WASM. Everything
provider-shaped or pixel-shaped is verified by opening these pages — particularly the things no
headless test can judge: whether the legend ramp is a real gradient, whether the tooltip tracks and
then stops, whether dispatch really stops on absorption, whether modal capture suppresses hover while
you draw, and whether a drag with a selection tool armed pans the map underneath the stroke.

## Sample data

`assets/SampleFiles/` — the pages use:

| File | Used by | Notes |
|---|---|---|
| `4326.tif` | 1, 2, 3, 5 | 1250×769 flood depth, EPSG:4326, 0–9.6 m. Renders with no warp. |
| `Compare_0-0-DEP-12840.tif`, `Compare_0-0-DEP-17780.tif` | 2 | Two scenarios over the same town on identical grids — the band-math pair. |
| `Brazos_RP100_depth.tif` | 2 | EPSG:26914, so it demonstrates the CRS precondition and the GDAL warp. |
| `Iowa_County_Boundaries.json` | 1, 2, 3, 5 | 99 MultiPolygon counties with numeric properties to grade and rasterize. |
| `idalia-nldas2.nc`, `idalia-aorc.zarr.zip`, `idalia-stage4-4h.grb2` | 4 | Hurricane Idalia in three formats, so the reductions are comparable. |
| `sample.nc3` | 4 | Tiny NetCDF3 with real CF coordinates — the header-supplement path. |

`Iowa_city.json`, `cedar_rapids.json` and their siblings are FIM Scenario / HAZUS documents, not
GeoJSON — the neutral parser rejects them by design, and no page uses them.
