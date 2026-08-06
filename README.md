# FIMViz.js

A **headless** flood-inundation-map visualization engine: `Dataset`/`Storage`/`parse`/`reproject`
primitives, the `ColorScale`/`Legend`/`Stats`/`Filter` read-models, a `Layer` model, and a
map-provider seam (Google Maps or Leaflet) for creating a map and rendering vector layers. It
ships **no UI** — no widget markup, no CSS, no panels. A full widget (Layer Panel, flood-extent
slider, comparison tools, HAZUS damage UI) is a separate host runtime built *on top of* this
engine via `FimViz.registerRuntime()`; it is not part of this package.

> **Not yet published to the public npm registry.** To use it today, clone this repository and
> either import from `src/package/lib.js` directly, or run `npm run build` and point your bundler
> at `dist/fimviz.js`.

## Install

```bash
git clone https://github.com/uihilab/FIMViz.js.git
cd FIMViz.js && npm install
npm run build   # → dist/fimviz.js (+ dist/ui.js) and dist/types/
```

### Vendored dependency: SciWrid Toolkit

[SciWrid Toolkit](https://github.com/uihilab/SciWrid-Toolkit) is a sibling lab library that reads
GRIB2 / NetCDF / Zarr / COG. It is **not on npm**, so it is vendored as a packed tarball
(`vendor/sciwrid-toolkit-<version>.tgz`, referenced from `package.json` as a `file:` dependency) —
which is what keeps a fresh clone installable with a plain `npm install`, and pins the version at the
same time. Nothing in the engine imports it yet; it backs the planned multi-dimensional/temporal
format support in
[docs/PACKAGE_ROADMAP.md §8](docs/PACKAGE_ROADMAP.md#8-multi-dimensional-formats--real-temporal-datasets-sciwrid-toolkit-as-a-materializer).

**You only need the steps below to pull in a newer SciWrid** — a normal `npm install` already
installs the committed tarball. `npm pack` ships SciWrid's built `dist/`, not its `lib/` sources, so
the rebuild is required or you will repack a stale bundle:

```bash
cd ../SciWrid-Toolkit && git pull && npm run build      # dist/ is what gets packed
npm pack --pack-destination ../FIMViz.js/vendor
cd ../FIMViz.js && npm install file:vendor/sciwrid-toolkit-<version>.tgz --omit=optional
```

The tarball carries the built bundle only (11 files, ~386 KB unpacked) — SciWrid's own
`files: ["dist", "README.md", "LICENSE"]` keeps its 194 MB of test fixtures and 219 MB of history
out. `--omit=optional` skips `h5wasm`/`numcodecs`/`hyparquet`/`jsfive`/`jpeg-js`, which lazy-load
from a CDN in the browser; add only the ones a given format actually needs under Node. Delete the
superseded tarball from `vendor/` after bumping the version.

## Quick start — a bare map

No runtime, no widget markup needed — `mount()` builds a real map itself via the map-provider seam:

```js
import { FimViz } from 'fimviz';

const fim = await FimViz.mount('#fim', { provider: 'leaflet' });   // a real map — no API key needed

const ds = await fim.addDataset(geojsonFileOrUrl);   // File | Blob | ArrayBuffer | URL → Dataset
await fim.addLayer('vector', { source: ds });      // renders it via the map provider
```

```html
<div id="fim" style="width: 100%; height: 600px;"></div>
```

`provider` is **required** — the backends differ in credentials *and* capability, so the engine never
picks one for you. `'leaflet'` needs nothing; `'google'` needs a key and is the only one with the
full overlay tier (velocity, damage markers, ArcGIS depth tiles):

```js
const fim = await FimViz.mount('#fim', { provider: 'google', apiKey: 'YOUR_GOOGLE_MAPS_KEY' });
// fim.getMap() is a real google.maps.Map.
```

Vector layers render on either provider (a neutral style vocabulary —
`fillColor`/`strokeWidth`/… — is translated to each SDK). **Raster overlays are Google-only** —
they extend `google.maps.OverlayView` (inheritance, not a provider call), so this doesn't apply to
flood-extent/depth/velocity rendering regardless of `provider`.

## The composable primitives

These need no map, no mount, no runtime:

```js
import { FimViz, Dataset, reproject, Storage, ColorScale, Legend, Stats, Filter } from 'fimviz';

const ds = await FimViz.parseFile(file);          // → Dataset, in its native CRS (never reprojects)
const wgs84 = await reproject(ds, 'EPSG:4326');    // → a NEW Dataset

const db = new Storage({ name: 'my-store', version: 1, tables: ['userFiles'] });
await db.put('userFiles', 'x.tif', ds.toRecord());

const cs = new ColorScale({ palette: 'viridis', min: 0, max: 10 });
const legend = Legend.fromColorScale(cs);
```

## Temporal & multi-dimensional data

NetCDF4/NetCDF3/GRIB2/Zarr open through the same `addDataset`/`parseFile` as a GeoTIFF. One file with
many timesteps becomes a `Dataset` with a real **time axis**:

```js
const ds = await fim.addDataset(file);                     // header only — nothing decoded
const t  = ds.select(Date.parse('2023-08-28T06:00:00Z'));  // one slice, off the same bytes
await fim.addLayer(t);                                      // already EPSG:4326 — no GDAL warp

await ds.reduce('mean').grid();                             // collapse every timestep
```

Everything the reader has to assume about a file is a **default with an override beside it** — so a
file that does not match CF's overwhelming majority is a configuration problem, not an unsupported one:

```js
await fim.addDataset(file, {
  grid:   { bbox: [0, -80, 360, 90] },            // extent, when the file reports none
  series: { coords: i => new Date(Date.UTC(2001, i, 16)) },  // label an axis the format can't
  dims:   { order: 'yx' },                         // which trailing pair is (lat, lon)
  lon:    '-180..180',                             // re-express the extent; a global grid is rolled
});
```

A file with no CF times still gets a real axis — integer positions over its declared leading
dimension, with `axis.unit === 'index'` so a UI can tell it apart from timestamps.

Their decoder carries a ~193 KB wasm, so it is **external to the bundle and loaded on demand**: a
consumer who never opens one of these files downloads nothing for them, and a page that does needs
`sciwrid-toolkit` resolvable (an npm dependency under a bundler, an import-map entry in a raw browser
page — see `examples/temporal-netcdf.html`).

Every `Dataset` op, `Stats`, `ColorScale` and `Legend` work on the result unchanged. Scope and the
grid geometries that need a manual extent are in
[PACKAGE_ROADMAP.md §8.1](docs/PACKAGE_ROADMAP.md#81-which-grids-we-actually-support-scope-and-the-silent-failure-guard);
`examples/temporal-netcdf.html` is a live page (scrub, play, reduce) with NetCDF4/Zarr/GRIB2 samples.

## Docs

- **API reference** (generated): [docs/api/](docs/api/) — run `npm run docs:api` to regenerate.
- **Usage guides**: [docs/usage/USAGE.md](docs/usage/USAGE.md) and the rest of
  [docs/usage/](docs/usage/) — configuration, events, layers, storage, color scales, and more.
- **Architecture** — the object model and what's built vs. planned:
  [docs/CLASS_DIAGRAM.md](docs/CLASS_DIAGRAM.md),
  [docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md](docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md),
  and [docs/PACKAGE_ROADMAP.md](docs/PACKAGE_ROADMAP.md).

## License

ISC.
