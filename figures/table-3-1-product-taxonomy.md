# Table 3.1 — Flood product taxonomy

Keyed by **product kind**, not by class, so the table stays independent of Fig. 3.3's object model.
The `layer type` column is the registry key passed to `addLayer(type, …)`.

| Product kind | Sources (arity) | Value semantics | Rendering strategy | Nodata convention | Derived outputs admitted | Layer type |
|---|---|---|---|---|---|---|
| **Extent** | 1 | Binary — wet / dry, after `reclassify` to a strict 0/1 grid | Single-stop `ColorScale`; dry rendered transparent so the basemap carries the context | Sentinel, not a value. `compareExtentMetrics` treats *anything not the dry value* as wet, so nodata must be folded out before scoring or it counts as flooded | Contingency metrics against a second extent; zonal area by polygon; agreement counts across members | `raster` |
| **Depth** | 1 | Continuous, metres, ≥ 0 | Continuous ramp over the observed range; `Legend` from the scale, not hardcoded | `NaN` / declared noData → transparent. Distinct from 0, which is a real depth reading of "dry" | Extent by threshold; `Stats` moments and histogram; zonal statistics; damage estimate | `raster`, `depth` |
| **Ensemble / probabilistic** | N (2+) | Count per cell — how many members are wet (0…N) | N-step agreement ramp for counts 1…N; count 0 transparent. Members are aligned onto a common grid first | Members must agree on the dry sentinel; a member's nodata is not a dry vote and has to be masked before aggregation | Agreement surface; exceedance fraction; per-member disagreement | `ensembleAgreement`, `ensemble` |
| **Velocity field** | 1 (two bands: u, v) | Vector field — magnitude and direction per cell | Animated particle advection over a magnitude ramp; direction is not colour-encoded | Absent vector ≠ zero vector. A zero-magnitude cell is still water; a nodata cell is not | Magnitude raster (√(u²+v²), via a callback `reclassify`); streamline density | `velocity` |
| **Damage** | 1 vector source (building points/polygons) | Point attribute — currency or ratio per feature | Graduated symbols or choropleth over feature attributes; not a raster path at all | A feature with no matched occupancy class is excluded from the total, not counted as zero | Aggregate loss by zone; exposed count by depth band | *none* — `estimateHazusDamage()` is a pure function, not a registered layer |
| **Comparison** | 2 (metrics), 2–8 (classification) | Categorical — a category surface derived from an N-ary alignment. Per pixel, a bitmask of which sources are wet | One colour per non-empty category (2ⁿ−1 of them); "neither" transparent. Sources are resampled onto one grid under an explicit policy before classification | Scored on the aligned grid, so each source's nodata has already been resampled — the domain must be restricted *before* the tally, and there is no per-pixel mask parameter to do it with | CSI, POD, FAR, bias, accuracy, κ; per-category cell counts and areas | `comparison` |

## Notes

**Arity is not cosmetic.** It determines whether alignment is required at all. The single-source kinds
render on their native grid; the N-ary kinds cannot render before `alignRasters` has resolved a
common grid under a `low` / `high` / `average` policy, and that choice is a reported parameter rather
than a default (Study 5 varies it across twelve combinations).

**Nodata is the column that separates flood work from general raster viz.** In four of the six rows
an absent value carries domain meaning that differs from zero — a dry cell is not an unobserved cell,
a zero-magnitude vector is not a missing vector, an unclassified building is not a building with no
loss. A toolkit that maps nodata to transparent and stops has discarded the distinction the metrics
depend on.

**Damage is deliberately the odd row.** It is the one product with no registered layer type: the
engine exposes `estimateHazusDamage(buildings, { isGpkg })` as a pure function and leaves the
rendering to the ordinary vector path. Listed here because the taxonomy is about products, not about
classes — and the asymmetry is a finding, not an omission to be smoothed over.

**The taxonomy is implicit, not declared.** There is no `PRODUCT_KIND` enumeration in `src/`; the
kinds above are recoverable from the seven registered layer types plus the damage function, and from
the options each accepts. If §3.4 is to claim the engine "carries an explicit product taxonomy",
either the wording should soften to *implicit in the layer-type registry*, or the enumeration should
be introduced in code so the table has a referent.
