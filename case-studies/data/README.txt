Mirrored source data for Study 5.3 (CASE_STUDY_PROTOCOL.md §0.4).
The files themselves are gitignored; this file is the provenance record.

Copernicus_DSM_COG_10_N35_00_W083_00_DEM.tif
  URL       https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N35_00_W083_00_DEM/
            Copernicus_DSM_COG_10_N35_00_W083_00_DEM.tif
  Accessed  2026-08-13
  Bytes     44,224,717 (matches upstream Content-Length)
  Product   Copernicus DEM GLO-30, AWS Open Data
  Licence   Free use with attribution: ESA / (c) DLR e.V. 2010-2014 and (c) Airbus DS 2014-2018
  CRS       EPSG:4326 (GeographicTypeGeoKey 4326, "WGS 84")
  Grid      3600 x 3600, 1 band, 2.778e-4 deg/px (~30 m)
  Bounds    W -83.0  S 35.0  E -82.0  N 36.0   (contains Asheville, 35.59 N 82.55 W)
  Overviews 4 levels - a real COG, though the engine has no range reads to exploit them
  NoData    none declared (GDAL_NODATA absent)

  Why mirrored: the bucket serves no Access-Control-Allow-Origin header, so a browser cannot
  fetch it directly. Verified 2026-08-13 with an Origin-bearing request: HTTP 200, no ACAO.
  The 90 m bucket (copernicus-dem-90m) behaves the same way.

jrc_RP100_ermidas_3035.tif
  URL       https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/FLOODS/EuropeanMaps/floodMap_RP100.zip
  Accessed  2026-08-13
  Product   JRC/EFAS river flood hazard map, Europe, 100-year return period, 100 m
  Licence   CC BY 4.0, (c) European Union 1995-2026
  CRS       EPSG:3035 (ETRS89-extended / LAEA Europe) -- NOT reprojected here
  Source    floodmap_EFAS_RP100_C.tif, 63976 x 45242 Float32 (~11.6 GB uncompressed)
  Clip      323 x 395, 11.6 kB, depths 0.1-17.888 m, nodata -3.402823e+38
            projwin 2688400 1863100 2720734 1823487 (EPSG:3035), covering EMSR864 AOI01 + 0.02 deg pad
  Note      Clipped with gdal_translate -projwin in the NATIVE projection: a window read, no
            resampling and no reprojection. The 3035 -> 4326 warp is left to the engine, because
            warp cost is what Case Study 1 measures.
