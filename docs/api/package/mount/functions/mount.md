[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mount](../README.md) / mount

# Function: mount()

> **mount**(`target`, `options?`): `Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

Defined in: [package/mount.js:235](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/mount.js#L235)

The public entry point, and an alias for `create()`. With a registered runtime it boots the full
widget, and without one it boots a bare map (see the note above `_runtime`). Widgets share one
document and are kept apart by dom.js scoping; the iframe isolation path was removed.

## Parameters

### target

`string` \| `Element`

### options?

`any` = `{}`

## Returns

`Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`
