[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / LeafletCreateOptions

# Interface: LeafletCreateOptions

Defined in: package/mapProvider.js:406

## Properties

### center?

> `optional` **center?**: `object`

Defined in: package/mapProvider.js:407

initial map center; defaults to the continental US.

#### lat

> **lat**: `number`

#### lng

> **lng**: `number`

***

### mapOptions?

> `optional` **mapOptions?**: `any`

Defined in: package/mapProvider.js:412

raw Leaflet `L.Map` options, passed straight to `L.map(el, mapOptions)`.

***

### tileOptions?

> `optional` **tileOptions?**: `any`

Defined in: package/mapProvider.js:411

options passed to `L.tileLayer` (e.g. `attribution`).

***

### tileUrl?

> `optional` **tileUrl?**: `string`

Defined in: package/mapProvider.js:409

basemap tile URL template; pass `null` to opt out of the default
  OpenStreetMap tile layer (e.g. to add your own via `L.tileLayer`).

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: package/mapProvider.js:408

initial zoom level; defaults to `5`.
