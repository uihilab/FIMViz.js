[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mount](../README.md) / create

# Function: create()

> **create**(`target`, `options?`): `Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

Defined in: [package/mount.js:83](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/mount.js#L83)

Boots a FimMap on the default app.

Applies the host config once, validates it, injects the widget markup unless the page already
has it, boots the map, then resolves to the FimMap. A mount failure releases the map so the
single-instance guard does not stay stuck.

## Parameters

### target

`string` \| `Element`

a container element, its id, or a CSS selector

### options?

`any` = `{}`

see docs/usage/USAGE.md "Configuration"

## Returns

`Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`
