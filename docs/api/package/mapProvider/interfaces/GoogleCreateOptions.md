[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / GoogleCreateOptions

# Interface: GoogleCreateOptions

Defined in: [package/mapProvider.js:277](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L277)

## Properties

### apiKey

> **apiKey**: `string`

Defined in: [package/mapProvider.js:278](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L278)

Google Maps JS API key (required — this provider's `requiresApiKey` is `true`).

***

### center?

> `optional` **center?**: `object`

Defined in: [package/mapProvider.js:281](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L281)

initial map center; defaults to the continental US.

#### lat

> **lat**: `number`

#### lng

> **lng**: `number`

***

### libraries?

> `optional` **libraries?**: `string`[]

Defined in: [package/mapProvider.js:280](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L280)

additional Maps JS API libraries to load (e.g. `['visualization']`).

***

### mapId?

> `optional` **mapId?**: `string`

Defined in: [package/mapProvider.js:283](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L283)

a Google Cloud-configured Map ID (cloud-based styling / Advanced Markers).

***

### mapOptions?

> `optional` **mapOptions?**: `any`

Defined in: [package/mapProvider.js:284](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L284)

raw `google.maps.MapOptions`, merged LAST — wins over every default/derived option above.

***

### version?

> `optional` **version?**: `string`

Defined in: [package/mapProvider.js:279](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L279)

the Maps JS API version channel.

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: [package/mapProvider.js:282](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/mapProvider.js#L282)

initial zoom level; defaults to `5`.
