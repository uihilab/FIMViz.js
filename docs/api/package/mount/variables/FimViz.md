[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mount](../README.md) / FimViz

# Variable: FimViz

> `const` **FimViz**: `object` & `object`

Defined in: [package/mount.js:253](https://github.com/uihilab/FIMViz.js/blob/9e18afac2775f0224216af175bd5a318723bb4c9/src/package/mount.js#L253)

## Type Declaration

### current()

> **current**(): [`FimVizInstance`](../../fimViz/classes/FimVizInstance.md)

The active default instance, or null if no map is mounted.

#### Returns

[`FimVizInstance`](../../fimViz/classes/FimVizInstance.md)

### reset()

> **reset**(): `void`

Force-release the default instance (tears down its maps). Rarely needed.

#### Returns

`void`

## Type Declaration

### create

> **create**: (`target`, `options?`) => `Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

create(target, options) — boot a FimMap on the ambient default app.

Applies host config (set-once), validates it, injects the widget markup unless the page
already provides it, boots the map, and resolves to the FimMap once it is ready. On mount
failure the map is released so the single-instance guard does not stay stuck.

#### Parameters

##### target

`string` \| `Element`

a container element, its id, or a CSS selector

##### options?

`any` = `{}`

see docs/usage/USAGE.md "Configuration"

#### Returns

`Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

### mount

> **mount**: (`target`, `options?`) => `Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

mount(target, options) — the public entry point; an alias for `create()`. With a registered
runtime it boots the full widget; otherwise it boots a bare map (see the note above `_runtime`).
Single-document composition (Path B via dom.js scoping); the abandoned iframe `isolate` path
(Path A) was removed.

#### Parameters

##### target

`string` \| `Element`

##### options?

`any` = `{}`

#### Returns

`Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

### parseFile

> **parseFile**: (`source`, `options?`) => `Promise`\<[`Dataset`](../../dataset/classes/Dataset.md)\>

parseFile(source, options) — pure parse (no instance, no map). Returns a Dataset.

#### Parameters

##### source

`string` \| `ArrayBuffer` \| `File` \| `Blob`

##### options?

`any` = `{}`

#### Returns

`Promise`\<[`Dataset`](../../dataset/classes/Dataset.md)\>
