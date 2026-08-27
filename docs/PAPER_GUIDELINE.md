# FIMViz.js paper — drafting guideline

Target venue: *Environmental Modelling & Software* (Elsevier), full research paper with a
Software availability section. This guideline fixes the word budget, the reserved vocabulary, the
claim each section settles, the evidence each claim needs, and the corrections the outline requires
before drafting starts. It is written against the repository at `C:\projects\FIMViz.js` as of
2026-08-27.

Working title, unchanged:

> FIMViz.js: A reusable JavaScript engine for flood inundation map visualization, analysis, and
> evaluation in the browser

---

## 1. Venue constraints

These are constraints, not preferences.

| Item | Setting |
| --- | --- |
| Body length | 8,000 words excluding abstract, references, and the Software availability box |
| Abstract | 150-250 words, unstructured, no citations |
| References | Elsevier Harvard (name-year), `\citep`/`\citet` equivalents in prose |
| Person | First person plural is allowed in EMS. Use "we" for what the authors did |
| Headings | Numbered, three levels maximum |
| Software availability | Required: name, developers, contact, year first available, hardware and software required, availability and cost, program language, program size |
| Declarations | CRediT author statement, generative-AI declaration, data availability statement |
| Highlights | 3-5 bullets, 85 characters each |
| Graphical abstract | Optional; Fig. 4.2 (one engine, four hosts) is the candidate |

Word budget by section. Do not pad to reach it, and do not exceed it to be thorough.

| Section | Words | Notes |
| --- | ---: | --- |
| 1 Introduction | 900 | including 1.1 and 1.2 |
| 2 Background and related work | 1,100 | 2.3 is a table plus 150 words |
| 3 System architecture | 2,200 | the largest section; it carries the contribution |
| 4 Performance evaluation | 1,100 | mostly tables and figure captions |
| 5 Case studies | 1,800 | 450 each across four studies |
| 6 Discussion and limitations | 700 | |
| 7 Future work | 200 | |

---

## 2. Reserved terms

One term per concept for the whole document. Define each at first use, then reuse the same word.
Elegant variation is a defect here, because most of these words are also loose English.

| Reserved term | Means | Never write instead |
| --- | --- | --- |
| engine | FIMViz.js itself | framework, library, platform, toolkit, approach, solution |
| the package | the npm distribution of the engine | — |
| Dataset | the immutable source description plus its op chain | data object, source object |
| Layer | one rendering of a Dataset | view, display object |
| op, op chain | a deferred operation and its sequence | pipeline, workflow, transformation graph |
| force | executing an op chain (`grid()`, `features()`, `stats()`) | evaluate, resolve, trigger |
| materializer | the per-format decoder registered on `Dataset` | reader, parser, driver |
| map provider | the Google Maps or Leaflet backend | seam, backend, renderer |
| provider interface | the contract a map provider implements | seam, adapter layer |
| read-model | `ColorScale`, `Legend`, `Stats`, `Filter` | view model, widget model |
| recipe | the `toRecord()` export: source plus ops, no buffer | serialization, snapshot |
| grid | a decoded raster (`RasterGrid`) | raster, when the decoded array is meant |
| product | a flood data product (extent, depth, ensemble, velocity, damage) | dataset, when the domain object is meant |
| host | the application embedding the engine | client, consumer, user (for the application) |
| runtime | a UI implementation registered with `registerRuntime` | plugin, module |
| headless | running with no DOM | server-side, offline |

Words that are both ordinary English and a defined quantity in this paper — watch every use:

- **bias** — reserve for the metric *b* in Section 5.1. For anything else write "systematic error".
- **model** — reserve for the hydraulic or hydrologic model. The engine's classes are the
  **object model**, always spelled in full.
- **resolution** — say "grid resolution" or "display resolution" every time.
- **sample**, **significance**, **error**, **weight** — do not use loosely anywhere.

`seam` appears throughout the repository documentation and is on the banned-word list for this
paper. Keep it in the code docs; write **provider interface** in the manuscript.

---

## 3. Section briefs

Each brief gives the claim, the evidence, the content, and the moves to avoid. The first sentence
of every section must be a standalone summary: a reader skimming heads should get the argument from
those sentences alone.

### 1. Introduction — 900 words

**Claim.** Flood inundation map (FIM) practice requires several heterogeneous product types, and
the capabilities to view, derive from, and evaluate them are rebuilt per project because no
reusable component exposes them.

**Content, in funnel order per paragraph.**

1. Flood risk and the role of inundation mapping in mitigatory decision support. Cite the FIM
   literature: HAND-based mapping, two-dimensional hydraulic modelling, NWM-driven products,
   satellite-derived delineations. One paragraph, no more.
2. Product heterogeneity. Extents, depths, ensembles, velocity fields, and damage records differ in
   dimensionality, in the rendering they need, and in what a derived output means. Name the five
   product types here, once, and reuse them in Table 3.4 and Section 5.
3. The rebuilt capabilities: data ingest, reprojection, color scaling, overlay rendering, and
   agreement metrics. State the consequence rather than defending it — every project that needs
   agreement metrics writes contingency classification and nodata handling again.
4. The gap: generic web-mapping libraries carry strong primitives and no flood-product model;
   hydroinformatics libraries carry analysis and no FIM rendering or evaluation.

**1.1 Motivation.** Three reasons a library and not an application: embedding inside a host that
owns its own markup, independent testing of a capability without a map, and partial adoption of one
or more parts. Keep this to 150 words. It is the paragraph most at risk of importance inflation.

**1.2 Contributions and organization.** Five bullets, each naming the section that delivers it:

1. An object model that separates an immutable Dataset from its renderings, so one decode backs
   many Layers (§3.3).
2. Deferred evaluation across ingest, ops, and decoder loading, quantified rather than asserted
   (§3.2, §4.4).
3. A domain product taxonomy realized as layer types and derived raster operations, including
   pixel-wise agreement metrics with stated nodata and denominator conventions (§3.4, §5.1).
4. Framework-neutral read-models and a provider interface, letting a host bind its own UI and swap
   map backends (§3.5, §5.4).
5. A recipe-based provenance format that rehydrates a scene from source plus ops rather than a
   decoded buffer (§3.6, §5.4).

Then one roadmap paragraph. One signpost per major section is enough for the whole paper; this is
it.

**Avoid.** "Has attracted growing attention", "in an increasingly complex world", "novel". Open with
the problem.

---

### 2. Background and related work — 1,100 words

**Claim.** No existing component exposes FIM viewing, derivation, and evaluation as capabilities a
third-party application can adopt in pieces.

**2.1 Flood visualization platforms and viewers.** Cite the platforms; do not reproduce their
architecture arguments. The point to make is extractability: capability is bound to the
application even where the source is open. Name two or three concrete cases and stop.

**2.2 General-purpose web geospatial and hydroinformatics libraries.** Leaflet, OpenLayers,
deck.gl, and georaster-layer supply rendering primitives and carry no flood-product model, no axis
model, and no agreement metrics. HydroLang and HydroLang-ML are the compositional precedent this
work follows into mapping — state what is inherited (module composition, headless operation,
registry extension) in one sentence each, then cite.

**2.3 Where FIMViz.js sits.** One table, 12 capabilities as rows, 4 tiers as columns, with a
150-word reading of it underneath. Proposed rows, each traceable to code:

| # | Capability | Traced to |
| --- | --- | --- |
| 1 | Multi-format ingest (raster and vector) | `io/parse.js`, `io/materializers.js` |
| 2 | Multi-dimensional and temporal ingest | `io/sciwrid.js`, `SCIWRID_FORMATS` |
| 3 | Client-side reprojection | `io/reprojector.js`, `geo/gdal.js` |
| 4 | Deferred op chain with composable terminals | `package/dataset.js` |
| 5 | Derived raster operations (mask, clip, reclassify, combine, terrain) | `package/rasterOps.js` |
| 6 | Grid alignment and resampling policy | `geo/resample.js`, `GRID_POLICY` |
| 7 | Pixel-wise agreement metrics | `package/comparisonMetrics.js` |
| 8 | Zonal and grouped statistics | `zonalStats`, `groupByGrid`, `package/stats.js` |
| 9 | Value-to-color engine and derived legend | `package/colorScale.js`, `package/legend.js` |
| 10 | FIM product layer types | `package/layer.js`, `comparisonLayer.js`, `ensembleAggregationLayer.js`, `src/layers/` |
| 11 | Map-backend independence | `package/mapProvider.js` |
| 12 | Client-side persistence and provenance | `io/storage.js`, `Dataset.toRecord` |

Tier columns: *generic web-mapping library*, *flood viewer application*, *hydroinformatics
library*, *FIMViz.js*. Mark each cell present, partial, or absent, and define what partial means in
the caption. State capability differences rather than hiding them — a table with FIMViz.js present
in all twelve cells will not be believed.

**2.4 Relation to the companion application.** One paragraph. FIMApp is a browser application built
on a subset of this engine. Cite it; do not describe its internals; do not re-argue its
contribution.

---

### 3. System architecture — 2,200 words

**Claim.** The engine factors FIM capability into primitives with defined extension points, so a
host adopts what it needs and supplies the rest.

Section 3 has six figures and one table, all drawn and listed under "Figure inventory" below.

**3.1 Architecture overview** (350 words). `figures/fig-3-1-architecture.svg`: data primitives →
object model → provider interface → optional UI kit → host application, with the engine's outbound
event bus drawn as the only engine-to-host channel, and the registries marked as the points where an
external system attaches. `figures/fig-3-2-dependency-graph.svg` is the evidence behind the layering
claim — 57 modules and 110 edges forming a directed acyclic graph — and argues §3.1, not §3.2. Two
properties to state plainly here, both verifiable:

- The engine imposes no markup and no styling, and it runs with no DOM. `src/ui/` is a separate
  module the core never imports, published as its own bundle (`fimviz/ui`).
- The engine is UI-agnostic. It is **not** fully renderer-agnostic: vector Layers render on either
  map provider through a neutral style vocabulary translated per SDK, while raster overlays extend
  `google.maps.OverlayView` by inheritance and render on Google Maps only. Scope this claim at
  first statement. Deferring it to Limitations will read as concealment to a reviewer who opens the
  repository.

**3.2 Deferred work as the organizing principle** (350 words). Three deferrals, each with the
mechanism named:

1. Nothing is fetched or decoded until a terminal forces it. `Dataset.fromURL` holds a URL; the
   materializer runs on the first `grid()`, `features()`, or `stats()`.
2. Ops compose before they compute. `reproject`, `select`, `clip`, `mask`, `reclassify`, `combine`,
   `resampleTo`, `slope`, `aspect`, `hillshade`, `rasterize`, and `reduce` each return a derived
   Dataset carrying an op descriptor. The chain executes once, at the terminal.
3. Decoders and the reprojector load on demand through dynamic import. Importing the package barrel
   loads no GDAL; `registerDefaultReprojectorLoader` pulls in `gdal3.js` on the first forced
   reproject, and an application that never reprojects never downloads it.

`figures/fig-3-4-deferred-work.svg` carries this section: a four-op chain built at zero cost, the
force boundary, the six stages that run once when a terminal crosses it, and the reuse of the
memoized grid against the path avoided. Its stage brackets use the same names §4.1 fixes
(`t_fetch`, `t_decode`, `t_op`, `t_total`), so the figure and the timing tables read against each
other. Do not restate the figure in prose — give the reader the one thing to take from it and point
to it by number.

**3.3 Datasets and Layers** (350 words). `figures/fig-3-3-object-model.svg`, drawn from
`docs/CLASS_DIAGRAM.md`. Dataset is the source: immutable, composable, and carrying its own CRS, bounds, axes, and warnings.
Layer is one rendering. One Dataset backs many Layers. The consequence to state: a comparison or
ensemble product reuses a decoded base grid rather than re-reading it, which §4.4 and §5.4 measure.

**3.4 A taxonomy of flood products** (350 words). One table: product type → sources required →
rendering strategy → derived outputs → where it lives in the engine. Split the last column honestly:

- Registered on the core barrel: `vector`, `raster`, `comparison`, `ensembleAgreement`.
- Opt-in overlay barrel (`src/layers/`, Google Maps only): depth, ensemble, velocity.
- HAZUS damage aggregation is pure compute in `package/hazusDamage.js`, currently marked as not part
  of the public API and used by the companion application.

This section is where the domain content lives, and it is what separates the engine from a generic
mapping toolkit. It is also where an overstated table will be checked first.

**3.5 Read-models** (300 words). `figures/fig-3-5-read-models.svg`: the four objects, the contract
they share, and four consumers binding to it — a framework host, the DOM kit, a headless script, and
no consumer at all. `ColorScale`, `Legend`, `Stats`, and `Filter` are portable framework-neutral
objects with no DOM dependency. A React, Vue, plain-DOM, or headless consumer
binds to the same objects. State the payoff as a testable property: a headless script obtains the
same numbers a panel would display, from the same call. `ColorScale` has three coloring modes
(palette, explicit stops, control points); say which, once, and carry the numeric-versus-categorical
limitation into §6 (see correction C7).

**3.6 Persistence, provenance, and reproducibility** (250 words). `Storage` is a generic IndexedDB
wrapper: the engine names no database, table, or deployment format, and the host owns the schema.
`toRecord()` writes a recipe — source plus op descriptors — rather than a decoded buffer, so a scene
rehydrates to the same view elsewhere at a fraction of the bytes. The recipe-to-buffer size ratio is
the headline number; it belongs to §5.4, not here. `Dataset.download()` and `Stats.download()` are
the export path.

**3.7 Multi-dimensional and temporal datasets** (250 words).
`figures/fig-3-6-axis-model.svg`: three source shapes producing one axis object, the two independent
flags (`ordered`, `commensurable`) that decide which verbs are legal, and the four reader overrides.
The flag table is the mechanism worth the space — an ensemble axis is unordered and still reducible,
a band axis is the reverse, and that is why there are two flags rather than one. NetCDF3, NetCDF4, GRIB2, Zarr, and COG
enter through the same `addDataset`/`parseFile` path as a single image, and become a Dataset with a
real axis. `select` takes one step, `selectRange` narrows a window, `reduce` collapses a stack, and
the axis slider animates across it. Every reader assumption is a default with an explicit override
beside it (`grid.bbox`, `series.coords`, `dims.order`, `lon`), so a non-conforming file is a
configuration problem rather than an unsupported one. A file that labels nothing still gets an axis
with `unit === 'index'`.

**3.8 User-interface kit** (200 words). Layer panel, axis slider, dropzone, tools panel, region
draw, toast, tooltip, info window, and the operations panel, each a function returning DOM the host
mounts. State the direction of dependency once: the engine emits, the UI subscribes, never the
reverse, and an unhandled event does nothing. Name the event capture and delegation mechanism
(`createEmitter`, `setHostSink`, `emitHost`) and the coded-error convention (`err.code`).

### Figure inventory for Section 3

All six exist in `figures/` as self-contained SVG, sized 1160-1180 units wide for a 190 mm
double-column placement, with no external fonts, no raster embeds, and no color carrying information
that lightness does not also carry.

| File | Serves | Claim it settles |
| --- | --- | --- |
| `fig-3-1-architecture.svg` | §3.1 | Every crossing of the engine boundary is a registry, an event, or a fetch |
| `fig-3-2-dependency-graph.svg` | §3.1 | The layering is a fact about the import graph, not a drawing convention |
| `fig-3-3-object-model.svg` | §3.3 | A source is not a rendering, and the cardinality runs both ways |
| `fig-3-4-deferred-work.svg` | §3.2 | Four calls cost nothing; one call costs everything, once |
| `fig-3-5-read-models.svg` | §3.5 | The engine exposes values, not widgets |
| `fig-3-6-axis-model.svg` | §3.7 | Which verbs are legal belongs to the axis, not to the verb |
| `table-3-1-product-taxonomy.md` | §3.4 | The product taxonomy, with the two tiers separated (see C3) |

§3.6 gets no figure. Its content is a size ratio and a round trip, both of which are numbers, and a
diagram of a serialization format would outweigh a 250-word section. The ratio belongs in Table 4.2.

The file names are ordinal, not final figure numbers. Two figures serve §3.1 and the op-chain figure
serves §3.2, so the manuscript numbering and the file names diverge (see C14).

---

### 4. Performance evaluation — 1,100 words

**Claim.** The deferred design has a measured cost profile, and the client-side ceilings are stated
as numbers.

This section is blocked. It cannot be drafted before the reference environment is recorded and the
four measurement runs exist (see §5 of this guideline). Write no number here that is not read from
`performance.csv`, `metrics.csv`, or `results.csv`.

**4.1 Method and reference environment.** One documented machine: CPU model, core count, RAM,
storage class, and OS build. Browser version strings, with Chromium primary and a reduced parity run
elsewhere. Node version for the headless runs. Five repetitions per measurement, reported as median
and interquartile range. Cold and warm cache reported separately. Stage boundaries fixed as
`t_fetch`, `t_decode`, `t_op`, `t_paint`, `t_total`. Transferred bytes from the Resource Timing API,
not from file size on the server. Every dataset listed with URL, access date, licence, native CRS,
native grid resolution, and file size.

**4.2 Ingest and time-to-first-render.** By format and file size across GeoTIFF, Shapefile,
KML/KMZ, GeoJSON, NetCDF3, NetCDF4, GRIB2, and Zarr. One table, one figure. Resolve the Zarr
question first (correction C8).

**4.3 Reprojection cost.** Warp time against grid size, plus the share of study datasets that
needed no warp. The Copernicus DEM is already EPSG:4326 and the JRC clip is EPSG:3035, so the two
cases are both present in the case-study data.

**4.4 The measured payoff of deferred computation.** Two measurements: N Layers derived from one
source against a naive re-decode per Layer, and a chain built but never forced against the same
chain forced. This turns §3.2 from a design claim into a number. It is the single most important
table in Section 4.

**4.5 Analysis throughput.** Pixel-wise agreement metrics and region-scoped statistics across raster
sizes. Report the scoring rate in cells per second so the number transfers to grids the reader
cares about.

**Avoid.** Reporting a mean alone; a single run; "significantly faster" without a test or a ratio.

---

### 5. Case studies — 1,800 words

Four studies, 450 words each. `case-studies/CASE_STUDY_PROTOCOL.md` is the execution specification
and should stay the source of truth; this guideline governs only what reaches the manuscript. Each
study gets: the claim it settles, the data with provenance, the procedure in three or four
sentences, the result, and one surprise or discarded run if there was one.

**5.1 Modelled extent against an observed delineation.** Claim: quantitative evaluation is a
reusable engine capability, and it yields identical numbers in a browser tab and in a headless
batch. State every metric formula, the nodata treatment, the denominator convention, and the wet
threshold as a parameter with a three-value sensitivity. Region-scoped metrics through
`SpatialFilter` are the practitioner result; a basin-wide score alone hides where a model fails.
Retain the Batesville HAND versus SRH-2D pairing as a second instance of the identical procedure
(see O2). Figures: four-panel comparison, and the batch distribution of the critical success index.

**5.2 Rainfall driving a flood event.** Claim: temporal and multi-dimensional products enter through
the same path as a single image, and the axis is selected, reduced, and animated with no
server-side subsetting service. Resolve the forcing product first (see O1). Report the accumulation
units question explicitly — a sum over a rate is wrong, and the study must state which it computed.
The analytical payoff is `accumulation.groupBy(extentMask)`: rainfall distribution inside against
outside the inundated area.

**5.3 Terrain and regulatory context without a backend.** Claim: derived terrain surfaces,
data-driven categorical styling, generated legends, and region statistics run against public
endpoints from a static page with no server-side compute. Copernicus DEM GLO-30 (mirrored, 3600 ×
3600, EPSG:4326, no declared nodata) with FEMA NFHL zones. Two honest items belong in the text, not
only in §6: the whole-file fetch bound, and the host code the categorical styling required because
`ColorScale` keys on numeric values rather than string classes. State the CORS mirror and why.

**5.4 A composed flood scene in a third-party host.** Claim: the engine is adoptable in pieces,
embeds in a host that owns its markup and styling, runs with no browser, and survives a change of
map provider — at a stated integration cost. Four hosts: minimal static page, framework host driven
by read-models with the UI kit deliberately unused, partial adoption inside a foreign map with the
engine's map layer never mounted, and headless Node writing a PNG. Report lines of host code,
dependencies added, gzipped bundle delta, engine CSS required, registries touched, and capabilities
degraded after a provider swap. The exposure analysis over administrative polygons gives the study a
socio-economic outcome rather than a rendering outcome.

---

### 6. Discussion and limitations — 700 words

**Discussion** (400 words). What becomes possible for an adopter, stated as four concrete moves:
embed one part, run headless in a pipeline, swap map providers, extend with a new format or product
type through a registry. Then the four design positions, each in one or two sentences: defer work
until it is needed; expose portable read-models rather than widgets; state capability differences
rather than hiding them; treat client-side storage as disposable and the recipe as the durable
artifact. Close with what portable flood-data formats still need before a library can consume them
without bespoke adapters, citing the application-tier specifications as the host-owned example.

**Limitations** (300 words). Each limitation names what would change a conclusion and by how much.
"More research is needed" is not a limitation.

- Raster overlays render on Google Maps only. Quantify from §5.4: which capabilities degraded on the
  provider swap, and how many lines of host code changed.
- Whole-file reads bound very large rasters. State the measured file size at which the page becomes
  unusable on the reference machine, not an estimate.
- Browser memory and compute ceilings, with the `usedJSHeapSize` caveat that it is Chromium-only.
- Hosting and CORS dependence: the DEM mirror is the concrete case, and the COOP/COEP requirement
  for GDAL WASM belongs here.
- `ColorScale` has no scale keyed on a string attribute, so categorical styling is host code today.
- Distribution status: not on the public npm registry at the time of writing (see O4).
- Zarr path status, resolved per C8.

---

### 7. Future work — 200 words

Range reads and overview-level access, GPU-accelerated band math, further Dataset ops (vectorization
in particular, since zonal statistics already exist), additional map providers, real-time forecast
ingestion, and a contribution model. One sentence each, no forecasting of the field, and no
restatement of the limitations above.

---

### Additional matter

Software availability box (EMS format), CRediT statement, generative-AI declaration, data
availability statement pointing at `case-studies/data/README.txt` for provenance and at the mirror
policy, and references.

---

## 4. Corrections required before drafting

Each of these is a place where the outline and the code disagree. Fixing them is cheaper now than
after a reviewer opens the repository.

**C1 — "seam" is banned in this manuscript.** It is the repository's word for the map-provider
boundary and appears in the outline (§3.1). Write **provider interface**. Leave the code docs alone.

**C2 — the renderer-agnostic claim is too broad.** Vector Layers render on both providers; raster
overlays are Google-only by inheritance from `google.maps.OverlayView`. Scope this in §3.1 at first
statement.

**C3 — the product taxonomy spans two tiers.** `vector`, `raster`, `comparison`, and
`ensembleAgreement` are registered layer types on the core barrel. Depth, ensemble, and velocity
live in the opt-in `src/layers/` barrel and are Google-only. `hazusDamage.js` carries the comment
"USED BY FIMAPP. Not part of the public API for now." Table 3.4 must separate these, or the
contribution is overstated in the one table a reviewer will check against the source.

**C4 — the metric names collide with themselves.** `compareExtentMetrics` returns
`{ pc, b, h, k, f, mi }`; `case-studies/results_headless.csv` writes
`csi, pod, far, bias, containment, kappa`. Here *f* is the critical success index and *h* is the
probability of detection. Pick one naming set for the whole document, state the mapping to the code
symbols once in §5.1, and do not alternate.

**C5 — FAR and IoU are not returned by the engine.** The protocol's five-metric set includes false
alarm ratio and intersection over union. `compareExtentMetrics` returns neither by name: IoU is *f*,
and FAR = fp/(tp+fp) is computed by the study script. Either state that derivation in §5.1 or drop
the two names from the claimed metric set.

**C6 — `selectRange` exists.** `dataset.js:718` implements it, with an unordered-axis guard, and
`examples/04-temporal.html` demonstrates it. `CASE_STUDY_PROTOCOL.md` §2 step 5 still says the
engine has no range selection and that rolling accumulation is host glue. That statement is stale;
do not carry it into §5.2 or §6.

**C7 — state the ColorScale limitation precisely.** Stops key on a numeric `value` or a `[min, max]`
range, so numeric classing works. A scale keyed on a string attribute such as `FLD_ZONE` does not
exist. "No categorical ColorScale" overstates it.

**C8 — Zarr is claimed and disclaimed in the same corpus.** `SCIWRID_FORMATS` includes `zarr`,
`case-studies/data/` mirrors four NWM Zarr stores, and the protocol puts Zarr out of scope until
range reads land. §4.2's format list and §6's limitation must agree. Decide once.

**C9 — case-study numbering does not match the folder.** The manuscript has four studies; the
repository has `case_study1.html` through `case_study6.html`. A reader who fetches the repository to
find §5.2 will not find it. Fix the mapping in a README table, or renumber.

**C10 — Sections 4 and 5 have almost no data yet.** The only result file is
`case-studies/results_headless.csv`: study 1, `node v24.16.0`, four rows, a 436 × 401 grid, three wet
thresholds plus an observability row. No `performance.csv`, no `metrics.csv`, no browser runs. Every
figure in §4 and §5 stays absent until the runs exist. Do not write placeholder numbers, and do not
write a sentence whose subject is a number you intend to fill in later.

**C11 — the reference environment is unrecorded.** §4.1 is the first thing that can be written once
protocol §0.1 is filled in, and nothing else in §4 can precede it.

**C13 — an unsourced number is already in a figure.** `fig-3-3-object-model.svg` ends with "measured
at 2.44× for six derived layers over a single source (Study 4)". That figure appears nowhere else in
the repository: not in `results_headless.csv`, not in the docs, not in a script output. Either
produce the run that supports it and cite the file, or remove the clause from the figure. A number a
reviewer cannot trace is worse than no number.

**C14 — figure file names and manuscript numbers diverge.** Two figures argue §3.1 and the op-chain
figure argues §3.2, so `fig-3-2-dependency-graph.svg` is not Fig. 3.2. Fix this once, at submission,
by renaming the files to the final numbers rather than by renumbering in the caption — a caption that
disagrees with the file name is how a wrong figure reaches production.

**C12 — the companion application citation.** §1.1 and §2.4 both reference FIMApp. Cite it once with
its actual status (published, in review, or preprint) and do not describe its internals.

---

## 5. Drafting order and blocking

Sections 4 and 5 are written from records, so the measurement runs come first. The protocol's
recommended execution order stands: study 3, then 1, then 2, then 4.

1. Record the reference environment (protocol §0.1). Unblocks §4.1.
2. Run study 3. Produces the ingest, warp, and derived-op numbers §4.2, §4.3, and §4.5 need.
3. Run study 1 in both environments. Produces the throughput and browser-headless parity numbers.
4. Run study 2. Produces the temporal scaling and the laziness measurement for §4.4.
5. Run study 4. Produces the integration cost table, the reuse measurement, and the recipe ratio.
6. Draft §5, then §4 from the same records.
7. Draft §3, which is the only long section that can be written from the code alone — start it in
   parallel with the runs if the runs are slow.
8. Draft §6 and §7 from the recorded warnings (`console.log` per study) plus the corrections above.
9. Draft §1 and §2 last, so the contribution bullets match what the paper actually delivered.
10. Verification pass: every number traced to a file, every citation key checked byte-identical,
    every reserved term checked for elegant variation, and the banned-word list run over the full
    text.

---

## OPEN

Five questions. Each changes the text, and none can be answered from the repository.

**O1. Which forcing product is Section 5.2 — CHIRPS daily precipitation, or NWM/NLDAS-2?**
The outline says CHIRPS; `CASE_STUDY_PROTOCOL.md` §2 names NWM or NLDAS-2 with an Idalia NetCDF
fixture as primary and CHIRPS as optional; the mirrored data under `case-studies/data/` is four NWM
Zarr stores. This decides §4.2's format rows, §5.2's figures and units discussion, and whether the
Zarr path is a limitation or the study's own evidence. If it is not resolved, §5.2 cannot state its
data provenance and §4.2 has a format column nothing fills.

**O2. Is the Batesville HAND versus SRH-2D pairing already published in the FIMApp paper?**
If yes, §5.1 cites it as prior work and reports only the parity of the numbers. If no, it is a
result in this paper and needs its own data provenance entry. Getting this wrong is either a
self-plagiarism flag or an uncited result.

**O3. Is EMSR864 the committed Copernicus EMS activation for Section 5.1, and is its product a
delineation or a difference product?** `case-studies/data/README.txt` names the EMSR864 AOI01
footprint for the JRC clip, but no delineation file is mirrored. This decides §5.1's data table and,
if it is a difference product, the entire contingency classification.

**O4. Will the package be on the public npm registry at submission?** `package.json` says version
1.0.0; the README says it is not published and instructs readers to clone. This decides the Software
availability box, the installation sentence, and the data availability statement. A published paper
whose install instructions do not work is the failure mode.

**O5. Does Section 4 report three browsers or Chromium only?** Protocol §0.1 specifies Chromium
primary with a reduced Firefox and WebKit parity run. Three browsers roughly triples the run time and
adds a column to every table in §4. Chromium only is defensible if stated; it cannot be added after
the runs.
