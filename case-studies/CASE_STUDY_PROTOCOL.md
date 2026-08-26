# FIMViz.js — Case Study Selection and Execution Protocol

**Purpose.** This document fixes the four case studies for Section 5, states the claim each one
settles, and gives an executable procedure for running it. Every study is specified so that the
output is a *record* (numbers, tables, exported provenance files, screenshots) rather than a
narrative, because Section 5 and Section 4 will both be written from those records.

**Selection basis.** The four studies below are drawn from the ten candidates in `CASE_STUDIES.md`
and were chosen against three filters: (i) doability score of 4 or 5 against the engine as it
stands today, so no study depends on unlanded subsystems; (ii) coverage of a distinct capability
axis, so the four together exercise the raster path, the vector path, the temporal axis, the
evaluation path, persistence, and the embedding seam without redundancy; and (iii) an outcome a
domain reader would recognise as a result, not a screenshot.

| #   | Study                                          | Source candidates | Doability | Primary capability axis                     |
| --- | ---------------------------------------------- | ----------------- | --------- | ------------------------------------------- |
| 1   | Modelled extent versus observed delineation    | 5                 | 5         | Evaluation, raster↔vector, headless parity  |
| 2   | Forcing and rainfall driving an event          | 8 (re-scoped)     | 4         | Temporal / multi-dimensional axis           |
| 3   | Terrain and regulatory context, no backend     | 1 + 3             | 5 / 4     | Derived raster ops, vector styling, zonal   |
| 4   | Composed scene embedded in a third-party host  | 7 (re-scoped)     | 4         | Reuse, embedding cost, persistence, exposure |

**Recommended execution order: 3 → 1 → 2 → 4.** Study 3 exercises the raster and vector
paths with nothing missing and produces the reference environment numbers the other three reuse.
Study 1 exercises `rasterize` and `ComparisonLayer`, the subsystem with the least external
validation and the highest differentiated value. Study 2 adds the time axis on its proven format.
Study 4 composes everything and is the only one that needs a second host page, so it goes last.

---

## 0. Shared protocol

Run this once, before Study 3, and reuse the result across all four. Section 4 (Performance
Evaluation) is written from the logs the four studies emit, so instrumentation is not optional in
any of them.

### 0.1 Reference environment

Record and freeze, verbatim, for the Methods paragraph:

- Machine: CPU model, core count, installed RAM, storage class (NVMe/SATA), operating system and build.
- Browsers: Chromium, Firefox, and WebKit, each with full version string. One is designated primary
  (Chromium) and carries every measurement; the other two carry a reduced parity run (ingest plus
  first render only).
- Node version for the headless runs.
- Network: nominal downlink measured at run time, plus one throttled profile (a fixed 4G-class
  shaping preset) used for the ingest measurements only.
- Page hosting: static server command, whether a CORS proxy was needed, and for which endpoint.

### 0.2 Measurement rules

- **Repetitions.** Five repetitions per measurement. Report median and interquartile range, never a
  single run and never a mean alone.
- **Cache state.** Every ingest measurement is reported twice: cold (hard reload, cache disabled,
  IndexedDB cleared) and warm.
- **Instrumentation.** Wrap each stage with `performance.mark`/`performance.measure`. The stage
  boundaries are fixed for all studies: `t_fetch` (request issued → bytes resolved), `t_decode`
  (materializer entry → grid or feature collection returned), `t_op` (chain forced → derived grid
  returned), `t_paint` (colorize → overlay visible), and `t_total` (call issued → first rendered
  frame).
- **Memory.** `performance.memory.usedJSHeapSize` sampled before ingest, after decode, and after
  render, on Chromium only, with the limitation noted.
- **Bytes.** Transferred bytes per stage from the Resource Timing API, not from the file size on
  the server.
- **Laziness check.** Every study includes one measurement of a chain that is *built but never
  forced*, to quantify Section 3.2 as a number rather than a design claim.

### 0.3 Reproducibility artifacts

Each study emits, into a per-study folder:

1. `record.json` — the `Storage`/`toRecord()` export of every Dataset in the final scene. This is the
   compact recipe, not the decoded buffer. **Record both sizes**: recipe bytes versus decoded buffer
   bytes. The ratio is a headline number for Section 3.6.
2. `performance.csv` — one row per timing measurement, columns `study, stage, dataset, format, bytes,
   width, height, cache_state, browser, rep, ms`. *(Named `metrics.csv` in an earlier draft. Renamed
   because Study 1 uses "metric" to mean critical success index, probability of detection, and
   false alarm ratio — a `metrics.csv` full of milliseconds collides with the word in the same paper,
   and a reader who opens it expects agreement statistics.)*
3. `metrics.csv` — one row per **rendered raster surface**: `study, surface, unit, width, height, crs,
   cells_valid, cells_total, min, max, mean, median, stddev, p10, p90, area_m2, no_data`. Emitted at
   the moment each surface is drawn. This is what makes a figure checkable before it is merely
   plausible: a slope panel can look entirely convincing and still be wrong by the ratio between
   degrees and metres, but a mean slope of 41° across the Blue Ridge is rejectable on sight.
4. `results.csv` — the domain result of the study (agreement metrics, zonal table, accumulation
   table), whichever applies.
5. `console.log` — the full engine warning stream (`ds.warnings` plus emitted events), which supplies
   the honest-limitations material for Section 6.
6. Screenshots at a fixed viewport (1600 × 1000, device pixel ratio 2) for every figure listed below.

### 0.4 Data provenance

For every dataset used: full source URL, access date, licence, native CRS, native resolution, file
size, and whether it was accessed live or from a mirrored snapshot. Mirror anything that is not
version-pinned upstream and cite the mirror, since a rapid-mapping activation or a forecast archive
can be revised after publication.

---

## 1. Evaluating a modelled extent against an observed delineation

**Claim settled.** Quantitative flood-map evaluation is a reusable engine capability rather than a
feature of one application, and it yields identical numbers in a browser tab and in a headless batch.

**Reviewer objection answered.** *"Any mapping library plus a canvas could draw this."* Drawing is not
the contribution. Alignment policy, categorical resampling, nodata semantics, contingency
classification, and region-scoped metrics are, and they are the parts every group currently rebuilds.

### Data

- **Observed:** a Copernicus EMS Rapid Mapping activation delineation product (GeoJSON, shapefile, or
  GeoPackage). Selection criteria, applied in order: a fluvial or compound event; a delineation
  product rather than grading only; an area of interest between roughly 200 and 5,000 km²; and a
  publicly available modelled extent covering the same footprint and event window.
- **Modelled:** one of — a HAND-derived FIM for the matching reach and stage, an NWM-driven inundation
  product, or a published two-dimensional hydraulic model extent (HEC-RAS or SRH-2D) if one exists for
  the site.
- **Continuity pairing (retain).** The HAND versus SRH-2D pairing at Batesville, carried over from the
  companion application work, is run as a second instance of the identical procedure so readers of
  that paper can anchor the new results against a familiar case.
- **Verify before committing:** live endpoint availability, CORS headers, activation identifier, and
  whether the delineation is distributed as observed extent or as a difference product.

### Procedure

1. Ingest both products through `fim.addDataset(...)`. Record `t_fetch` and `t_decode` per product,
   plus `ds.crs`, `ds.bounds`, and `ds.warnings`.
2. Reproject to a common CRS with `ds.reproject(crs)`, then force it. Record the cost, because
   Section 4.3 needs the cost of a warp and the frequency
   with which it is avoidable.
3. Rasterize the observed vector delineation onto the modelled grid: `observed.rasterize({ width,
   height, bounds, burnValue: 1 })`. State the alignment policy explicitly (`GRID_POLICY` setting) and
   the resampling method. **Categorical masks use `nearest` or `mode`; a bilinear resample of a binary
   mask is a defect, and the study should show why in one sentence.**
4. Define wetness. For a depth raster, the wet threshold is a stated parameter, not a default. Run the
   full metric set at three thresholds and report the sensitivity.
5. Build the comparison: `fim.addLayer('comparison', { sources: [modelled, observedRasterized] })`,
   then `layer.compute()`.
6. Derive the contingency table (hit, false alarm, miss, correct negative) and the metrics: critical
   success index, probability of detection, false alarm ratio, intersection over union, and bias
   ratio. **State each formula in the paper**, including the treatment of nodata and the denominator
   convention for intersection over union.
7. Region-scoped metrics: define three subregions with `SpatialFilter` (channel corridor, urban
   footprint, floodplain margin) and call `layer.metricsForMask(...)` for each. This is the result a
   practitioner uses; a single basin-wide critical success index hides where a model actually fails.
8. Render the disagreement map with a four-class categorical scheme and a legend generated from the
   data.
9. Export `record.json`, reload it into a fresh page, and confirm the rehydrated view reproduces the
   same metrics. Record the round-trip time and the recipe size.
10. **Headless batch.** Run the identical chain in Node over N ≥ 5 activation/model pairs. Record
    per-pair wall time and the maximum absolute difference between browser and Node metric values.

### What to record

`results.csv` columns: `pair_id, event, region, modelled_product, observed_activation, grid_w, grid_h,
crs, wet_threshold, TP, FP, FN, TN, CSI, POD, FAR, IoU, bias, region_scope, runtime_ms, environment`.

### Figures and tables

- **Fig. 1.1** — Four-panel figure at a common extent and scale bar. Panels: (a) modelled extent;
  (b) observed delineation; (c) categorical disagreement map (hit, false alarm, miss, correct
  negative) with the data-derived legend; (d) the three subregion boundaries overlaid on (c).
  *Caption to generate: composition of the four panels, the event and date, the wet threshold used,
  the alignment policy, and the CRS.*
- **Table 1.1** — Contingency table and the five metrics, basin-wide and per subregion, with the
  three-threshold sensitivity as additional rows.
- **Table 1.2** — Browser versus headless: per-pair runtime and maximum absolute metric difference.
- **Fig. 1.2** — Distribution of critical success index across the N batch pairs (box plot or strip
  plot), which makes the batch claim visible rather than asserted.

### Known pitfalls

Nodata conflated with zero; a delineation that is a difference product rather than an extent; an
observed polygon whose interior holes matter (ring union is the engine's documented simplification, so
state it); axis order in the declared CRS; and modelled products distributed in a projected CRS whose
warp dominates the runtime.

---

## 2. Forcing and rainfall driving a flood event

**Claim settled.** Multi-dimensional and temporal products enter through the same path as a single
image, and a time axis can be selected, reduced, and animated in a browser without a server-side
subsetting service.

**Reviewer objection answered.** *"Web map libraries already show rasters."* None of them carry an axis
model. The result here is a forcing-to-response sequence, which is a hydrologic argument, not a
rendering one.

### Data

- **Primary (proven path):** gridded NetCDF forcing — National Water Model or NLDAS-2 precipitation —
  over a documented event. The Hurricane Idalia fixture (120 timesteps) already verified against the
  axis slice is the recommended starting point, since it makes the study a measurement rather than a
  bring-up.
- **Secondary (optional):** CHIRPS daily precipitation NetCDF for a longer antecedent window, when a
  multi-week accumulation is wanted alongside the hourly event window.
- **Explicitly out of scope:** the Zarr variant, until range reads land. If it is attempted, report it
  as a limitation with a number, not as a silent omission.

### Procedure

1. Ingest the NetCDF and print `ds.axes`. Record axis length, chunk layout, decode time for the first
   timestep, and the file's declared units.
2. Select single timesteps across the axis (`ds.select(...)`). Measure the first selection and the
   twentieth to expose any caching effect, and report both.
3. Scrub. Drive the axis slider across all timesteps and record per-frame time, dropped frames, and
   peak heap. State whether playback is real time at the reference resolution.
4. Event accumulation: `ds.reduce('sum', { axis: 'time' })` across the full window. Record compute time
   against timestep count at three window lengths (for example 12, 48, and 120 steps) so the scaling is
   visible.
5. Rolling accumulation: build 24-hour rolling windows. **The engine has no `selectRange` today**, so
   this is host glue over `select` plus `combine`. Record the host code required (lines, and the shape
   of the loop), because this is the honest statement of a gap and belongs in Section 6.
6. Basin summaries: `ds.zonalStats(zones)` over watershed or county polygons on the accumulation grid,
   giving basin-mean and basin-maximum event rainfall.
7. Relate forcing to response: place the accumulation grid beside the observed or modelled extent from
   Study 1 where footprints allow, and run `accumulation.groupBy(extentMask)` to obtain the rainfall
   distribution inside and outside the inundated area. This is the analytical payoff of the study.
8. Laziness measurement: build a five-op chain on the axis and never force it. Record elapsed time and
   bytes transferred, against the same chain forced.

### What to record

`results.csv` columns: `window_start, window_end, n_steps, reduce_op, zone_id, zone_name, mean_mm,
max_mm, sum_mm, area_km2, compute_ms`; plus a second table for the inside/outside extent grouping.

### Figures and tables

- **Fig. 2.1** — Filmstrip of six timesteps across the event, sharing one colour scale and one legend,
  with the axis slider position marked. *Caption to generate: event, source product, variable, units,
  timestep interval, and the shared scale bounds.*
- **Fig. 2.2** — Event accumulation map beside the flood extent, same extent and scale, with the
  basin polygons overlaid.
- **Fig. 2.3** — Bar chart of basin-mean accumulation per zone, generated from `results.csv`.
- **Table 2.1** — Axis operations and their cost: select (first and warm), reduce at three window
  lengths, zonal statistics, each with median and interquartile range, cold and warm.
- **Table 2.2** — Rainfall distribution inside versus outside the inundated area, from `groupBy`.

### Known pitfalls

Calendar attributes and non-standard time units; accumulation units (rate versus depth per step — a
sum over a rate is wrong and the study must state which it did); a fill value that is not the declared
one; and a rotated or non-geographic grid, which is a reprojection cost, not an unsupported format.

---

## 3. Terrain and regulatory context without a backend

**Claim settled.** Analysis-grade raster and vector work — derived terrain surfaces, categorical
styling driven by data, legends generated from the data, and region statistics — runs against public
endpoints from a static page with no server-side compute.

**Reviewer objection answered.** *"This is a thin wrapper over an existing renderer."* Slope, aspect,
hillshade, zonal statistics, and value-binned reduction are computed in the client, and the
zero-backend property is a deployment argument with cost and data-governance consequences that a
wrapper cannot make.

### Data

- **Terrain:** Copernicus DEM 30 m Cloud-Optimized GeoTIFF from AWS Open Data. Already EPSG:4326, so
  the CRS precondition is met without a warp — which makes it the clean baseline for ingest timing.
- **Regulatory:** FEMA National Flood Hazard Layer, either from the ArcGIS REST service as GeoJSON or
  as a state-level shapefile download. Result paging is host work; record how much.
- **Study area:** one community with mixed zone classes (AE, VE, X, and a floodway) and terrain relief
  sufficient for slope to be meaningful. Pick a second, flatter site as a contrast if time allows.

### Procedure

1. Ingest the DEM. Record cold and warm `t_fetch`, `t_decode`, and transferred bytes at three tile
   sizes. **Whole-file fetch is the current bound**; state the resolution ceiling it imposes and the
   file size at which the page becomes unusable, measured rather than estimated.
2. Terrain surfaces: `ds.slope()`, `ds.aspect()`, `ds.hillshade()`. Record compute time against grid
   size at three sizes each. Note that these are lazy ops, and measure the built-but-unforced case once.
3. Nodata handling: render with the `terrain` palette and confirm ocean or void nodata does not take
   the ramp's minimum colour. **This is a stated engine rule and the figure should make it visible** —
   include a panel with `missingColor` deliberately unset as the counterexample.
4. Histogram and readout: `Stats.raster` for the elevation histogram, `layer.enableHover()` plus
   `valueAt()` for the point readout. Record hover latency.
5. Ingest the NFHL vector. Record feature count, decode time, and the host code required for result
   paging.
6. Categorical styling by `FLD_ZONE` through the per-feature style function. **A categorical
   `ColorScale` does not exist today**; record what the host had to write, and what `Legend` and
   `byClass` could not supply as a result. This is a concrete Section 6 limitation with evidence.
7. Legend generated from the data rather than a hardcoded class list.
8. Zonal analysis: `dem.zonalStats(nfhlZones)` for elevation distribution per regulatory zone, and
   `slope.groupBy(zoneRaster)` — or `dem.groupBy(slope, { bins: 5 })` — for the hypsometric breakdown.
   The comparison of terrain distribution across AE versus X zones is the domain result.
9. Neighbourhood-scale statistics: define two or three `SpatialFilter` regions and report region
   statistics, which is the workflow a floodplain administrator actually performs.
10. Zero-backend accounting: total server-side compute (zero), total static bytes served by the host,
    and the list of third-party endpoints contacted. State whether the DEM or NFHL request required a
    CORS proxy, since that qualifies the claim and should be stated plainly rather than glossed.

### What to record

`results.csv` columns: `zone_class, n_features, area_km2, elev_min, elev_max, elev_mean, elev_p10,
elev_p90, slope_mean, cell_count, compute_ms`.

### Figures and tables

- **Fig. 3.1** — Two panels at a fixed shared extent: elevation with hypsometric ramp, and slope,
  both client-side, one shared scale bar and north arrow. *Caption to generate: source product,
  resolution, grid dimensions, the Horn's-method attribution for slope, and the statement that no
  server-side computation was involved.* Hillshade is deliberately not a panel here — it appears
  under the zones in Fig. 3.2, where the translucent fills let the relief read through, and a third
  panel of it in Fig. 3.1 would duplicate that for no analytical gain. Aspect is computed and timed
  (see the procedure) but figures nowhere: it answers nothing about elevation or slope by zone, and
  its `metrics.csv` row is the record that it ran.
- **Fig. 3.2** — NFHL zones styled categorically with the data-derived legend, drawn translucent over
  the hillshade.
- **Fig. 3.3** — Two-panel nodata comparison: `missingColor` set versus unset. Small, and it earns its
  place by making a rendering rule falsifiable.
- **Table 3.1** — Elevation and slope distribution per regulatory flood zone.
- **Table 3.2** — Client-side compute cost: slope, aspect, hillshade, zonal statistics, and grouped
  reduction, against grid size.

### Known pitfalls

Digital elevation model tiles that straddle the antimeridian; NFHL geometries with invalid rings;
result paging silently truncating the feature set (check the returned count against the service's
reported count); and slope computed on a geographic grid without a metre conversion, which produces a
plausible but wrong surface — state the handling.

---

## 4. A composed flood scene embedded in a third-party host

**Claim settled.** The engine is adoptable in pieces, embeds in a host that owns its own markup and
styling, runs without a browser, and survives a change of map backend. The integration cost is stated
as a number.

**Reviewer objection answered — this is the one that carries it.** *"A comparable library could be
generated on demand."* The response is not a claim about difficulty. It is that the contribution is a
factored capability envelope with defined seams — layer-type, map-provider, materializer, palette, and
resampler registries — plus a provenance format, and that this study measures what adopting it costs
in four different hosts. A generated one-off has no seams to measure.

### Part A — Embedding cost across four hosts

Build the same composed scene four times:

1. **Minimal static page.** Plain HTML, no framework, no bundler, ESM import from a served path.
2. **A framework host.** React or Vue, where the host owns all markup and the engine's read-models
   (`ColorScale`, `Legend`, `Stats`, `Filter`) drive host components. **The engine's own UI kit is not
   used here** — that is the point of the read-model contract.
3. **Partial adoption inside a foreign map.** Use only `ColorScale` plus `Stats` plus one derived
   raster op inside an existing Leaflet or OpenLayers page, with the engine's map layer never mounted.
   This is the incremental-adoption claim, and it is the most persuasive single item in the study.
4. **Headless Node.** No DOM. The chain runs, metrics are computed, and a PNG is written from
   `gridToDataURL` or the colorized buffer.

For each host record: lines of host code, dependencies added, gzipped bundle delta, time from an empty
project to a first rendered scene (wall clock by one implementer, stated as such), whether any engine
CSS was required (expected: none), and which registries the host had to touch.

Then swap the map provider through `registerMapProvider` and record what changed in host code and
which capabilities degraded. **The advanced overlay tier is available on one backend only**; this study
is where that limitation is measured rather than asserted.

### Part B — The composed scene and its exposure result

1. Compose extent, depth, velocity, and damage products for one event in a single view, with the layer
   panel driving them.
2. Add an ensemble agreement layer over N ≥ 4 extent members (`ensembleAgreement`), giving the
   agreement count surface.
3. Confirm the reuse property with a measurement: render M layers derived from one source and compare
   against a naive re-decode per layer. **This is the number that turns Section 3.2 from a design claim
   into evidence**, and it belongs to Section 4.4 as well as here.
4. Exposure analysis (the re-scoped Study 7): rasterize the flood extent, run
   `extent.zonalStats(adminPolygons)` over census tracts or municipal boundaries, and drive a
   choropleth from the result with `colorBy`. Report exposed area per unit and, where a public
   population or building count attribute exists on the polygons, exposed count per unit. This gives
   the study a socio-economic decision-support outcome rather than a rendering outcome.
5. Persistence and provenance: save the whole scene to `Storage`, close the page, reload from the
   recipe, and confirm the rehydrated scene is identical. Record recipe bytes against decoded bytes,
   and the rehydration time. Export one dataset back out to a standard format and confirm it opens in
   desktop GIS software (name the software and version).

### What to record

- `hosts.csv`: `host, loc, deps_added, bundle_kb_gzip, time_to_first_render_ms, engine_css_used,
  registries_touched, capabilities_degraded`.
- `exposure.csv`: `admin_unit, area_km2, flooded_area_km2, pct_flooded, exposed_count, compute_ms`.
- `reuse.csv`: `n_layers, one_decode_ms, naive_redecode_ms, peak_heap_mb_each`.

### Figures and tables

- **Fig. 4.1** — The composed scene: extent, depth, velocity, and damage in one view, with the layer
  panel visible. *Caption to generate: the four products, their sources, the event, and a note that the
  host page supplies its own markup and styling.*
- **Fig. 4.2** — The same engine in four hosts, as a two-by-two panel: static page, framework host,
  foreign map with partial adoption, and the headless Node output written to file. This figure is the
  paper's central reuse evidence and should be built to carry that weight.
- **Fig. 4.3** — Ensemble agreement surface over N members, with the agreement-count legend.
- **Fig. 4.4** — Exposure choropleth by administrative unit, derived from the zonal table.
- **Table 4.1** — Integration cost across the four hosts.
- **Table 4.2** — Provenance record: recipe size against decoded size, rehydration time, and the
  export format round trip.
- **Table 4.3** — Reuse measurement: M layers from one decode against M decodes.

### Known pitfalls

Framework strict mode double-mounting the map; a bundler that fails on the dynamic decoder imports —
which, if it happens, is a real finding and belongs in Section 6; administrative polygons whose
attributes carry population for only part of the study area; and the temptation to use the engine's UI
kit in the framework host, which would defeat the purpose of that panel.

---

## 5. What each study contributes to the paper

| Study | Section 4 measurements it supplies                            | Section 6 limitations it evidences                          |
| ----- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| 3   | Ingest by format and size; warp cost; derived-op scaling       | Whole-file reads; no categorical colour scale                |
| 1   | Analysis throughput; browser–headless parity                   | Alignment and resampling policy; nodata conventions          |
| 2   | Temporal decode, select, reduce scaling; laziness payoff       | No range selection primitive; Zarr path unproven             |
| 4   | Deferred-computation payoff; rehydration cost                  | Single-backend advanced overlay tier; memory ceilings        |

Once `results.csv`, `metrics.csv`, `performance.csv`, and the figure set exist for all four, the next drafting step is
Section 5 and the results narrative, then Sections 3 and 4, then Sections 1 and 2, following the
reverse order agreed for this manuscript.
