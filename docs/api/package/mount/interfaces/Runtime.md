[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mount](../README.md) / Runtime

# Interface: Runtime

Defined in: [package/mount.js:35](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/mount.js#L35)

## Properties

### bootstrap

> **bootstrap**: (`fim`) => `Promise`\<`void`\>

Defined in: [package/mount.js:36](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/mount.js#L36)

boot the map; called by create() instead of its default createMap() path, with the FimMap being mounted

#### Parameters

##### fim

`any`

#### Returns

`Promise`\<`void`\>

***

### createPanel

> **createPanel**: (`root`) => `any`

Defined in: [package/mount.js:39](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/mount.js#L39)

per-instance Layer Panel factory

#### Parameters

##### root

`Element`

#### Returns

`any`

***

### getMountedMap

> **getMountedMap**: () => `any`

Defined in: [package/mount.js:37](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/mount.js#L37)

reported once bootstrap() resolves

#### Returns

`any`

***

### markup

> **markup**: `string`

Defined in: [package/mount.js:40](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/mount.js#L40)

widget HTML injected into the container

***

### teardownMap

> **teardownMap**: () => `void`

Defined in: [package/mount.js:38](https://github.com/uihilab/FIMViz.js/blob/cf0b670babbcd8bf33ef47bbe5f1e8ec9a645e8b/src/package/mount.js#L38)

detach listeners on destroy()

#### Returns

`void`
