## 3.4 A taxonomy of flood products

The product kind decides how many sources a rendering needs, how its values are classified and
colored, what an absent value means, and which derived outputs are defined. Table 3.1 sets out six
kinds against those columns. A general-purpose mapping toolkit exposes one raster path and leaves
each of those decisions to the application; the engine encodes them, and that domain content is what
separates it from the libraries in Section 2.2.

Two conventions recur across the table and are worth stating once. Nodata is a sentinel, and every
scoring path in the engine tests inequality against a dry sentinel, so an unmasked nodata cell is
counted as wet. The domain must be restricted before a tally, and the only restriction the engine
offers is a polygon mask through `SpatialFilter`; there is no per-pixel mask parameter. Second, an
N-ary product resamples its members onto a common grid under a stated policy before any
classification, so the alignment method — nearest or mode for a categorical mask, and never bilinear
— belongs to the product definition rather than to rendering.

The final column names the layer type that draws each product, and the two tiers differ. Four types
(`raster`, `vector`, `comparison`, and `ensembleAgreement`) register when the package barrel is
imported. Two more (`depth` and `velocity`) register only when the opt-in `src/layers` barrel is
imported, and they render on Google Maps alone. Damage has no layer type: `estimateHazusDamage()` is
a pure aggregation function, and the marker rendering belongs to the host application.

---

**Table 3.1.** Flood product kinds and the conventions each imposes.

| Product kind | Sources (arity) | Value semantics | Rendering strategy | Nodata convention | Derived outputs admitted | Layer type |
| --- | --- | --- | --- | --- | --- | --- |
| Extent | 1 | Binary — wet / dry, after reclassify to a strict 0/1 grid | Two-class classed `ColorScale`; dry rendered transparent so the basemap carries the context | Sentinel, not a value. `compareExtentMetrics` treats anything not equal to the dry value as wet, so nodata must be folded out before scoring or it counts as flooded | Contingency metrics against a second extent; zonal area by polygon; agreement counts across members | `raster` |
| Depth | 1 | Continuous, metres, ≥ 0 | Continuous ramp over the observed range; `Legend` derived from the scale rather than hardcoded | NaN or declared `noData` renders transparent. Distinct from 0, which is a measured depth of zero | Extent by threshold; `Stats` moments and histogram; zonal statistics; damage estimate | `raster`; `depth` when the opt-in barrel is imported (Google Maps only) |
| Ensemble / probabilistic | N (2 or more) | Count per cell — how many members are wet (0…N) | N-step agreement ramp for counts 1…N, count 0 transparent. Members are aligned onto a common grid first | Members must agree on the dry sentinel. A member's nodata is not a dry vote and has to be masked before aggregation | Agreement surface; exceedance fraction; per-member disagreement | `ensembleAgreement`; a single pre-baked member is a `raster` layer carrying `type: 'ensemble'` |
| Velocity field | 1 source carrying two components (u, v) — GRIB2 messages selected by parameter category and number, or two arrays | Vector field — magnitude and direction per cell | Animated particle advection over a magnitude ramp; direction is not color-encoded | An absent vector is not a zero vector. A zero-magnitude cell is still water; a nodata cell is not | Magnitude raster (√(u²+v²), through a callback passed to `reclassify`); streamline density | `velocity` — opt-in barrel, Google Maps only |
| Damage | 1 vector source (building points or polygons) | Point attribute — currency or ratio per feature | Graduated symbols or choropleth over feature attributes; not a raster path | A feature with no matched occupancy class is excluded from the total rather than counted as zero | Aggregate loss by zone; exposed count by depth band | None. `estimateHazusDamage()` is a pure function, outside the public API at present |
| Comparison | 2 for metrics, 2–8 for classification | Categorical — a category surface from an N-ary alignment. Per pixel, a bitmask of which sources are wet | One color per non-empty category (2ⁿ−1 of them); "neither" transparent. Sources are resampled onto one grid under an explicit policy before classification | Scored on the aligned grid, so each source's nodata has already been resampled. The domain must be restricted before the tally, and only a polygon mask is available to do it | Accuracy, bias, probability of detection, critical success index, and Cohen's κ, returned directly; false alarm ratio derived as fp/(tp+fp); per-category cell counts and areas | `comparison` |
