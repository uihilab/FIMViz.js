[**fimviz**](../../../README.md)

***

[fimviz](../../../README.md) / [io/storage](../README.md) / Storage

# Class: Storage

Defined in: [io/storage.js:58](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L58)

## Constructors

### Constructor

> **new Storage**(`opts?`): `Storage`

Defined in: [io/storage.js:93](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L93)

#### Parameters

##### opts?

###### name

`string`

database name — REQUIRED; the host owns the schema

###### resetTablesOnUpgrade?

`boolean` = `false`

when `version` triggers an upgrade (i.e. it
  exceeds whatever is on disk), drop and recreate every table in `tables` instead of only
  creating the ones that don't exist yet. For a host accepting "a version bump clears local
  data" as its migration story — no copy, no marker table, just IndexedDB's own version
  tracking making this a one-time event. Irrelevant on a brand-new database (drop is a no-op
  on a table that doesn't exist).

###### tables?

`string`[] = `[]`

tables to create when `version` triggers an upgrade

###### version?

`number` = `null`

open at this version, creating `tables` on upgrade.
                                 Omit to open at whatever version already exists.

###### versionMigrate?

(`ctx`) => `void` = `null`

STRUCTURAL version-upgrade hook, run INSIDE the versionchange transaction when `version` triggers
  an upgrade — after the default `tables` create/reset. Use it for changes that can only happen in
  an upgrade: create/delete a store, or copy rows between stores via `ctx.transaction`. `oldVersion`
  (0 on a fresh database) lets the host branch per version step. In-place record rewrites do NOT
  need this — use `map()` afterward. Runs only on the configured-version open, not on the
  incremental bumps `createTable`/`dropTable` do.

#### Returns

`Storage`

## Properties

### DELETE

> `static` **DELETE**: `symbol`

Defined in: [io/storage.js:64](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L64)

Sentinel a `map(table, fn)` callback returns to DELETE the current row (returning a value updates
it; returning `undefined` leaves it unchanged). A Symbol so it can never collide with a real
stored value.

## Accessors

### declaredVersion

#### Get Signature

> **get** **declaredVersion**(): `number`

Defined in: [io/storage.js:271](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L271)

The version this instance was CONSTRUCTED with (`null` when omitted). A plain noun — it is what
the host asked for, not what is on disk; `await db.version()` is the latter, and the two diverge
as soon as `createTable`/`dropTable` bumps it.

##### Returns

`number`

***

### name

#### Get Signature

> **get** **name**(): `string`

Defined in: [io/storage.js:106](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L106)

##### Returns

`string`

## Methods

### clear()

> **clear**(`table`): `Promise`\<`boolean`\>

Defined in: [io/storage.js:383](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L383)

Delete every row in `table`, keeping the table itself (contrast `clearAll()`, which clears every table).

#### Parameters

##### table

`string`

#### Returns

`Promise`\<`boolean`\>

***

### clearAll()

> **clearAll**(): `Promise`\<`string`[]\>

Defined in: [io/storage.js:465](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L465)

Clear every row from every existing store in ONE transaction — a full data wipe that keeps the
schema and the version. This is the "refresh completely" for a key-value store: to start over you
clear and re-add, no schema teardown needed. (Contrast `clear(table)` for one store, and
`destroy()` which deletes the whole database.)

#### Returns

`Promise`\<`string`[]\>

the tables that were cleared

***

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [io/storage.js:480](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L480)

Drop the in-memory connection. Data persists; the next call reopens.

#### Returns

`Promise`\<`void`\>

***

### createTable()

> **createTable**(`table`): `Promise`\<`boolean`\>

Defined in: [io/storage.js:289](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L289)

Create a table. Returns false if it already existed. Bumps the DB version.

#### Parameters

##### table

`string`

#### Returns

`Promise`\<`boolean`\>

***

### delete()

> **delete**(`table`, `key`): `Promise`\<`boolean`\>

Defined in: [io/storage.js:373](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L373)

Delete one row.

#### Parameters

##### table

`string`

##### key

`IDBValidKey`

#### Returns

`Promise`\<`boolean`\>

***

### destroy()

> **destroy**(): `Promise`\<`any`\>

Defined in: [io/storage.js:488](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L488)

Delete the entire database.

#### Returns

`Promise`\<`any`\>

***

### dropTable()

> **dropTable**(`table`): `Promise`\<`boolean`\>

Defined in: [io/storage.js:301](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L301)

Drop a table. Returns false if it did not exist. Bumps the DB version.

#### Parameters

##### table

`string`

#### Returns

`Promise`\<`boolean`\>

***

### get()

> **get**(`table`, `key`): `Promise`\<`any`\>

Defined in: [io/storage.js:352](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L352)

→ the stored value, or undefined if absent. (Absent and broken are distinguishable: a
broken read REJECTS rather than resolving undefined, unlike the old io/db.js.)

#### Parameters

##### table

`string`

##### key

`IDBValidKey`

#### Returns

`Promise`\<`any`\>

***

### has()

> **has**(`table`, `key`): `Promise`\<`boolean`\>

Defined in: [io/storage.js:362](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L362)

True if `key` exists (distinguishes a stored `undefined` from a missing row).

#### Parameters

##### table

`string`

##### key

`IDBValidKey`

#### Returns

`Promise`\<`boolean`\>

***

### list()

> **list**(`table`, `opts?`): `Promise`\<`object`[] \| `IDBValidKey`[]\>

Defined in: [io/storage.js:397](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L397)

List rows. `{ keys: true }` returns just the keys (cheap — no values deserialized), which is
what a picker listing filenames wants. `range` is an optional IDBKeyRange.

#### Parameters

##### table

`string`

##### opts?

###### keys?

`boolean` = `false`

###### range?

`IDBKeyRange` = `null`

#### Returns

`Promise`\<`object`[] \| `IDBValidKey`[]\>

***

### map()

> **map**(`table`, `fn`): `Promise`\<`number`\>

Defined in: [io/storage.js:434](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L434)

Iterate `table`'s key→value pairs IN KEY ORDER, transforming each row in place — the general
iterate/transform primitive, and the DATA-migration tool (rename/add/drop a field, re-shape a
value, prune rows) that helps a version update WITHOUT a schema upgrade: values are verbatim and
keys are out-of-line, so a record's shape is not part of the schema. Runs in ONE readwrite
transaction. To read without changing anything, return `undefined` every time.

`fn(key, value)` returns:
  • a value → update the row (skipped when strictly `=== value`, so an unchanged row costs nothing),
  • `Storage.DELETE` → delete the row,
  • `undefined` → leave the row untouched (a safe default: a callback that forgets to return does
    nothing rather than wiping data).

#### Parameters

##### table

`string`

##### fn

(`key`, `value`) => `any`

#### Returns

`Promise`\<`number`\>

how many rows were updated or deleted

***

### put()

> **put**(`table`, `key`, `value`): `Promise`\<`IDBValidKey`\>

Defined in: [io/storage.js:339](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L339)

Store `value` under `key`, verbatim.

#### Parameters

##### table

`string`

##### key

`IDBValidKey`

##### value

`any`

anything structured-cloneable, stored exactly as given

#### Returns

`Promise`\<`IDBValidKey`\>

the key

***

### table()

> **table**(`table`): [`StorageTable`](../interfaces/StorageTable.md)

Defined in: [io/storage.js:317](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L317)

A handle scoped to one table, so row ops read as verbs on the table itself
(`storage.table('userFiles').put(key, value)`) instead of repeating the table name as an
argument to the db-level Storage instance on every call. Pure sugar — each method delegates
to the matching Storage method below with `table` bound; no separate transaction logic, no
state of its own (cheap to create, nothing to dispose).

#### Parameters

##### table

`string`

#### Returns

[`StorageTable`](../interfaces/StorageTable.md)

***

### tables()

> **tables**(): `Promise`\<`string`[]\>

Defined in: [io/storage.js:279](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L279)

Table names currently in the database.

#### Returns

`Promise`\<`string`[]\>

***

### version()

> **version**(): `Promise`\<`number`\>

Defined in: [io/storage.js:257](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L257)

This database's CURRENT on-disk version, or `null` if it does not exist yet.

Safe to call before opening — it never creates the database and never triggers an upgrade. When a
connection is already open its live `db.version` is authoritative (and needs no
`indexedDB.databases()` support); otherwise it reads the origin's database list.

#### Returns

`Promise`\<`number`\>

***

### databases()

> `static` **databases**(): `Promise`\<`object`[]\>

Defined in: [io/storage.js:228](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L228)

Every IndexedDB database in this origin, with its current version.

Wraps `indexedDB.databases()`, which is unavailable in a few older engines — there it throws
rather than reporting "no databases", since an empty list would be indistinguishable from a real
answer and could tempt a host into destroying live data.

#### Returns

`Promise`\<`object`[]\>

***

### exists()

> `static` **exists**(`name`): `Promise`\<`boolean`\>

Defined in: [io/storage.js:245](https://github.com/uihilab/FIMViz.js/blob/a23ccba65224d3481fd21299491ab6e3a23f0f47/src/io/storage.js#L245)

Does a database of this name already exist in this origin?

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`boolean`\>
