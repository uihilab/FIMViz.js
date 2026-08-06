[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / LeafletCreateOptions

# Interface: LeafletCreateOptions

Defined in: [package/mapProvider.js:415](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/mapProvider.js#L415)

## Properties

### center?

> `optional` **center?**: `object`

Defined in: [package/mapProvider.js:416](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/mapProvider.js#L416)

initial map center; defaults to the continental US.

#### lat

> **lat**: `number`

#### lng

> **lng**: `number`

***

### mapOptions?

> `optional` **mapOptions?**: `any`

Defined in: [package/mapProvider.js:421](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/mapProvider.js#L421)

raw Leaflet `L.Map` options, passed straight to `L.map(el, mapOptions)`.

***

### tileOptions?

> `optional` **tileOptions?**: `any`

Defined in: [package/mapProvider.js:420](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/mapProvider.js#L420)

options passed to `L.tileLayer` (e.g. `attribution`).

***

### tileUrl?

> `optional` **tileUrl?**: `string`

Defined in: [package/mapProvider.js:418](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/mapProvider.js#L418)

basemap tile URL template; pass `null` to opt out of the default
  OpenStreetMap tile layer (e.g. to add your own via `L.tileLayer`).

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: [package/mapProvider.js:417](https://github.com/uihilab/FIMViz.js/blob/39cf3cbcc95a54d593615b2073cde0e6bbbdb15a/src/package/mapProvider.js#L417)

initial zoom level; defaults to `5`.
