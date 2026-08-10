# Candidate case studies

Ten end-to-end demos for exercising the library against real, publicly available
data. Each is chosen so it runs entirely in a modern browser and so the dataset
can be fetched without an account or a paid tier.

Sources below are from general knowledge and have not been re-verified against
the live endpoints — check URLs and CORS headers before committing to one.

---

## 1. Terrain baseline — Copernicus DEM 30 m

**Data:** AWS Open Data `copernicus-dem-30m` (also `-90m`), Cloud-Optimized
GeoTIFF, global, no auth.

**Exercises:** COG ingest over HTTP range requests, overview-level selection by
zoom, hypsometric colour ramps, and nodata/ocean handling — a direct test of the
"absent values must not take the ramp's minimum colour" rule.

**Viz:** elevation ramp plus a derived hillshade, with a slope layer computed
client-side.

Single band, no time axis, no auth — this isolates the raster path and makes a
good first case study.

## 2. Streamflow with a real time axis — NOAA National Water Model

**Data:** `noaa-nwm-retrospective-2-1-zarr-pds` (Zarr, chunked, best suited to
the browser) or `noaa-nwm-pds` (hourly NetCDF4 forecasts).

**Exercises:** temporal axis construction, lazy chunk fetching along time,
scrubbing and animation, and joining a multi-million-element feature dimension to
NHDPlus reach identifiers.

**Viz:** stream network coloured by discharge, animated over a flood event; click
a reach to get its hydrograph.

The hardest and most valuable of the ten. The feature-ID join is where most
libraries fall over.

## 3. Regulatory flood zones — FEMA National Flood Hazard Layer

**Data:** FEMA's ArcGIS REST service (`hazards.fema.gov/.../NFHL/MapServer`),
which serves GeoJSON directly, or state-level shapefile downloads.

**Exercises:** vector ingest, categorical styling driven by an attribute
(`FLD_ZONE`: AE, VE, X, …), legend generation from the data rather than a
hardcoded list, hover and hit-testing, and polygon simplification for zoomed-out
views.

**Viz:** classified polygon fill and outline with a data-derived legend.

## 4. Band math in the browser — Sentinel-2 flood extent

**Data:** Element84 Earth Search STAC API into `sentinel-s2-l2a-cogs` on AWS.
Pick a known event — the Pakistan floods of August–September 2022, or the 2019
Missouri River floods — and take a before/after pair.

**Exercises:** STAC search as a data-addition path, multi-band COG reads,
NDWI/MNDWI computed on the GPU, a threshold slider, and cloud masking from the
SCL band.

**Viz:** true-colour composite with a swipe divider and the water mask overlaid.

## 5. Observed flood delineations — Copernicus EMS Rapid Mapping

**Data:** free per-activation downloads (GeoJSON, shapefile, GeoPackage) of
observed flood extent, delineation, and grading products.

**Exercises:** GeoPackage and multi-layer ingest, overlaying an authoritative
vector extent on the Sentinel-2 derived mask from case study 4, and computing
agreement statistics (intersection over union) client-side.

**Viz:** a validation view — true positive, false positive, and missed area, as a
categorical raster-versus-vector comparison.

## 6. Point gauges linked to charts — USGS NWIS

**Data:** the `waterservices.usgs.gov` instantaneous-values JSON API. Live, and
generally CORS-friendly.

**Exercises:** building a point layer from an API response, one time series per
feature, syncing a temporal cursor between map and chart, and caching responses
in IndexedDB so a reload does not re-fetch.

**Viz:** gauge symbols sized and coloured by stage relative to flood stage, with
linked hydrographs.

## 7. Exposure analysis — Overture Maps buildings

**Data:** Overture Maps building footprints as GeoParquet on AWS/Azure, queried
with DuckDB-WASM directly from the browser.

**Exercises:** GeoParquet as an ingest format, spatial predicates (buildings
intersecting a flood polygon), aggregation to administrative units, and pushing
filtering down into the query instead of loading everything.

**Viz:** affected-building counts as a choropleth, with footprints drawn at high
zoom.

The strongest "modern browser" story of the ten — a genuinely analytical stack
running client-side.

## 8. Gridded climate time series — CHIRPS or ERA5 precipitation

**Data:** CHIRPS daily on AWS Open Data, or ERA5 Zarr via the Pangeo/Google ARCO
mirror (`gcp-public-data-arco-era5`).

**Exercises:** temporal aggregation (a 7-day rolling sum), unit conversion,
diverging colour scales centred on a meaningful zero (anomaly against
climatology), and animating across hundreds of time steps without stalling.

**Viz:** rainfall accumulation animated over the days preceding a flood event — a
natural companion panel to case study 2.

## 9. Trajectories with time — IBTrACS / HURDAT2 hurricane tracks

**Data:** NOAA NCEI IBTrACS (CSV, NetCDF, shapefile) or HURDAT2 (plain text, and
tiny).

**Exercises:** line geometry assembled from timestamped points, symbology varying
along a line (wind speed to width or colour), antimeridian crossing, and
time-windowed filtering.

**Viz:** an animated storm track with wind-radii polygons. Useful for confirming
the time axis handles irregular 6-hourly sampling.

## 10. Offline storage — PMTiles basemap plus OPFS

**Data:** the Protomaps daily planet PMTiles build, or a regional extract
generated with `tippecanoe` from Natural Earth or OSM.

**Exercises:** reading a single-file tile archive via range requests, persisting a
bounded region to the Origin Private File System, then serving the whole map with
the network disconnected. Pairs with the cached gauge data from case study 6 for a
complete offline field-assessment kit.

**Viz:** any of the above, working on a plane.

---

## Coverage

|    | Ingest        | Manipulate              | Store        | Time axis     |
| -- | ------------- | ----------------------- | ------------ | ------------- |
| 1  | COG           | slope, hillshade        | —            | no            |
| 2  | Zarr, NetCDF  | ID join                 | chunk cache  | **yes**       |
| 3  | GeoJSON, REST | classify                | —            | no            |
| 4  | STAC, COG     | band math on GPU        | —            | before/after  |
| 5  | GeoPackage    | raster/vector compare   | —            | no            |
| 6  | JSON API      | resample                | IndexedDB    | **yes**       |
| 7  | GeoParquet    | spatial join, aggregate | DuckDB-WASM  | no            |
| 8  | Zarr          | rolling aggregate       | —            | **yes**       |
| 9  | CSV           | trajectory build        | —            | **yes**       |
| 10 | PMTiles       | —                       | **OPFS**     | no            |

## Practical notes

**CORS is the real gate.** AWS Open Data buckets, Earth Search, and USGS NWIS are
generally permissive. FEMA's ArcGIS service and some Copernicus EMS endpoints are
not consistently so — budget for a small dev proxy on those.

**Suggested order:** 1, then 3, then 2, then 4, then 7. That gets a clean raster
path, then a clean vector path, then the time axis, then GPU compute, then the
analytical stack, with each step adding exactly one new capability.

**The pair worth building as a single demo** is 4 and 5: derive a flood mask from
imagery, then score it against the official delineation. It exercises nearly every
subsystem at once and produces a result a domain expert would care about.

---

# Doability against the library as it stands

Rated against what is actually built — [usage/](./usage/), [CLASS_DIAGRAM.md](./CLASS_DIAGRAM.md),
and the ✅-marked slices in [PACKAGE_ROADMAP.md](./PACKAGE_ROADMAP.md) — not against
what is designed for. "Missing" below means *the engine has no path to it today*,
whether or not the roadmap names it.

| Score | Meaning |
| ----- | ------- |
| **5** | Ships today. Documented API, no new engine code, host writes only page glue. |
| **4** | Small glue. A modest host-side adapter; no engine change. |
| **3** | One real engine gap, or the study works only in a scoped-down form. |
| **2** | The engine does one half; the other half is entirely new work. |
| **1** | Blocked on a subsystem that does not exist. |

| # | Study | Score | The gating issue |
| - | ----- | ----- | ---------------- |
| 1 | Copernicus DEM | **5** | none — only whole-file fetch limits resolution |
| 5 | Copernicus EMS validation | **5** | none — `ComparisonLayer` was built for exactly this |
| 3 | FEMA NFHL | **4** | no categorical `ColorScale`; ArcGIS result paging is host work |
| 8 | CHIRPS precipitation | **4** | NetCDF path proven; the ERA5-Zarr variant is not |
| 4 | Sentinel-2 NDWI | **3** | no range reads → asset size; no raster-by-raster mask → no cloud mask |
| 9 | IBTrACS tracks | **3** | points work; assembling track *lines* from rows has no primitive |
| 6 | USGS NWIS gauges | **2** | the WaterML adapter is app-tier, not in this repo; no chart read-model |
| 10 | PMTiles + OPFS | **2** | `Storage` covers the Dataset half; the tile/basemap half is outside the engine |
| 2 | NWM streamflow | **1** | feature-indexed (non-gridded) Zarr; no ID-join primitive |
| 7 | Overture buildings | **1** | no Parquet reader, no vector↔vector spatial join |

---

## 1. Copernicus DEM — **5**

**Works today.** `fim.addDataset(url)` fetches and parses the GeoTIFF
([io/parse.js:59](../src/io/parse.js#L59)); Copernicus DEM is already EPSG:4326, so it
clears the CRS precondition with no GDAL warp. `ds.slope()`, `ds.aspect()`,
`ds.hillshade()` are landed pure-JS lazy ops (Horn's method,
[package/rasterOps.js](../src/package/rasterOps.js)), the `terrain` palette is a
built-in, `Stats.raster` gives the histogram, and `layer.enableHover()` +
`valueAt()` give the elevation readout. `missingColor` keeps ocean nodata off the
ramp.

**Missing:**

- **HTTP range reads / COG overviews.** `geotiffMaterializer` does
  `fetch → arrayBuffer → getImage()`
  ([io/materializers.js:41-46](../src/io/materializers.js#L41-L46)) — the whole file, first
  IFD. A 1°×1° Copernicus tile is 3600² float32 ≈ 52 MB decoded, which is workable
  for one tile and rules out browsing at continental scale. This is roadmap §4's
  unstarted "range / chunked reads."
- **No composite blending.** Hillshade under a colour ramp is two layers and an
  opacity setting; there is no multiply/overlay blend mode in `colorizeGrid`.

**Correction to the docs while you are here.** [usage/USAGE.md](./usage/USAGE.md)'s
Limitations says "the raster overlay tier is Google-only." That is now overstated:
`RasterLayer._draw()` goes through `provider.addRasterImage`
([package/layer.js:699-710](../src/package/layer.js#L699-L710)), which the Leaflet provider
implements ([package/mapProvider.js:499](../src/package/mapProvider.js#L499)). The
genuinely Google-only tiers are velocity, HAZUS markers, and the ArcGIS depth
tiles. Worth fixing before this study becomes anyone's first impression.

## 5. Copernicus EMS validation — **5**

**Works today, and is the best fit of the ten.** `ComparisonLayer` aligns 2–8
rasters onto one grid and — for exactly two — scores a confusion matrix
([package/comparisonMetrics.js](../src/package/comparisonMetrics.js)), which *is* the
validation view this study asks for. The vector delineation reaches it via
`ds.rasterize({ width, height, bounds })`, and EMS ships shapefile and GeoJSON
alongside GeoPackage, so the existing `shp`/`geojson` parsers suffice.
`layer.prepare()` materializes Dataset sources before the sync `compute()`.

**Missing:**

- **GeoPackage.** Not a parser we have (roadmap §3 candidate). Use the shapefile
  or GeoJSON download instead — not a real obstacle.
- **`rasterize` ignores holes** and is Polygon/MultiPolygon only
  (rings union, matching `SpatialFilter`). For flood delineations with interior
  dry islands this inflates the "observed" class.
- **No `polygonize`**, so the comparison cannot be handed back as vector — explicitly
  deferred in roadmap §2 (needs marching squares).

## 3. FEMA NFHL — **4**

**Works today.** The ArcGIS REST endpoint returns GeoJSON, and `fim.addDataset(url)`
takes a URL string directly. `VectorLayer` renders on both providers,
`featureAt(lat,lng)` drives an info window, `createInfoWindow`/`propsTable` are in
`fimviz/ui`, and `config.resolveUrl` is the documented seam for routing FEMA
through a CORS proxy.

**Missing:**

- **A categorical `ColorScale`.** `FLD_ZONE` is a string, and `colorBy` coerces with
  `Number(raw)` — a non-finite value is deliberately sent to `missingColor` rather
  than the ramp ([package/layer.js:851-862](../src/package/layer.js#L851-L862)). So the
  natural styling for this dataset is the one thing the scale cannot express. The
  workaround is real but partial: `render({ style: ({feature}) => '#hex' })` passes a
  per-feature function straight through to the provider
  ([package/mapProvider.js:197-202](../src/package/mapProvider.js#L197-L202)), so the *map*
  is right — but `getLegend()`, `getStats().byClass`, and the settings-panel palette
  knobs all read `colorScale`, so you hand-build the legend and get no classified
  stats. Note also that `setStyle(patch)` object-spreads `_style` and would destroy a
  function set this way.
- **Result paging.** ArcGIS caps a query at ~1000 features; the engine has no paged
  source, so the host loops `resultOffset` itself and merges.
- **No simplification** for zoomed-out rendering (roadmap §5.2's `slice`/`filter`
  transformation ops are designed, not built).

## 8. CHIRPS precipitation — **4** (ERA5-Zarr variant: **2**)

**Works today** on the NetCDF path, which is the one proven end-to-end:
`addDataset` builds a time axis of in-file selector refs, and
`ds.reduce('sum')` collapses it with no new grid math — verified against a real
120-step NLDAS-2 file (roadmap §8). A rolling 7-day window is expressible without
`selectRange`: select the seven entries and `a.combine([...six], { op: 'sum' })`.
[examples/04-temporal.html](../examples/04-temporal.html) is the working
time-slider pattern.

**Missing:**

- **Zarr is registered but unproven.** `SCIWRID_FORMATS` includes it
  ([io/sciwrid.js:19](../src/io/sciwrid.js#L19)), and roadmap §8 is explicit that only the
  NetCDF4 vertical was verified. ARCO-ERA5 additionally needs consolidated metadata
  and chunk selection across a multi-TB store — treat that variant as research, not
  a demo.
- **No diverging palette** among the built-ins (blues, grayscale, rainbow, heat,
  viridis, terrain, reds, plasma). `ColorScale.registerPalette` closes this in three
  lines, but nothing centres a ramp on zero for you.
- **No playback controller.** `select()` per frame is the mechanism; the loop,
  prefetch, and scrub-throttling are host code. Roadmap §5.2 lists the
  prefetch-and-evict window around a slider as an unpulled lever.
- **No `selectRange`** — deliberately deferred in §8.

## 4. Sentinel-2 NDWI — **3**

**Works, and better than expected in one place.** Earth Search assets are
*single-band* COGs, so the band-0-only materializer is not the blocker here, and
NDWI is expressible in the landed op set even though there is no
normalized-difference op:

```js
const num  = green.difference(nir);                    // G − N
const den  = green.combine([nir], { op: 'sum' });      // G + N
const ndwi = num.combine([den],   { op: 'ratio' });    // → water index
const mask = ndwi.reclassify([{ min: 0.2, max: Infinity, value: 1 }]);
```

Every node is lazy and LHS-conforming, so the NIR grid is resampled onto the green
grid automatically.

**Missing:**

- **Range reads, again — and here it bites.** A 10 m B03/B08 COG is 100–200 MB, and
  the materializer fetches the whole file. In practice you are restricted to
  lower-resolution assets or a small AOI, which undercuts the study's point.
- **No raster-by-raster mask.** `ds.mask()` takes a polygon or `SpatialFilter` only
  ([usage/DATASET_OPERATIONS.md](./usage/DATASET_OPERATIONS.md#raster--unary)); roadmap §2
  designed `mask(polygon | rasterMask)` and landed only the polygon half. So the SCL
  cloud mask has no clean application — the nearest trick is reclassifying SCL to
  `{1, NaN}` and `combine`-ing with `min`, which is obscure enough to be worth
  fixing rather than documenting.
- **No multi-band decode**, so a true-colour RGB composite is not renderable at all
  — `readRasters()[0]` is taken and the rest discarded
  ([io/materializers.js:45-46](../src/io/materializers.js#L45-L46)). The "swipe over true
  colour" half of the study is out.
- **No STAC client** (~20 lines of host `fetch`, not a real gap) and **no swipe/blend
  UI** — roadmap §2.2 classes that as presentation combination, which nothing implements.
- **Pure-JS, not GPU.** Fine at moderate grid sizes; the study's framing should drop
  the GPU claim.

## 9. IBTrACS tracks — **3**

**Works today** for the point form: the CSV parser auto-detects `lat`/`lon` columns,
every other column becomes `properties`, and `colorBy: 'wind'` with a numeric
`ColorScale` grades the symbols with a matching `Legend` and `byClass` stats.

**Missing:**

- **No group-by.** CSV gives one Feature per row; assembling per-storm LineStrings
  from timestamped rows has no primitive. The host builds the GeoJSON and passes it
  in — at which point the CSV parser is not doing much for you.
- **No per-vertex styling.** Style resolves per *feature*, so "width varies along the
  track with wind speed" means splitting each track into per-segment features.
- **HURDAT2's fixed-width text** is not a format we read; IBTrACS CSV is the way in.
- **No time animation**, same gap as study 8, and no antimeridian handling anywhere
  in the codebase.

## 6. USGS NWIS gauges — **2**

**The parsing adapter is not in this library.** Roadmap §3 records a landed
WaterML/NWIS adapter producing `Gauge` objects, but it is **app-tier** — there is no
`waterml`/`nwis` module under [src/](../src/) and no test for it in
[test/](../test/). From `fimviz` alone you fetch the JSON and build GeoJSON yourself.
Once you have, the point layer, info window, and `Storage` caching are all ordinary
API use.

**Missing:**

- **The adapter itself**, for this repo's purposes.
- **A chart / sparkline read-model.** `Legend` and `Stats` are the only read-models;
  nothing renders a hydrograph, and `fimviz/ui` has no chart widget. The whole
  "linked temporal cursor between map and chart" half is new work.
- **Gauge-shaped time axes are a third axis shape.** Roadmap §8 flags this explicitly:
  the NWIS adapter routes *around* `select()` with `ref: null` and bespoke
  `latest()`/`at()` accessors, so `reduce()` does not work on it. Anything you build
  here will not compose with the NetCDF time axis from studies 2 and 8.
- **`Storage` gives you a KV store, not a cache** — TTLs, keying, and invalidation
  are yours by explicit design (§2.3, "not a database library").

## 10. PMTiles + OPFS — **2**

**Half of it works.** `ds.toRecord()` → `Storage.put()` → `Dataset.fromRecord()` is a
real offline-dataset path, values are stored verbatim by structured clone, and the
recipe form keeps records small. For a field kit holding a handful of flood rasters,
that is genuinely the interesting half.

**Missing:**

- **PMTiles, and tiled sources generally.** No archive reader, no range requests, no
  tile cache. The escape hatch is real — Leaflet's provider accepts `tileUrl`/
  `tileOptions`, or a host reaches `fim.map` and adds `protomaps-leaflet` itself
  ([package/mapProvider.js:452-456](../src/package/mapProvider.js#L452-L456)) — but that is
  host code the library neither owns nor helps with.
- **OPFS.** `Storage` is IndexedDB only, and namespacing is origin-global rather than
  per-`FimViz` (§5.1 lists that as unstarted).
- **No offline detection or sync model** of any kind.

## 2. NWM streamflow — **1** as scoped

**The blocker is structural, not missing glue.** NWM retrospective `chrtout` is a
`(time, feature_id)` array — a per-reach time series, not a grid. The parser
derives its native grid from the variable's **last two dimensions** plus
`scan().bbox` and throws when a file has no geographic extent
([io/sciwrid.js](../src/io/sciwrid.js), and see
[DATASET_OPERATIONS.md → "has no usable geographic extent"](./usage/DATASET_OPERATIONS.md#has-no-usable-geographic-extent)).
This file will hit exactly that path, and correctly so — there is nothing to place
on a map without joining to NHDPlus geometry first.

**Missing:**

- **Any join primitive.** Nothing maps an array of values keyed by ID onto a vector
  layer's features. `colorBy` reads `feature.properties[key]`, so the host must
  materialize the join into the GeoJSON itself — for 2.7 M reaches, in the browser,
  per timestep.
- **Curvilinear / non-1-D coordinate handling**, which also rules out the gridded
  NWM LDASOUT output on its Lambert conformal grid.

**Re-scope it.** Swap the target to **gridded NWM/NLDAS-2 forcing NetCDF** — that is
literally the fixture the §8 slice was verified against (Hurricane Idalia, 120
timesteps, `reduce('mean'|'max')` in ~3 s). Same "prove the time axis" value, and
it becomes a **5**.

## 7. Overture buildings — **1** as scoped

**Missing, and none of it is small:** no Parquet or GeoParquet reader (roadmap §8
explicitly puts Parquet out of scope until the raster path lands), no DuckDB-WASM,
no vector↔vector spatial join, and no vector aggregation — `zonalStats` is
raster-only. `SpatialFilter.contains(lat, lng)` gives point-in-polygon, so counting
building *centroids* inside a flood polygon is hand-rollable, but that is a loop you
write, not a capability you call.

**Re-scope it to the FIMViz-native version of the same question:** rasterize the
flood extent, then `ds.zonalStats(zones)` over admin polygons for per-zone
min/max/mean/sum/count/area, and drive a choropleth from the result with
`colorBy`. Every piece of that is landed, it answers the same exposure question,
and it becomes a **4**.

---

## The missing pieces, ranked by how many studies they unblock

1. **HTTP range reads + COG overview selection** (roadmap §4, not started) — gates 1,
   4, and 8 at real resolution. The single highest-leverage item on this list.
2. **Multi-band raster decode** — the materializer keeps band 0 and discards the
   rest. Blocks every true-colour or RGB composite view.
3. **`mask(rasterMask)`** — designed in §2, landed polygon-only. Blocks cloud masks,
   quality flags, and any boolean-raster gating.
4. **Categorical / nominal `ColorScale`** — blocks the natural styling of every
   zone-, class-, or land-cover-typed vector dataset, and quietly costs you `Legend`
   and `byClass` even when the per-feature style function saves the map.
5. **A join primitive** (values keyed by ID → feature properties) — the one thing
   standing between the engine and most hydrologic network data.
6. **Vector↔vector spatial predicates and aggregation** — `zonalStats` for vectors.
7. **A playback/animation controller and `selectRange`** — the time axis is built;
   nothing drives it over time except host code.
8. **A chart read-model** — `Legend` and `Stats` have no time-series sibling, and
   gauge data is unusable without one.
9. **More readers**: GeoPackage, FlatGeobuf, GeoParquet, LAS/LAZ (§3 candidates).
10. **Tiled and paged sources** — PMTiles, WMS/WMTS/WFS, ArcGIS `resultOffset`.

## Revised build order

**1 → 5 → 3 → 8(NetCDF) → 4.** Study 1 exercises the raster path with nothing
missing; study 5 exercises `rasterize` + `ComparisonLayer`, the subsystem with the
least external validation and the most differentiated value; study 3 exercises the
vector path and surfaces the categorical-scale gap concretely; study 8 exercises the
time axis on its proven format; study 4 is the first one that should wait for range
reads.

Studies 2 and 7 are worth keeping in the document **as re-scoped above** — in their
original form they measure the roadmap rather than the library.
