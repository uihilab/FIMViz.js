# Decisions, Tradeoffs & Incomplete Items

This is the **consolidated history doc** for the composable-core rewrite — it replaces four docs that had
grown overlapping (`COMPOSABLE_API.md`, `COMPOSABLE_PLAN.md`, `FLOODEXTENT_DECOMPOSITION.md`,
`DATASET_LAYER_ADT.md`, all removed — their content lives only here now). It answers three questions in
one place: **what did
we decide and why** (§1), **what did we consider and reject, and what tradeoffs are still live** (§2), and
**what's built vs. still open** (§3). For the object model *as it exists today* (class shapes, method
signatures), see [CLASS_DIAGRAM.md](./CLASS_DIAGRAM.md) and [usage/USAGE.md](./usage/USAGE.md) — this doc
is the *why*, those are the *what*.

## Contents

[1. Architecture decisions](#1-architecture-decisions-resolved) ·
[2. Tradeoffs, rejections, and open questions](#2-tradeoffs-rejections-and-open-questions) ·
[3. Implementation status](#3-implementation-status) ·
[4. Known gaps](#4-known-gaps) ·
[5. Incomplete / deferred work](#5-incomplete--deferred-work) ·
[6. Cross-references](#6-cross-references)

---

## 1. Architecture decisions (resolved)

### 1.1 The object model's shape

- **Dataset is separate from Layer.** Source + unit of storage/reuse vs. one rendering; one Dataset backs
  N Layers.
- **`Dataset` is a *lazy, immutable op-chain node*, not an eager value (a deliberate reversal).** A
  **root** wraps a source (inline bytes/GeoJSON, or a URI); a **derived** node is a parent + one op. Ops
  (`reproject`, `select`, `mask`/`clip`/`reclassify`/`combine`, …) return **new** lazy Datasets and never
  mutate. Nothing is fetched/decoded/warped until a **terminal** (`load()`/`grid()`/`features()`, or a
  `Layer` rendering it) **forces** the chain; the result is memoized per node (`#materialized`, evictable
  via `release()`).
  - **Why `reproject` moved onto `Dataset` as a method (reversing "reproject lives in `geo/`, Dataset
    stays import-free"):** the import-free property was worth keeping, but the *mechanism* (a free
    function) wasn't the only way to get it. Under the lazy model, `ds.reproject(crs)` builds a lazy node
    importing nothing — the GDAL warp runs only when forced, and even then dispatches through a
    **registered seam** (`registerReprojector`/`resolveReprojector`), so `package/dataset.js` still imports
    no GDAL. Headlessness is preserved by the *seam*, not by the method's absence. The test changed from
    "`reproject` doesn't exist on Dataset" to "reproject is a lazy op **and** Dataset still imports no
    GDAL (forcing without a registered reprojector throws a clear error)."
  - **A. Spatial ops transform their *argument*, not the Dataset; binary ops conform to the LHS.** A
    spatial op (mask by polygon, clip by bbox) transforms **its geometry argument** into the Dataset's
    native CRS — the Dataset itself stays native, localizing the one unavoidable transform. A **binary**
    op `A.op(B)` conforms to the **left-hand** Dataset: if `B.crs !== A.crs`, `B` is reprojected into `A`'s
    CRS in memory (not re-materialized) and aligned onto `A`'s grid, and the op **collects a warning**
    rather than throwing. Comparison/ensemble stay implicitly left-associative. **This is why there are
    two alignment entry points, on purpose:** the N-ary layer aligner (`geo/resample.js`'s
    `alignRasters`) keeps a richer `low`/`high`/`average` grid **policy** (no natural "left" among N
    members); a binary Dataset op just takes the left operand's grid. Do not rewrite `ComparisonLayer` as
    `dsA.compareWith(dsB)` — the N-ary aligner is the right tool there, not a binary op.
  - **B/D. Storage: recipe by default, materialized optional; both rehydrate to a Dataset.**
    `toRecord()` persists the **source + op recipe** (small — the immutable pipeline *is* the value), not
    the decoded buffer. `toRecord({ storeMaterialized: true })` also embeds the decoded view;
    `Dataset.fromRecord(rec)` rehydrates either way. A plain inline root Dataset still serializes with
    `data` and round-trips exactly as before the lazy model — the recipe fields are additive, appearing
    only for a URL root, an op chain, or `storeMaterialized`.
  - **C. Materialization is memoized per node**, uniform whether a Layer has one source or an array
    (comparison/ensemble) — the expensive base decode happens once and derived nodes reuse it.
  - **E. Warnings surface both ways.** A lazy op can't warn at construction time (nothing has run yet);
    warnings accumulate on the node (`ds.warnings`) and surface at **force time** — attached to the
    result/`layer.result.warnings` **and** emitted on the host bus (`notify`/`emitHost`).
  - **F. Kind-changing ops are allowed.** An op may return a Dataset whose `kind` differs from its
    parent's (rasterize: vector→raster; polygonize/contour: raster→vector) — nothing assumes
    `child.kind === parent.kind`. These are deferred (§5), but the door is structurally open.
- **Layer subclassing rule: subclass on divergence, `type` field among true siblings.** *Rule: subclass
  when the rendering mechanism, source arity, or lifecycle diverges; keep a `type` field only among
  siblings sharing all three.* `RasterLayer` (`type: extent|userRaster|depth|ensemble`, all
  palette-canvas) and `VectorLayer` (`type: geojson|kml|kmz|shp`, all provider-vector) carry a `type`;
  genuinely different renderers get subclasses — `ComparisonLayer`/`EnsembleAggregationLayer` (N-ary
  align+reduce), `VelocityLayer` (raster pair + rAF), `DepthLayer` (ArcGIS tiles, no canvas), `DamageLayer`
  (HAZUS markers via `AdvancedMarkerElement`). `ensemble` is **not** a subclass by itself — a `RasterLayer`
  with `type:'ensemble'` + a preset `ColorScale`; **`EnsembleAggregationLayer`** (aggregating *multiple*
  member rasters into an agreement count) is the genuinely distinct one.
- **Base `Layer` is multi-source (`sources: Dataset[]`)**, `dataset` getter = `sources[0]` — comparison/
  ensemble-aggregation break a singular dataset; most (including single-file `ensemble`) use one.
- **`Layer` has one public verb (`render()`) + a power-user seam (`compute()`).** `render()` computes
  implicitly (if needed), checks the provider's CRS precondition, then draws; `compute()` alone gets the
  result without drawing. No presentation/derived-class split — the "two families" collapse to *compute()
  is trivial* (materialize one source) vs. *compute() reduces N sources* (comparison/ensemble), a
  difference of degree in one method, not two class hierarchies.
- **The CRS precondition is strict in the engine, convenience is app-tier policy.** `render()` asks
  `provider.acceptsCRS(ds.crs)`; a mismatch **emits a host event and throws** — no silent reproject.
  Auto-reproject-then-render is a config flag the host can add; the engine never guesses.
- **`provider` is required and has no default — the same "never guess" rule, applied at boot.** The
  two built-in backends differ in *credentials* **and** in *capability*: `'leaflet'` needs nothing and
  gives map + vectors + static rasters, `'google'` needs an `apiKey` and is the only one carrying the
  full overlay tier (velocity, damage markers, ArcGIS depth). A default would silently decide both for
  a host — either demanding a key it never asked to need, or quietly withholding tiers it thought it
  had — so `mount()` throws `config-invalid` naming both options instead (`mount.js`, checked before
  any container/markup work so the message survives a registered runtime booting its own map).
  `mapProvider.js`'s `DEFAULT_PROVIDER = 'leaflet'` is deliberately **not** this default: it is the
  fallback a *detached* layer resolves against — one constructed with no mounted app, so with no
  `config.provider` to read at all.
- **The Settings/Operations change-model: a change to a Layer is either an *operation* (replaces or
  re-acquires the source data — `setSources`/`deriveSources`, `reproject`, `select(coord)`, `reload`,
  `show`/`hide`/`fit`/`remove` — imperative Layer/Dataset **methods**) or a *setting* (a parameter applied
  while rendering/computing the *current* source — palette/stops/colors/labels/continuous, opacity, hover,
  noData, overrideTheme — declarative `LayerSettings` **knobs**).** Boundary test: *does it change what the
  data IS, or only how the current data is drawn/read?* Consequence: **the scenario slider drives an
  operation** (`deriveSources(ds => ds.select(stage))`), not a setting — it never belonged in a
  settings/tools panel. Both sides emit the **same** effect-event vocabulary so any UI reacts uniformly
  without knowing which side triggered it: `restyle` (recolor the memoized grid, no re-force), `recomputed`
  (a derived grid changed, e.g. `noData` → precedes a redraw), `rendered` (the layer (re)drew, from either
  side), `removed`. `LayerSettings` doesn't duplicate state — `RasterSettings` *references* the layer's
  existing `ColorScale` rather than shadowing it.
  - **What is NOT a setting, on purpose:** *value threshold/mask* is the `Filter` family
    (`layer.applyFilter(...)`), not a knob; *reclassify to new values* is a Dataset transformation **op**
    (`ds.reclassify`, roadmapped), producing new data. "Reclassify" is reserved for that; the render-time
    classed-bands knob is `ColorScale`. One word must not mean both.
- **`ColorScale` is a mutable class, fully read/write** (resolves an early "class vs. helper" question);
  `Legend` is the derived read-model with `formatLabel`/`formatValue` hooks.
- **`Stats` is a pure, terminal read-model, enriched at compute time (single pixel/feature pass), never
  filterable after the fact.** `stats.applyFilter()` deliberately does not exist — it would force `Stats`
  to retain the raster and stop being a serializable read-model. "Stats then filter" is always a fresh
  `layer.getStats(filter)`.
- **Filtering (`Filter` family) is a layer/query concern.** `SpatialFilter` (pure polygon geometry,
  universal across raster+vector) and `PredicateFilter` (`(v,x,y,at)` raster / `(feature)` vector).
  `layer.applyFilter(f)` **mutates the layer view** (render dims/hides + default `getStats()` honors it),
  chainable as AND, and returns `layer`; a compute-only one-off is `getStats(f)` — never touches the
  screen. Geometry is split from policy on purpose: raster render **dims** outside a region, stats
  **exclude**, damage **hides** — behavior differs per consumer, so policy stays with the consumer and the
  filter itself stays reusable/testable.
- **Spatial selection is one public concept (`Region`), however many internal objects the correct model
  needs.** Governing principle: *class count is an internal cost; concept count is the user's cost — grow
  the first only to hold or shrink the second.* A user thinks "my selection," not "a vector layer with an
  interaction bound to it," so `fim.region.draw()` is the whole public surface; `RegionLayer` (an
  editable, unlisted `VectorLayer`), `RegionFilterInteraction` (region→active-layer policy), and the
  `SpatialFilter` it produces are internal. **`LayerInteraction` (a shared base for
  `RegionFilterInteraction`) is deliberately deferred** — region-filter *mutates* its target while
  comparison *emits* a new overlay, too different a contract to justify a base until a third interaction
  earns it. For the same reason, **`ComparisonLayer` → `ComparisonInteraction` would reverse the resolved
  "ComparisonLayer is a Layer subclass" decision** — not revisited without a forcing case.
- **`FimViz` is an ambient service container, not a class the user instantiates.** A namespace
  (`create`/`mount`/`parseFile`/`current`/`reset`) plus a lazily-created, reference-counted **default**
  instance owning shared services (event bus, config, map registry, `Storage`) — born on the first
  `FimMap`, released on the last `destroy()` (IndexedDB persists; only the connection closes).
  `FimViz.create()` makes an isolated private one. Pattern: ambient default à la Firebase `[DEFAULT]` /
  matplotlib `pyplot`. Multiple maps **share the default app by default** (good for dashboards); isolation
  is opt-in via a private `create()` — "two fully independent widgets" is two `create()` calls, not two
  bare `mount()`s.
- **Objects carry up-the-chain references; nothing resolves "current" mid-operation.** `FimMap` holds its
  `FimViz`; a `Layer` holds its `FimMap`.
- **Config is set-once at entry, locked after boot.** A late reconfigure warns/throws — a raster may have
  already booted GDAL with the old path.
- **`Storage` is a generic key-value store — it knows nothing about Datasets, files, or FIMViz.** The host
  supplies the database name, table names, and keys; keys are **out-of-line** (no `keyPath`) so values can
  be stored **verbatim** (structured-clone, not JSON — `JSON.stringify(arrayBuffer)` silently produces
  `"{}"`). The generality test: *does the store touch your value?* It must not — key derivation,
  timestamps, field-stripping are the caller's business, not the store's. `Dataset.toRecord()`/
  `fromRecord()` own serialization on the type that knows the format. This is a **rewrite, not a wrap** of
  the old `io/db.js` — see §3 for the bugs it fixed along the way.
- **`Catalog` is a shape, not a class** — `{ list(opts) → Entry[], load(id) → Promise<Dataset> }`. Satisfied
  by two things, **neither a new class**: local `Storage` + `Dataset.fromRecord`, and a ~10-line remote
  `fimDatabaseCatalog(url)`. No base class, no `LocalCatalog` — an interface with one implementation is
  speculative generality.
- **A generic selection axis folds INTO `Dataset`** (`axes`/`axis` + `select()`), rather than a separate
  `Collection`/`Scenario` class above it. **The fold-in test:** *does it share Dataset's invariant — one
  CRS, one bounds?* FIM Scenario does (every selection is an extent raster over one area) → folds in; a
  *catalog* does not (unrelated members) → stays a shape. Division of labor: the library owns axis metadata
  + lazy `select()`; the app owns the slider UI and the domain adapter, building the slider generically
  from `ds.axes` without the engine ever learning "stage" vs. "time".
  - **An axis entry's `ref` says how to GET the payload, not only where to fetch it.** The original
    shape assumed *one file per entry* — a URL (or named URL variants) — which is FIM Scenario's shape
    and no multi-dimensional format's. A third form, `{ select: {…} }`, marks the entry as a **slice of
    the source this Dataset already holds**: `select()` returns a child rooted on the parent's own
    bytes/URL (no second fetch, same `format`, no `axes` of its own) and the selection reaches the
    decoder as `root.select`. It is discriminated on an *object-valued* `select` key, so a named URL
    variant that happens to be called `select` is still a variant. **Rejected: a second bypass.** The
    WaterML/NWIS adapter met the same "entries aren't separately fetchable" problem and routed *around*
    `select()` (`ref: null`, bespoke accessors) — correct there, but repeating it would have left three
    incompatible axis shapes and a `reduce()` that works on only one. Because `reduce()` is already
    sugar over `select()` + `combine()`, folding the in-file case into `select()` bought temporal
    aggregation for free. Landed with the NetCDF4/GRIB2/Zarr adapter — [PACKAGE_ROADMAP.md §8](./PACKAGE_ROADMAP.md#8-multi-dimensional-formats--real-temporal-datasets-sciwrid-toolkit-as-a-materializer).
- **App-specific domain formats get adapters; the neutral core never learns a proprietary schema.**
  `parseFile` handles only generic formats (geojson/kml/kmz/shp/geotiff; HAZUS damage is included because
  it's a FEMA *standard*, not one lab's schema). Two FIMViz-specific JSON formats stayed out, **not
  equally proprietary**: **FIM Database** (`{files:[{FileName}]}`, siblings next to the manifest) is barely
  a schema at all — its adapter (`fimDatabaseCatalog`, ~10 lines) satisfies the `Catalog` shape directly.
  **FIM Scenario** (`gauge_info`/`details`/`time_series`/`scenarios[]`, a genuine structured schema) is a
  real adapter (`parseFimScenario`) building `Dataset`s with a selection axis — this is one lab's private
  schema and must never reach `parseFile`.
- **`deck.gl` dropped entirely.** The aggregation views (hexagon/scatter/contour/heatmap/screenGrid) were
  never surfaced on the frontend — removed along with the four `@deck.gl/*` deps, `layers/map.js`, and the
  deck path in `script.js`. `DamageLayer` keeps only `AdvancedMarkerElement` point markers.
- **The upload inlet is a primitive + a host-DOM adapter**, not four duplicated drag-drop blocks: `addDataset`
  (semantic primitive: transport-agnostic, intent-free, no DOM) + `bindUpload(el, {purpose, …})` (a DOM
  adapter over host-owned elements, `purpose` the single extensibility axis — new transport = a sibling
  binder, new intent = a new `purpose`, new UI = 100% host-owned via `onFile`/events).
- **The "app policy leaking into library code" pattern, and its fix.** Recurring failure mode: a closed
  table or hardcoded app value ends up in engine code, defended as "a marked domain adapter" or "the
  generic mechanism" — plausible-sounding categories that don't hold up. The fix pattern each time was the
  same: **the library owns the mechanism + an open registry; the app registers the specifics** (mirrors
  the layer-type, map-provider and materializer registries). Applied to: `PALETTES` (closed table → an
  open registry, unknown-palette now throws with the available list instead
  of silently falling back to `blues`); `proxiedUrl` (deployment-specific host branching lives in a host's
  own config, reached via `config.resolveUrl`; the engine's `defaultResolveUrl` is
  **identity** — guessing a URL scheme produced a real `[::1]` loopback bug); domain data
  (flood-risk labels, map styles, default coordinates, a deployment's `dataSource`) likewise belongs to a
  host, never the engine. One item was **kept** by
  deliberate decision, not oversight: `Legend.toHtml()` emits this app's DOM markup, but the model is
  already data-complete (`stops`/`toJSON`) and moving `toHtml` to a `ui/` renderer isn't worth the churn.

### 1.2 Instance-scoped DOM, event inversion, and the engine→host boundary

- **The engine must never call an app function — not by import, and not through `window.*` either.** A
  `window.pushNotification(...)` in library code is the same coupling as an import, minus any tool's
  ability to see it, and throws a `TypeError` in a host that doesn't define that global. Fix:
  `package/events.js` is the engine's single outbound channel — it **emits** (`notify`,
  `notifyStorageChanged`, `notifyUploadComplete`, generic `emitHost`), the host **subscribes**
  (a host's own `bindHostEvents(fim)`) and decides what, if anything, to render. With
  no sink attached every emitter is a silent no-op — what makes the engine embeddable headlessly.
- **Layer events forward to the owning map's bus under `` `${type}:${evt}` `` — one event, two
  subscriptions, not two mechanisms.** `layer.on('rendered', fn)` (this one layer's lifecycle) and
  `fim.on('userRaster:rendered', fn)` (any layer of that type on this map) are the *same* event; forwarding
  makes the per-map form **derived**, so a new layer type gets it with zero per-subsystem wiring. Resolved
  deliberately early — an inconsistent event contract hardens into API the moment anything depends on it.
- **A host's not-yet-per-instance subsystems may use an ambient active-DOM-scope pointer
  (`setActiveDom`/`domId`/`domQs`/`domQsa`)** — rather than being threaded a root immediately.
  Per-instance UI modules (a `LayerPanel`/`RasterToolsPanel`) hold a real root and resolve through
  `scoped(root).byId(...)`.
- **The engine names no host element, and reads no ambient DOM scope.** This was aspirational for a
  long while — `layers/` was described as "UI-clean … they import no UI" while `depthMap`,
  `ensemble` and `floodDepth` were writing `#loading-indicator`, `#tif-depth-hover-value`,
  `#ExtentLegend`, `#droughtLegend`, `#depth-legend` and `#maptypes` by id. Two things were wrong with
  that: those ids are one deployment's chrome, so in any other host the engine silently did nothing
  while appearing portable; and the scope is a module-level global set by whichever mount ran last.
  Resolved three ways, by kind:
  - `floodDepth.js` **moved to the app**. It names the Iowa DNR MapServer endpoint and its
    return-period scenarios — deployment detail, the same rule that keeps `io/db.js` and `io/fim/`
    app-side. Nothing to invert; it was app code in the wrong package.
  - The rest became **events**, and most already existed: `depthMap` was already emitting
    `hover`/`rendered`/`removed` and *additionally* writing the DOM, so the change largely deleted
    the redundant half. Only `busy {active, source}` is new. The host binds
    (`bindDepthLayerChrome`, one `busy` handler in `bindHostEvents`) and decides what a spinner is.
  - Consequently **`mount.js` no longer calls `setActiveDom()`** — nothing in the package reads that
    scope. `bootstrap(fim)` points it at `fim.root` and `teardownMap()` resets it, so the pointer is
    owned by the tier that owns the markup.

  Two findings fell out of doing it. **`#tif-depth-hover-value` and `#depth-legend-hover-row` exist
  nowhere in this repo** — the engine had been writing them to nothing for as long as the code
  existed, and a faithful migration would only have relocated dead code (the readout the UI actually
  shows comes from `ui/rasterTools.js`). And the **`#map` injection check in `mount.js` was
  document-wide** (`document.getElementById("map")`), so a second widget found the *first* one's map
  div, concluded the markup was present, and injected nothing — leaving the second container empty,
  and with a runtime registered the whole widget missing. It was the one lookup the DOM-scoping
  migration never reached, because it runs before the `FimMap` that would scope it exists. Both
  guarded now: a source scan in `hostEvents.test.mjs`, and `markupInjection.dom.test.mjs`.
- **`data-action`/`data-args` (+ `data-on`) replaced inline `onclick=` handlers**, one delegated listener
  per instance calling `fn.call(el, ...JSON.parse(dataset.args))` so `this` is the element and handler
  bodies migrate unchanged. `data-on` is required for non-click actions because a checkbox fires both
  `click` **and** `change`.
- **The `window.*` bridge was three separate problems, not one** — an earlier status claim that
  `data-action` "retired ~113 window.* bindings" was wrong; it retired ~50 of ~115. The three: (1)
  `widget.html` inline handlers (50, → `data-action`, mechanical); (2) handlers generated inside JS
  template strings (44 across 7 files — needed HTML-generation rewrites, not just `data-action`); (3)
  **~65 cross-module calls** — the real work, since `data-action` does nothing for a JS-to-JS call. That
  third category is what caused the `damage.js`↔`floodExtent.js` cycle: `damage.js` imported `getAVal`
  from `floodExtent.js` while `floodExtent.js` called back via `window.hideHazusMarkers()` — **the global
  WAS the cycle-breaker**. Fixed by relocating the session state (`a_val`/`current_map_id`/
  `customExtentInputJson`/`ctaLayer2`) into a **neutral** module (`floodExtentSession.js`, imports nothing
  from either side) so both modules could import it directly with no cycle.
- **Session/singleton state that used to live on module-level `let`s moved to a per-`FimMap` `WeakMap`**,
  not onto the engine `FimMap` object itself — putting app-domain concepts (a HAZUS input, a stage/discharge
  row) on the engine object was rejected (keeps `FimMap` free of app concepts). Pattern used repeatedly:
  `layers/comparison.js`'s `_cmp()`, `layers/floodExtentSession.js`'s `session()`,
  `ui/activeDisplayLayer.js`'s display-claim slot — an app-side `WeakMap<FimMap, state>` + an accessor
  function, never a new field on the engine object.
- **Duplicate `id`s across two mounted widget roots are the multi-instance premise, and are fragile.**
  Scoped `$('#layer-panel')` relies on `element.querySelector('#id')` matching within the subtree —
  browsers do this; **jsdom's nwsapi does not** (routes id selectors through `document.getElementById` →
  first match document-wide → filters to subtree → `null` if that first match is outside the subtree).
  `dom.js`'s `scoped()` works around it by rewriting an exact `#id` to `[id="..."]` (spec-identical,
  engine-independent) — compound selectors pass through and stay subject to the quirk. The deeper point:
  the whole strategy rests on *invalid HTML* (repeated ids across a page); migrating `widget.html` onto
  `data-fim="..."` attributes is the durable fix if this ever bites for real.

### 1.3 The floodExtent decomposition

`layers/floodExtent.js` (1561 lines) was the **central dispatcher**, not a single subsystem, so it could
not migrate onto the Layer model by the same mechanical rename that worked for velocity/ensemble/depth/
damage. It tangled three concerns in one module, resolved to three homes:

| Tangled concern | What it looked like | Resolved home |
|---|---|---|
| User-file layer registry (`toolboxLayer`) | filename→rendered-file map, heterogeneous values (a `USGSOverlay`, a `{setMap}` vector proxy, or a delegating proxy for damage/ensemble/depth) | `fim.layers`, keyed by filename (`FimMap#layersByName` + `registerNamedLayer`/`getLayerByName`) |
| Extent-scenario registry + slider (`toolboxLayerExtent`, `_sliderSeq`, `showSlider`/`handleSlider*`) | model/stage/discharge/annualChance selection picking an extent raster | a `Scenario` over axis-`Dataset`s (§1.1's selection-axis fold-in) |
| Dispatcher/session context (`arr_INUN`, `customExtentInputJson`, `ctaLayer2`, `a_val`, `current_map_id`, …) | active-scenario state, several exported as getters consumed cross-module (`damage.js` reads `getAVal()`) | a per-`FimMap` session object (`floodExtentSession.js`), §1.2's WeakMap pattern |

**Why "the slider stays in the app" (a resolved design call):** the *package* only validates and models a
scenario and resolves a selection → a URL; a host keeps the actual slider UI. `Scenario`
(an app-tier `parseFimScenario` adapter) is metadata + `u + 1` generic engine `Dataset`s (one
stage-axis series per model + one time-axis series); `resolveStage`/`resolveTime` return a render-ready
descriptor the existing `fim.addDataset → addLayer` path consumes unmodified.

**The slider migration's replacement strategy: prefer the new path, self-heal on divergence.** Rather than
a flag-day cutover, each `arr_INUN` positional read was replaced one at a time with a call that **prefers
the `Scenario` read and falls back to `arr_INUN`, logging on any divergence** — so a file that trips an
edge case self-heals instead of breaking, and the log signals it happened. Three traps made this
non-trivial (each would have been a silent, browser-only regression if the migration had skipped the
divergence guard):

1. **Sort order** — `Scenario` sorts axis entries by stage; the legacy `arr_INUN[2]` read is in raw file
   order.
2. **`null` vs. `""`** — `parseFimScenario` normalizes empty fields to `null`; `arr_INUN` kept `""`, and
   some downstream paths did string/number operations that treat these differently.
3. **Single-model slot** — `arr_INUN[2][0]` holds only the *currently selected* model, so the slider's `a`
   index is **not** a model index (an easy misread when porting the logic).

For the two real sample files (single-model, ascending), these traps were empirically inert, verified with
byte-identical node tests against both the `arr_INUN` mapping and the `Scenario` read, then browser-confirmed
at each step. The migration reached **every reachable read** in `handleSliderChange`/`handleSliderInput`/
`showSlider`, including the real-time nearest-stage scan and the metadata unit strings. What's left of
`arr_INUN` is **confirmed-dead code** — an `#achance` checkbox + a dual-slider branch with no counterpart
in the running app ("Annual Chance" there is a read-only text field, not an interactive slider); migrating
unreachable code isn't testable and wasn't worth the risk. (`annual_chance` itself is sparse but genuinely
present in some real files — it should not be treated as always-empty in parity/lookup logic elsewhere.)

**A pre-existing bug fixed along the way (not caused by the migration):** the Toggle Vector/Raster button
stuck on vector because it carried **two** click handlers simultaneously — `ui/ui.js`'s stateful `.onclick`
(alternates raster↔vector) *and* a delegated `data-action="toggleVectorRaster"` hardcoded to `'vector'`.
Both fired; since the slider handler is async and guards itself with a monotonic `_sliderSeq`, the
always-vector delegated handler happened to win the stale-load race. Fixed by dropping the redundant
`data-action` — the lesson (see §4) is not to double-bind a delegated action and a programmatic `.onclick`
on the same element.

## 2. Tradeoffs, rejections, and open questions

### 2.1 Map-provider abstraction — per-tier tradeoffs

`mapProvider.js`'s seam (`registerMapProvider`) is landed for three of six tiers; the other three stay
deferred. The tradeoffs recorded here recur for each remaining tier, so they're kept even though the
specific tiers they were first decided for are done:

| Tier | Google | Leaflet | Status |
|---|---|---|---|
| Map + basemap | `google.maps.Map` | `L.map` + `L.tileLayer` | ✅ |
| Vector (GeoJSON) | `google.maps.Data` | `L.geoJSON` | ✅ |
| Static raster image | `google.maps.GroundOverlay` | `L.imageOverlay` | ✅ |
| Live raster repaint | remove + recreate `GroundOverlay` | `L.ImageOverlay#setUrl` | ✅ |
| Map hover/mousemove | `google.maps.event` | `map.on('mousemove')` | ✅ |
| Velocity animated canvas | custom `OverlayView` + rAF | *(none)* | 🔲 not ported |
| Comparison draw-mask tool | DOM + `getProjection()` + `Polygon`/`Marker` | *(none)* | 🔲 not ported |
| HAZUS markers | `AdvancedMarkerElement` | *(none)* | 🔲 not ported |
| Flood-depth tiles | vendored `arcgislink.js` | *(none)* | 🔲 not ported |

**Decisions + rejected alternatives, per tier already built:**

- **Static raster (`addRasterImage`)** — chose `GroundOverlay`/`L.imageOverlay` because both are
  first-class map objects that reposition themselves on pan/zoom with no custom `draw()`/
  `getProjection().fromLatLngToDivPixel()` math. *Rejected:* keeping the existing custom `OverlayView` and
  adding a parallel Leaflet-only class — every renderer (`DepthOverlay`, `EnsembleOverlay`, both
  `USGSOverlay`s, and the not-yet-ported `CombinedOverlay`/`SingleImageOverlay`) had carried a
  near-identical ~25-line `onAdd`/`draw`/`onRemove` triad; a second hand-rolled positioning class per
  renderer defeats "one engine mechanism, N renderers." Also rejected: a custom `L.Layer` subclass
  mirroring `OverlayView` — reinvents what `L.imageOverlay` already ships.
- **Live repaint (`setRasterImageUrl`)** — `GroundOverlay` has no documented in-place image swap (unlike
  `L.ImageOverlay#setUrl`), so the contract **returns a handle**: Google removes+recreates, Leaflet calls
  `setUrl()` and returns the same handle — callers must always reassign to the returned handle, never
  reuse the one passed in. Cost: a Google palette switch is a teardown+reconstruct (imperceptible for one
  small overlay). *Rejected:* leaving Google on the old custom class just for repaint-capable renderers —
  reintroduces the two-paths problem for exactly the renderers (depth/extent/userRaster) that share the
  palette UI and most need one path.
- **Map hover (`onMapMouseMove`)** — returns an **unsubscribe function**, hiding Google's static-call
  listener removal vs. Leaflet's instance-call-needing-name+handler. *Rejected:* returning
  `{provider, handle}` and having each caller branch on which provider it got — the exact per-call-site
  branching the seam exists to avoid.

**Why the remaining four tiers aren't a mechanical swap:** *Velocity's animated canvas* is a full-viewport
canvas repainted every frame by its own rAF loop, driven by five Google-specific listeners
(`resize`/`center_changed`/`dragstart`/`zoom_changed`/`idle`) — the particle math is already
provider-agnostic, but re-deriving "when does the field need rebuilding" from Leaflet's `moveend`/
`zoomend`/`resize` (different granularity/timing than Google's `idle`) is real design work, not a
find-replace. *The comparison draw-mask tool* is a bespoke drawing interaction (raw DOM mouse events +
`getProjection().fromLatLngToPoint()` + `Math.pow(2, zoom)` math + a `Polygon`/`Marker` snap indicator) —
Leaflet's `containerPointToLatLng` is simpler, but it's a parallel micro-library rewrite, not a raster
concern. *Markers* need a whole new marker tier (`L.marker`/`L.divIcon`), a clean-slate addition, not an
extension of an existing one. *Flood-depth's `arcgislink.js`* is a vendored Google-only library with no
portable internals — a Leaflet path means `L.tileLayer` at the ArcGIS REST export endpoint or
Esri-Leaflet, a fresh integration each way.

**Mapbox stays out of scope, deliberately:** a canvas image-overlay fits Google/Leaflet's DOM-pane model,
but Mapbox's WebGL sources/layers are a different rendering model entirely — a larger separate phase, not
a third provider dropped into the same seam.

### 2.2 The interplay model — three axes, two kinds of combination

Three orthogonal axes to a rendered layer: **data** (`Dataset`), **style** (`ColorScale`), **placement**
(`Layer` + provider). Two kinds of combination that must not be conflated:

- **Dataset↔Dataset = DATA combination** — align/difference/classify/agreement produce *new data*; pure,
  headless, LHS-conforming (§1.1-A). This is where comparison/ensemble *compute* eventually migrates,
  which is why `ComparisonLayer`/`EnsembleAggregationLayer` are considered **transitional** shapes, not the
  final resting place of that compute.
- **Layer↔Layer = PRESENTATION combination** — z-order, exclusive display, a shared `ColorScale`, swipe/
  blend. A visual arrangement; no new data is produced. *You compare DATA, not layers* — a rule worth
  keeping explicit, since "comparison" as a word invites conflating the two.

Layer↔Dataset is the landed seam between them: `layer.sources: Dataset[]` are **inputs**; since Datasets
are immutable, "the data changed" always means *point the layer at a new Dataset*
(`setSources`/`deriveSources`), never mutate one in place. `deriveSources` exists specifically as the
"hot-modify" path — derive from the *current* source so memoized ancestors are reused and only the changed
tail of the op-chain recomputes, vs. a cold `setSources` swap that re-decodes from scratch. The render
update mode (`'auto'|'in-place'|'recreate'`) resolves from provider capability + layer type when `'auto'`;
a raster on a capable provider goes in-place (no flicker, keeps z-order/identity), everything else
recreates. **Correctness note that bit this exactly once:** a stale async force must be dropped by the
load-sequence guard (`loadSeq`/`_sliderSeq`) *before* it swaps the handle, or a slow load can overwrite a
newer image on a reused in-place handle — `'recreate'` is naturally immune (fresh handle each time),
`'in-place'` trades that immunity for smoothness, so the guard is load-bearing there specifically.

Dataset lifecycle is **ref-counted by the owning `FimMap`** (`_acquireDataset`/`_releaseDataset`) — a
Dataset's memoized decode is evicted only when the last Layer referencing it drops it; Layers themselves
never call `ds.release()` directly. **Exclusive display claim** (`Layer.exclusive` — true for
velocity/ensemble): activating an exclusive layer tears down whatever previously claimed the slot
(`FimMap._claimExclusive`, formalizing what `ui/activeDisplayLayer.js` already did ad hoc).

### 2.3 `Storage`'s scope boundary — a deliberate non-feature

**"Not a database library" is a scope decision, not a gap**: no query DSL, no index management, no
transaction API beyond put/get/list/map/clearAll. If a consumer needs more than that, the intended answer
is *build a `StorageAdapter` around a real database*, not extend this class — the seam is kept small
enough on purpose that such an adapter could slot in later without `Storage` itself growing indefinitely.
Two kinds of version-management primitive are offered and deliberately **not merged into one**: `map()`/
`clearAll()` are DATA-migration tools needing **no** schema/version bump (out-of-line keys + verbatim
values mean a record's shape was never part of the schema); the `versionMigrate` constructor hook is the
STRUCTURAL counterpart (create/drop a store, copy rows between stores) — IndexedDB only allows that kind
of change inside an `onupgradeneeded` transaction, so it can't be a plain method call.

### 2.4 Rejected: iframe isolation for multi-instance

An `iframeMount.js` ("Path A") was built, then deleted once in-DOM `{ isolated: true }` (a separate
in-page `FimViz`, Path B's DOM-scoping) covered the multi-instance need without the overhead and
constraints of iframe boundaries (cross-frame API surface, styling isolation costs, no shared map SDK
instance). There is no iframe option today, and none is planned — Path B's instance-scoped DOM
(`package/dom.js`) made it unnecessary.

### 2.5 Still-open questions

- **`ComparisonLayer`'s parent class — `RasterLayer` vs. bare `Layer`.** Not yet forced by a concrete need;
  currently sits closer to `Layer` in the built code, but the question hasn't been revisited since it was
  first raised.
- **Component styling** — scoped CSS per mounted UI component vs. inheriting the host page's styles.
  Unresolved, and with no separate UI package planned (see §5.1) there is no forcing event to settle it.
- **`Legend.toHtml()`'s DOM-markup ownership** — kept on the read-model by decision (§1.1). Revisiting it
  to get every renderer consistently out of the model layer is not on the roadmap.

## 3. Implementation status

### 3.1 Build status (what's built vs. planned)

| Area | Scope | Status |
|---|---|---|
| Core | `FimViz` ambient default + `FimMap` + `create()`/`mount()` + scoped `$` | ✅ |
| Data | `Dataset`, `Storage`, headless `parseFile`/`addDataset` (geojson+HAZUS, kml/kmz, shp, geotiff→WGS84) | ✅ |
| Read-models | `ColorScale`, `Legend`, `Stats` + the `Filter` family | ✅ |
| Layers | Layer objects with per-instance state (velocity, ensemble, depth, damage, comparison, floodExtent) | ✅ |
| Headlessness | Instance-scoped DOM + zero engine `window.*` calls (the engine emits; a host subscribes) | ✅ |
| Native multi-instance | `mount()` composed purely on the primitives + fully per-instance subsystems | ⬜ |

The headless boundary depends on Layer state already being per-instance: state must live on `Layer`
objects before the handlers that mutate it are rewired, or the DOM/event wiring gets done twice.

### 3.2 The engine→host boundary — how headlessness is enforced

Two independent properties make the "headless" claim real, and each is *enforced*, not merely asserted:

- **Instance-scoped DOM.** The engine resolves DOM through `package/dom.js` — either a per-instance
  factory (`createLayerPanel(root)`, etc.) or the ambient `setActiveDom` scope for not-yet-per-instance
  subsystems — never a document-wide `getElementById`. A `data-action` delegation dispatcher replaces
  inline handlers, so dynamically-generated markup works by bubbling through one listener.
- **No engine module calls into host UI.** The engine's only outbound channel is `package/events.js`: it
  **emits** (`notify`, `notifyStorageChanged`, `notifyUploadComplete`, generic `emitHost`) and a host
  **subscribes** (§1.2). With no sink attached every emitter is a silent no-op — the property that lets a
  bare-engine consumer run with no host UI at all. This is guarded by a source-scan test
  (`test/hostEvents.test.mjs`) that asserts **zero** engine-module `window.*` calls (except
  `gm_authFailure`, which Google Maps calls *on* the engine, not the reverse) and no reach into
  `window.layerPanel`.
- **The engine names no database or table.** The same test asserts no engine module contains a concrete
  store name (e.g. `fimviz-store`/`toolbox-store`) or a `files*Metadata` table name — a host owns the
  schema (§1.1). File upload, widget textbox/checkbox reading, and overlay-driving are host concerns; the
  genuinely headless pieces live in the engine: `geo/tifBounds.js` (GeoKeys → WGS84 bounds + CRS
  validation), `io/read.js`, and `io/parsePrimitives.js` (vendored geotiff/togeojson/shpjs re-exports, so
  host code never names those packages directly).

### 3.3 `Storage` — a generic KV store, disposable by policy

`Storage` is a small generic db/table/row KV mechanism over IndexedDB, not a database library: no query
DSL, no index management, no transaction API beyond put/get/has/delete/list/clear/map. A host that needs
more builds a `StorageAdapter` around a real database rather than extending this class. The engine names
no database or table — a host names its own (§1.1, §1.2).

**Standing policy: a schema change bumps the version and accepts a reset**, not a migration framework —
this is storage a host should treat as disposable. `Storage` still exposes the raw hook a host needs if it
*does* want to migrate (`versionMigrate` runs inside the version-bumping open, with the upgrade
transaction), but the engine itself ships no migration machinery. Read/error semantics are deliberately
simple: a failed read and a missing key both surface as `undefined` — a host that needs to distinguish
them wraps `Storage` rather than the engine growing richer error channels.

### 3.4 Ambient pointers — config retired; the DOM scope is the remaining blocker

The engine keeps **no ambient config pointer**. Config is read per-instance via `fim.config`
(`FimMap.config` → the owning app's config object). The one setting that genuinely cannot be
per-instance — `gdalPath` — has a narrow module-level holder (`setGdalPath`/`getGdalPath`), honest
because gdal3.js compiles a single Emscripten module per page (GDAL is a per-page singleton), so the
first mounted app's path wins by nature of the WASM runtime. The `resolveUrl` URL-resolution seam is
threaded, not ambient: `fim.addDataset` binds the instance's `config.resolveUrl` into the parse
options, and a lazy `Dataset.fromURL` root carries a resolver applied at force time — so two isolated
apps never share a URL-rewriting rule. A test guards that no engine module references
`getConfig`/`setConfig`/`setActiveConfig`. Relatedly, `FimMap.get map()` genuinely owns its map
(`mount.js` calls `_adoptMap()` once boot resolves, instead of a module-level `let map` that made every
`FimMap` on a page report the same map).

**What still blocks true multi-instance** is `dom.js`'s `_active` scope, read by ~475
`domId`/`domQs`/`domQsa` calls (mostly a host-tier concern). That DOM scope needs threading
per-instance; the config/map work above does not incidentally solve it.

## 4. Known gaps

- **Four extension idioms coexist with no stated rule for which applies when**: registry
  (`Layer.registerType`/`FimViz.registerMapProvider`/`Dataset.registerMaterializer`), injected factory
  (`createLayerPanel` passed into `FimMap`), config hook (`config.resolveUrl`), and emitter
  (`package/events.js`). Each was chosen for good reasons in its own spot (see §1's per-decision
  rationale), but no doc states *when a new extension point should reach for which one* — worth writing
  down before a fifth idiom gets invented for something one of the four already covers.

  **Where a registry LIVES is settled, even though which idiom to pick isn't:** on the type it serves,
  as a static. `Layer.registerType`/`Layer.types()`, `ColorScale.registerPalette`/`palettes()`,
  `Dataset.registerMaterializer`/`formats()`/`registerReprojector`/`registerResampler`,
  `FimViz.registerMapProvider`/`mapProviders()`/`registerRuntime`. The owner was never ambiguous in
  any of these cases — a factory registered on the layer registry builds a `Layer`, a palette is a
  `ColorScale`'s ramp — so the barrel exports the **types** and the verbs hang off them, rather than
  ~15 loose top-level functions a reader has to associate by prefix. `registerBuiltinMaterializers`
  is the one exception, and for a structural reason: it lives in `io/materializers.js`, which imports
  geotiff, and `Dataset` must never reach that.

## 5. Incomplete / deferred work

### 5.1 Phase 5 (not started)

- Delete the legacy `widget.html`-injection body inside `mount()`; redefine `mount()` as pure composition
  of the headless components (`fim.renderLayerPanel(...)`, etc.); a host composes its widget on those.
- True multi-instance: thread `dom.js`'s ambient scope per-instance (the real blocker per §3.4); remove the
  single-instance guard; namespace IndexedDB per `FimViz`, not per map (today it's origin-global).

Turnkey embedding of the *full* widget (packaging the UI tier as a separate library) is **not planned** —
a bare `mount()` from the `fimviz` barrel alone gives a real, empty map but not the full widget chrome,
since the bundled barrel self-registers no runtime; a host that wants the full widget registers its
own runtime from its own composition root.

### 5.2 Dataset/Layer ADT — designed for, not built

- **Transformation ops**: `filter`, `slice`, `rasterize`/`polygonize` (kind-changing, per §1.1-F). The op
  infrastructure (declarative descriptors, per-kind dispatch, the LHS-conform rule, warning collection)
  already accepts them; they just haven't been written.
- **General recipe replay in `fromRecord`** for arbitrary op chains — Phase 1 replays
  reproject/select/mask/clip/reclassify/combine; the replay logic grows as the op set grows.
- **`fromURL` raster reprojection** — the GDAL reprojector needs the encoded source bytes, which a lazy
  `fromURL` root hasn't fetched yet (a `parseFile`'d Dataset already has them on `.data` and works today).
  Needs either buffering the fetch first or a server-side warp path.
- **`Dataset.fromGrid`** (a materialized-Dataset factory) and restructuring the extent slider's `ctaLayer2`
  as a real `RasterLayer` — noted as only worthwhile once a true in-place image swap exists broadly (today
  only Leaflet has one; Google's is remove-and-recreate regardless).
- **CRS-normalization convenience flag** — the auto-reproject-then-render app-tier policy mentioned in
  §1.1 is designed for but not wired up.
- **Bounded materialized-cache eviction (LRU/size cap) / a prefetch-and-evict window around the slider
  position** — ref-counted eviction is landed; tuning it further is a lever for the hottest path, not yet
  pulled.
- **Structural caching across identical op-chains** (memoize by recipe hash, dedupe identical chains) —
  possible because the recipe is immutable and hashable, but premature until a real usage path shows the
  redundancy actually costing something.

### 5.3 Browser verification still owed

Recorded because it's easy to lose track of what's been confirmed by hand vs. only by `npm test`, which
does not cover `google.maps` rendering or the GDAL WASM warp. Owed, at the engine level: vector-layer
rendering + neutral-style translation on both providers (Google and Leaflet); raster overlay
colorize/opacity/hit-test on Google; the GDAL WASM reproject forced at a real terminal; and the
`http://[::1]:PORT` loopback fix (confirm data actually fetches over IPv6 loopback, not just `localhost`).

### 5.4 Bigger, further-out additions

Event-filtering/interaction policy, more Dataset operations, additional/proprietary formats, new
import/export transports — scoped separately in [PACKAGE_ROADMAP.md](./PACKAGE_ROADMAP.md), not repeated
here.

## 6. Cross-references

- **What's built, with current signatures:** [usage/USAGE.md](./usage/USAGE.md) and the rest of
  `docs/usage/`; the generated per-parameter reference is [docs/api/](./api/).
- **The object model's shape (UML, ownership, per-class status):** [CLASS_DIAGRAM.md](./CLASS_DIAGRAM.md).
- **Forward-looking roadmap (not yet started, larger additions):**
  [PACKAGE_ROADMAP.md](./PACKAGE_ROADMAP.md).

## What is public, and the one test for it (resolved)

The usage docs used to name thirteen functions the barrel didn't export — readable as promises the
package wasn't making. Resolved by asking one question per name, **not** by exporting them all: *does
a consumer have a use for this that the public API doesn't already serve?*

Only one passed. **`Dataset.formats()`** is now barrel-exported: "which formats can I decode
right now" has no other answer, and a host needs it to build a file picker's `accept` list or to
validate an upload before parsing. **`Layer.types()`** was added — a *new* name, not one of the
thirteen — replacing the proposed `hasLayerType` export, because `type` is overloaded in this
codebase (a registry key for `addLayer`, and separately `layer.type`'s subtype discriminator, with
`'depth'`/`'ensemble'` meaning different things in each); a list named after the registry can't be
misread the way a `hasLayerType(type)` predicate could.

Everything else stayed internal and the docs now say so:

- **`getMaterializer`/`getReprojector`/`resolveReprojector`** — they hand back the *implementation*,
  which is what the seam already dispatches to. A caller who wants a decode calls `ds.load()`; one
  who wants a warp calls `ds.reproject(crs)`. Nothing is left for the handle to do.
- **`providerRequiresApiKey`** — its only use was a provider-picker deciding whether to show a key
  field, and `mount()` already throws `config-invalid` naming the missing key. Retired from the
  barrel along with the google default — `provider` now has **no** default at all and is required
  (§1.1), so there is no implied backend whose key requirement a caller would need to ask about.
  (`mapProvider.js`'s `DEFAULT_PROVIDER = 'leaflet'` is *not* that default: it is what a **detached**
  layer — one built with no mounted app, so no `config.provider` to read — resolves against.)
- **`styleToGoogle`/`styleToLeaflet`/`featuresOf`/`resolveFeatureStyle`** — provider-implementation
  detail. `VectorLayer` applies them; a third-party provider author reads `mapProvider.js`, which
  carries the full contract and two worked implementations.
- **`hasLayerType`/`createLayer`/`dispatchMapEventToLayers`/`geomContains`** — reached through
  `fim.addLayer(...)` / `fim.enableMapEvents()`. For a point-in-polygon test of one's own, the public
  equivalent is `SpatialFilter.contains(lat, lng)`.

**The standing rule:** a name reaches the barrel when it answers a question the public API can't, not
because it happens to be exported from its module. Everything remains reachable through
`fimviz/src/*` for anyone who really needs it — with no types and no stability promise, which is the
honest signal that they are off the supported path.
