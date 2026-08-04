# Storage — usage reference

`Storage` (barrel-exported) is a **generic key-value store over IndexedDB**. It
knows nothing about Datasets, files, or FIMViz — the host names the database, the tables, and the
keys. Values are stored **verbatim** (structured-clone, not JSON) — an `ArrayBuffer`/`TypedArray`/
`Blob`/`Map`/`Set`/`Date` round-trips exactly; `JSON.stringify(arrayBuffer)` would silently produce
`"{}"`. Keys are **out-of-line** (no `keyPath`) — the store never touches your value to find its key.

## Contents

[Discovery](#discovery--does-it-exist-at-what-version) ·
[Getting an instance](#getting-an-instance) · [Rows](#rows) ·
[Tables](#tables-structural--bumps-the-db-version) ·
[Version-management primitives](#version-management-primitives-mechanisms-not-a-framework) ·
[Connection lifecycle](#connection-lifecycle) · [Notes](#notes)

## Discovery — does it exist, at what version?

IndexedDB **cannot downgrade**: opening at a version lower than the one on disk throws a hard
`VersionError`. And the on-disk version is not something a host can track for itself —
`createTable`/`dropTable` bump it as a side effect, so the number you passed to the constructor goes
stale on its own. Ask before you open:

```js
await Storage.databases();        // → [{ name, version }, …]  every DB in this origin
await Storage.exists('my-store'); // → boolean
await db.version();               // → the CURRENT on-disk version, or null if it doesn't exist yet
db.declaredVersion;               // → what THIS instance was constructed with (a plain noun)
```

`version()` is safe to call before opening: it never creates the database and never triggers an
upgrade. `declaredVersion` and `await version()` diverge as soon as a `createTable`/`dropTable` bump
lands — that divergence is the thing worth checking.

The **safe open** is to omit `version` entirely, which attaches to whatever already exists:

```js
const db = new Storage({ name: 'my-store', tables: ['userFiles'] });   // no version → no downgrade risk
```

A downgrade error names the ways out: check the version, open at that version or higher, omit
`version`, or `destroy()` and start over. `Storage.databases()` **throws** on engines without
`indexedDB.databases()` rather than reporting an empty list — "no databases" and "cannot tell" must
not look alike when the next step might be destroying data.

## Getting an instance

```js
new Storage({ name, version?, tables?, resetTablesOnUpgrade?, versionMigrate? })

// or, via a mounted FimMap (shares one Storage across every map on that app):
const fim = await mount('#el', { storage: { name: 'my-store', version: 1, tables: ['userFiles'] } });
fim.storage   // throws until `storage` was passed to mount()/create() — the engine names no default
```

| Param | Default | Notes |
|---|---|---|
| `name` | — (**required**) | Throws without one — the host owns the schema. |
| `version` | `null` (open at whatever's on disk) | Creates `tables` on upgrade when set. |
| `tables` | `[]` | Table (object store) names to create when `version` triggers an upgrade. |
| `resetTablesOnUpgrade` | `false` | On an upgrade, **drop and recreate** every table in `tables` instead of only creating missing ones — the "a version bump clears local data" migration story. A no-op on a brand-new database. |
| `versionMigrate` | `null` | `(ctx: {db, transaction, oldVersion, newVersion}) => void` — a STRUCTURAL hook run *inside* the versionchange transaction, after the default create/reset. Use for create/delete-a-store or copy-rows-between-stores. Runs only on the configured-version open, not on `createTable`/`dropTable`'s incremental bumps. |

## Rows

Row ops are scoped to one table via `db.table(name)` — a handle so a call reads as a verb on the
table itself, rather than repeating `table` as an argument on every call to the db-level instance:

```js
const userFiles = db.table('userFiles');

await userFiles.put(key, value)     // key required; value stored verbatim; returns the key
await userFiles.get(key)             // → value, or undefined if absent (a BROKEN read REJECTS,
                                      //   distinguishable from "absent")
await userFiles.has(key)             // → boolean (distinguishes a stored `undefined` from missing)
await userFiles.delete(key)          // → true
await userFiles.clear()              // delete every row in ONE table, keep the table itself
await userFiles.list({ keys?, range? })
// keys:true  → IDBValidKey[]              (cheap — no values deserialized; good for a filename picker)
// keys:false → { key, value }[]  (default, in key order)
// range: an optional IDBKeyRange

userFiles.name   // 'userFiles'
```

`table(name)` is pure sugar — each method delegates to the equivalent db-level call
(`db.put(table, key, value)`, `db.get(table, key)`, …) with `table` bound; no separate transaction
logic, and nothing to dispose (cheap to create, discard freely). Both forms are fully
interchangeable — a row written via `db.table('userFiles').put(k, v)` reads the same way via
`db.get('userFiles', k)`, and vice versa; nothing about a table's data or schema differs between
them.

## Tables (structural — bumps the DB version)

```js
await db.tables()          // → string[] — every table currently in the database
await db.createTable(name)  // → false if it already existed, else creates it (version bump)
await db.dropTable(name)    // → false if it didn't exist, else drops it (version bump)
```

## Version-management primitives (mechanisms, not a framework)

Two kinds of change, two different tools — the host owns the *policy* either way:

```js
await db.table('userFiles').map((key, value) => {
  // DATA migration — NO schema/version bump needed, since keys are out-of-line and values are
  // verbatim (a record's shape isn't part of the schema). Runs in ONE readwrite transaction,
  // iterating key→value in key order.
  return newValue;          // update the row (skipped if === the current value — a no-op costs nothing)
  return Storage.DELETE;    // delete the row (a Symbol — can't collide with a real stored value)
  return undefined;         // leave the row untouched (the safe default — a callback that forgets to
                             // return does nothing, rather than wiping data)
});
// → Promise<number> — how many rows were updated or deleted

await db.clearAll();   // wipe every row in every table, in ONE transaction — keeps schema + version.
                        // The KV "start over": clear then re-add, no schema teardown. Returns the
                        // table names that were cleared. Contrast clear(table) — one table only.
```

`versionMigrate` (constructor option, above) is the STRUCTURAL counterpart — create/drop a store or
copy rows between stores, which IndexedDB only allows inside an `onupgradeneeded` transaction. Use
`map()` for in-place record rewrites; reach for `versionMigrate` only when the *shape of the
database itself* (which stores exist) needs to change.

## Connection lifecycle

```js
await db.close()     // drop the in-memory connection; data persists, next call reopens
await db.destroy()   // delete the ENTIRE database (closes first)
db.name              // the database name (getter)
```

Concurrent calls share one open connection (`#conn()` caches the open promise) — you don't need to
manage connection reuse yourself.

## Notes

- **Every write really commits** before its promise resolves — it waits for `tx.oncomplete`, not just
  the request's `onsuccess`.
- **Structural vs. data changes**: `createTable`/`dropTable`/`versionMigrate` bump the IndexedDB
  version (the only way to change which stores exist); `put`/`map` never need a version bump, since
  a row's shape isn't schema.
- **No query DSL, no index management, no transaction API beyond the above** — deliberately: this is
  a small, generic KV mechanism, not a database library. If you need more, that's a sign to build a
  `StorageAdapter` around a real one, not to extend this class.
- **Scope**: the engine ships no default database name or table list — a host builds its own facade
  (e.g. a set of file-type stores) on top of `Storage`, naming the database and tables it owns.
