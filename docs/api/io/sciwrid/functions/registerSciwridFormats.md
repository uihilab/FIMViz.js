[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/sciwrid](../README.md) / registerSciwridFormats

# Function: registerSciwridFormats()

> **registerSciwridFormats**(`formats?`): `void`

Defined in: [io/sciwrid.js:398](https://github.com/uihilab/FIMViz.js/blob/fa826b69548017771e1f4e174a9441d835478f4f/src/io/sciwrid.js#L398)

Register the SciWrid-backed decoders. Idempotent; call once at boot before forcing any Dataset of
these formats. `parseSciwrid()` calls it for you, so an app that always goes through the parser
never needs this — it exists for rehydrating a stored Dataset (`Dataset.fromRecord`), which skips
the parser entirely.

## Parameters

### formats?

`string`[] = `SCIWRID_FORMATS`

## Returns

`void`
