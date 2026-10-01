**5.4. Riverine flood exposure in Louisiana today and under a 2050 climate**

*Repository mapping: `case-studies/case_study10.html` and `case-studies/build_case_study10_data.mjs`
(default region Louisiana). It replaces case study 4 as §5.4. Numbers are from the page's run over the
builder output of 22 September 2026.*

Riverine flood hazard is published as a stack of scenario maps, one per return period and one per
climate model, and a planner's first question of such a stack is how many people each map puts in the
water and how far the maps agree. Louisiana carries a large share of the United States' riverine flood
exposure, and its floodplains are wide enough to register on a global grid. How many people in Louisiana
live inside the 100-year riverine flood extent today, how does that number change by 2050 under RCP8.5,
and how far do five climate models agree on where the water goes?

The study composes one scene from public files and exercises the parts of the engine the other three
studies do not: selection axes built from separate files, operations chained across three sources, six
layer types drawn from one chain, and a recipe that rebuilds the scene. The nine historical depth files
form a Dataset with an ordered `return_period` axis, and `select(rp)` fetches only the file on the slider.
The five 2050 files form a second Dataset with an unordered but reducible `gcm` axis, and
`reduce("mean")` collapses it into an ensemble-mean depth. `reclassify` with range rules produces hazard
classes and wet masks, `combine` produces the change in depth and the population inside the extent,
`mask` restricts the population to the state, and the terminals `zonalStats` and `groupBy` produce the
per-parish and per-class counts. A `ComparisonLayer` scores the 2050 extent against today's, and an
`EnsembleAggregationLayer` counts how many models flood each cell.

WRI's Aqueduct Floods, version 2 (Ward et al., 2020), supplies riverine flood depth in meters on a
30 arc-second global grid (43200 × 21600 cells). The depths come from the GLOFRIS cascade, in which the
PCR-GLOBWB hydrological model with river and floodplain routing simulates discharge and flood volume,
and each return period's volume is spread over the terrain. The historical maps are driven by the
EU-WATCH reanalysis for 1960–1999 and labelled 1980 (Society of Actuaries, 2021); the future maps rerun
the cascade with five CMIP5 models (NorESM1-M, GFDL-ESM2M, HadGEM2-ES, IPSL-CM5A-LR, and MIROC-ESM-CHEM),
of which this study takes RCP8.5 in 2050 at the 100-year return period. Population comes from
WorldPop's 2020 unconstrained counts at 1 km, which redistribute census totals to cells with a
random-forest model over settlement, land-cover, road, and night-light covariates. The state outline and
its 64 parishes come from geoBoundaries (Runfola et al., 2020), which takes them from the US Census
Bureau's MAF/TIGER database. The builder read each global file with HTTP range requests and kept only
the window over the state plus a 0.1° margin (652 × 516 cells, 1.28 MiB per file), on the source grid;
WorldPop's server refused range requests, so its 52.7 MB US file was downloaded whole and cropped. No file
was resampled before the page opened it. The wet threshold is 0.1 m.

In the historical baseline, the 100-year extent holds 1,148,107 of the state's 4,712,533 people
(24.4 %). Exposure grows steadily with return period, from 613,292 people at 5 years to 1,382,956 at
1,000 years, while the wet area roughly doubles over the same range (34,106 to 67,043 cells; Table 5.4a).
Most of the exposed population sits in shallow water: 45 % in the 0.1–0.5 m class, 53 % in the
0.5–1.5 m class, and 2 % (27,445 people) at 1.5 m or more (Fig. 5.4a). The 2-year map contains no wet
cell in the crop, which the page reports rather than drawing an empty layer without comment.

The 2050 ensemble mean changes depth more than extent. On the 62,170 cells wet in either map, the
ensemble-mean depth is 0.23 m shallower on average, with 17.8 % of cells more than 0.1 m shallower and
5.6 % more than 0.1 m deeper. The extent is nearly unchanged: the comparison layer gives a frequency bias
of 0.975, 96.3 % of today's wet cells remain wet, and the critical success index is 0.952 (Fig. 5.4b).
The five models place the floodplain in nearly the same cells, with 89.6 % of the cells any model floods
flooded by all five and 3.0 % by one or two (Fig. 5.4c). They differ in the people they put inside it:
2050 exposure runs from 1,082,872 (NorESM1-M, −5.7 % against today) to 1,164,876 (GFDL-ESM2M, +1.5 %),
and three of the five models exceed today's count, so the sign of the change depends on the model
(Table 5.4b). The ensemble mean averages depth cell by cell, which lowers the deepest cells: it places
23,458 people at 1.5 m or more, within the single-model range of 17,466 to 28,653. Summed by parish, the
ensemble mean holds 1,155,323 people (+0.6 %), and Jefferson, Ascension, and Orleans carry 32 % of that
total (Fig. 5.4d).

The recipe carries the scene. Four products (the change surface, the two exposure surfaces, and the
hazard classes) take 21 ops over seven source files, and `toRecord()` writes them as 289.7 kB of JSON
against 9.0 MiB of GeoTIFF the scene reads. `Dataset.fromRecord()` rebuilt all four, refetched the files,
and reproduced every checksum to the last digit. The largest part of the recipe is the state outline
(2,163 vertices after simplification at a quarter cell), which appears four times, because
`toRecord()` writes a tree and the masked population enters each exposure chain twice.

**Instrumentation and limitations.** Building the page surfaced four engine properties that change
what a host must write. `combine`'s `min`, `sum`, and `mean` skip an absent input rather than propagate
it, so masking population with `min(pop, OPEN)` counted cells with no population as 10¹² people, and
populated cells with no depth as wet. The page makes each raster gap-free over the other's footprint
before masking, and a cross-check against `groupBy` detected both errors. `Dataset.fromURL` infers the
format from `name` rather than from the URL, so a name without an extension yields a Dataset that cannot
be forced. The comparison and agreement layers count any value other than the dry value as wet, NaN
included, so the page converts NaN to dry first. geotiff.js writes 8-bit samples only, so the builder
carries its own float32 GeoTIFF writer. Three limits apply to the numbers. Aqueduct's 1 km grid does not
resolve small channels, and a lidar-based regulatory map would draw a different extent. The study applies
no levee protection, so parishes behind the federal levee system, Orleans and Jefferson among them,
count their population wherever the depth map is wet; with protection applied, their counts would fall
by an amount this study does not estimate. WorldPop's unconstrained counts spread people over every land
cell, which places people in thinly settled floodplain cells that a building-constrained product would
leave empty.

Fig. 5.4a. Historical 100-year riverine depth over Louisiana (left) and the three hazard classes derived
from it by `reclassify` (right). One entry of the `return_period` axis; the slider on the page steps
through the other eight.

Fig. 5.4b. Change in 100-year depth, 2050 five-model mean minus today, with changes smaller than 0.1 m
left blank (left), and the `ComparisonLayer` classification of the two extents, with today as the
reference (right).

Fig. 5.4c. Number of the five climate models that flood each cell at the 100-year return period in
2050, from an `EnsembleAggregationLayer`.

Fig. 5.4d. People inside the 2050 ensemble-mean 100-year extent by parish, a vector layer colored by the
`zonalStats` sum.

| return period | wet cells in the crop | people inside the extent | share of state population |
| ---: | ---: | ---: | ---: |
| 2-year | 0 | 0 | 0.0 % |
| 5-year | 34,106 | 613,292 | 13.0 % |
| 10-year | 45,409 | 760,907 | 16.1 % |
| 25-year | 51,788 | 858,266 | 18.2 % |
| 50-year | 59,582 | 1,091,622 | 23.2 % |
| 100-year | 61,471 | 1,148,107 | 24.4 % |
| 250-year | 64,121 | 1,280,545 | 27.2 % |
| 500-year | 65,661 | 1,329,243 | 28.2 % |
| 1,000-year | 67,043 | 1,382,956 | 29.3 % |

Table 5.4a — Extent and exposure by return period, historical baseline, wet above 0.1 m. State
population 4,712,533 (WorldPop 2020).

| climate model, RCP8.5 2050 | wet cells in the crop | people inside the 100-year extent | against today | people at 1.5 m or more |
| --- | ---: | ---: | ---: | ---: |
| NorESM1-M | 57,977 | 1,082,872 | −5.7 % | 18,774 |
| GFDL-ESM2M | 59,865 | 1,164,876 | +1.5 % | 26,243 |
| HadGEM2-ES | 57,760 | 1,096,401 | −4.5 % | 17,466 |
| IPSL-CM5A-LR | 60,020 | 1,161,741 | +1.2 % | 28,653 |
| MIROC-ESM-CHEM | 58,332 | 1,159,125 | +1.0 % | 25,963 |
| five-model mean | — | 1,155,391 | +0.6 % | 23,458 |
| today (1980 baseline) | 61,471 | 1,148,107 | — | 27,445 |

Table 5.4b — Exposure at the 100-year return period under each climate model, the ensemble mean, and
today.

References to add: Ward, P. J., Winsemius, H. C., Kuzma, S., et al. (2020), *Aqueduct Floods
Methodology*, World Resources Institute; Society of Actuaries (2021), *Potential Impacts of Climate
Change on U.S. Inland Flood Risk*; WorldPop (2020), Global 1 km population counts, 2020; Runfola, D.,
et al. (2020), geoBoundaries, *PLOS ONE* 15(4): e0231866.
