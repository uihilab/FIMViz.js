[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / LeafletCreateOptions

# Interface: LeafletCreateOptions

Defined in: [package/mapProvider.js:459](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L459)

## Properties

### center?

> `optional` **center?**: `object`

Defined in: [package/mapProvider.js:460](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L460)

initial map center; defaults to the continental US.

#### lat

> **lat**: `number`

#### lng

> **lng**: `number`

***

### mapOptions?

> `optional` **mapOptions?**: `any`

Defined in: [package/mapProvider.js:465](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L465)

raw Leaflet `L.Map` options, passed straight to `L.map(el, mapOptions)`.

***

### tileOptions?

> `optional` **tileOptions?**: `any`

Defined in: [package/mapProvider.js:464](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L464)

options passed to `L.tileLayer` (e.g. `attribution`).

***

### tileUrl?

> `optional` **tileUrl?**: `string`

Defined in: [package/mapProvider.js:462](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L462)

basemap tile URL template; pass `null` to opt out of the default
  OpenStreetMap tile layer (e.g. to add your own via `L.tileLayer`).

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: [package/mapProvider.js:461](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L461)

initial zoom level; defaults to `5`.
