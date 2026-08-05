[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/sciwrid](../README.md) / registerSciwridFormats

# Function: registerSciwridFormats()

> **registerSciwridFormats**(`formats?`): `void`

Defined in: [io/sciwrid.js:201](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/io/sciwrid.js#L201)

Register the SciWrid-backed decoders. Idempotent; call once at boot before forcing any Dataset of
these formats. `parseSciwrid()` calls it for you, so an app that always goes through the parser
never needs this — it exists for rehydrating a stored Dataset (`Dataset.fromRecord`), which skips
the parser entirely.

## Parameters

### formats?

`string`[] = `SCIWRID_FORMATS`

## Returns

`void`
