[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mount](../README.md) / FimViz

# Variable: FimViz

> `const` **FimViz**: `object` & `object`

Defined in: [package/mount.js:257](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/mount.js#L257)

## Type Declaration

### current()

> **current**(): [`FimVizInstance`](../../fimViz/classes/FimVizInstance.md)

The active default instance, or null when no map is mounted.

#### Returns

[`FimVizInstance`](../../fimViz/classes/FimVizInstance.md)

### reset()

> **reset**(): `void`

Releases the default instance, tearing down its maps. Rarely needed.

#### Returns

`void`

## Type Declaration

### create

> **create**: (`target`, `options?`) => `Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

Boots a FimMap on the default app.

Applies the host config once, validates it, injects the widget markup unless the page already
has it, boots the map, then resolves to the FimMap. A mount failure releases the map so the
single-instance guard does not stay stuck.

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

The public entry point, and an alias for `create()`. With a registered runtime it boots the full
widget, and without one it boots a bare map (see the note above `_runtime`). Widgets share one
document and are kept apart by dom.js scoping; the iframe isolation path was removed.

#### Parameters

##### target

`string` \| `Element`

##### options?

`any` = `{}`

#### Returns

`Promise`\<[`FimMap`](../../fimMap/classes/FimMap.md)\> & `object`

### parseFile

> **parseFile**: (`source`, `options?`) => `Promise`\<[`Dataset`](../../dataset/classes/Dataset.md)\>

Parses a source into a Dataset. Needs no instance and no map.

#### Parameters

##### source

`string` \| `ArrayBuffer` \| `Blob` \| `File`

##### options?

`any` = `{}`

#### Returns

`Promise`\<[`Dataset`](../../dataset/classes/Dataset.md)\>
