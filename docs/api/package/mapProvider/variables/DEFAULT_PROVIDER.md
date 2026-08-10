[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / DEFAULT\_PROVIDER

# Variable: DEFAULT\_PROVIDER

> `const` **DEFAULT\_PROVIDER**: `string` = `"leaflet"`

Defined in: [package/mapProvider.js:93](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L93)

The provider a DETACHED layer resolves against — one built without a mounted app, so there is no
`config.provider` to read (a unit test's stub, or a Layer constructed directly). NOT a config
default: `mount()` requires an explicit `provider` and throws `config-invalid` without one, so
this is never what a real mounted map uses. `leaflet` because it is the credential-free one.
