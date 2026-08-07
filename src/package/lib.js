// Library entry point (ESM build → dist/fimviz.js).
//
// Exposes the public package API without booting. A consumer does:
//   import { FimViz } from 'fimviz';
//   const widget = await FimViz.mount('#container', { apiKey, dataSource });
//
// See docs/usage/USAGE.md for the full contract, container/sizing requirements, and the
// COOP/COEP hosting constraint required by GDAL WASM.
//
// FimViz is the headless engine: it ships no UI, no widget markup, and no drag-drop wiring. A host
// composes a full widget by importing the runtime it wants and calling registerRuntime() before
// mount(); `registerRuntime` is re-exported here so it is part of the public engine surface. Absent
// a runtime, mount() still boots a bare working map via the map-provider seam (see mount.js).
// `registerRuntime`, `registerMapProvider`, `mapProviders()` and `providerAcceptsCRS()` are STATICS
// on FimViz — it is what boots a map, so it owns both the backend registry and the runtime seam.
export { mount, FimViz } from "./mount.js";

// The low-level map constructor `mount()` calls. Rarely needed directly; it is the one map-provider
// verb that isn't a registry operation, so it stays a plain function.
export { createMap } from "./mapProvider.js";

// Composable-core primitives. FimViz.parseFile / fim.addDataset produce Datasets from
// files; parsing never reprojects — a Dataset comes back in its native `crs` and the caller warps
// deliberately via reproject() (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
export { Dataset } from "./dataset.js";
export { warp } from "../geo/warp.js";
export { Storage } from "../io/storage.js";
// csvHeaders lets a host read a CSV's column names BEFORE calling parseFile, to build a picker for
// { latField, lngField } / { geometryField } — the "let the user map columns" seam for csv/xyz.
// wktToGeometry is the WKT decoder parseFile's csv geometryField path uses, surfaced standalone.
export { csvHeaders, wktToGeometry } from "../io/parse.js";

// The lazy-Dataset materialize seam (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1): the two decoded value types a forced
// Dataset produces, plus the registries a host uses to supply decoders/warp. The engine ships no heavy
// decoder on the barrel — import "fimviz/src/io/materializers.js" for the built-in geotiff/vector ones,
// or register your own. reproject as a lazy op (ds.reproject) forces through the registered reprojector.
// The two decoded VALUE TYPES a materializer returns (and `Dataset.fromGrid` accepts). The seams
// themselves — registerMaterializer / formats() / registerReprojector /
// registerDefaultReprojectorLoader — are STATICS ON `Dataset`, the type they serve. The registries'
// other readers (getMaterializer/getReprojector/resolveReprojector) stay internal: they hand back
// the implementation, which a caller has no use for once the seam dispatches on its own.
import { RasterGrid, VectorFeatures, registerDefaultReprojectorLoader } from "./materialize.js";
export { RasterGrid, VectorFeatures };
// The built-in decoders (geotiff + vector) register on import of this barrel; the function is exposed
// so a raw-browser page can re-run it explicitly.
export { registerBuiltinMaterializers } from "../io/materializers.js";

// The GDAL raster reprojector is browser-only and heavy (gdal3.js), so it must not load just because
// a consumer imported "fimviz" — plenty never touch a raster. Wiring it as the reproject seam's
// DEFAULT LOADER means the closure below (cheap — no import yet) is all that's registered here;
// materialize.js's resolveReprojector() only calls it — which is what actually pulls in io/
// reprojector.js/geo/gdal.js/gdal3.js — the first time a reproject is forced with nothing registered.
// So `ds.reproject(crs).grid()` just works with no setup call, and a consumer who never reprojects
// never pays for GDAL at all.
registerDefaultReprojectorLoader(() => import("../io/reprojector.js").then((m) => m.registerGdalReprojector()));

/**
 * Explicitly (eagerly) wire the built-in GDAL warp, pre-empting the lazy default above. Not required
 * for `ds.reproject(crs).grid()` to work — only useful to pre-warm GDAL ahead of the first real
 * reproject (e.g. to avoid a first-use delay). Dynamically imports io/reprojector.js, so calling this
 * is what actually pulls GDAL in — importing this barrel alone never does.
 * @returns {Promise<void>}
 */
export async function registerGdalReprojector() {
  const { registerGdalReprojector: register } = await import("../io/reprojector.js");
  register();
}

/**
 * Generalized escape hatch to gdal3.js: call ANY of its methods by name with whatever raw
 * parameters that method's own signature requires (a `Dataset` from a prior `callGdal('open', ...)`
 * for the dataset-based utilities, coordinate arrays for `gdaltransform`, nothing extra for
 * `getOutputFiles`, ...) — see `geo/gdal.js`'s `callGdal` for the full shape catalogue and an
 * example. `Dataset.reproject`/`Dataset.resampleTo` already cover `gdalwarp` for the common
 * reproject/resample paths; reach for this for a gdal3.js utility (`gdal_translate`,
 * `gdal_rasterize`, `ogr2ogr`, `gdalinfo`, `ogrinfo`, `gdaltransform`, ...) neither of those covers.
 *
 * Dynamically imports `geo/gdal.js` (→ gdal3.js, ~38 MB wasm) on first call — never just from
 * importing this barrel, so a consumer who never calls this pays nothing for GDAL, same as the
 * reproject seam above.
 * @param {string} method
 * @param {...*} params
 * @returns {Promise<*>}
 */
export async function callGdal(method, ...params) {
  const { callGdal: call } = await import("../geo/gdal.js");
  return call(method, ...params);
}

// NOTE: nothing app-specific is exported here. The library ships MECHANISMS — `Storage`,
// `parseSource` — and names no database, table, or one-deployment format; the host owns the schema
// (io/storage.js). A host's own IndexedDB names and format adapters belong in the host.

// Read-models (pure, headless): the value→color engine, its derived legend, computed statistics,
// and the spatial/predicate filters that scope them.
// Palettes are ColorScale's registry: ColorScale.registerPalette(name, colors) / ColorScale.palettes().
export { ColorScale } from "./colorScale.js";
export { Legend } from "./legend.js";
export { Stats } from "./stats.js";
export { Filter, SpatialFilter, PredicateFilter } from "./filter.js";

// The Layer object model: the base + the type registry. Each subsystem (velocity, ensemble, depth,
// comparison, …) registers its own factory on import, so this barrel names none of them.
// The type registry is Layer's: Layer.registerType(type, factory) / Layer.types().
export { Layer, RasterLayer, VectorLayer } from "./layer.js";
// The provider-neutral raster colorize pipeline RasterLayer._draw uses — surfaced so the app can
// reuse it (retiring its ~6 hand-rolled copies) and a consumer can colorize a grid independently.
export { colorizeGrid, gridToDataURL } from "./rasterImage.js";
// The pure raster-grid transforms behind the lazy Dataset ops (ds.clip/mask/reclassify) — surfaced so
// a consumer can transform a decoded grid directly. See docs/PACKAGE_ROADMAP.md §2.
export {
  maskGrid, clipGrid, reclassifyGrid, combineGrids, zonalStats, groupByGrid,
  slopeGrid, aspectGrid, hillshadeGrid, rasterizeFeatures,
} from "./rasterOps.js";
// Grid alignment behind ComparisonLayer/EnsembleAggregationLayer (and any N-raster comparison a host
// builds directly): resample onto a common grid (GRID_POLICY/resolveTargetGrid/resampleGrid/
// alignRasters), plus registerResampler — the escape hatch for resample METHODS beyond the three
// pure-JS ones (nearest/bilinear/average). Note this is a
// SYNCHRONOUS, pixel-level hook for a host with its own already-initialized kernel — GDAL's own richer
// methods (cubic/lanczos/...) go through geo/gdal.js's async, buffer-level warpToGrid instead, not this
// (see geo/resample.js's header for why the two don't unify).
// registerResampler moved to `Dataset.registerResampler` with the other seams it sits beside.
export { GRID_POLICY, RESAMPLE_METHODS, resolveTargetGrid, resampleGrid, alignRasters } from "../geo/resample.js";
// ComparisonLayer both exports the class and (on import) registers the "comparison" layer type.
export { ComparisonLayer } from "./comparisonLayer.js";
// EnsembleAggregationLayer likewise registers the "ensembleAgreement" type on import.
export { EnsembleAggregationLayer } from "./ensembleAggregationLayer.js";

// The headless UI module (docs/PACKAGE_ROADMAP.md §5) is NOT re-exported here. It has exactly one
// home — the `fimviz/ui` subpath (dist/ui.js) — for two reasons. Payload: that entry pulls only the
// small pure deps it names, so a consumer who wants a toast or a tools panel downloads ~51 KB
// instead of the engine. Identity: re-exporting the same modules from both entries meant an app
// importing from both shipped TWO copies, with two separate registries and two sets of DOM nodes
// that each believed they were the only one. One import path, one instance:
//     import { createToast, createToolsPanel } from "fimviz/ui";

// Vendored runtime primitives. Surfaced here so any consumer imports them from the engine — never
// by naming the third-party package directly — making the engine the single owner of these
// dependencies (they are declared only in this package's package.json). These are the raw
// parse/boot primitives a host may need beyond parseFile: geotiff pixel access for the
// comparison/extent overlays, XML→GeoJSON, shapefile→GeoJSON, and the Google Maps script loader.
export { fromArrayBuffer } from "geotiff";
export { kml } from "@tmcw/togeojson";
export { Loader } from "@googlemaps/js-api-loader";

/**
 * shpjs: a zipped shapefile (.shp/.dbf/.shx) → GeoJSON. Same call shape as shpjs's own default
 * export (it is async there too), but the module is loaded ON FIRST CALL rather than re-exported
 * statically. shpjs depends on proj4 (+ wkt-parser, mgrs) to honour a .prj, so a static re-export
 * put ~300 KB into every consumer's initial bundle to serve the one format that needs it. The
 * `shp` branch of `parseFile` defers it the same way.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<Object|Object[]>} a GeoJSON FeatureCollection (or one per layer)
 */
export async function shp(buffer) {
  const mod = await import("shpjs");
  return (mod.default ?? mod)(buffer);
}
