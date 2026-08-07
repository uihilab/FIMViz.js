# FIMViz examples

Runnable demo pages for the `fimviz` package. Each is a standalone HTML file that imports the built
bundle through an import map — no bundler, no framework, no build step of their own.

## Running them

```bash
npm run build      # writes dist/fimviz.js and dist/ui.js — the pages import these, not src/
npx serve .        # from the REPO ROOT, not from examples/
```

Then open <http://localhost:3000/examples/>.

Two things go wrong most often:

- **Serving `examples/` instead of the repo root.** The pages read `../dist/*` and
  `../assets/SampleFiles/*`; both are above `examples/`, so they 404 and the page looks dead.
- **Forgetting `npm run build` after changing `src/`.** The pages load `dist/`, so source edits are
  invisible until you rebuild.
- **Opening a `.nc`/`.grib2`/`.zarr` from a page with no `sciwrid-toolkit` import-map entry.** That
  reader is external to the bundle by design (it must load its own wasm and workers), so a page that
  wants those formats maps it to `../node_modules/sciwrid-toolkit/dist/index.js` — see the import map
  in `temporal-netcdf.html` or `console-test.html`. Nothing else needs it.

`file://` will not work: ES modules, `fetch`, and IndexedDB all need a real HTTP origin.

## API keys

Leaflet pages need nothing. Google pages need a Maps JS API key that you supply — never committed:

- `verify.html` and `ui-tools.html` — both take `?provider=google` and prompt once for the key, keeping it in `localStorage`. Without that parameter they run on Leaflet and need nothing.
- `test2.html` — reads `?apiKey=…` from the URL, and skips the Google half cleanly without one.

## Which page to open

| Page | What it is for |
|---|---|
| **`verify.html`** | **Guided manual verification.** Ten numbered steps, each with instructions, expected results, and Pass/Fail capture. Start here when checking a change. |
| `ui-tools.html` | Every `fimviz/ui` component mounted the way an app would mount them — layer panel, click-to-select, tools + operations panels, legend/stats, hover, feature info, and all four selection tools (polygon / rectangle / freehand / brush). Exhaustive per-method coverage lives in `test/ui.dom.test.mjs` instead. |
| `temporal-netcdf.html` | NetCDF4 / Zarr / GRIB2 through the ordinary `addDataset`: a time axis scrubbed by `createAxisSlider`, and `reduce()` over the whole axis. |
| `dataset-layer.html` | The `Dataset → Layer` pipeline against a tiny in-page demo provider (no real map). |
| `method-playground.html` | Every public method called once with sample parameters. A scratch bench, not a test. |
| `reproject.html` | `Dataset.reproject(crs)` — the GDAL WASM warp, forced only at a terminal. No map. |
| `scenario.html`, `test2.html` | The same `Dataset` rendered on Google and Leaflet, side by side. |
| `console-test.html` | A console scratch bench: every export as a global, plus a `createDropzone` that parks parsed Datasets on `FIM.dropped`. |
| `api-test.esm.html`, `esm.html`, `test.html` | Import-surface and boot smoke pages. |
| `depth-events.html` | The engine→host `busy` event seam from a host with none of FIMViz's markup. |

## `verify.html` — the guided pass

The one page written to be *worked through* rather than read. Each step states what to do and what
you should see; you mark Pass, Fail, or Skip, and "Copy report" puts a Markdown table on your
clipboard. Verdicts persist in `localStorage` per provider, so you can run the Leaflet pass, switch
to `?provider=google`, and keep both.

It deliberately covers what a headless test cannot judge — whether the toast is legible, whether the
tooltip tracks and then *stops*, whether the legend ramp is a real gradient, whether points are
styled circles rather than broken icons, whether dispatch really stops on absorption, and whether
modal capture really suppresses hover while you draw.

**Step 8 is now the whole selection tier** — polygon, rectangle, freehand and brush, each drawn on the
map by `createRegionOverlay`. Run all four. Two of its checks exist because headless tests were blind
to them: that the shape is *visible at all*, and that dragging with freehand or brush does not pan the
map underneath the stroke.

Work top to bottom: step 8 needs the raster from step 3, and step 9 needs the region from step 8.

## Automated coverage, and where it stops

`npm test` runs 948 Node tests over the pure modules (including jsdom coverage of every
`fimviz/ui` export). It cannot see a browser: no `google.maps`, no
Leaflet, no canvas, no GDAL WASM. Everything provider-shaped or pixel-shaped is verified by opening
these pages. That gap is why `verify.html` exists, and why it is worth running on both providers
before a release.

## Sample data

`assets/SampleFiles/` — GeoTIFFs (`4326.tif`, `Brazos_RP100_depth.tif`, the `Compare_*` pair),
vectors (`Iowa_County_Boundaries.json`, `ames.kmz`), and the multi-dimensional samples the temporal
page uses (`idalia-nldas2.nc`, `idalia-aorc.zarr.zip`, `idalia-stage4-4h.grb2`, `sample.nc3`).

`Iowa_city.json` is site configuration, not GeoJSON — it has no `type`/`features`, so `parseFile`
rejects it as a vector source. Use `Iowa_County_Boundaries.json` for a real FeatureCollection.
