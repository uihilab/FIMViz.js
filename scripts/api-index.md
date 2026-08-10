# FIMViz.js — API reference

Generated from the library's own JSDoc: every parameter, every return type, for the public surface and
for the seams a host implements. The narrative counterpart is the
[usage guides](../guides/usage.html); the runnable one is the
[examples](../examples/01-quickstart.html), and the
[home page](../index.html#api) links the classes most people arrive looking for.

## Reading the modules below

`package/*` is the engine — `dataset`, `layer`, `colorScale`, `legend`, `stats`, `filter`, `fimMap`
and the seams around them. `io/*` is parsing, decoding and storage; `geo/*` is projection and
resampling; `ui/*` is the opt-in widget module, published separately as `fimviz/ui` and never imported
by the engine.

If you are orienting yourself for the first time, four types carry most of the surface:
**`Dataset`** (a lazy, immutable node in an op chain — parsing gives you one, every operation returns
a new one, and a terminal forces it), **`Layer`** (one rendering of one or more Datasets),
**`ColorScale`** (value → colour, in three mutually exclusive modes) and **`FimMap`** (what `mount()`
resolves to). `Legend` and `Stats` are derived from the first three, never stored alongside them.

Two conventions worth knowing before you browse. **Registries are statics on the type they serve** —
`Layer.registerType`, `ColorScale.registerPalette`, `Dataset.registerMaterializer`,
`FimViz.registerMapProvider` — so there are no loose top-level `register*` functions to hunt for. And
**`@internal` members are excluded here**: if something appears in the source but not in this
reference, it is not part of the supported surface.
