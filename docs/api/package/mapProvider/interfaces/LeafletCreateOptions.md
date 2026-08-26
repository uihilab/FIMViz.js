[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / LeafletCreateOptions

# Interface: LeafletCreateOptions

Defined in: [package/mapProvider.js:555](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L555)

## Properties

### center?

> `optional` **center?**: `object`

Defined in: [package/mapProvider.js:556](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L556)

initial map center; defaults to the continental US.

#### lat

> **lat**: `number`

#### lng

> **lng**: `number`

***

### mapOptions?

> `optional` **mapOptions?**: `any`

Defined in: [package/mapProvider.js:561](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L561)

raw Leaflet `L.Map` options, passed straight to `L.map(el, mapOptions)`.

***

### tileOptions?

> `optional` **tileOptions?**: `any`

Defined in: [package/mapProvider.js:560](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L560)

options passed to `L.tileLayer` (e.g. `attribution`).

***

### tileUrl?

> `optional` **tileUrl?**: `string`

Defined in: [package/mapProvider.js:558](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L558)

basemap tile URL template; pass `null` to opt out of the default
  OpenStreetMap tile layer, i.e. to add your own with `L.tileLayer`.

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: [package/mapProvider.js:557](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L557)

initial zoom level; defaults to `5`.
