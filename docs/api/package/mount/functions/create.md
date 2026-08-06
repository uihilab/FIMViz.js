[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mount](../README.md) / create

# Function: create()

> **create**(`target`, `options?`): `Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

Defined in: [package/mount.js:85](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/mount.js#L85)

create(target, options) — boot a FimMap on the ambient default app.

Applies host config (set-once), validates it, injects the widget markup unless the page
already provides it, boots the map, and resolves to the FimMap once it is ready. On mount
failure the map is released so the single-instance guard does not stay stuck.

## Parameters

### target

`string` \| `Element`

a container element, its id, or a CSS selector

### options?

`any` = `{}`

see docs/usage/USAGE.md "Configuration"

## Returns

`Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`
