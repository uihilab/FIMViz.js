[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / MapProviderImpl

# Interface: MapProviderImpl

Defined in: [package/mapProvider.js:48](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L48)

## Properties

### acceptsCRS?

> `optional` **acceptsCRS?**: (`crs`) => `boolean`

Defined in: [package/mapProvider.js:50](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L50)

can this provider render content in `crs`?
  Layer's render precondition asks this before drawing. Omitting it accepts anything.

#### Parameters

##### crs

`string`

#### Returns

`boolean`

***

### addRasterImage

> **addRasterImage**: (`map`, `dataUrl`, `bounds`, `opts?`) => `any`

Defined in: [package/mapProvider.js:72](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L72)

positions a pre-rendered image, a data URL or any image URL, over `bounds` and returns an
  opaque handle. Non-interactive by default, so map events reach the engine's own hit-testing.
  Pass `{ interactive: true }` to give this overlay direct SDK interaction.

#### Parameters

##### map

`any`

##### dataUrl

`string`

##### bounds

###### east

`number`

###### north

`number`

###### south

`number`

###### west

`number`

##### opts?

###### interactive?

`boolean`

###### opacity?

`number`

#### Returns

`any`

***

### addVector

> **addVector**: (`map`, `geojson`, `opts?`) => `any`

Defined in: [package/mapProvider.js:54](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L54)

renders a GeoJSON FeatureCollection or Feature onto `map` and returns an opaque handle.

#### Parameters

##### map

`any`

##### geojson

`any`

##### opts?

###### style?

`string` \| [`NeutralStyle`](NeutralStyle.md) \| ((`ctx`) => `string` \| [`NeutralStyle`](NeutralStyle.md))

#### Returns

`any`

***

### applyLayerOrder?

> `optional` **applyLayerOrder?**: (`map`, `handles`) => `any`[]

Defined in: [package/mapProvider.js:69](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L69)

restack overlays to match
  `handles`, ordered bottom to top, and returns them. A provider may have replaced some, since
  the Google raster path recreates them, so use the returned array from then on.

#### Parameters

##### map

`any`

##### handles

`any`[]

#### Returns

`any`[]

***

### create

> **create**: (`el`, `options`) => `Promise`\<`any`\>

Defined in: [package/mapProvider.js:52](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L52)

builds the map in `el` and returns the provider's native map object, exposed as `fim.map`.

#### Parameters

##### el

`Element`

##### options

[`GoogleCreateOptions`](GoogleCreateOptions.md) \| [`LeafletCreateOptions`](LeafletCreateOptions.md)

#### Returns

`Promise`\<`any`\>

***

### fitBounds

> **fitBounds**: (`map`, `bounds`) => `void`

Defined in: [package/mapProvider.js:57](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L57)

fits the map's viewport to `bounds`.

#### Parameters

##### map

`any`

##### bounds

###### east

`number`

###### north

`number`

###### south

`number`

###### west

`number`

#### Returns

`void`

***

### onMapEvent

> **onMapEvent**: (`map`, `type`, `cb`) => () => `void`

Defined in: [package/mapProvider.js:84](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L84)

subscribes to a normalized map event and returns an unsubscribe. `hover` becomes the
  provider's own mousemove.

#### Parameters

##### map

`any`

##### type

`"click"` \| `"hover"` \| `"dblclick"` \| `"mousedown"` \| `"mouseup"` \| `"rightclick"`

##### cb

(`evt`) => `void`

#### Returns

() => `void`

***

### onMapMouseMove

> **onMapMouseMove**: (`map`, `cb`) => () => `void`

Defined in: [package/mapProvider.js:82](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L82)

subscribes to mouse-move on the map, normalized to `{lat, lng}`, and returns an unsubscribe.

#### Parameters

##### map

`any`

##### cb

(`pt`) => `void`

#### Returns

() => `void`

***

### removeRasterImage

> **removeRasterImage**: (`map`, `handle`) => `void`

Defined in: [package/mapProvider.js:76](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L76)

tear a raster-image handle down.

#### Parameters

##### map

`any`

##### handle

`any`

#### Returns

`void`

***

### removeVector

> **removeVector**: (`map`, `handle`) => `void`

Defined in: [package/mapProvider.js:56](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L56)

tear a vector handle down.

#### Parameters

##### map

`any`

##### handle

`any`

#### Returns

`void`

***

### requiresApiKey?

> `optional` **requiresApiKey?**: `boolean`

Defined in: [package/mapProvider.js:49](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L49)

does `create()` need `options.apiKey`? (google: true, leaflet: false)

***

### setDraggable?

> `optional` **setDraggable?**: (`map`, `on`) => `void`

Defined in: [package/mapProvider.js:63](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L63)

turn pan-by-drag on or off. Drag-based
  the selection tools suppress it while drawing, since tracing a stroke and panning the map are
  the same gesture.

#### Parameters

##### map

`any`

##### on

`boolean`

#### Returns

`void`

***

### setRasterImageOpacity

> **setRasterImageOpacity**: (`handle`, `opacity`) => `void`

Defined in: [package/mapProvider.js:77](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L77)

changes a raster-image handle's opacity, from 0 to 1.

#### Parameters

##### handle

`any`

##### opacity

`number`

#### Returns

`void`

***

### setRasterImageUrl

> **setRasterImageUrl**: (`map`, `handle`, `dataUrl`, `bounds`, `opts?`) => `any`

Defined in: [package/mapProvider.js:79](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L79)

swaps a raster-image handle's image, i.e. for a palette repaint. Use the returned handle from
  then on: google cannot swap the image in place and recreates the overlay instead.

#### Parameters

##### map

`any`

##### handle

`any`

##### dataUrl

`string`

##### bounds

###### east

`number`

###### north

`number`

###### south

`number`

###### west

`number`

##### opts?

###### interactive?

`boolean`

###### opacity?

`number`

#### Returns

`any`

***

### viewMetrics?

> `optional` **viewMetrics?**: (`map`) => `object`

Defined in: [package/mapProvider.js:66](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L66)

ground meters per screen pixel, with the map's pixel size. A tool sizes itself in screen units
  from these, i.e. a brush that keeps its width as the user zooms, without touching a map SDK.

#### Parameters

##### map

`any`

#### Returns

`object`

##### height

> **height**: `number`

##### metresPerPixel

> **metresPerPixel**: `number`

##### width

> **width**: `number`

***

### whenIdle?

> `optional` **whenIdle?**: (`map`, `opts?`) => `Promise`\<`void`\>

Defined in: [package/mapProvider.js:59](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L59)

resolve once the
  camera has settled. Always safe to await: it resolves on a timeout when the map is already
  still, so it cannot hang. Anything reading the projection right after a `fitBounds` must await
  it first, since a click resolved mid-animation gives the wrong coordinates.

#### Parameters

##### map

`any`

##### opts?

###### timeout?

`number`

#### Returns

`Promise`\<`void`\>
