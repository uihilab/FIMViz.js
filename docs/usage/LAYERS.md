# Layer — usage reference

`Layer` (barrel-exported alongside `RasterLayer`/`VectorLayer`) is one rendering
of one or more `Dataset`s on the map. It's an **event emitter** (never imports/names any UI — a UI
binder subscribes instead) and owns the shared render pipeline every subtype builds on. Subtype-
specific methods (RasterLayer/VectorLayer/ComparisonLayer/EnsembleAggregationLayer): see
[LAYER_SUBTYPES.md](./LAYER_SUBTYPES.md).

## Contents

[Construction](#construction) · [Properties](#properties) · [Events](#events) ·
[Lifecycle](#lifecycle) · [Render pipeline](#render-pipeline) · [Chainable ops](#chainable-ops) ·
[Swapping sources](#swapping-sources) · [Settings](#settings-declarative-knobs) ·
[Read-models](#read-models) · [Hit-testing](#hit-testing) ·
[The type registry](#the-type-registry-how-fimaddlayer-dispatches) ·
[FimMap-side layer registry](#fimmap-side-layer-registry) ·
[Map-event dispatch](#map-event-dispatch-internal--driven-by-fimenablemapevents)


## Moving a layer to another map

`toSpec()` is a plain, structured-cloneable **description** — type, sources, settings, and the
ColorScale as data. `addLayer(spec)` rebuilds an equivalent layer from it:

```js
const spec = layer1.toSpec();
const layer2 = await map2.addLayer(spec);   // works across providers
```

The `Dataset` is **shared** (a free value — no re-parse, no second decode) and is adopted onto the
target map's app so it shows up in `datasets` there too. Everything else is **copied**: the rebuilt
layer gets its own `ColorScale` built from the description, its own id, and no event subscribers.
So the two layers diverge — recolouring one never touches the other.

That copy-not-share rule is why this is a descriptor rather than a `clone()`: a clone has to decide
whether mutable colour state is shared, and no default is right for every caller.

## Forgetting a layer's data

```js
layer.remove()                          // teardown; releases the decode at zero refs. The
                                         // Dataset stays registered and re-forces if used again.
layer.remove({ purgeSource: true })      // …and unregister each source nothing else holds
fim.removeDataset(ds)                    // forget it outright — THROWS while a layer still renders it
fim.removeDataset(ds, { force: true })   // unregister anyway
fim.adoptDataset(ds)                     // register a Dataset parsed on another app
```

Registry membership and reference counting are separate: the registry records what was **parsed**,
the count records what is **rendered**. `remove()` only ever affects the latter.


## Construction

```js
new Layer({ map?, type?, sources=[], id?, exclusive=false })
// map: the owning FimMap (or null) · type: discriminator string, e.g. 'vector'/'raster'/'depth'
// sources: Dataset[] — 1 for most layer types, 2+ for comparison/ensemble-aggregation
// id: auto-generated if omitted · exclusive: true = a "display-claiming" layer (velocity/ensemble)
```

Usually you don't construct `Layer` directly — `fim.addLayer(...)` dispatches to the right subclass.
The bare base has no `_draw()` override, so rendering it draws nothing (see "Render pipeline" below)
— it's meant either to be subclassed, or used headlessly (a subsystem that emits data events instead
of drawing, e.g. the historical velocity/ensemble pattern).

## Properties

| Property | Type | Notes |
|---|---|---|
| `.id` | `string` | Stable, auto-generated if not passed. |
| `.type` | `string\|null` | Discriminator among siblings of one class. Drives event forwarding (below). |
| `.sources` | `Dataset[]` | Never mutate directly — use `setSources`/`deriveSources`. |
| `.map` (getter) | `FimMap\|null` | The owning map. |
| `.dataset` (getter) | `Dataset\|null` | Convenience = `sources[0]`. |
| `.visible` | `boolean` | Set by `render()`/`hide()`. |
| `.exclusive` | `boolean` | Display-claiming (velocity/ensemble-style — see `_claimExclusive`). |
| `.result` | `*` | Set by `compute()` — the render-ready decoded value. |

## Events

```js
layer.on(evt, fn)     // subscribe — returns this
layer.off(evt, fn)
layer.once(evt, fn)   // auto-unsubscribes after first fire
layer.emit(evt, payload?)   // fires listeners with { ...payload, layer: this }
```

Built-in lifecycle events: `'rendered'` (overlay is on the map, data ready) and `'removed'` (torn
down, fired **synchronously** by `remove()` — not on the provider's async teardown callback).

**Every event ALSO forwards** to the owning map's bus under `` `${type}:${evt}` ``:

```js
layer.on('rendered', fn)              // this ONE layer's lifecycle
fim.on('userRaster:rendered', fn)     // ANY layer of type 'userRaster' on this map
```

(Forwarding only happens when the layer has both a `type` and a map — automatic, no per-type wiring
needed for a new layer type.)

## Lifecycle

```js
layer.show() / layer.hide()   // base: just flips .visible. RasterLayer/VectorLayer OVERRIDE this to
                               // actually toggle the overlay on the map (see LAYER_SUBTYPES.md) — the
                               // bare base has no overlay of its own to toggle, so flipping the flag
                               // is all it can do.
layer.fit()                   // fit the map to this layer's bounds (base is a no-op; subtypes override)
layer.remove()                 // teardown + emit('removed') + unregister from the owning FimMap
```

## Render pipeline

```js
await layer.compute(opts?)   // force the primary source Dataset, memoize onto .result. Override to
                              // align+reduce N sources (ComparisonLayer/EnsembleAggregationLayer do).
await layer.render(opts?)    // compute (if needed) → CRS precondition → draw. opts.render:
                              //   'auto' (default) | 'in-place' | 'recreate'
```

`render()`:
1. Calls `compute()` only if `.result` is still `null` (so re-rendering after a live setting change
   skips re-forcing the data).
2. **CRS precondition**: throws `"the '<provider>' provider cannot render CRS '<crs>'... Reproject
   first"` if any source's native CRS isn't renderable — mechanism only, the engine never silently
   reprojects (also emits a `layer:crs-unrenderable` host event).
3. Warns via `console.warn` (doesn't throw) if `_draw()` was never overridden — draws nothing, would
   otherwise look like a silent, indistinguishable bug.
4. `_draw({...opts, mode})` — the only provider-touching step. Base is a no-op.
5. Claims the exclusive display slot (`fim._claimExclusive(this)`) if `.exclusive`.

`opts.render` (`'auto'|'in-place'|'recreate'`): explicit wins; `'auto'` asks the provider (does it
expose `setRasterImageUrl`?) and the layer type (`_usesRasterImage()`) — vector layers and providers
without in-place swap always fall back to `'recreate'`.

## Chainable ops

The same [Dataset ops](./DATASET_OPERATIONS.md), reachable from the layer you already have. Each
returns the layer, so they chain; one `render()` draws the result:

```js
await layer.clip(bbox).mask(polygon).reclassify(rules).render();
await layer.reset();     // back to the sources the layer was built from
```

| Op | Notes |
|---|---|
| `clip(bbox)` `mask(polygon, opts?)` `reclassify(rules, opts?)` `resampleTo(target, opts?)` | raster ops, per [DATASET_OPERATIONS.md](./DATASET_OPERATIONS.md) |
| `slope(opts?)` `aspect()` `hillshade(opts?)` | terrain |
| `reproject(toCrs)` | the warp runs at `render()`, GDAL loads then |
| `select(coord, opts?)` `reduce(op?, opts?)` | selection-axis ops — `select` is what a scenario slider drives |
| `reset(opts?)` | **async** — restores the pre-op sources and re-renders a live layer |
| `dirty` | getter: an op has been applied that the last `render()` hasn't drawn |

**Three timings, and only the first is "immediate":**

1. **Sources are rewritten now**, synchronously, at each call — so `layer.dataset`, `getStats()` and
   `fit()` tell the truth mid-chain, and a bad argument throws at the call that made it rather than
   several awaits later.
2. **The map redraws at `render()`** — a four-op chain repaints once, not four times.
3. **Data still computes lazily**, at a terminal inside `compute()`. Chaining forces nothing.

Ops apply across **all** sources, so a comparison/ensemble layer clips every member. The cost of
immediate application: a chain that throws partway leaves the earlier ops applied. Nothing is
corrupted — every op is a pure new node — and `reset()` returns to the original sources.

**Not available:** `combine`/`difference` (N-ary — "which source is the left operand" has no answer
on a layer; call them on the Datasets), and `rasterize`, which changes a Dataset's *kind* and so
can't return this layer. `layer.rasterize()` throws naming the alternative:
`fim.addLayer(layer.dataset.rasterize({ width, height }))`.

## Swapping sources

```js
await layer.setSources(sources, opts?)          // sources: Dataset | Dataset[]
await layer.deriveSources(fn, opts?)             // fn: (current: Dataset[]) => Dataset | Dataset[]
```

Immutable swap — never mutates a Dataset, points at a new one. Drives the FimMap's ref-count (new
sources acquired before old ones are considered for release). **Atomic**: if the live layer's
re-render throws (bad CRS, a fetch failure, ...), the whole swap rolls back — `sources`/`result`
revert to their pre-call values and the failed acquire is undone — rather than leaving the layer
pointing at broken new sources with the working old ones already released. `deriveSources` is sugar
for a "hot-modify" — the derived Dataset shares memoized ancestors with the old one, so only the
changed tail recomputes.

## Settings (declarative knobs)

```js
layer.settings.get(key?)        // one knob, or the whole state object (a copy) with no key
await layer.settings.set(partial)   // batch-write; also: layer.set(partial) sugar, layer.get() sugar
await layer.settings.reset()
```

`settings.set` is **partial/best-effort**: one invalid key doesn't block the others in the same
call — every other key still applies and its effect event still fires. If any key failed, ONE
aggregate error throws at the end naming every failed key (with its own message) and which keys
succeeded despite it. Which keys exist depends on the subtype — see
[LAYER_SUBTYPES.md](./LAYER_SUBTYPES.md).

## Read-models

```js
layer.getLegend()        // base: null. RasterLayer AND VectorLayer derive one from their ColorScale.
await layer.getStats()   // base: null. RasterLayer classifies pixels by the attached ColorScale;
                         // VectorLayer counts features by geometry type (area/length/bbox) from its
                         // GeoJSON source — works headless, before/without a render, any provider —
                         // and buckets byClass by its own colorScale/colorBy when both are set.
```

## Hit-testing

```js
layer.hitTest(lat, lng)   // base: always false. RasterLayer tests the real footprint (pixel-level,
                          // excludes noData/transparent); VectorLayer tests feature geometry.
```

Used by the map's click/hover dispatch (`dispatchMapEventToLayers`, below) to decide which layer(s)
receive an event.

## The type registry (how `fim.addLayer` dispatches)

```js
Layer.registerType(type, factory)   // factory: (fim, opts) => Layer | Promise<Layer>
Layer.types()                     // string[] — every type addLayer can currently construct
```

Built-in registered types: `'vector'`, `'raster'` (both in `layer.js`); `'comparison'`,
`'ensembleAgreement'`, `'velocity'`, `'ensemble'`, `'depth'` self-register from their own modules on
import. `Layer.types()` returns exactly those plus anything a host registered — a copy, so
mutating it can't corrupt the registry.

> **These are registry keys, not `layer.type` values.** `'depth'` and `'ensemble'` appear in both
> vocabularies: here they name a *factory* `addLayer` can dispatch to, while `layer.type` uses them
> as discriminators among sibling rasters (`'extent'`/`'userRaster'`/`'depth'`/`'ensemble'`) to say
> *what kind of raster this is*. `Layer.types()` only ever answers the first question.

`hasLayerType(type)` and `createLayer(fim, type?, opts?)` exist in `layer.js` but are **internal** —
`fim.addLayer(...)` is the way in, and it already throws naming every registered type when one can't
be resolved.

`fim.addLayer(type?, opts?)` — `type` can be:
- an explicit registry string (`'raster'`, `'vector'`, ...),
- **omitted**, inferred from `opts.source`/`opts.sources[0]`'s `Dataset.kind` — only when there's
  exactly **one** source (a multi-source type like comparison can't be guessed),
- a **bare Dataset** (or any object) instead of a string — `fim.addLayer(ds)` — internally shifted to
  `{source: ds}`, then inferred the same way,
- a **raw File/Blob/ArrayBuffer/URL** — parsed via `addDataset()` first (lands on `fim.datasets` too),
  so `fim.addLayer(file)` needs no separate `addDataset()` step.

An unresolvable type throws, naming the registered options. Some factories (`'raster'`, whose
`RasterLayer.render()` is the async base pipeline) resolve as a `Promise<Layer>` — `addLayer` always
awaits before pushing onto `fim.layers`, so callers never see the unresolved promise.

## FimMap-side layer registry

```js
fim.getLayer(id)                    // Layer | null, by id
fim.registerNamedLayer(name, layer) // the "one user file → one Layer" registry (File Viewer)
fim.getLayerByName(name)            // Layer | null
fim.namedLayers                     // Layer[] — every registered named layer
fim.removeLayer(idOrLayer)          // → layer.remove()
```

## Map-event dispatch (internal — driven by `fim.enableMapEvents()`)

`dispatchMapEventToLayers(layers, type, base, { simultaneous? })` in `layer.js` is the pure function
behind hover/click routing, called by `FimMap`; `geomContains(geom, x, y)` is its point-in-geometry
test. Neither is barrel-exported — turn dispatch on with `fim.enableMapEvents()` (see
[APP_STARTUP_ADVANCED.md](./APP_STARTUP_ADVANCED.md)) and subscribe on the layer. The behaviour it
implements is worth knowing either way:

> Top-down z-order (last = top); every hit-tested layer is offered the event; by default propagation
> stops at the first layer that absorbs it (`evt.stopPropagation()`), and
> `fim.simultaneousLayerEvents = true` bypasses absorption so every hit layer receives it.

For a point-in-polygon test of your own, use `SpatialFilter.contains(lat, lng)` — that one is public.
