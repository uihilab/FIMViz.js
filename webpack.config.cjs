/* eslint-disable no-undef */
// Library build for the `fimviz` package: ESM only (dist/fimviz.js).
//
// The package is consumed one way — `import { … } from "fimviz"` — whether that is a bundler, a
// native <script type="module">, or an import map. There is deliberately no second (UMD/global)
// build: it would mean a second output to keep in sync, and its global (`window.FimViz` holding
// the module namespace, so the namespace read as the confusing `FimViz.FimViz`) was a usability
// wart that existed only to serve script-tag consumers.
// No HTML shell, no obfuscation (consumers need debuggable code), no baked-in API key — the
// Google Maps key must be supplied by the host via mount({ apiKey }).
const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

const moduleRules = [
  {
    // url:false leaves url(...) refs untouched (fonts/images live outside the bundle).
    // Only .css is handled — the sole stylesheet in the graph is leaflet/dist/leaflet.css,
    // pulled in lazily by the Leaflet provider. There is no .scss in this package.
    test: /\.css$/,
    use: ["style-loader", { loader: "css-loader", options: { url: false } }],
  },
];

// No .env injection for the library: never ship our key. config.js reads
// process.env.GOOGLE_MAPS_API_KEY, so define it as empty for the lib bundles.
const defineEmptyKey = new webpack.DefinePlugin({
  "process.env.GOOGLE_MAPS_API_KEY": JSON.stringify(""),
});

const libEsmConfig = {
  name: "lib",
  entry: "./src/package/lib.js",
  experiments: { outputModule: true },
  output: {
    filename: "fimviz.js",
    path: path.resolve(__dirname, "dist"),
    library: { type: "module" },
    module: true,
    // 'auto' resolves async chunk URLs relative to wherever the consumer serves the bundle,
    // so the lazily-loaded chunks (GDAL glue, arcgislink) resolve without configuration.
    publicPath: "auto",
  },
  mode: "production",
  module: { rules: moduleRules },
  plugins: [defineEmptyKey],
  // minimize:true still strips whitespace/comments/dead code (worth keeping for size), but Terser's
  // default `mangle` renames every class, function, variable, and private (#foo) field to a short
  // symbol — that's what turns `Dataset { #url, #warnings, ... }` into `Di { #t, #e, ... }` in the
  // console, directly contradicting this file's own "no obfuscation (consumers need debuggable
  // code)" above. mangle:false (+ keep_classnames/keep_fnames, redundant with mangle:false but
  // explicit) is the actual switch for that — not disabling minimize altogether.
  optimization: {
    minimize: true,
    splitChunks: false,
    minimizer: [new TerserPlugin({
      terserOptions: { mangle: false, keep_classnames: true, keep_fnames: true },
    })],
  },
};

// The headless UI module as its OWN bundle (dist/ui.js), exposed via the `fimviz/ui` subpath export.
// It pulls in only the tiny pure deps it names (package/colorScale.js, package/filter.js) — never
// geotiff / the Maps loader / GDAL — so a consumer that imports `fimviz/ui` for a toast or a tools
// panel does not download the whole engine. (PACKAGE_ROADMAP.md §5 "subpath export".)
const uiEsmConfig = {
  ...libEsmConfig,
  name: "ui",
  entry: "./src/ui/index.js",
  output: { ...libEsmConfig.output, filename: "ui.js" },
};

module.exports = [libEsmConfig, uiEsmConfig];
