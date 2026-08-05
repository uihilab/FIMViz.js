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
