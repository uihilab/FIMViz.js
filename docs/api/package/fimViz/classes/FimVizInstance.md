[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/fimViz](../README.md) / FimVizInstance

# Class: FimVizInstance

Defined in: [package/fimViz.js:19](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L19)

The shared service container behind one or more FimMaps. The user rarely holds one, since they
work in Maps and Layers while the default stays implicit.

## Constructors

### Constructor

> **new FimVizInstance**(`opts?`): `FimVizInstance`

Defined in: [package/fimViz.js:36](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L36)

#### Parameters

##### opts?

###### isDefault?

`boolean` = `false`

#### Returns

`FimVizInstance`

## Accessors

### config

#### Get Signature

> **get** **config**(): `any`

Defined in: [package/fimViz.js:171](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L171)

This app's config: the defaults with whatever `mount()` or `create()` was given merged over.

##### Returns

`any`

***

### datasets

#### Get Signature

> **get** **datasets**(): [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/fimViz.js:72](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L72)

A copy of every Dataset parsed on this app, by any of its maps. Add one with `fim.addDataset()`
or `fim.addLayer(rawFile)`, which parses implicitly. Pushing onto this array does nothing.

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)[]

***

### emitter

#### Get Signature

> **get** **emitter**(): `any`

Defined in: [package/fimViz.js:150](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L150)

The underlying event emitter backing `on`/`off`/`emit`.

##### Returns

`any`

***

### hasMaps

#### Get Signature

> **get** **hasMaps**(): `boolean`

Defined in: [package/fimViz.js:183](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L183)

True when at least one `FimMap` is mounted. mount() reads it as the single-instance guard.

##### Returns

`boolean`

***

### isDefault

#### Get Signature

> **get** **isDefault**(): `boolean`

Defined in: [package/fimViz.js:146](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L146)

True for the shared default app, false for one from `{ isolated: true }`.

##### Returns

`boolean`

***

### maps

#### Get Signature

> **get** **maps**(): [`FimMap`](../../fimMap/classes/FimMap.md)[]

Defined in: [package/fimViz.js:148](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L148)

The `FimMap`s currently mounted on this app.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)[]

***

### storage

#### Get Signature

> **get** **storage**(): [`Storage`](../../../io/storage/classes/Storage.md)

Defined in: [package/fimViz.js:51](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L51)

Client-side storage, shared across this app's maps. Built lazily from `config.storage`, because
Storage is generic: the host owns the database name and schema, so the library cannot construct
one until it is configured (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).

  mount('#el', { apiKey, storage: { name: 'my-store', version: 1, tables: ['userFiles'] } })

Throws when unconfigured rather than returning null, since reaching for storage that was never
set up is a programming error.

##### Returns

[`Storage`](../../../io/storage/classes/Storage.md)

## Methods

### adoptDataset()

> **adoptDataset**(`ds`): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: [package/fimViz.js:89](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L89)

Registers a Dataset parsed elsewhere, usually one coming from another app, since any map can
render one. Idempotent, and returns the Dataset for chaining.

  app2.adoptDataset(app1.datasets[0]);   // now discoverable on app2 too, no re-parse

#### Parameters

##### ds

[`Dataset`](../../dataset/classes/Dataset.md)

#### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

***

### configure()

> **configure**(`options?`): `void`

Defined in: [package/fimViz.js:158](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L158)

Merges host options into config. Once locked it warns and does nothing.

#### Parameters

##### options?

`any` = `{}`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [package/fimViz.js:222](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L222)

Tears down each map on this app. Rare, since the reference-counted path is the norm.

#### Returns

`void`

***

### emit()

> **emit**(`evt`, `payload?`): `FimVizInstance`

Defined in: [package/fimViz.js:179](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L179)

Emits an app-level event to its subscribers.

#### Parameters

##### evt

`string`

##### payload?

`any`

#### Returns

`FimVizInstance`

***

### lockConfig()

> **lockConfig**(): `void`

Defined in: [package/fimViz.js:169](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L169)

Locks config against further changes, once the first map on this app has booted.

#### Returns

`void`

***

### off()

> **off**(`evt`, `fn`): `FimVizInstance`

Defined in: [package/fimViz.js:177](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L177)

Removes a listener added with `on`.

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

`FimVizInstance`

***

### on()

> **on**(`evt`, `fn`): `FimVizInstance`

Defined in: [package/fimViz.js:175](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L175)

Subscribes to an app-level event, i.e. `storage:changed`.

#### Parameters

##### evt

`string`

##### fn

(`payload`) => `void`

#### Returns

`FimVizInstance`

***

### removeDataset()

> **removeDataset**(`ds`, `opts?`): `boolean`

Defined in: [package/fimViz.js:103](https://github.com/uihilab/FIMViz.js/blob/bb0a538d32e039b08b0262c3169d06460273c60b/src/package/fimViz.js#L103)

Drops a Dataset from this registry and releases its decode.

It lives on the app rather than on `Layer` because the app owns the registry, and a Layer cannot
know whether a Layer on another map still wants the data. For the same reason it throws while
references remain: unregistering data something is still rendering is never intended.

#### Parameters

##### ds

[`Dataset`](../../dataset/classes/Dataset.md)

##### opts?

`force: true` drops it anyway. The renderers keep their own
  reference and re-force on the next draw, so only discoverability is lost.

###### force?

`boolean` = `false`

#### Returns

`boolean`

false if it was not registered here
