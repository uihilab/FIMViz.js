[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [package/fimViz](../README.md) / FimVizInstance

# Class: FimVizInstance

Defined in: [package/fimViz.js:20](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L20)

A FimViz instance: the shared service container behind one or more FimMaps. The user
rarely holds one directly — they work in Maps/Layers and the default is implicit.

## Constructors

### Constructor

> **new FimVizInstance**(`opts?`): `FimVizInstance`

Defined in: [package/fimViz.js:38](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L38)

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

Defined in: [package/fimViz.js:173](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L173)

This app's own config object (defaults merged with whatever was passed to `mount()`/`create()`).

##### Returns

`any`

***

### datasets

#### Get Signature

> **get** **datasets**(): [`Dataset`](../../dataset/classes/Dataset.md)[]

Defined in: [package/fimViz.js:74](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L74)

Every Dataset parsed on this app, by any of its maps. A copy — register via `fim.addDataset()`
(or `fim.addLayer(rawFile)`, which parses implicitly), not by pushing here.

##### Returns

[`Dataset`](../../dataset/classes/Dataset.md)[]

***

### emitter

#### Get Signature

> **get** **emitter**(): `any`

Defined in: [package/fimViz.js:152](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L152)

The underlying event emitter backing `on`/`off`/`emit`.

##### Returns

`any`

***

### hasMaps

#### Get Signature

> **get** **hasMaps**(): `boolean`

Defined in: [package/fimViz.js:185](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L185)

Does this app have at least one mounted `FimMap`? Used as the single-instance mount guard.

##### Returns

`boolean`

***

### isDefault

#### Get Signature

> **get** **isDefault**(): `boolean`

Defined in: [package/fimViz.js:148](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L148)

Is this the shared ambient default app (vs. one created via `{ isolated: true }`)?

##### Returns

`boolean`

***

### maps

#### Get Signature

> **get** **maps**(): [`FimMap`](../../fimMap/classes/FimMap.md)[]

Defined in: [package/fimViz.js:150](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L150)

Every `FimMap` currently mounted on this app.

##### Returns

[`FimMap`](../../fimMap/classes/FimMap.md)[]

***

### storage

#### Get Signature

> **get** **storage**(): [`Storage`](../../../io/storage/classes/Storage.md)

Defined in: [package/fimViz.js:53](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L53)

Client-side storage — shared across this app's maps. Lazily built from `config.storage`,
because Storage is GENERIC: the host owns the database name and schema, so the library has
nothing to construct one from until it is configured (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).

  mount('#el', { apiKey, storage: { name: 'my-store', version: 1, tables: ['userFiles'] } })

Not configured is a clear throw rather than a silent null: reaching for storage you never set
up is a programming error.

##### Returns

[`Storage`](../../../io/storage/classes/Storage.md)

## Methods

### adoptDataset()

> **adoptDataset**(`ds`): [`Dataset`](../../dataset/classes/Dataset.md)

Defined in: [package/fimViz.js:91](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L91)

Register a Dataset parsed elsewhere — typically one crossing over from another app, since a
Dataset is a free value that any map can render. Idempotent; returns the Dataset for chaining.

  app2.adoptDataset(app1.datasets[0]);   // now discoverable on app2 too, no re-parse

#### Parameters

##### ds

[`Dataset`](../../dataset/classes/Dataset.md)

#### Returns

[`Dataset`](../../dataset/classes/Dataset.md)

***

### configure()

> **configure**(`options?`): `void`

Defined in: [package/fimViz.js:160](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L160)

Merge host options into config. No-op (with a warning) once locked.

#### Parameters

##### options?

`any` = `{}`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [package/fimViz.js:224](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L224)

Force-teardown of every map on this app (rare; the ref-counted path is the norm).

#### Returns

`void`

***

### emit()

> **emit**(`evt`, `payload?`): `FimVizInstance`

Defined in: [package/fimViz.js:181](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L181)

Emit an app-level event to every subscriber.

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

Defined in: [package/fimViz.js:171](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L171)

Lock config against further changes — called once the first map on this app has booted.

#### Returns

`void`

***

### off()

> **off**(`evt`, `fn`): `FimVizInstance`

Defined in: [package/fimViz.js:179](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L179)

Unsubscribe a listener previously added with `on`.

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

Defined in: [package/fimViz.js:177](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L177)

Subscribe to an app-level event (`error`, `notify`, `storage:changed`, …).

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

Defined in: [package/fimViz.js:105](https://github.com/uihilab/FIMViz.js/blob/af343381b1a457e40ac721c50ed4e6e47add4561/src/package/fimViz.js#L105)

Forget a Dataset: drop it from this registry and release its decode.

The verb lives HERE, not on `Layer`, because the app owns the registry — a Layer cannot know
whether a Layer on another map still wants it. That is also why this REFUSES while references
remain: unregistering data something is still rendering is never what the caller meant.

#### Parameters

##### ds

[`Dataset`](../../dataset/classes/Dataset.md)

##### opts?

`force: true` drops it regardless (the renderers keep their
  own reference and re-force on next draw; only discoverability is lost)

###### force?

`boolean` = `false`

#### Returns

`boolean`

false if it was not registered here
