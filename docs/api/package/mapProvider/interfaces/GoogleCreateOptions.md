[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / GoogleCreateOptions

# Interface: GoogleCreateOptions

Defined in: [package/mapProvider.js:270](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L270)

## Properties

### apiKey

> **apiKey**: `string`

Defined in: [package/mapProvider.js:271](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L271)

Google Maps JS API key (required — this provider's `requiresApiKey` is `true`).

***

### center?

> `optional` **center?**: `object`

Defined in: [package/mapProvider.js:274](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L274)

initial map center; defaults to the continental US.

#### lat

> **lat**: `number`

#### lng

> **lng**: `number`

***

### libraries?

> `optional` **libraries?**: `string`[]

Defined in: [package/mapProvider.js:273](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L273)

additional Maps JS API libraries to load (e.g. `['visualization']`).

***

### mapId?

> `optional` **mapId?**: `string`

Defined in: [package/mapProvider.js:276](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L276)

a Google Cloud-configured Map ID (cloud-based styling / Advanced Markers).

***

### mapOptions?

> `optional` **mapOptions?**: `any`

Defined in: [package/mapProvider.js:277](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L277)

raw `google.maps.MapOptions`, merged LAST — wins over every default/derived option above.

***

### version?

> `optional` **version?**: `string`

Defined in: [package/mapProvider.js:272](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L272)

the Maps JS API version channel.

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: [package/mapProvider.js:275](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/package/mapProvider.js#L275)

initial zoom level; defaults to `5`.
