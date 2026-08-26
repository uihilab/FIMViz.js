// Library entry point (ESM build → dist/fimviz.js).
//
// Exposes the public package API without booting. The user does:
//   import { FimViz } from 'fimviz';
//   const widget = await FimViz.mount('#container', { apiKey, dataSource });
//
// docs/usage/USAGE.md covers the API, the container and sizing requirements, and the COOP/COEP
// hosting constraint GDAL WASM needs.
//
// FimViz is a headless engine, shipping no UI. A host
// builds a full widget by importing the runtime it wants and calling registerRuntime() before
// mount(). Without a runtime, mount() still boots a bare working map through the map provider (see
// mount.js). registerRuntime, registerMapProvider, mapProviders() and providerAcceptsCRS() are
// statics on FimViz, since booting a map is what it does, so it owns both registries.
export { mount, FimViz } from "./mount.js";

// The low-level map constructor `mount()` calls. Rarely needed directly; it is the one map-provider
// verb that isn't a registry operation, so it stays a plain function.
export { createMap } from "./mapProvider.js";

// Core primitives. FimViz.parseFile and fim.addDataset build Datasets from files. Parsing never
// reprojects: a Dataset comes back in its native `crs` and the user warps it deliberately with
// reproject() (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).
export { Dataset } from "./dataset.js";
export { warp } from "../geo/warp.js";
export { Storage } from "../io/storage.js";
// csvHeaders reads a CSV's column names before parseFile runs, so a host can build a picker for
// { latField, lngField } or { geometryField } and let the user map columns. wktToGeometry is the
// WKT decoder that parseFile's csv geometryField path uses, exposed on its own.
export { csvHeaders, wktToGeometry } from "../io/parse.js";

// The two value types a materializer returns and `Dataset.fromGrid` accepts, from the lazy-Dataset
// materialize path (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1). This barrel ships no heavy
// decoder: import "fimviz/src/io/materializers.js" for the built-in geotiff and vector ones, or add
// your own. ds.reproject forces through whatever reprojector is registered.
//
// The four registration points (registerMaterializer, formats, registerReprojector,
// registerDefaultReprojectorLoader) are statics on `Dataset`, the type they serve. Their readers
// (getMaterializer, getReprojector, resolveReprojector) stay internal, since they return an
// implementation the user has no use for once dispatch happens on its own.
import { RasterGrid, VectorFeatures, registerDefaultReprojectorLoader } from "./materialize.js";
export { RasterGrid, VectorFeatures };
// The geotiff and vector decoders register when this barrel is imported. The function is exposed so
// a raw-browser page can re-run it explicitly.
export { registerBuiltinMaterializers } from "../io/materializers.js";

// The GDAL raster reprojector is browser-only and heavy, so importing "fimviz" must not load it.
// Only the closure below is registered here, and it imports nothing yet. materialize.js's
// resolveReprojector() calls it the first time a reproject is forced with nothing registered, and
// that call is what pulls in io/reprojector.js, geo/gdal.js and gdal3.js. So
// `ds.reproject(crs).grid()` works with no setup call, and an app that never reprojects never
// loads GDAL.
registerDefaultReprojectorLoader(() => import("../io/reprojector.js").then((m) => m.registerGdalReprojector()));

/**
 * Loads the built-in GDAL warp now, ahead of the lazy default above. `ds.reproject(crs).grid()`
 * works without it; call this only to pre-warm GDAL and avoid a delay on first use. It imports
 * io/reprojector.js dynamically, so this call pulls GDAL in. Importing the barrel does not.
 * @returns {Promise<void>}
 */
export async function registerGdalReprojector() {
  const { registerGdalReprojector: register } = await import("../io/reprojector.js");
  register();
}

/**
 * Calls any gdal3.js method by name, passing whatever that method's own signature requires. Some
 * take a `Dataset` from a prior `callGdal('open', ...)`, `gdaltransform` takes coordinate arrays,
 * and `getOutputFiles` takes nothing. `callGdal` in `geo/gdal.js` catalogues them all with an
 * example.
 *
 * `Dataset.reproject` and `Dataset.resampleTo` already cover `gdalwarp`. Use this for a utility
 * neither covers, i.e. `ogr2ogr`.
 *
 * Imports `geo/gdal.js` and its ~38 MB of wasm on first call, never on import of this barrel, so a
 * app that never calls it loads no GDAL.
 * @param {string} method
 * @param {...*} params
 * @returns {Promise<*>}
 */
export async function callGdal(method, ...params) {
  const { callGdal: call } = await import("../geo/gdal.js");
  return call(method, ...params);
}

// Nothing app-specific is exported here. The library ships mechanisms such as `Storage` and
// `parseSource`, and names no database, table or single-deployment format. The host owns the schema
// (io/storage.js), along with its own IndexedDB names and format adapters.

// Pure headless read models: the value-to-color engine, its derived legend, computed statistics,
// and the filters that scope them. Palettes live on ColorScale as
// ColorScale.registerPalette(name, colors) and ColorScale.palettes().
export { ColorScale } from "./colorScale.js";
export { Legend } from "./legend.js";
export { Stats } from "./stats.js";
export { Filter, SpatialFilter, PredicateFilter } from "./filter.js";

// The Layer object model: the base class and the type registry. Each subsystem registers its own
// factory on import, so this barrel names none of them. The registry lives on Layer as
// Layer.registerType(type, factory) and Layer.types().
export { Layer, RasterLayer, VectorLayer } from "./layer.js";
// The provider-neutral colorize pipeline RasterLayer._draw uses, exposed so the app can reuse it in
// place of its hand-rolled copies and the user can colorize a grid directly.
export { colorizeGrid, gridToDataURL } from "./rasterImage.js";
// The pure grid transforms behind the lazy Dataset ops (ds.clip, ds.mask, ds.reclassify), exposed so
// the user can transform a decoded grid directly. See docs/PACKAGE_ROADMAP.md §2.
export {
  maskGrid, clipGrid, reclassifyGrid, combineGrids, zonalStats, groupByGrid,
  slopeGrid, aspectGrid, hillshadeGrid, rasterizeFeatures,
} from "./rasterOps.js";
// Grid alignment behind ComparisonLayer and EnsembleAggregationLayer, and available to any N-raster
// comparison a host builds itself: resample onto a common grid.
//
// Dataset.registerResampler adds methods beyond the three pure-JS ones, nearest, bilinear and
// average. It is a synchronous pixel-level hook for a host that already has its own kernel running.
// GDAL's richer methods such as cubic go through geo/gdal.js's async warpToGrid instead. The header
// of geo/resample.js explains why the two do not unify.
export { GRID_POLICY, RESAMPLE_METHODS, resolveTargetGrid, resampleGrid, alignRasters } from "../geo/resample.js";
// ComparisonLayer both exports the class and (on import) registers the "comparison" layer type.
export { ComparisonLayer } from "./comparisonLayer.js";
// EnsembleAggregationLayer likewise registers the "ensembleAgreement" type on import.
export { EnsembleAggregationLayer } from "./ensembleAggregationLayer.js";