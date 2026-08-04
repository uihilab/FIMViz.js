[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mapProvider](../README.md) / GoogleCreateOptions

# Interface: GoogleCreateOptions

Defined in: package/mapProvider.js:224

## Properties

### apiKey

> **apiKey**: `string`

Defined in: package/mapProvider.js:225

Google Maps JS API key (required — this provider's `requiresApiKey` is `true`).

***

### center?

> `optional` **center?**: `object`

Defined in: package/mapProvider.js:228

initial map center; defaults to the continental US.

#### lat

> **lat**: `number`

#### lng

> **lng**: `number`

***

### libraries?

> `optional` **libraries?**: `string`[]

Defined in: package/mapProvider.js:227

additional Maps JS API libraries to load (e.g. `['visualization']`).

***

### mapId?

> `optional` **mapId?**: `string`

Defined in: package/mapProvider.js:230

a Google Cloud-configured Map ID (cloud-based styling / Advanced Markers).

***

### mapOptions?

> `optional` **mapOptions?**: `any`

Defined in: package/mapProvider.js:231

raw `google.maps.MapOptions`, merged LAST — wins over every default/derived option above.

***

### version?

> `optional` **version?**: `string`

Defined in: package/mapProvider.js:226

the Maps JS API version channel.

***

### zoom?

> `optional` **zoom?**: `number`

Defined in: package/mapProvider.js:229

initial zoom level; defaults to `5`.
