[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mount](../README.md) / mount

# Function: mount()

> **mount**(`target`, `options?`): `Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

Defined in: [package/mount.js:231](https://github.com/uihilab/FIMViz.js/blob/aa18b967902eed757d90bb15d02c8e250d2c0aa7/src/package/mount.js#L231)

mount(target, options) — the public entry point; an alias for `create()`. With a registered
runtime it boots the full widget; otherwise it boots a bare map (see the note above `_runtime`).
Single-document composition (Path B via dom.js scoping); the abandoned iframe `isolate` path
(Path A) was removed.

## Parameters

### target

`string` \| `Element`

### options?

`any` = `{}`

## Returns

`Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`
