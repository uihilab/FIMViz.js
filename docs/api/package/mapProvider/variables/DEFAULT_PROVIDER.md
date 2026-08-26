[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / DEFAULT\_PROVIDER

# Variable: DEFAULT\_PROVIDER

> `const` **DEFAULT\_PROVIDER**: `string` = `"leaflet"`

Defined in: [package/mapProvider.js:96](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L96)

The provider a detached layer resolves against, meaning one built without a mounted app and so
with no `config.provider` to read: a unit test's stub, or a Layer constructed directly. Not a
config default, since `mount()` requires an explicit `provider` and throws `config-invalid`
without one, so a real mounted map never uses this. It is leaflet because leaflet needs no key.
