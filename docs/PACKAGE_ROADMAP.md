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

**Still open:** **polygonize** (raster→vector — the other half of "vectorize/rasterize"; unlike rasterize,
this needs contour tracing (marching squares / connected-component boundary tracing), a materially
different and larger algorithm than the point-in-polygon tests the rest of §2 reuses — deliberately not
folded in with the above), and the `gdalwarp -cutline`/`gdal_calc` fast paths for large rasters (a
GDAL-backed performance tier over the pure-JS path above, for rasters too large to hold as decoded grids).

---

## 3. Proprietary & additional file formats

**Problem.** `parseSource` handles geotiff/geojson/kml/kmz/shp; real hydrology/hydraulics work lives in
domain and geospatial formats we can't yet ingest.

**Design.** The materializer/parser registry already generalizes this: `registerMaterializer(format, fn)`
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

**Problem.** The barrel forces every consumer to download the whole engine (CLAUDE.md's "public export
surface" note). Tracing the actual import graph: `mount.js` (→ `FimViz`/`mount`/`parseFile`, which nearly
every consumer imports) reaches `io/parse.js`, which statically imports `@tmcw/togeojson`, `shpjs`, `jszip`,
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

**Not started.** No ✅ — this is a proposal, not a landed slice. Two subpaths, not per-class subpaths: a
subpath per export multiplies webpack entries/`exports` map entries/docs roughly 15-20x for a payoff that
only benefits a consumer wanting a sliver of the library — disproportionate for the coarse dependency
boundary actually found above.

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

## Cross-cutting notes

- **Every item hangs off an existing seam** (`registerMaterializer`/`registerReprojector`/
  `registerMapProvider`/the map event listener) — none requires re-architecting the core. The engine names a
  mechanism, a plugin supplies the heavy/proprietary implementation, and a narrow consumer downloads only
  what it uses.
- **Keep the engine headless.** New heavy deps (HDF5, full-GDAL, netcdf) live behind registered seams in
  `io/`, never in `package/` — the rule that kept `Dataset` constructible without GDAL.
- **Plugin boundary.** As the format/op/source lists grow, split them into optional entry points so the base
  bundle stays small (tree-shakeable subpaths — tracked as future work in CLAUDE.md).
