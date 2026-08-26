[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/mount](../README.md) / Runtime

# Interface: Runtime

Defined in: [package/mount.js:32](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mount.js#L32)

## Properties

### bootstrap

> **bootstrap**: (`fim`) => `Promise`\<`void`\>

Defined in: [package/mount.js:33](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mount.js#L33)

boots the map. create() calls it with
  the FimMap being mounted, instead of taking its own createMap() path.

#### Parameters

##### fim

`any`

#### Returns

`Promise`\<`void`\>

***

### createPanel

> **createPanel**: (`root`) => `any`

Defined in: [package/mount.js:37](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mount.js#L37)

per-instance Layer Panel factory

#### Parameters

##### root

`Element`

#### Returns

`any`

***

### getMountedMap

> **getMountedMap**: () => `any`

Defined in: [package/mount.js:35](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mount.js#L35)

read once bootstrap() resolves

#### Returns

`any`

***

### markup

> **markup**: `string`

Defined in: [package/mount.js:38](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mount.js#L38)

widget HTML injected into the container

***

### teardownMap

> **teardownMap**: () => `void`

Defined in: [package/mount.js:36](https://github.com/uihilab/FIMViz.js/blob/20575188daabf89b00e9e31ae0314273480ab3d3/src/package/mount.js#L36)

detaches listeners on destroy()

#### Returns

`void`
