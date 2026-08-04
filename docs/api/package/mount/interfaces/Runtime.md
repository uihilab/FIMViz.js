[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mount](../README.md) / Runtime

# Interface: Runtime

Defined in: package/mount.js:33

## Properties

### bootstrap

> **bootstrap**: (`fim`) => `Promise`\<`void`\>

Defined in: package/mount.js:34

boot the map; called by create() instead of its default createMap() path, with the FimMap being mounted

#### Parameters

##### fim

`any`

#### Returns

`Promise`\<`void`\>

***

### createPanel

> **createPanel**: (`root`) => `any`

Defined in: package/mount.js:37

per-instance Layer Panel factory

#### Parameters

##### root

`Element`

#### Returns

`any`

***

### getMountedMap

> **getMountedMap**: () => `any`

Defined in: package/mount.js:35

reported once bootstrap() resolves

#### Returns

`any`

***

### markup

> **markup**: `string`

Defined in: package/mount.js:38

widget HTML injected into the container

***

### teardownMap

> **teardownMap**: () => `void`

Defined in: package/mount.js:36

detach listeners on destroy()

#### Returns

`void`
