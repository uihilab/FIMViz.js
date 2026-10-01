# 1. Introduction

Floods accounted for 44 % of the 7,348 disaster events that CRED and UNDRR (2020) recorded worldwide
between 2000 and 2019, which made them the most common disaster type in that period. Flood
inundation maps (FIMs) locate the hazard for mitigatory decision support, and three families of
method now produce them at national to global scale. Hydrodynamic hazard models supply 30 m
inundation estimates for the conterminous United States (CONUS) under current and future climates
(Bates et al., 2021), and for the globe under any return period or climate scenario (Wing et al.,
2024). Terrain-index methods based on Height Above Nearest Drainage (HAND) link national streamflow
forecasts to inundation extents (Maidment, 2017; Liu et al., 2018), and the NOAA Office of Water
Prediction runs such a pipeline operationally with the National Water Model (NWM) (Aristizabal et
al., 2023). Satellite services supply observed extents: the Copernicus Global Flood Monitoring (GFM)
service typically delivers Sentinel-1 flood maps within five hours of image acquisition (Wagner et
al., 2026).

A practitioner receives more than one of these products for an event. This paper treats five flood
product kinds (extents, depths, ensembles, velocity fields, and damage estimates), and Section 3.4
adds a sixth, the comparison of two or more extents. They differ in
dimensionality, in the rendering each needs, and in what a derived output means (e.g., a depth grid
admits a wet threshold, an ensemble admits a count of agreeing members, and a damage record admits
aggregation by zone). Products for one event also arrive in different coordinate reference systems,
at different grid resolutions, and with different conventions for a missing value, and these
differences are reconciled before any two products can be compared.

The reconciliation is software work, and no browser library reviewed in Section 2 performs it for
flood products. Ingest, reprojection, grid alignment, color scaling, overlay rendering, and
agreement metrics are each required before a FIM can be viewed or scored in a web application, so
each application implements them itself. Reimplementation also has a methodological cost. The
critical success index (CSI) of one prediction against one benchmark depends on how a categorical
mask is resampled onto a common grid and on whether nodata cells count as dry, and the definition of
the metric fixes neither choice. Cohen et al. (2025) found that including permanent water bodies in
an evaluation can inflate assessed model accuracy. Two groups that make different choices can
therefore report different CSI values for the same pair of maps.

General-purpose web mapping libraries (e.g., Leaflet and OpenLayers) supply rendering and
interaction, and they carry no flood product model: no wet threshold, no ensemble, and no agreement
metric. Browser-based hydroinformatics libraries supply data retrieval, analysis, and computation
(Erazo Ramirez et al., 2022, 2024), and their published descriptions do not cover FIM rendering or
extent evaluation. The domain rules between the two (what each product kind is, how it is drawn,
which derived outputs it admits, and how two extents are scored) are written inside individual
applications. This study moves those rules into a reusable JavaScript engine, FIMViz.js.

## 1.1. Motivation

The engine is built for reuse, and four modes of reuse each impose one constraint on its design.
Embedding runs the engine inside an interface that a host owns, so the engine may not impose markup,
styling, or a component system. Headless use runs it in a script or batch job with no Document
Object Model (DOM), so no computation may depend on a rendering context. Independent testing checks
one function's numbers without starting an application, so each function that returns a number must
be callable without a map. Incremental adoption takes one part (e.g., a color scale, a statistic, or
a single raster op) without the rest, so the package may not require a single entry point that loads
everything. A library divided into modules can still require a mounted map for each call, so the
decisions that satisfy these modes are made in the object model; Section 3 describes them with their
costs.

## 1.2. Contributions and organization

This study makes five contributions.

1. This study introduces an engine for viewing, deriving, and evaluating FIMs that imposes no markup
   or styling, runs with no DOM, and renders through a provider interface with Google Maps and
   Leaflet implementations. Hosts extend it through named registries for layer types, map providers,
   materializers, palettes, reprojectors, and resamplers (Section 3.1).
2. We separate the Dataset, an immutable source plus its op chain, from the Layer, one rendering of
   a Dataset. Ops compose without reading the source and a chain is forced once, so one decoded grid
   backs more than one Layer; deriving k Layers from one decode ran 0.944k to 0.968k times faster
   than decoding the source once per Layer (Sections 3.2, 3.7, and 4.4).
3. We define six flood product kinds (extent, depth, ensemble, velocity, damage, and comparison) by
   the sources each requires, the rendering each admits, and the derived outputs each supports, and
   we realize them as layer types, ops, and an aggregation function (Section 3.4).
4. We expose four read-models (ColorScale, Legend, Stats, and Filter) with no DOM dependency, so a
   React host, a plain-DOM host, and a script bind to the same objects (Section 3.5). We persist a
   Dataset as a recipe (the source reference plus its ops, with no decoded buffer); in Section 5.4,
   a 289.7 kB recipe rebuilt four products from 9.0 MiB of source GeoTIFFs and reproduced their
   checksums (Section 3.8).
5. We make contingency scoring, grid alignment policy, and region-scoped metrics functions of the
   engine, and we report from two case studies that the CSI is sensitive to benchmark selection and
   nearly insensitive to grid alignment policy, even where the policy changes the scored cell count
   by more than a factor of ten (Section 5).

Section 2 reviews related software and the FIM literature, Section 3 presents the architecture, and
Section 4 measures ingest, rendering, reprojection, deferred computation, and analysis throughput.
Section 5 reports four case studies run on public data, Section 6 discusses adoption and
limitations, and Section 7 lists future work.

# 2. Background and related work

No software reviewed in this section exposes FIM viewing, derivation, and evaluation as parts that a
browser application can adopt separately.

## 2.1. Flood information platforms

Flood information platforms deliver FIMs, observations, and forecasts through one web application.
The Iowa Flood Information System (IFIS) provides access to flood inundation maps, real-time flood
conditions, flood forecasts, and interactive visualizations for communities in Iowa (Demir and
Krajewski, 2013). Demir et al. (2018) described IFIS as a prototype for a generalized decision
support system for flood-related decisions (FLOODSS). IFIS is also the public interface of the Iowa
Flood Center forecasting system, which updates forecasts every 15 min for more than 1,000 Iowa
communities (Krajewski et al., 2017). Sermet and Demir (2018) added Flood AI, an assistant that
answers flood questions using voice recognition, natural language processing, and a disaster
ontology. FIMeval automates the evaluation of model-predicted FIMs against a four-tier benchmark
database for CONUS, and it is distributed as a Python package, a Jupyter notebook, and an ArcGIS Pro
toolbox (Devi et al., 2026).

IFIS, FLOODSS, and Flood AI are delivered as applications, and their functions are reached through
their interfaces. A group that wants one function in a different web application (e.g., the
agreement metrics or the depth rendering) must adopt the surrounding application or reimplement the
function. Publishing the source code does not change this, because extracting a function depends on
how the code is divided. FIMeval is packaged for reuse, but it runs in a Python environment, so a
browser application cannot call it directly.

## 2.2. Web mapping and hydroinformatics libraries

General-purpose web mapping is supplied by open-source JavaScript libraries. Leaflet and OpenLayers
provide interactive maps, tiles, vector rendering, and interaction; deck.gl renders large datasets
on the graphics processing unit (GPU) through WebGL2 and WebGPU; and geotiff.js with
georaster-layer-for-leaflet decodes GeoTIFF files and draws them on a Leaflet map. Cloud-optimized
formats extend what a browser can read without a server-side subsetting service. A Cloud Optimized
GeoTIFF (COG) is organized into tiles, carries reduced-resolution overviews, and is served by an
HTTP server that supports range requests (OGC, 2023). Zarr defines a format for N-dimensional typed
arrays (Zarr Developers, 2023), and the SpatioTemporal Asset Catalog (STAC) specification describes
geospatial assets for indexing and discovery (STAC Contributors, 2021). Abernathey et al. (2021)
describe how such formats, stored as chunks or tiles on object storage, let a client read subsets of
large datasets over HTTP.

None of these libraries defines a flood product. A wet threshold, the distinction between an extent
and a depth, an ensemble agreement count, a contingency table, and the color of an absent value are
left to each application. Section 5.1 measures how much one of these choices, the grid alignment
policy, changes a score.

Browser-based hydroinformatics libraries supply analysis. HydroLang is a client-side library for
acquiring, managing, transforming, analyzing, and visualizing hydrological datasets, organized as
four high-cohesion, low-coupling modules (Erazo Ramirez et al., 2022). HydroLang Markup Language
exposes those analyses as HTML web components, so users with basic programming skills can retrieve,
analyze, visualize, and map data (Erazo Ramirez et al., 2023). HydroCompute adds client-side
computation, running simulations in web workers through WebGPU, WebAssembly, and JavaScript (Erazo
Ramirez et al., 2024). Ewing et al. (2024) implemented the Basic Model Interface (BMI) in JavaScript
and coupled two client-side applications (HydroLang and HLM-Web) for rainfall-runoff simulation.
HydroDS takes the server-side position, providing hosted data services that prepare inputs for
distributed hydrological models (Gichamo et al., 2020). These libraries define no FIM product kinds
and no extent-agreement metrics. The engine follows HydroLang's compositional precedent (independent
modules that a host combines) and applies it to FIM rendering and evaluation.

## 2.3. Flood inundation mapping and its evaluation

The engine's domain rules come from two bodies of work, the first of which produces FIMs. Nobre et
al. (2011) introduced HAND as a terrain model. Maidment (2017) set out the National Flood
Interoperability Experiment (NFIE), which connects high-resolution flood forecasts with real-time
observations and inundation mapping, and Liu et al. (2018) computed a 10 m HAND raster for CONUS in
a CyberGIS workflow. Later studies estimated channel geometry and rating curves from HAND (Zheng,
Tarboton, et al., 2018), improved its terrain preprocessing (Garousi-Nejad et al., 2019), mapped
inundation at large scale from high-resolution terrain (Zheng, Maidment, et al., 2018), and extended
HAND to multiple fluvial sources for the NWM (Aristizabal et al., 2023). Hydrodynamic models range
from the raster-based LISFLOOD-FP model (Bates and De Roo, 2000) to 30 m national and global hazard
models (Bates et al., 2021; Wing et al., 2024), a 100 m pan-European hazard map (Alfieri et al.,
2014), and 100 m maps for Europe and the Mediterranean basin at six return periods (Dottori et al.,
2022). Teng et al. (2017) review empirical, hydrodynamic, and simple conceptual inundation methods
and the uncertainty in their outputs.

The second body of work evaluates FIMs, and it defines the comparison product. Bates and De Roo
(2000) scored a predicted extent against an observed one with a fit measure: the intersection of the
two inundated areas divided by their union. Computed on cell counts, that ratio equals the CSI of
forecast verification, which Schaefer (1990) showed to depend on how often the event is forecast.
Stephens et al. (2014) found that binary pattern measures of this kind favor large floods, since for
the same vertical error in water level a large flood scores better than a small one, and that the
CSI favors overprediction of extent. Cohen et al. (2025) compared lower-quality remote-sensing
benchmarks with a high-confidence benchmark and found considerable differences in assessed accuracy.
Section 5.1 varies the benchmark and the grid alignment policy for one prediction. The benchmark
changed the CSI by more than 50 %, and the alignment policy changed it by less than 0.001; the first
result is consistent with Cohen et al. (2025).

## 2.4. Position of this work

Table 2.1 compares four classes of software against twelve functions that FIM work requires, each
traced to a module of the engine. General-purpose web mapping libraries supply rendering without a
flood product model. Hydroinformatics libraries supply analysis without FIM rendering or evaluation.
Flood information platforms supply both inside an application. The engine supplies them as a
library, and the table marks the rows where its support is partial (e.g., the depth and velocity
layer types, which draw on Google Maps alone).

Table 2.1. Functions required for FIM work, by class of software. [Build note: rows are multi-format
ingest, multi-dimensional and temporal ingest, client-side reprojection, deferred op chain, derived
raster operations, grid alignment and resampling policy, pixel-wise agreement metrics, zonal and
grouped statistics, color scaling with a derived legend, FIM product layer types, map-provider
independence, and client-side persistence and provenance. Columns are flood information platform
(IFIS), general-purpose web mapping library (Leaflet, OpenLayers), hydroinformatics library
(HydroLang), and FIMViz.js. Mark each cell present, partial, or absent; define partial in the
caption; cite the representative system once, in the column header.]

## 2.5. Relation to the companion application

FIMApp is a browser application built by the same laboratory on a subset of the engine and reported
separately [FIMApp reference]. It uses the engine through the registries available to any host,
registering its own layer types, palettes, deployment configuration, and scenario schema. One
function runs the other way: the HAZUS damage aggregation of Section 3.4 was written for FIMApp and
is not yet part of the engine's public API. Where the two papers overlap, this paper describes the
engine and the companion paper describes one application built on it.

# References

Abernathey, R.P., Augspurger, T., Banihirwe, A., Blackmon-Luca, C.C., Crone, T.J., Gentemann, C.L.,
Hamman, J.J., Henderson, N., Lepore, C., McCaie, T.A., Robinson, N.H., Signell, R.P., 2021.
Cloud-native repositories for big scientific data. Computing in Science & Engineering 23 (2), 26–35.
https://doi.org/10.1109/MCSE.2021.3059437

Alfieri, L., Salamon, P., Bianchi, A., Neal, J., Bates, P., Feyen, L., 2014. Advances in
pan-European flood hazard mapping. Hydrological Processes 28 (13), 4067–4077.
https://doi.org/10.1002/hyp.9947

Aristizabal, F., Salas, F., Petrochenkov, G., Grout, T., Avant, B., Bates, B., Spies, R., Chadwick,
N., Wills, Z., Judge, J., 2023. Extending Height Above Nearest Drainage to model multiple fluvial
sources in flood inundation mapping applications for the U.S. National Water Model. Water Resources
Research 59 (5), e2022WR032039. https://doi.org/10.1029/2022WR032039

Bates, P.D., De Roo, A.P.J., 2000. A simple raster-based model for flood inundation simulation.
Journal of Hydrology 236 (1–2), 54–77. https://doi.org/10.1016/S0022-1694(00)00278-X

Bates, P.D., Quinn, N., Sampson, C., Smith, A., Wing, O., Sosa, J., Savage, J., Olcese, G., Neal,
J., Schumann, G., Giustarini, L., Coxon, G., Porter, J.R., Amodeo, M.F., Chu, Z., Lewis-Gruss, S.,
Freeman, N.B., Houser, T., Delgado, M., Hamidi, A., Bolliger, I., McCusker, K.E., Emanuel, K.,
Ferreira, C.M., Khalid, A., Haigh, I.D., Couasnon, A., Kopp, R.E., Hsiang, S., Krajewski, W.F.,
2021. Combined modeling of US fluvial, pluvial, and coastal flood hazard under current and future
climates. Water Resources Research 57 (2), e2020WR028673. https://doi.org/10.1029/2020WR028673

Cohen, S., Baruah, A., Nikrou, P., Tian, D., Liu, H., 2025. Toward robust evaluations of flood
inundation predictions using remote sensing derived benchmark maps. Water Resources Research 61 (8),
e2024WR039574. https://doi.org/10.1029/2024WR039574

CRED, UNDRR, 2020. The Human Cost of Disasters: An Overview of the Last 20 Years (2000–2019). Centre
for Research on the Epidemiology of Disasters and UN Office for Disaster Risk Reduction.
https://www.undrr.org/publication/human-cost-disasters-overview-last-20-years-2000-2019

deck.gl, 2026. deck.gl: GPU-powered, highly performant large-scale data visualization.
https://deck.gl/ (accessed 22 September 2026).

Demir, I., Krajewski, W.F., 2013. Towards an integrated Flood Information System: centralized data
access, analysis, and visualization. Environmental Modelling & Software 50, 77–84.
https://doi.org/10.1016/j.envsoft.2013.08.009

Demir, I., Yildirim, E., Sermet, Y., Sit, M.A., 2018. FLOODSS: Iowa flood information system as a
generalized flood cyberinfrastructure. International Journal of River Basin Management 16 (3),
393–400. https://doi.org/10.1080/15715124.2017.1411927

Devi, D., Dhital, S., Munasinghe, D., Cohen, S., Baruah, A., Chen, Y., Tian, D., Pruitt, C., 2026. A
framework for the evaluation of flood inundation predictions over extensive benchmark databases.
Environmental Modelling & Software 196, 106786. https://doi.org/10.1016/j.envsoft.2025.106786

Dottori, F., Alfieri, L., Bianchi, A., Skoien, J., Salamon, P., 2022. A new dataset of river flood
hazard maps for Europe and the Mediterranean Basin. Earth System Science Data 14 (4), 1549–1569.
https://doi.org/10.5194/essd-14-1549-2022

Erazo Ramirez, C., Sermet, Y., Molkenthin, F., Demir, I., 2022. HydroLang: an open-source web-based
programming framework for hydrological sciences. Environmental Modelling & Software 157, 105525.
https://doi.org/10.1016/j.envsoft.2022.105525

Erazo Ramirez, C., Sermet, Y., Demir, I., 2023. HydroLang Markup Language: community-driven web
components for hydrological analyses. Journal of Hydroinformatics 25 (4), 1171–1187.
https://doi.org/10.2166/hydro.2023.149

Erazo Ramirez, C., Sermet, Y., Demir, I., 2024. HydroCompute: an open-source web-based computational
library for hydrology and environmental sciences. Environmental Modelling & Software 175, 106005.
https://doi.org/10.1016/j.envsoft.2024.106005

Ewing, G.J., Erazo Ramirez, C., Vaidya, A., Demir, I., 2024. Client-side web-based model coupling
using basic model interface for hydrology and water resources. Journal of Hydroinformatics 26 (2),
494–502. https://doi.org/10.2166/hydro.2024.212

Garousi-Nejad, I., Tarboton, D.G., Aboutalebi, M., Torres-Rua, A.F., 2019. Terrain analysis
enhancements to the Height Above Nearest Drainage flood inundation mapping method. Water Resources
Research 55 (10), 7983–8009. https://doi.org/10.1029/2019WR024837

geotiff.js, 2026. geotiff.js: a small library to parse TIFF files for visualization or analysis.
https://github.com/geotiffjs/geotiff.js (accessed 22 September 2026).

georaster-layer-for-leaflet, 2026. Display GeoTIFFs on a Leaflet map.
https://github.com/GeoTIFF/georaster-layer-for-leaflet (accessed 22 September 2026).

Gichamo, T.Z., Sazib, N.S., Tarboton, D.G., Dash, P., 2020. HydroDS: data services in support of
physically based, distributed hydrological models. Environmental Modelling & Software 125, 104623.
https://doi.org/10.1016/j.envsoft.2020.104623

Krajewski, W.F., Ceynar, D., Demir, I., Goska, R., Kruger, A., Langel, C., Mantilla, R., Niemeier,
J., Quintero, F., Seo, B.-C., Small, S.J., Weber, L.J., Young, N.C., 2017. Real-time flood
forecasting and information system for the state of Iowa. Bulletin of the American Meteorological
Society 98 (3), 539–554. https://doi.org/10.1175/BAMS-D-15-00243.1

Leaflet, 2026. Leaflet: an open-source JavaScript library for mobile-friendly interactive maps.
https://leafletjs.com/ (accessed 22 September 2026).

Liu, Y.Y., Maidment, D.R., Tarboton, D.G., Zheng, X., Wang, S., 2018. A CyberGIS integration and
computation framework for high-resolution continental-scale flood inundation mapping. Journal of the
American Water Resources Association 54 (4), 770–784. https://doi.org/10.1111/1752-1688.12660

Maidment, D.R., 2017. Conceptual framework for the National Flood Interoperability Experiment.
Journal of the American Water Resources Association 53 (2), 245–257.
https://doi.org/10.1111/1752-1688.12474

Nobre, A.D., Cuartas, L.A., Hodnett, M., Rennó, C.D., Rodrigues, G., Silveira, A., Waterloo, M.,
Saleska, S., 2011. Height Above the Nearest Drainage: a hydrologically relevant new terrain model.
Journal of Hydrology 404 (1–2), 13–29. https://doi.org/10.1016/j.jhydrol.2011.03.051

OGC, 2023. OGC Cloud Optimized GeoTIFF Standard, version 1.0 (OGC 21-026). Maso, J. (Ed.). Open
Geospatial Consortium. https://docs.ogc.org/is/21-026/21-026.html

OpenLayers, 2026. OpenLayers. https://openlayers.org/ (accessed 22 September 2026).

Schaefer, J.T., 1990. The critical success index as an indicator of warning skill. Weather and
Forecasting 5 (4), 570–575. https://doi.org/10.1175/1520-0434(1990)005<0570:TCSIAA>2.0.CO;2

Sermet, Y., Demir, I., 2018. An intelligent system on knowledge generation and communication about
flooding. Environmental Modelling & Software 108, 51–60.
https://doi.org/10.1016/j.envsoft.2018.06.003

STAC Contributors, 2021. SpatioTemporal Asset Catalog specification, version 1.0.0.
https://github.com/radiantearth/stac-spec/releases/tag/v1.0.0

Stephens, E., Schumann, G., Bates, P., 2014. Problems with binary pattern measures for flood model
evaluation. Hydrological Processes 28 (18), 4928–4937. https://doi.org/10.1002/hyp.9979

Teng, J., Jakeman, A.J., Vaze, J., Croke, B.F.W., Dutta, D., Kim, S., 2017. Flood inundation
modelling: a review of methods, recent advances and uncertainty analysis. Environmental Modelling &
Software 90, 201–216. https://doi.org/10.1016/j.envsoft.2017.01.006

Wagner, W., Bauer-Marschallinger, B., Roth, F., Raiger-Stachl, T., Reimer, C., McCormick, N.,
Matgen, P., Chini, M., Li, Y., Martinis, S., Wieland, M., Kraft, F., Festa, D., Hassaan, M., Tupas,
M.E., Zhao, J., Seewald, M., Riffler, M., Molini, L., Kidd, R., Briese, C., Salamon, P., 2026. The
fully-automatic Sentinel-1 Global Flood Monitoring service: scientific challenges and future
directions. Remote Sensing of Environment 333, 115108. https://doi.org/10.1016/j.rse.2025.115108

Wing, O.E.J., Bates, P.D., Quinn, N.D., Savage, J.T.S., Uhe, P.F., Cooper, A., Collings, T.P.,
Addor, N., Lord, N.S., Hatchard, S., Hoch, J.M., Bates, J., Probyn, I., Himsworth, S., Rodríguez
González, J., Brine, M.P., Wilkinson, H., Sampson, C.C., Smith, A.M., Neal, J.C., Haigh, I.D., 2024.
A 30 m global flood inundation model for any climate scenario. Water Resources Research 60 (8),
e2023WR036460. https://doi.org/10.1029/2023WR036460

Zarr Developers, 2023. Zarr core specification, version 3.
https://zarr-specs.readthedocs.io/en/latest/v3/core/index.html

Zheng, X., Maidment, D.R., Tarboton, D.G., Liu, Y.Y., Passalacqua, P., 2018. GeoFlood: large-scale
flood inundation mapping based on high-resolution terrain analysis. Water Resources Research 54
(12). https://doi.org/10.1029/2018WR023457

Zheng, X., Tarboton, D.G., Maidment, D.R., Liu, Y.Y., Passalacqua, P., 2018. River channel geometry
and rating curve estimation using Height above the Nearest Drainage. Journal of the American Water
Resources Association 54 (4), 785–806. https://doi.org/10.1111/1752-1688.12661

---

# Verification notes (not part of the manuscript)

Each citation was checked for metadata (Crossref, OpenAlex, publisher page) and for the specific
claim it carries (abstract or full text). Corrections against the previous draft:

- Devi et al. is 2026 (EMS 196, issue year), not 2025. "FIMbench" appears only in the separate
  repository github.com/sdmlua/fimbench, not in the paper; the name was dropped.
- Bates and De Roo (2000) introduced a fit measure (intersection over union of inundated areas), not
  hit rate or false alarm ratio. The CSI is attributed to forecast verification (Schaefer, 1990).
- Krajewski et al. (2017): the abstract states forecasts every 15 min for over 1,000 communities.
  "Over two thousand locations" could not be confirmed and was removed.
- Satellite latency now cites Wagner et al. (2026): "GFM typically delivers flood maps within five
  hours of image acquisition."
- Abernathey et al. (2021) supports HTTP object storage, chunking, Zarr, and COG; it does not mention
  STAC, which now cites the specification. Stern et al. (2022) was dropped (no claim needed it).
- HydroLang author list corrected (Molkenthin is third author). "Used independently or chained" is in
  the GitHub README, not the paper; the text cites the paper's "high-cohesion low-coupling modules".
- HydroLang Markup Language: the published abstract says "basic programming skills", not "without
  coding".
- Ewing et al. is 2024, J. Hydroinform. 26(2), 494-502 (was 2023).
- Gichamo et al. DOI corrected to 10.1016/j.envsoft.2020.104623.
- Maidment (2017) abstract does not mention HAND; HAND at CONUS scale now cites Liu et al. (2018).
- Bates et al. (2021): "1 arc-second" and "multiple return periods" are not in the abstract; removed.

Unresolved:

1. Section 5.1/5.2 numbers (benchmark changes CSI by more than 50 %, alignment by less than 0.001,
   scored cell count changes by more than 10x). These come from the author's draft and were not
   traced to a results file in this pass.
2. HydroLang, HLML, and HydroCompute are described as defining no FIM product kinds and no
   extent-agreement metrics. The abstracts are consistent with this; the full texts were not read.
3. Cohen et al. (2025): full text not readable (403/429). Claims are limited to the abstract.
4. Zheng, Maidment, et al. (2018) GeoFlood: page range not returned by Crossref or OpenAlex.
5. Wagner et al.: ScienceDirect gives 2026, OpenAlex gives 2025 for RSE vol. 333.
6. FIMApp reference: status (published, in review, or preprint) needed.
7. Section 3 says raster overlays draw on Google Maps only; Section 4 DONE says both providers
   implement the raster-image methods and measured raster rendering on both. Contribution 1 and
   Section 2.4 follow Section 4 and name only depth and velocity as Google-only.
