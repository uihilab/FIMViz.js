[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/sciwrid](../README.md) / registerSciwridFormats

# Function: registerSciwridFormats()

> **registerSciwridFormats**(`formats?`): `void`

Defined in: [io/sciwrid.js:425](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/io/sciwrid.js#L425)

Register the SciWrid-backed decoders. Idempotent; call once at boot before forcing any Dataset of
these formats. `parseSciwrid()` calls it for you, so an app that always goes through the parser
never needs this — it exists for rehydrating a stored Dataset (`Dataset.fromRecord`), which skips
the parser entirely.

## Parameters

### formats?

`string`[] = `SCIWRID_FORMATS`

## Returns

`void`
