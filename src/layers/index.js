// layers/index.js — the FIM overlay subsystems, as an opt-in barrel.
//
// These are deliberately NOT on the main barrel (package/lib.js). They pull in geotiff and the
// ArcGIS helper, and they render FIM-shaped data — a consumer who only wants Dataset/Storage/the
// read-models should not download any of it. Same split as ui/index.js: the core stays small and
// this is imported only by a host that wants these layers.
//
// Every accessor takes a FimMap OR a raw provider map, and there is one layer PER FimMap — see
// fimForMap() for how a provider map resolves back to the instance that owns it.

export {
  depthLayerFor, renderUserDepthLayer, removeUserDepthLayer, DepthLayer,
  parseLegendAndUnit, buildDefaultDepthLegend, buildLegendHtml, hexToRgb,
} from "./depthMap.js";

export {
  ensembleLayerFor, renderUserEnsembleLayer, removeEnsembleLayer, removeUserEnsembleLayer,
  EnsembleLayer,
} from "./ensemble.js";

export { velocityLayerFor, renderVelocityLayer, removeVelocityLayer } from "./velocity.js";

// The provider-map -> FimMap resolution these subsystems use internally; surfaced because a host
// driving them directly holds a provider map and needs the same lookup.
export { fimForMap } from "../package/fimMap.js";
