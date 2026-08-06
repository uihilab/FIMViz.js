[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / GoogleCreateOptions

# Interface: GoogleCreateOptions

Defined in: [package/mapProvider.js:233](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/mapProvider.js#L233)

## Properties

### apiKey

> **apiKey**: `string`

Defined in: [package/mapProvider.js:234](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/mapProvider.js#L234)

Google Maps JS API key (required — this provider's `requiresApiKey` is `true`).

***

### center?

> `optional` **center?**: `object`

Defined in: [package/mapProvider.js:237](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/mapProvider.js#L237)

initial map center; defaults to the continental US.

#### lat

> **lat**: `number`

#### lng

> **lng**: `number`

***

### libraries?

> `optional` **libraries?**: `string`[]

Defined in: [package/mapProvider.js:236](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/mapProvider.js#L236)

additional Maps JS API libraries to load (e.g. `['visualization']`).

***

### mapId?

> `optional` **mapId?**: `string`

Defined in: [package/mapProvider.js:239](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/mapProvider.js#L239)

a Google Cloud-configured Map ID (cloud-based styling / Advanced Markers).

***

### mapOptions?

> `optional` **mapOptions?**: `any`

Defined in: [package/mapProvider.js:240](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/mapProvider.js#L240)

raw `google.maps.MapOptions`, merged LAST — wins over every default/derived option above.

***

### version?

> `optional` **version?**: `string`

Defined in: [package/mapProvider.js:235](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/mapProvider.js#L235)

the Maps JS API version channel.

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: [package/mapProvider.js:238](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/package/mapProvider.js#L238)

initial zoom level; defaults to `5`.
