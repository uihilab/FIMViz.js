[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / GoogleCreateOptions

# Interface: GoogleCreateOptions

Defined in: [package/mapProvider.js:290](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L290)

## Properties

### apiKey

> **apiKey**: `string`

Defined in: [package/mapProvider.js:291](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L291)

Google Maps JS API key (required — this provider's `requiresApiKey` is `true`).

***

### center?

> `optional` **center?**: `object`

Defined in: [package/mapProvider.js:294](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L294)

initial map center; defaults to the continental US.

#### lat

> **lat**: `number`

#### lng

> **lng**: `number`

***

### libraries?

> `optional` **libraries?**: `string`[]

Defined in: [package/mapProvider.js:293](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L293)

additional Maps JS API libraries to load (e.g. `['visualization']`).

***

### mapId?

> `optional` **mapId?**: `string`

Defined in: [package/mapProvider.js:296](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L296)

a Google Cloud-configured Map ID (cloud-based styling / Advanced Markers).

***

### mapOptions?

> `optional` **mapOptions?**: `any`

Defined in: [package/mapProvider.js:297](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L297)

raw `google.maps.MapOptions`, merged LAST — wins over every default/derived option above.

***

### version?

> `optional` **version?**: `string`

Defined in: [package/mapProvider.js:292](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L292)

the Maps JS API version channel.

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: [package/mapProvider.js:295](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mapProvider.js#L295)

initial zoom level; defaults to `5`.
