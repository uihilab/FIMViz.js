# Package roadmap — proposed additions

Forward-looking design for engine capabilities we want. Records the shape, the seam each hangs off, and the
high-value first slice, so work can start without re-deriving the design. Builds on the Dataset/Layer ADT
([DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md](DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md) §1.1) and the provider seam
([mapProvider.js](../src/package/mapProvider.js)).

---

## 1. Cross-provider event-filtering & interaction policy

**Problem.** Mouse interaction was ad hoc — hover/draw attached `google.maps.event` listeners directly to
the map, and a raster overlay swallowing events was fixed with a blunt `clickable:false`. No
provider-neutral, layer-aware model for who receives a `click`/`drag`/`hover`.

**Design.** A normalized, precedence-based event dispatcher on the map instance, provider-neutral:

- **Provider seam** — `onMapEvent(map, type, cb) → unsubscribe`, covering `click`, `dblclick`,
  `mousedown`/`mouseup`, `mousemove` (hover), `drag`, `dragstart`/`dragstop`, `contextmenu`. Each fires a
  neutral `{ type, lat, lng, point, originalEvent }` so google and leaflet look identical to the layer.
- **Layer subscription + hit-test** — `layer.on('click'|'hover'|…, handler)`; a layer receives an event only
  when the point passes its `layer.hitTest(latlng)` (raster tests its footprint / non-transparent pixel;
  vector tests feature geometry).
- **Precedence (default)** — `FimMap` dispatches **z-order, top-down** (its `layers` array is the z-order);
  the top hit layer runs first; if it **absorbs** (`stopPropagation`), propagation stops; else it falls
  through to the next down.
- **Modal override** — an exclusive interaction (region draw, a measurement tool) registers via
  `fim.captureInteraction(handler)` and takes **all** events until `releaseInteraction()`; layer dispatch is
  suppressed while captured.
- **Simultaneous mode** — `fim.simultaneousLayerEvents` (or a per-dispatch option): when true,
  precedence/absorption is bypassed and **every** hit-tested layer receives the event.

✅ **Landed:** `onMapEvent` (Google+Leaflet) for click/hover, `FimMap` z-order dispatch with absorption,
**simultaneous mode**, **modal capture / region-draw**, **pixel-level hit-test** (`RasterLayer.hitTest` =
a real non-noData pixel under the point, so clicks fall through transparent areas), and the **interactive
opt-in** (raster overlays default non-interactive via `addRasterImage(..., { interactive })` — the hardcoded
`clickable:false` retired). **Still open:** the fuller vocabulary (`drag`/`dblclick`/`contextmenu`
end-to-end).

---

## 2. Dataset operations (clip / mask / transform / 3-D aggregate)

**Problem.** We already bundle GDAL — high-value spatial ops turn Dataset from "a thing you render" into "a
thing you analyze."

**Design.** Each is a **lazy op** returning a new Dataset (immutable, memoized), forced through a registered
seam (keeping GDAL out of Dataset's import graph). N-ary ops use the `#inputs[]` node.

- **Clip** — `ds.clip(geometry | bbox)` → footprint reduced to the cut.
- **Mask** — `ds.mask(polygon | rasterMask, { invert })` → pixels outside become noData/transparent.
- **Reclassify** — `ds.reclassify(rules)` → value remap.
- **Band math / binary** — `a.combine([b], { op })` (difference/ratio/sum/mean/min/max).
- **Terrain** — `ds.hillshade()`/`slope()`/`aspect()` → GDAL `gdaldem`.
- **Vectorize / rasterize** — `ds.polygonize()` (raster→vector), `ds.rasterize(field)` (vector→raster) — the
  kind-changing ops.
- **Zonal statistics** — `ds.zonalStats(zones)` → per-zone min/max/mean/sum over a raster (feeds `Stats`).
- **3-D / aggregation** — reduce an **axis** (stage/time/depth): `ds.reduce(axis, 'mean'|'max'|'sum')`
  collapses a temporal/vertical stack to one grid; the payoff of the N-D-ready axes model.

✅ **Landed as pure-JS lazy ops on the decoded grid** (`package/rasterOps.js`; need no GDAL, node-tested;
masked/unmatched pixels → NaN, which colorize/Stats treat as transparent): `ds.clip(bbox)`,
`ds.mask(polygon,{invert})`, `ds.reclassify(rules,{unmatched})` build lazy nodes forced at terminal and
round-trip through `toRecord`/`fromRecord`. A UI — `ui/operationsPanel.js` `createOperationsPanel`
(threshold/mask-to-region/reset, styled like the tools panel) — drives the single-layer ops on a live layer
via `deriveSources`. Also **band math** — `ds.combine([b,…], { op })`/`ds.difference(b)` (difference/ratio
binary, sum/mean/min/max N-ary), the first real N-ary op: LHS-conform (others resampled onto THIS grid via
`geo/resample`), forcing the multi-input `#inputs` node, round-tripping through records — and
**`ds.zonalStats(zones)`** (a terminal returning per-zone min/max/mean/sum/count/area). Both pure-JS +
node-tested; the pure grid forms (`combineGrids`/`zonalStats`) are on the barrel. Being multi-input /
table-returning, they're API-level rather than in `createOperationsPanel`.

✅ **Landed: terrain, as pure JS** (`slopeGrid`/`aspectGrid`/`hillshadeGrid` in `rasterOps.js`, node-tested) —
Horn's 1981 3×3-window gradient, the same algorithm `gdaldem slope`/`aspect`/`hillshade` use, run directly
on the decoded grid instead of shelling out to GDAL (the same "pure-JS substitute" choice already made for
clip/mask/reclassify vs. `gdalwarp`). `ds.slope({zFactor,cellsizeX,cellsizeY,unit})`, `ds.aspect()`,
`ds.hillshade({altitude,azimuth,zFactor,cellsizeX,cellsizeY})` are lazy unary ops, round-tripping through
records like the others. `cellsizeX/Y` default to the grid's own pixel size in the bounds' units (degrees
for WGS84 — pass metres for a true-scale result, same unit contract as `zonalStats`' `area`); aspect has no
cellsize param, matching gdaldem's own square-pixel assumption. **Not** GDAL-backed, so no wasm/worker cost.

✅ **Landed: rasterize** (`rasterizeFeatures` in `rasterOps.js` + `ds.rasterize({width,height,bounds,field,
burnValue})`) — the kind-changing **vector→raster** half of "vectorize/rasterize". Point-tests each pixel
centre against every feature's polygon (`SpatialFilter`, reused rather than re-implemented), burning a
property value or a constant; later features win on overlap. Polygon/MultiPolygon only (no point/line);
holes are ignored (rings union, the same simplification `SpatialFilter` already makes elsewhere). Node-
tested, including the `toRecord`/`fromRecord` round-trip and the vector-only-op guard.

✅ **Landed: axis `reduce`** (`ds.reduce(op, {axis,method,variant})`, `op` ∈ `sum|mean|min|max`) — collapses
a Dataset's selection axis (e.g. a stage/time series) to one grid. Implemented as **sugar over
`select()`+`combine()`**: resolves every axis entry to a child Dataset, then LHS-conforms/reduces them
exactly like `combine()` — no new grid math, reusing the already-tested N-ary reducer. Node-tested with a
2-entry axis stub series (mean/sum/min/max, the lazy-not-forced guarantee, the empty-axis and
unsupported-op error paths).

✅ **Landed: the ops reach a Layer directly** — `layer.clip(bbox).mask(poly).reclassify(rules)` applies each
op across every source **immediately** (synchronously, via the same `deriveSources` path), returns the
layer so they chain, and draws once at the next `render()`; `layer.dirty` reports an applied-but-undrawn
op and `layer.reset()` restores the pre-op sources. `Dataset.fromGrid(grid)` closes the loop the other way,
wrapping an already-decoded grid as a pre-materialized Dataset so the chain is reachable from a bare grid.
N-ary ops (`combine`/`difference`) are deliberately absent from the layer — "which source is the left
operand" has no answer there — and `layer.rasterize()` throws, since a kind change cannot return the same
layer.

**Still open:** **polygonize** (raster→vector — the other half of "vectorize/rasterize"; unlike rasterize,
this needs contour tracing (marching squares / connected-component boundary tracing), a materially
different and larger algorithm than the point-in-polygon tests the rest of §2 reuses — deliberately not
folded in with the above), and the `gdalwarp -cutline`/`gdal_calc` fast paths for large rasters (a
GDAL-backed performance tier over the pure-JS path above, for rasters too large to hold as decoded grids).

---

## 3. Proprietary & additional file formats

**Problem.** `parseSource` handles geotiff/geojson/kml/kmz/shp; real hydrology/hydraulics work lives in
domain and geospatial formats we can't yet ingest.

**Design.** The materializer/parser registry already generalizes this: `Dataset.registerMaterializer(format, fn)`
(generic geo formats, engine) + **domain adapters** (`parseFimScenario`-style, app-tier, per lab schema).
Format detection extends `detectFormat`; browser parsing uses WASM (GDAL covers many) or a JS parser.

**Candidates** (roughly by value): **NetCDF** (`.nc`, multi-dim stacks → maps onto `Dataset.axes`;
`netcdfjs`), **HEC-RAS** (`.hdf`/`.g0x`/…, the upstream model FIM derives from; HDF5 via `h5wasm`), **SWMM**
(`.inp`/`.out`/`.rpt`, a domain adapter), **GRIB/GRIB2** (weather/precip), **GeoPackage** (`.gpkg`, GDAL/
`sql.js`), **COG** (`.tif`, range-read large rasters; geotiff.js supports it), **FlatGeobuf** (`.fgb`), **LAS/
LAZ** (LiDAR point clouds), **Esri FileGDB** (`.gdb`, GDAL), **ASCII Grid/DEM** (`.asc`).

**First slice.** **NetCDF** (exercises the axes model end-to-end, unlocks temporal/ensemble) + **COG range
reads** (§4). Lab-specific schemas (HEC-RAS/SWMM quirks) stay app-tier adapters; generic containers
(GeoPackage/FlatGeobuf) in the engine. **Research needed:** browser viability + size of each WASM/JS parser;
which belong in the engine vs. an optional plugin so a google-only consumer doesn't download HDF5/GDAL-full.

✅ **Landed: CSV and XYZ** (`io/parse.js`, pure JS, no new dependency; node-tested) — the two formats that
had no open design question, so they went first. Both build vector Datasets (`format: "csv"`/`"xyz"`) and
share the existing generic `vectorMaterializer` (registered in `io/materializers.js`) since they're already
GeoJSON by the time a Dataset exists — no new materializer needed.

- **`csv`** — each row becomes a Feature. Two mapping modes, the caller's choice: a coordinate **column
  pair** (`{ latField, lngField }` → a Point) or a single **geometry column** (`{ geometryField }` — WKT or
  a JSON-encoded GeoJSON geometry per row, so a row can carry any geometry type, not just points). Every
  other column becomes `properties`. Common column names (`lat`/`latitude`/`y`, `lng`/`lon`/`long`/
  `longitude`/`x`, `geometry`/`geom`/`wkt`/`the_geom`) are auto-detected when no mapping is given; on
  failure the thrown `Error` carries `.columns` (the detected headers). **The "let the user map columns"
  seam**: `csvHeaders(text)` is exported (barrel + `io/parse.js`) so a host reads the column names and
  builds a picker **before** calling `parseFile`/`parseSource` with the chosen mapping — the engine owns
  the mechanism (parsing + a documented options contract), a host owns the picker UI, same inversion as
  `registerPalette`/`registerMapProvider`. `wktToGeometry` (POINT/MULTIPOINT/LINESTRING/MULTILINESTRING/
  POLYGON/MULTIPOLYGON — 2-D only, no Z/M, no GEOMETRYCOLLECTION) is exported standalone too. Malformed
  rows (bad coordinates, unparseable geometry cell) are skipped, not fatal.
- **`xyz`** — headerless whitespace/comma-separated `x y z` point files (LiDAR-derived elevation exports,
  survey dumps). `z` lands in `properties.z`; extra columns become `z2`/`z3`/…; `{ swapXY: true }` reads
  northing/easting-first rows. Malformed lines are skipped, not fatal.

✅ **Landed: WaterML/NWIS** (an app-tier domain adapter, node-tested) —
USGS's Instantaneous/Daily Values JSON response (`?format=json`, "WaterML JSON"). Mirrors
`parseFimScenario.js`'s shape: a pure transform (parsed JSON in, generic engine `Dataset`s out), so it never
touches `io/parse.js`. `value.timeSeries[]` (one entry per site×variable) groups into one **`Gauge`** per
site — `{ siteCode, siteName, location, series }` — each `series` entry a `Dataset` with a `time` axis, one
axis entry per reading. **Differs from FIM Scenario's axis shape in one deliberate way**: an NWIS reading has
no separately-fetchable file (the whole series arrives in the one response), so every entry's `ref` is
`null` and the reading itself (`{ value, qualifiers }`) lives directly in `meta` — `select()` would be the
wrong tool here, so `Gauge` adds its own `latest()`/`at()`/`series_()` accessors instead of routing through
`Dataset.select`. `coord` is the ISO timestamp **string** (not a numeric epoch), so — matching
`parseFimScenario`'s time axis — lookups are exact-match/by-index only, not nearest; `latest()` covers the
common case directly. Malformed per-site/per-reading rows are skipped, not fatal, same policy as
`parseFimScenario`. **Not yet done**: fetching a live NWIS URL and rendering a `Gauge` (marker + sparkline,
or feeding a stage into the flood-extent slider) — that consumer wiring is open UI/app work, deliberately
out of scope for the adapter itself.

---

## 4. Data import / export mechanisms

**Problem.** Ingest is file upload + URL `fetch` (`proxiedUrl`); export is `Dataset.download`. Real
deployments need more transports and container handling.

**Design.** A **source registry** keyed by scheme, mirroring the provider/materializer seams:
`registerSource(scheme, fn)` where a URL's scheme (`http`/`https`/`ftp`/`ws`/`s3`) dispatches to a handler
yielding bytes for `parseSource`. Compression is a parallel `registerDecompressor(kind, fn)` applied before
parse.

- **Compression / archives** — beyond `zip` (jszip): **gzip/deflate** via native `DecompressionStream`
  (no dep), **tar**, **bzip2**, **7z** as plugins. Auto-detect by magic bytes / extension.
- **FTP / SFTP** — browsers can't speak FTP; a **proxy-backed** source (`ftp://` → the deployment's proxy).
- **WebSockets** — a **streaming source** for live data (gauge levels, live flood updates): subscribe, emit
  incremental `Dataset` updates / `storage:changed`-style events; pairs with a Layer that re-renders on
  update (`setSources`).
- **Range / chunked reads** — HTTP range requests for **COG** and large rasters; resumable uploads.
- **Cloud & OGC** — S3/GCS presigned-URL fetch; OGC services (WMS/WMTS/WFS/WCS) as sources.
- **Export** — beyond `download`: to Storage (have), to format (GeoTIFF/GeoJSON/PNG via GDAL or canvas), to
  cloud (presigned PUT), a **share** link (serialize a Dataset recipe — `toRecord` — to a URL).

**First slice.** Native `gzip`/`tar` decompression (zero-dep, immediate value) + the `registerSource` seam
with a WebSocket streaming source (live data is the differentiated capability). FTP/cloud are proxy/
credential-bound — spec the proxy contract first.

---

## 5. Headless UI module (`ui/`) — user-mounted, engine never calls it

**Problem.** The library is headless, but a package user *not* rebuilding FIMViz still wants to stand up an
interface quickly (a hover value, a marker info window, a toast, a layer palette/opacity panel) without
hand-rolling it or lifting app-tier code welded to `widget.html`.

**Design.** A **separate module inside the package** (`src/ui/`) the host *may* use,
preserving headlessness by two rules: (1) no **core** module (`package/`/`io/`/`geo/`/`layers/`) imports
`ui/`; (2) `ui/` touches `document`/`window` **only inside functions**, never at import time (same discipline
as `Dataset.download()`) — so importing the barrel still resolves under Node. The engine's only outbound
channels stay the host bus (`notify`/`error`/`emitHost`) + `console`; **the engine never auto-wires or calls
UI** — a `ui/` helper may *take* the bus (`connectToast(fim)`), but the engine never reaches for it. The
`hostEvents.test.mjs` guard is rescoped from "no engine module touches `window`" to "no **core** module does;
`ui/` may (lazily)."

Contents by coupling:

- **Standalone DOM widget** — `createToast(root?) → { show(msg, {type,timeout}), clear() }`; no map, no
  layer. `connectToast(fim)` optionally subscribes it to `notify`.
- **Map-anchored widgets** — `createTooltip(...)` (a **hover** consumer) and a **marker info window** (a
  **click** consumer): thin views over the event-dispatch layer (§1) + the read-models — why §1's first slice
  is in the same build.
- **Layer tools panel** — `createToolsPanel(root, { layer, controls?, pretty? })`: a view bound to
  `layer.settings` (DATASET_LAYER_ADT §6d). `controls` is a declarative spec; presets `rasterControls`/
  `vectorControls` build it from a layer; `pretty:true` injects scoped CSS. It only reads/writes
  `layer.settings` and re-renders on the effect events, so a host's own UI and the panel can't disagree.
- **Read-model renderers** — `renderLegend(legend, {html})`/`renderStats(stats, {html})`, thin over
  `Legend.toHtml()` / a stats table. Ensemble & comparison "legends" are just `getLegend().toJSON()`/
  `.toHtml()` — **no binder**.

**Explicitly out of the package (decided):** the unified Layer **Panel** (too app-opinionated — the host
composes its own from `layer.settings` + read-models); the `bind*Tools` event-inversion **binders** (an
artifact of a fixed `widget.html`, obsolete once settings + effect events exist); **forced layer
exclusivity** — velocity/ensemble mutual-exclusion is *host policy*, so `Layer.exclusive` is **opt-in,
default `false`** (mechanism stays, imposition goes).

### First slice — the one-shot build (ordered by testability)

1. **`LayerSettings` change-model** (DATASET_LAYER_ADT §6d) — engine, node-testable: base + `RasterSettings`
   + `VectorSettings`, effect-class → event mapping, `layer.settings`, the new `recomputed` event.
2. **Event-dispatch first slice** (§1) — `onMapEvent` on google+leaflet for click/hover, `layer.hitTest`,
   `FimMap` z-order dispatch with absorption (geometry + z-order pure → node-tested; provider wiring browser).
3. **UI module** — `createToast`, `createTooltip`, marker info window, `createToolsPanel` +
   `rasterControls`/`vectorControls`, `renderLegend`/`renderStats`.
4. **Exclusivity → opt-in** — `Layer.exclusive` defaults `false`.
5. **Example** — `examples/ui-tools.html`: the manual acceptance check for the browser-only paths.

✅ **Landed:** all of the above, plus **simultaneous mode** (§1), **modal capture / region-draw**
(`captureInteraction`/`releaseInteraction` + `ui/regionDraw.js` → a `SpatialFilter` scoping
`layer.getStats({ filter })`), and the **`fimviz/ui` subpath export** (`dist/ui.js`, its own webpack entry
pulling only the small pure deps — no geotiff/Maps-loader/GDAL — so a headless consumer importing `fimviz/ui`
downloads only that). Also `createInfoWindow`/`bindFeatureInfo`/`propsTable`, `bindHoverValue`, and
`createOperationsPanel` (§2).

**Deferred, with a finding:** `damage`/`velocity` **control presets** are deliberately NOT shipped.
`VelocityLayer` is a Google-only animated canvas driven by positional params (particle density, colour
stops, fade alphas — no simple settings hook), and `DamageLayer` is app-tier, so a `velocityControls`/
`damageControls` preset would bind to knobs that don't exist. The **generalized** `createToolsPanel(root,
{ layer, controls })` already serves them (pass a custom control spec) — the real missing piece is each
subsystem *surfacing its knobs* as a `LayerSettings` sub-model, which is subsystem/app work (and
browser-only), not an engine preset.

---

## 6. Tree-shakeable subpaths (`fimviz/core`)

**Problem, as originally traced.** The barrel forces every consumer to download the whole engine: `mount.js`
(→ `FimViz`/`mount`/`parseFile`, which nearly
every consumer imports) reaches `io/parse.js`, which statically imported `@tmcw/togeojson`, `shpjs`, `jszip`,
`geotiff`, and `@turf/turf` — unconditionally, whether or not the consumer ever parses a file. Separately,
`io/materializers.js` (reached because the barrel re-exports `registerBuiltinMaterializers` from it) **runs
`registerBuiltinMaterializers()` at module scope** — a real side effect, which named-export tree-shaking
cannot remove regardless of usage analysis. Meanwhile `Dataset`, `Storage`, `ColorScale`, `Legend`, `Stats`,
`Filter`/`SpatialFilter`/`PredicateFilter`, `Layer`/`RasterLayer`/`VectorLayer`, `createMap`/
`registerMapProvider`, `ComparisonLayer`/`EnsembleAggregationLayer`, and the raster-grid ops have **zero**
static third-party dependencies (the Google/Leaflet SDK loaders in `mapProvider.js` are already
`import()`-lazy) — a consumer who only wants to render/analyze Datasets they already have (inline data, or
decoded themselves) pays for parsing dependencies it never touches.

**Design.** A second subpath, `fimviz/core` (own webpack entry + `exports` map entry, mechanically the same
shape as the already-shipped `fimviz/ui` split): everything in the zero-dependency cluster above, **minus**
`mount`/`FimViz`/`parseFile`/`csvHeaders`/`wktToGeometry`/the vendored parser re-exports
(`fromArrayBuffer`/`kml`/`shp`/`Loader`). Requires moving `registerBuiltinMaterializers()`'s auto-run out of
`io/materializers.js`'s module scope into an explicit call the *full* `fimviz` entry makes once. The GDAL
reprojector no longer needs the equivalent treatment — it's wired as `materialize.js`'s lazy
`registerDefaultReprojectorLoader` fallback (a closure over a dynamic `import()`), so `fimviz/core` gets
`ds.reproject(crs).grid()` for free with no eager GDAL cost either way; only the *materializer* auto-run
is the thing a `fimviz/core` entry would need to opt out of. `fimviz` (unchanged) stays the zero-setup
default for the common boot-a-map-and-parse-files case; `fimviz/core` is for a consumer building/rendering
Datasets without the parse layer.

**Not started, and the case for it is now much weaker** — because the payload problem was attacked at the
*dependency* level instead, which needed no new entry point and no API change:

- `readCrs`/`crsEquivalent`/`epsgNumber` moved out of `geo/gdal.js` into a pure `geo/crs.js`. They touch no
  GDAL, but living in the module whose first line is `import initGdalJs from "gdal3.js"` put ~190 KB of glue
  in every consumer's initial bundle. `geo/warp.js` now dynamic-`import()`s the warp for the same reason.
- `shpjs` (→ `proj4` + `wkt-parser` + `mgrs`, ~300 KB) and `jszip` (~95 KB) load **on demand**, inside the
  shapefile and `.kmz` branches of `parseSource`. The barrel's vendored `shp` became a thin async wrapper
  rather than a static re-export, since one re-export would have undone the whole thing.
- `@turf/turf` was already shaking down to `@turf/bbox`'s ~22 KB; only `geotiff` (~108 KB) and
  `@tmcw/togeojson` (~34 KB) remain eager.

**`dist/fimviz.js` went 678 KB → 201 KB (−71%)**, and what is left is roughly half our own source. A
`fimviz/core` entry would now be carving up that half — a much smaller prize than the original tracing
suggested, for a permanent second entry point, a second `exports` mapping, a docs split, and the
"which subpath is this class in?" question every consumer then has to answer. Two subpaths (`fimviz` +
`fimviz/ui`) remain the shipped shape; the barrel's *name* count was addressed separately by moving each
registry onto the type it serves (`Layer.registerType`, `ColorScale.registerPalette`, …).

---

## 7. GDAL lifecycle abstraction (over `callGdal`)

**Problem.** `callGdal(method, ...params)` (landed — `geo/gdal.js`, barrel-exported from `lib.js` via
the same dynamic-`import()` pattern as `registerGdalReprojector`) is a deliberately raw, generalized
escape hatch: it just resolves the gdal3.js singleton and calls `Gdal[method](...params)`. That
means every caller repeats the full gdal3.js lifecycle by hand for the common case — construct a
`File`, `callGdal('open', file)`, run the actual operation, `callGdal('close', dataset)`,
`callGdal('getFileBytes', outPath)` to get bytes back, with no wrapper absorbing any of that
ceremony. `warpTo`/`warpToGrid` already hide exactly this boilerplate, but only for `gdalwarp` — the
one utility they were written for; `callGdal` intentionally didn't generalize that lifecycle
handling when it landed, only the method dispatch.

**Design (not started — this section records the shape, not a landed slice).** Two convenience
layers over `callGdal`, matching the two shapes its own doc comment already categorizes:

- **A "run a dataset-based utility, get bytes back" wrapper** — `runGdal(method, arrayBuffer,
  filename, args?, outputName?)` generalizing `warpTo`/`warpToGrid`'s internal shape (open → run
  `method` → close → `getFileBytes`) to any of `gdalwarp`/`gdal_translate`/`gdal_rasterize`/
  `ogr2ogr`, returning a plain `ArrayBuffer`. This is the high-value slice — it's what most callers
  reaching for `callGdal` actually want, and it's a mechanical generalization of code that already
  exists twice (`warpTo`, `warpToGrid`).
- **A "run an info-only utility, get an object back" wrapper** — same open/close shell, but for
  `gdalinfo`/`ogrinfo`, which return a plain object instead of writing an output file (no
  `getFileBytes` step). Cannot share one function with the bullet above without a branch on return
  shape, which is exactly the complexity a caller would want abstracted away.
- **Not folding into a single function**: `gdaltransform` takes coordinates, not a file — it never
  needs `open`/`close` at all, so it stays a direct `callGdal('gdaltransform', coords, options)` call
  with no wrapper needed.
- **A `Dataset`-level convenience** is a further, optional layer on top of `runGdal` once it exists —
  `ds.gdal(method, args, opts)` as a lazy op (same shape as `reproject`/`resampleTo`) that takes the
  op's *encoded* bytes from the root (`ctx.source`, the same source `reproject`'s force already
  reads) and decodes the result through the registered materializer, for the subset of GDAL
  utilities whose output is itself a raster/vector Dataset (not `gdalinfo`/`ogrinfo`/
  `gdaltransform`, whose output is data, not a Dataset).

**First slice.** `runGdal` (the dataset-in/bytes-out wrapper) — highest value, and a close enough
mechanical match to `warpTo`/`warpToGrid`'s existing internals that it's low-risk to extract. The
info-only wrapper and the `Dataset`-level convenience are follow-ons once real usage shows which
GDAL utilities beyond `gdalwarp` callers actually reach for.

---

## 8. Multi-dimensional formats & real temporal datasets (SciWrid Toolkit as a materializer)

**Problem.** §3 names NetCDF as its first slice — "exercises the axes model end-to-end, unlocks
temporal/ensemble" — and it is still unwritten, along with GRIB2 and Zarr. Meanwhile the axes model
itself has only ever been driven by **FIM Scenario**, whose shape is *one file per timestep*: an axis
entry's `ref` is a URL, and `select()` "resolves one axis entry to a child URL-rooted Dataset". Every
real multi-dimensional scientific format is the inverse — **one file, many timesteps**, addressed by
index or date. So the engine has a temporal axis that has never met a temporal *file*, and no way to
read one.

Writing GRIB2/NetCDF/HDF5/Zarr decoders ourselves is the §3 "research needed" item (browser viability
and size of each WASM/JS parser) and is a project in its own right.

**Design.** Treat [SciWrid Toolkit](https://github.com/uihilab/SciWrid-Toolkit) — a sibling lab
library, WASM + JS, reading GRIB2/NetCDF3/NetCDF4-HDF5/Zarr/TIFF-COG/Parquet/Kerchunk — as an
**implementation behind `Dataset.registerMaterializer`**, not as a dependency of the engine. The
seam already exists and is exactly one function wide; nothing in `package/` learns these formats.

The shapes line up unusually well, which is what makes this a materializer rather than a port:

| | SciWrid `extractGrid` | FIMViz `RasterGrid` |
|---|---|---|
| pixels | `data: Float32Array` | `pixels` |
| order | row-major, **row 0 = maxLat** | row 0 = north (`rasterOps.js`'s `zonalStats`/`maskGrid` row→lat math) |
| missing | `NaN` | `NaN` → transparent on colorize, excluded from `Stats` |
| extent | `bbox [minLon,minLat,maxLon,maxLat]` | `bounds {west,south,east,north}` |
| CRS | resampled to WGS84 lat/lon | `EPSG:4326` — what both providers already accept |

The CRS row is the quiet payoff: `extractGrid` resamples onto a geographic bbox, so these formats
arrive **already renderable** and never touch the GDAL warp. Unlike `reproject()`, this path also runs
under Node, so it is coverable by `npm test` rather than joining §5.3's owed browser verification.

- **The one architectural change: generalize an axis entry's `ref`.** Today `ref` is a URL to fetch.
  It becomes *an instruction the materializer understands* — a URL for FIM Scenario, a
  `{ variable, date|index }` selector for NetCDF. `select(coord)` then returns a lazy child whose
  force calls `extractGrid(source, { variable, date, bbox, width, height })`. Because `reduce()` is
  already sugar over `select()` + `combine()`, temporal `mean`/`sum`/`min`/`max` come **for free** the
  moment `select()` works, with no new grid math. And the scenario slider — already resolved as an
  *operation*, `deriveSources(ds => ds.select(t))`, not a setting
  ([DECISIONS §1.1](DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md#11-the-object-models-shape)) — drives a
  NetCDF time axis with no UI change at all.
- **Rejected: the NWIS bypass, a second time.** The WaterML/NWIS adapter (§3) hit this same
  "entries aren't separately-fetchable files" problem and resolved it by routing *around* `select()`
  — `ref: null`, the reading in `meta`, and bespoke `latest()`/`at()`/`series_()` accessors. Correct
  there (a gauge reading is not a grid), but repeating it for NetCDF would leave three mutually
  incompatible axis shapes and a `reduce()` that works on only one of them. Generalizing `ref` folds
  the in-file case into the existing model instead of forking it.
- **Variable becomes a second axis.** A GRIB2/NetCDF file holds N variables; a `Dataset` is one grid.
  `select(coord, { axis })` already takes multiple axes, so variable folds in as axis 1 — with a guard,
  since `reduce()` across a *variable* axis is meaningless in a way it isn't across time.
- **Take the readers, not the renderers.** SciWrid also ships `gridToImageData`/`gridToPNG`/`RAMPS`/
  `gridToGeoTIFF`, which duplicate `colorizeGrid`/`gridToDataURL`/`ColorScale`/the GDAL writer. Ours
  stay — they are the ones wired into `Legend`, `Stats.byClass`, and the `LayerSettings` knobs. The
  dependency is scoped to **decode only**.
- **Bundle discipline is non-negotiable here.** SciWrid carries a ~193 KB wasm plus lazily-loaded
  h5wasm/numcodecs/hyparquet/jsfive. It hangs off an opt-in adapter behind a dynamic `import()` —
  never `io/materializers.js`'s module-scope auto-run, which would put it in every consumer's initial
  bundle and undo §6's 678 KB → 201 KB reduction. Same rule as HDF5/full-GDAL/netcdf in
  Cross-cutting notes below.

**Known friction, priced in rather than discovered later:**

- **`extractGrid` is a resample, not a decode.** It requires the caller to pre-commit to
  `bbox`/`width`/`height`, while the ops (`clip`, `mask`, `combine`'s LHS-conform) assume a Dataset
  has a *native* grid. The adapter must derive one at scan time from `variables[].nx/ny` (GRIB2) or
  `shape` (NetCDF) plus `scan().bbox` — and SciWrid's own docs note that bbox is exact for TIFF but
  not for GRIB2/NetCDF. This is the largest piece of real work and it is format-specific glue, not
  one function.
- **SciWrid is a work in progress** — its test suite is out-of-tree (does not run from a fresh clone)
  and its docs disagree with its code in several places. Mitigation is structural rather than
  procedural: pin a version, and keep the coupling to the one materializer function, so replacing it
  later costs one file instead of a refactor.

**How it is wired today (not yet a published dependency).** SciWrid is vendored as a **packed
tarball**, `vendor/sciwrid-toolkit-<version>.tgz`, referenced from `package.json` as
`"sciwrid-toolkit": "file:vendor/sciwrid-toolkit-0.1.0.tgz"`. `npm pack` honours SciWrid's own
`files: ["dist", "README.md", "LICENSE"]`, so what lands is the built bundle only — 11 files, ~386 KB
unpacked, no `examples/` fixtures (194 MB), no `.git` (219 MB), no C sources. Installed with
`--omit=optional`: `h5wasm`/`numcodecs`/`hyparquet`/`jsfive`/`jpeg-js` are SciWrid's
`optionalDependencies` and are lazy-loaded from a CDN in the browser anyway — add only the ones a
landed slice actually needs under Node (NetCDF4 will want `h5wasm`). The tarball **is** the version
pin, and it keeps a fresh clone installable without a second repository. To refresh:

```bash
cd ../SciWrid-Toolkit && git pull && npm run build      # dist/ is what gets packed
npm pack --pack-destination ../FIMViz.js/vendor
cd ../FIMViz.js && npm install file:vendor/sciwrid-toolkit-<version>.tgz --omit=optional
```

**First slice.** **NetCDF4 only, one vertical:** generalized axis `ref` → materializer → `select()`/
`reduce()` → `RasterLayer.render()` → a time slider on an example page. That proves the seam
end-to-end on the format §3 already picked; GRIB2 and Zarr then become repeat applications of the
same glue rather than new design. `Stats`/`SpatialFilter`/`PredicateFilter`/`ColorScale`/`Legend` are
grid-agnostic and need no work — a temporal statistic is a loop over `select()`.

✅ **Landed: the axis-`ref` generalization** (`package/dataset.js`, node-tested). An entry's `ref` may
now be `{ select: {…} }` — an in-file selector — alongside the existing URL and named-variant forms;
`select()` then returns a child rooted on the parent's own bytes/URL (no second fetch, same `format`,
no `axes` of its own) and the selection reaches the decoder as `root.select`. Discriminated on an
**object-valued** `select` key, so a named URL variant that happens to be called `select` is still a
variant. Round-trips through `toRecord`/`fromRecord`. Existing materializers are untouched:
`root.select` is simply absent for ordinary sources.

✅ **Landed: the NetCDF4 vertical** (`io/sciwrid.js` + `test/sciwrid.test.mjs`).
`parseSciwrid(source, opts?)` turns a `scan()` into a lazy `Dataset` carrying a **time axis of
selector refs**, one entry per timestep; `registerSciwridFormats()` registers the decoder for
netcdf4/netcdf3/grib2/zarr. Verified end-to-end against a real 120-step NLDAS-2 NetCDF4 (Hurricane
Idalia): `select()` → one decoded slice, `clip()`/`Stats` unchanged on it, and
**`reduce('mean'|'max')` collapsing all 120 timesteps in ~3 s with no new grid math** — the predicted
payoff of routing selectors through `select()`. Four decisions worth keeping:

- **Native grid derived at parse time.** `extractGrid` is a resample, so `nativeGridOf()` reads the
  variable's own shape from `scan()` — `'120x96x104'` (string, NetCDF/GRIB) or `[120,96,104]` (array,
  Zarr), CF order, so height/width are the **last two** dims however many lead them — plus
  `scan().bbox`, and stores it on `meta.grid`. A Dataset then has a native grid like any other raster
  and the ops' assumptions hold; `opts.grid` overrides it. A file with no geographic bbox throws
  rather than silently landing on synthetic index axes.
- **Axis coords are epoch milliseconds, not ISO strings.** `selectAxisEntry`'s nearest-match is
  numeric-only, and a time slider needs it; the ISO string stays on `entry.meta.time`. This
  deliberately diverges from the WaterML/NWIS adapter's string coords.
- **Workers off under Node.** `extractGrid` fans out over 5 Web Workers by default — the point of it
  in a browser, and a silent **hang** under Node (no `Worker` global, the pool never resolves, the
  promise never settles). The materializer forces `workers: 0` when `Worker` is undefined;
  `meta.workers` overrides.
- **Preconditions are checked before the dynamic `import()`**, so a misconfigured Dataset fails
  immediately instead of pulling a ~193 KB chunk and a wasm compile to reach an error.

`h5wasm` is a **devDependency** only: SciWrid lazy-loads it from a CDN in the browser and from npm
under Node, so it is needed to run the tests and not to ship. A source-scan test asserts
`io/materializers.js` never names the adapter, which is what keeps the wasm out of the default bundle.

✅ **Landed: GRIB2 and Zarr v2**, the predicted "repeat applications of the same glue" — nearly true,
with one format difference worth recording. Both are node-tested against vendored Idalia fixtures
(Zarr as-is at 1.9 MB; the 26 MB Stage IV GRIB2 trimmed to 4 messages / 930 KB with SciWrid's own
`trim()`), so all three formats the adapter registers are now exercised rather than merely claimed.

- **GRIB2 reports no `shape`.** A message *is* one 2-D field, so `scan()` gives `nx`/`ny` (plus
  `messages` for the count) and nothing else; reading `shape` alone threw "no usable 2-D shape".
  `nativeGridOf` now falls back to `(ny, nx)` — the same (height, width) order as a CF shape's
  trailing pair. That is the whole delta: selectors, `select()`, `reduce()` and the render path are
  untouched.
- **Zarr needed nothing** — its `shape` is an array rather than a string (already handled), and the
  AORC store carries CF coordinates, so it gets a real extent with no override.
- **Curvilinear files are the recurring real-world snag, not a format issue.** Stage IV is
  polar-stereographic, so `scan()` derives no bbox — the identical situation as ocean `tos` products.
  `opts.grid` is therefore a **partial** override: pass `bbox` alone and the pixel dims still come
  from the variable's own shape. The engine still refuses to guess an extent (a wrong one silently
  misplaces every pixel), but the thrown error now names the variable, its shape, the variables
  present, the likely cause, and the exact call that fixes it.

**Surfaced by the example, fixed in the engine:** `ColorScale.getColor(null)`/`('')` coerced to `0`
and returned the domain **minimum's** colour — "no data" rendering as "the lowest reading", the one
confusion `missingColor` exists to prevent — while `NaN` escaped as the malformed string
`rgb(NaN, NaN, NaN)`, `missingColor` was ignored on the palette path entirely, and `getValues()`
returned `undefined`s for every continuous scale. All four fixed with regression tests; the raster
path was never affected because `colorizeGrid` pre-filters `NaN` itself.

**Deliberately out of this slice:**

- **Cubing** (holding an N-D cube as a value and operating on it) — `RasterGrid` and `VectorFeatures`
  are the only two value types, and `reduce()` exists precisely to collapse an axis *to a grid*. A
  third value type would touch materialize, the ops, `Stats`, and `toRecord` round-tripping. Worth
  doing eventually; folding it in here is how the NetCDF slice slips.
- **Temporal range selection** — `select()` resolves a single entry. A `selectRange(from, to)`
  narrowing the axis is genuinely new surface, though SciWrid backs it natively (`t1`/`t2`/
  `dateRange`). A follow-on once single-entry `select()` is proven.
- **Parquet/Kerchunk** — SciWrid reads both, and they are vector/reference-shaped rather than gridded.
  Out of scope until the raster path lands.

---

## Cross-cutting notes

- **Every item hangs off an existing seam** (`registerMaterializer`/`registerReprojector`/
  `registerMapProvider`/the map event listener) — none requires re-architecting the core. The engine names a
  mechanism, a plugin supplies the heavy/proprietary implementation, and a narrow consumer downloads only
  what it uses.
- **Keep the engine headless.** New heavy deps (HDF5, full-GDAL, netcdf) live behind registered seams in
  `io/`, never in `package/` — the rule that kept `Dataset` constructible without GDAL.
- **Plugin boundary.** As the format/op/source lists grow, split them into optional entry points so the base
  bundle stays small (tree-shakeable subpaths — §6 above).
