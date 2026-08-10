// ui/index.js — the headless UI module barrel (docs/PACKAGE_ROADMAP.md §5).
//
// A SEPARATE module the engine core never imports. It touches the DOM only inside functions and
// never calls `window.foo()`, so it stays out of the way of the headless guard and Node import. The
// host mounts these and wires them to the engine (the engine emits; UI subscribes) — never the
// reverse. Re-exported from the package barrel (package/lib.js) for one-import ergonomics, and ALSO
// available as the `fimviz/ui` subpath (its own bundle, dist/ui.js) so a headless consumer can
// import just the UI without pulling in the engine.

export { createToast, connectToast } from "./toast.js";
export { createBusyIndicator, bindRasterMetadata, renderRasterMetadata } from "./hostBindings.js";
export { createTooltip, bindHoverValue } from "./tooltip.js";
export { createInfoWindow, propsTable, bindFeatureInfo } from "./infoWindow.js";
export { createToolsPanel, rasterControls, vectorControls } from "./toolsPanel.js";
export { renderLegend, renderStats, bindLegend, bindStats } from "./readModels.js";
export { createRegionDraw, REGION_MODES } from "./regionDraw.js";
export { createRegionOverlay, regionGeoJSON } from "./regionOverlay.js";
export { createOperationsPanel } from "./operationsPanel.js";
export { createLayerPanel, createLayerSelect, layerLabel } from "./layerPanel.js";
export { createAxisSlider, axisOf, axisEntryLabel } from "./axisSlider.js";
export { createDropzone, DROP_EXTENSIONS } from "./dropzone.js";
