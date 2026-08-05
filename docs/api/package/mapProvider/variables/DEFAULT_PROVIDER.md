[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / DEFAULT\_PROVIDER

# Variable: DEFAULT\_PROVIDER

> `const` **DEFAULT\_PROVIDER**: `string` = `"leaflet"`

Defined in: [package/mapProvider.js:86](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/mapProvider.js#L86)

The provider a DETACHED layer resolves against — one built without a mounted app, so there is no
`config.provider` to read (a unit test's stub, or a Layer constructed directly). NOT a config
default: `mount()` requires an explicit `provider` and throws `config-invalid` without one, so
this is never what a real mounted map uses. `leaflet` because it is the credential-free one.
