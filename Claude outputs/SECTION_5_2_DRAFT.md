# 5.2 Daily weather on the Feather River basin, replayed warmer

*Repository mapping: this section is `case-studies/case_study8.html` and
`case-studies/build_case_study8_data.mjs`. It replaces the Amite/NWM study (`case_study7.html`) as §5.2.
Records: `results.csv`, `metrics.csv`, and `performance.csv` from the run of 2026-09-16.*

Temporal sources enter the engine through the same `addDataset` call as a single image, and the time
axis is then selected, combined, and animated in the browser with no server-side subsetting service.
The January and February 2017 storms that filled Lake Oroville, and preceded the spillway emergency at
Oroville Dam, are the case. This study asks how much of that precipitation fell over the Feather River
basin as rain, and how much of the snow would have fallen as rain 1 to 5 °C warmer.

The California Department of Water Resources (DWR) gridded weather generator supplies daily
precipitation (`pr`, millimeters) and daily minimum and maximum temperature (`tmin`, `tmax`, °C) on a
1/16° statewide grid, as one NetCDF4 file per climate scenario (ProductA_100yr, about 1.02 GB each).
Six were used: scenario 1, the unperturbed detrended history, and scenarios 11 through 15, at 1 to 5 °C
of warming with a mean precipitation change of 0 % and a quantile change of 7 %.
`build_case_study8_data.mjs` cropped each file to the basin above USGS gage 11407000 (Feather River at
Oroville, from the USGS Network Linked Data Index), over 1 January to 28 February 2017, writing a
59 × 24 × 31 CF NetCDF4 file of 523 kB with no fill values.

Each scenario file was read once per variable through `addDataset(file, { variable })`, which returns a
Dataset whose axis holds the 59 CF time coordinates. A day's precipitation counts as rain in a cell when
the mean of `tmin` and `tmax` there exceeds a threshold, 0 °C by default: `reclassify` on the mean
temperature yields an open mask, a `min` combine against it keeps the rain, `difference` gives the snow,
and a `sum` combine over the 59 days totals the window. The `units` attribute on `pr` reads millimeters,
so each step is a daily depth and the totals are depths. Basin figures are `mask(basinRing)` followed by
`Stats.raster` over the 270 cells the basin polygon covers, so they are means rather than volumes.

Warming moves the phase of the 2017 window almost completely (Table 5.2). Rain is 82.1 % of baseline
basin precipitation and 99.0 % at 5 °C, and basin snow falls from 194.9 mm to 12.0 mm, by 43.6 % at the
first degree and 93.8 % across the column. Basin precipitation also rises 11.6 %, from 1,090.6 mm to
1,217.3 mm, because scenarios 11 through 15 raise the quantile term by 7 % while holding the mean change
at 0 %. The snow response is therefore joint, and this column gives no temperature elasticity.

| scenario | ΔT (°C) | Δ quantile (%) | pr (mm) | rain (mm) | snow (mm) | rain share (%) | snow vs baseline (%) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 0 | 1090.6 | 895.7 | 194.9 | 82.1 | — |
| 11 | +1 | 7 | 1114.9 | 1005.0 | 109.9 | 90.1 | −43.6 |
| 12 | +2 | 7 | 1139.8 | 1076.6 | 63.2 | 94.5 | −67.6 |
| 13 | +3 | 7 | 1165.2 | 1127.4 | 37.8 | 96.8 | −80.6 |
| 14 | +4 | 7 | 1191.0 | 1169.0 | 22.1 | 98.1 | −88.7 |
| 15 | +5 | 7 | 1217.3 | 1205.3 | 12.0 | 99.0 | −93.8 |

The DWR files index days with a `date` dimension of integer day numbers carrying no CF `units`
attribute, and the NetCDF4 materializer selects a step only through a CF time coordinate, so
`parseSciwrid` refused the series until the builder wrote a `time` coordinate in days since 2015-01-01.
An unmodified DWR file meets the same refusal.

The phase rule applies one daily threshold per 1/16° cell, so it models neither the change of phase
within a day nor the elevation range inside a cell. An hourly or hypsometric rule would move the snow
totals, and this study does not bound by how much.

---

## Figures

| File | Serves | Claim it settles |
| --- | --- | --- |
| `fig-5-2a-daily.svg` | §5.2 | One `select` on the CF time axis renders a day; the axis animates client-side |
| `fig-5-2b-snow.svg` | §5.2 | The same op chain, evaluated per scenario, changes only the source file |
| `table-5-2-scenarios.md` | §5.2 | Basin rain and snow totals against scenario temperature |

## Cost records — belong in §4, not in the §5.2 body

Read from `performance.csv` and `metrics.csv` (Chrome 153, Windows 10, warm cache, one repetition).

| Stage | Value | Note |
| --- | --- | --- |
| `t_fetch`, 523 kB NetCDF4 | 3.1–6.7 ms | localhost, warm; six files |
| `t_total`, first parse | 191.6 ms | `pr` of scenario 1; decoder initialization, since the eighteen files match in shape and within 1 % in bytes |
| `t_total`, parses 2–18 | 3.0–11.4 ms | same shape, same size |
| Per-scenario parse, 3 variables | 10.3–25.6 ms after the first; 205 ms for scenario 1 | `metrics.csv` `parse_ms` |
| `t_op`, decode 177 day-slices | 643.1–752.4 ms (median 716 ms) | 3.6–4.3 ms per 24 × 31 slice |
| `t_op`, `select` one day of `pr` | 0.2 ms | held node, memoized grid |
| `t_op`, `combine` daily mean | 0.9 ms | |
| `t_paint`, one day | 2.2 ms and 7.6 ms | temperature and precipitation Layers |
| `t_op`, partition + basin means, 59 days | 14.6–20.7 ms in five scenarios; 50.6 ms in scenario 13 | the outlier is unexplained |
| `t_paint`, 59-day snow total | 39.1 ms and 50.0 ms | baseline and scenario 15 |

These rows give §4.2 its NetCDF4 ingest entry and §4.5 a temporal-op rate. The 50.6 ms partition is the
one measurement out of family and is reported rather than dropped.

## DONE

- O1 resolved: §5.2's forcing source is the DWR gridded weather generator (NetCDF4), replacing the
  CHIRPS/NWM/NLDAS-2 ambiguity in the outline and `CASE_STUDY_PROTOCOL.md` §2.
- C9 partly addressed: §5.2 maps to `case_study8.html`. The §5.1, §5.3, and §5.4 mappings still need the
  README table.
- The accumulation-units question the guideline raises for §5.2 is settled by the file itself: `pr`
  carries a `units` attribute of millimeters, so the window sum is a depth and no rate-to-depth
  conversion applies.

## OPEN

1. Zarr (C8). CS7 carried the only Zarr evidence in the manuscript. With CS8 replacing it, does Zarr
   stay in §4.2's format list and §6's limitations, or leave the claimed format set? §4.2 and §6 must
   agree either way.
2. Repetitions. The recorded run has `REPS = 1` and `CACHE_STATE = "warm"`, against §4.1's five
   repetitions and a separate cold pass. The scenario totals in Table 5.2 are deterministic and do not
   change with repetition; the cost records above do. Rerun for the cost rows, or scope §4.1's rule so
   the §5.2 timings are stated as single-run.
3. Provenance. `case-studies/data/README.txt` carries neither the DWR dataset, the six file ids, nor the
   access date, and the DWR license term is recorded nowhere in the repository. §4.1 requires all of
   them per dataset.
