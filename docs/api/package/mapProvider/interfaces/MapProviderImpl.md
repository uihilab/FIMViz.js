[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / MapProviderImpl

# Interface: MapProviderImpl

Defined in: [package/mapProvider.js:49](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L49)

## Properties

### acceptsCRS?

> `optional` **acceptsCRS?**: (`crs`) => `boolean`

Defined in: [package/mapProvider.js:51](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L51)

can this provider render content in `crs`?
  Asked by `Layer`'s render precondition before drawing. Omitted = permissive (accepts anything).

#### Parameters

##### crs

`string`

#### Returns

`boolean`

***

### addRasterImage

> **addRasterImage**: (`map`, `dataUrl`, `bounds`, `opts?`) => `any`

Defined in: [package/mapProvider.js:67](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L67)

position a pre-rendered image (data URL or any image URL) over `bounds`; returns an opaque
  raster-image handle. Non-interactive (`clickable:false`) by default so map events pass through to
  the engine's own hit-testing; pass `{ interactive: true }` to opt this overlay into direct SDK
  interaction.

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

Defined in: [package/mapProvider.js:55](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L55)

render a GeoJSON FeatureCollection/Feature onto `map`; returns an opaque vector handle.

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

Defined in: [package/mapProvider.js:64](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L64)

restack overlays to match
  `handles`, ordered bottom → top, and RETURN the handles: a provider may have replaced some (the
  Google raster path recreates them), so callers must adopt the returned array.

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

Defined in: [package/mapProvider.js:53](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L53)

build the map in `el`; returns the provider's native map object (exposed as `fim.map`).

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

Defined in: [package/mapProvider.js:58](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L58)

fit the map's viewport to `bounds`.

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

Defined in: [package/mapProvider.js:81](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L81)

subscribe to a normalized map event; returns an unsubscribe function. `hover` maps to the
  provider's mousemove equivalent.

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

Defined in: [package/mapProvider.js:79](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L79)

subscribe to mouse-move on the map, normalized to `{lat, lng}`; returns an unsubscribe function.

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

Defined in: [package/mapProvider.js:72](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L72)

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

Defined in: [package/mapProvider.js:57](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L57)

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

Defined in: [package/mapProvider.js:50](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L50)

does `create()` need `options.apiKey`? (google: true, leaflet: false)

***

### setRasterImageOpacity

> **setRasterImageOpacity**: (`handle`, `opacity`) => `void`

Defined in: [package/mapProvider.js:73](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L73)

change a raster-image handle's opacity (0..1).

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

Defined in: [package/mapProvider.js:75](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L75)

swap a raster-image handle's image (e.g. a palette repaint). The caller MUST use the RETURNED
  handle going forward — some providers (google) cannot swap the image in place and recreate the
  overlay instead.

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

### whenIdle?

> `optional` **whenIdle?**: (`map`, `opts?`) => `Promise`\<`void`\>

Defined in: [package/mapProvider.js:60](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L60)

resolve once the
  camera has settled. Safe to await unconditionally: it resolves on a timeout when the map is
  already still, so it can never hang. Anything that reads the projection right after a `fitBounds`
  must await this first — a click resolved mid-animation lands at the wrong coordinates.

#### Parameters

##### map

`any`

##### opts?

###### timeout?

`number`

#### Returns

`Promise`\<`void`\>
