// storage.js — a GENERIC key-value store over IndexedDB. Database / table / row management.
//
// This knows NOTHING about Datasets, files, or FIMViz. The host supplies the database name, the
// table names and the keys; Storage supplies the mechanism. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1/§2.3.
//
//   const db = new Storage({ name: 'my-store', version: 1, tables: ['userFiles'] });
//   await db.put('userFiles', 'x.tif', ds.toRecord());     // value stored VERBATIM
//   Dataset.fromRecord(await db.get('userFiles', 'x.tif'));
//
// VALUES ARE STORED VERBATIM. The value type is anything structured-cloneable — ArrayBuffer,
// TypedArray, Blob, File, Map, Set, Date, plain objects, strings. That is IndexedDB's native
// capability, so it costs nothing and is strictly more general than JSON: raster payloads are
// ArrayBuffers and JSON.stringify(arrayBuffer) is "{}" — silent, total data loss.
//
// KEYS ARE OUT-OF-LINE (createObjectStore with no keyPath). This is what makes verbatim storage
// possible: a keyPath would require the key to live INSIDE the value, which is exactly why the old
// wrapper had to derive a key from name||filename||id and then delete those fields from the
// caller's object. The store must not touch your value — key derivation and timestamps are the
// caller's business.
//
// SCOPE EDGE: this is not a database library. No query DSL, no index management, no migration
// framework, no transaction API — that road ends at maintaining a worse Dexie. If a second backend
// is ever needed (memory for tests, remote for server-side), this surface is small enough to hide
// behind a StorageAdapter; do not build that until it is real.
//
// VERSION MANAGEMENT (below) stays on the right side of that edge by exposing PRIMITIVES, not a
// framework. Two facts about IndexedDB shape them:
//   • STRUCTURAL changes (create/drop a store, change a keyPath) may ONLY happen inside an
//     `onupgradeneeded` (versionchange) transaction — that is what `version` + `tables` +
//     `resetTablesOnUpgrade` + the `migrate` callback drive.
//   • A DATA change (rewriting record CONTENTS — add/rename/drop a field, re-key) needs NO upgrade
//     here: out-of-line keys + verbatim values mean a record's shape is not part of the schema, so
//     `map()` iterates key→value pairs and transforms them in an ordinary readwrite transaction. This
//     is the "modify items to help a version update" primitive — why this class needs no migration engine.
// The host still owns the POLICY (which version, keep-vs-drop, what the transform is); Storage only
// supplies the mechanisms. See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §2.3.

/**
 * A table-scoped view returned by `Storage#table(name)` — row ops read as verbs on the table
 * itself rather than repeating the table name on every call to the db-level Storage instance.
 * @typedef {object} StorageTable
 * @property {string} name
 * @property {(key: IDBValidKey, value: *) => Promise<IDBValidKey>} put
 * @property {(key: IDBValidKey) => Promise<*>} get
 * @property {(key: IDBValidKey) => Promise<boolean>} has
 * @property {(key: IDBValidKey) => Promise<boolean>} delete
 * @property {() => Promise<boolean>} clear
 * @property {(opts?: {keys?: boolean, range?: IDBKeyRange|null}) => Promise<Array>} list
 * @property {(fn: (key: IDBValidKey, value: *) => *) => Promise<number>} map
 */

const isPlainKey = (k) => k !== undefined && k !== null;

function fail(msg, err) {
  return new Error(err ? `${msg} — ${err.name}: ${err.message}` : msg);
}

export class Storage {
  /**
   * Sentinel a `map(table, fn)` callback returns to DELETE the current row (returning a value updates
   * it; returning `undefined` leaves it unchanged). A Symbol so it can never collide with a real
   * stored value.
   */
  static DELETE = Symbol("Storage.DELETE");

  #name;
  #version;
  #tables;
  #resetTablesOnUpgrade;
  #versionMigrate;
  #opening = null;   // cached open promise (shared by concurrent callers)

  /**
   * @param {object}   opts
   * @param {string}   opts.name      database name — REQUIRED; the host owns the schema
   * @param {number}  [opts.version]  open at this version, creating `tables` on upgrade.
   *                                  Omit to open at whatever version already exists.
   * @param {string[]}[opts.tables]   tables to create when `version` triggers an upgrade
   * @param {boolean} [opts.resetTablesOnUpgrade]  when `version` triggers an upgrade (i.e. it
   *   exceeds whatever is on disk), drop and recreate every table in `tables` instead of only
   *   creating the ones that don't exist yet. For a host accepting "a version bump clears local
   *   data" as its migration story — no copy, no marker table, just IndexedDB's own version
   *   tracking making this a one-time event. Irrelevant on a brand-new database (drop is a no-op
   *   on a table that doesn't exist).
   * @param {(ctx: {db: IDBDatabase, transaction: IDBTransaction, oldVersion: number, newVersion: number}) => void} [opts.versionMigrate]
   *   STRUCTURAL version-upgrade hook, run INSIDE the versionchange transaction when `version` triggers
   *   an upgrade — after the default `tables` create/reset. Use it for changes that can only happen in
   *   an upgrade: create/delete a store, or copy rows between stores via `ctx.transaction`. `oldVersion`
   *   (0 on a fresh database) lets the host branch per version step. In-place record rewrites do NOT
   *   need this — use `map()` afterward. Runs only on the configured-version open, not on the
   *   incremental bumps `createTable`/`dropTable` do.
   */
  constructor({ name, version = null, tables = [], resetTablesOnUpgrade = false, versionMigrate = null } = {}) {
    if (!name) {
      throw new Error(
        "Storage: a database `name` is required. The host owns the schema — the library does not " +
        "name your database (docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1).");
    }
    this.#name = name;
    this.#version = version;
    this.#tables = [...tables];
    this.#resetTablesOnUpgrade = resetTablesOnUpgrade;
    this.#versionMigrate = typeof versionMigrate === "function" ? versionMigrate : null;
  }

  get name() { return this.#name; }

  // --- connection -----------------------------------------------------------------------

  #openAt(version, create = [], drop = [], runMigrate = false) {
    return new Promise((resolve, reject) => {
      const req = version == null
        ? indexedDB.open(this.#name)
        : indexedDB.open(this.#name, version);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const t of drop) {
          if (db.objectStoreNames.contains(t)) db.deleteObjectStore(t);
        }
        for (const t of create) {
          // No keyPath → out-of-line keys → the value is stored exactly as handed in.
          if (!db.objectStoreNames.contains(t)) db.createObjectStore(t);
        }
        // The host's structural version-upgrade hook — INSIDE the versionchange transaction, after the
        // default create/reset, so it can create/delete stores and copy rows via e.target.transaction.
        if (runMigrate && this.#versionMigrate) {
          this.#versionMigrate({ db, transaction: e.target.transaction, oldVersion: e.oldVersion, newVersion: e.newVersion });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => {
        // A downgrade is the one open failure a host can actually fix, and the raw DOMException
        // ("The requested version (2) is less than the existing version (3)") says nothing about how.
        // It is also easy to hit by accident, because createTable/dropTable bump the on-disk version
        // behind the host's back — so the constructor's number goes stale on its own.
        if (req.error?.name === "VersionError") {
          return reject(fail(
            `Storage: cannot open database "${this.#name}" at version ${version} — a NEWER version ` +
            `already exists on disk. IndexedDB cannot downgrade. Check it first with ` +
            `\`await Storage.exists("${this.#name}")\` / \`await db.version()\`, then either open at ` +
            `that version or higher, omit \`version\` entirely to attach to whatever exists, or ` +
            `\`await db.destroy()\` to start over (destroys the data).`, req.error));
        }
        reject(fail(`Storage: cannot open database "${this.#name}"`, req.error));
      };
      req.onblocked = () => reject(fail(
        `Storage: opening "${this.#name}" is blocked by another open connection ` +
        `(close other tabs using it)`));
    });
  }

  #conn() {
    if (!this.#opening) {
      this.#opening = this.#openAt(
        this.#version, this.#tables, this.#resetTablesOnUpgrade ? this.#tables : [], true,
      );
    }
    return this.#opening;
  }

  /** Reopen at version+1 to run a schema change (IndexedDB only mutates stores on upgrade). The
   * `versionMigrate` hook does NOT run here — these are incremental programmatic bumps, not the
   * declared version's migration. */
  async #bump(create = [], drop = []) {
    const db = await this.#conn();
    const next = db.version + 1;
    db.close();
    this.#opening = null;
    this.#opening = this.#openAt(next, create, drop, false);
    await this.#opening;
    this.#version = next;
  }

  #assertTable(db, table) {
    if (!db.objectStoreNames.contains(table)) {
      const known = [...db.objectStoreNames].join(", ") || "(none)";
      throw fail(
        `Storage: table "${table}" does not exist in "${this.#name}". Known tables: [${known}]. ` +
        `Create it with createTable("${table}").`);
    }
  }

  /**
   * Run `fn(store)` in a transaction. ALWAYS awaits transaction completion, so a write has really
   * committed when this resolves (the old io/db.js resolved before commit). If `fn` returns an
   * IDBRequest its result is the resolved value.
   */
  async #run(table, mode, fn) {
    const db = await this.#conn();
    this.#assertTable(db, table);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, mode);
      let value;
      let req;
      try {
        req = fn(tx.objectStore(table));
      } catch (e) {
        reject(e);
        return;
      }
      if (req && typeof req === "object" && "onsuccess" in req) {
        req.onsuccess = () => { value = req.result; };
        req.onerror = () => reject(fail(`Storage: ${mode} on "${table}" failed`, req.error));
      }
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(fail(`Storage: transaction on "${table}" failed`, tx.error));
      tx.onabort = () => reject(fail(`Storage: transaction on "${table}" aborted`, tx.error));
    });
  }

  // --- discovery: what exists, at what version ---------------------------------------------
  //
  // Opening at a version LOWER than the one on disk throws a hard `VersionError`, and the on-disk
  // version is not something a host can track for itself: `createTable`/`dropTable` bump it as a side
  // effect, so it drifts away from whatever the host last passed to the constructor. These let a host
  // ASK before it opens, rather than guessing and catching. All async — reading the disk is I/O, so
  // they are terminals like every other read here (`get`/`has`/`list`/`tables`).

  /**
   * Every IndexedDB database in this origin, with its current version.
   *
   * Wraps `indexedDB.databases()`, which is unavailable in a few older engines — there it throws
   * rather than reporting "no databases", since an empty list would be indistinguishable from a real
   * answer and could tempt a host into destroying live data.
   * @returns {Promise<Array<{name: string, version: number}>>}
   */
  static async databases() {
    if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
      throw new Error(
        "Storage.databases(): this browser does not implement indexedDB.databases(). " +
        "Open with `new Storage({ name, tables })` (no `version`) instead — that attaches to " +
        "whatever version already exists and never triggers a downgrade.");
    }
    return (await indexedDB.databases())
      .filter((d) => d.name)
      .map((d) => ({ name: d.name, version: d.version ?? null }));
  }

  /**
   * Does a database of this name already exist in this origin?
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  static async exists(name) {
    return (await Storage.databases()).some((d) => d.name === name);
  }

  /**
   * This database's CURRENT on-disk version, or `null` if it does not exist yet.
   *
   * Safe to call before opening — it never creates the database and never triggers an upgrade. When a
   * connection is already open its live `db.version` is authoritative (and needs no
   * `indexedDB.databases()` support); otherwise it reads the origin's database list.
   * @returns {Promise<number|null>}
   */
  async version() {
    if (this.#opening) {
      try { return (await this.#opening).version; } catch { /* fall through to the disk read */ }
    }
    const found = (await Storage.databases()).find((d) => d.name === this.#name);
    return found ? found.version : null;
  }

  /**
   * The version this instance was CONSTRUCTED with (`null` when omitted). A plain noun — it is what
   * the host asked for, not what is on disk; `await db.version()` is the latter, and the two diverge
   * as soon as `createTable`/`dropTable` bumps it.
   * @returns {number|null}
   */
  get declaredVersion() { return this.#version; }

  // --- table management -----------------------------------------------------------------

  /**
   * Table names currently in the database.
   * @returns {Promise<string[]>}
   */
  async tables() {
    const db = await this.#conn();
    return [...db.objectStoreNames];
  }

  /**
   * Create a table. Returns false if it already existed. Bumps the DB version.
   * @param {string} table
   * @returns {Promise<boolean>}
   */
  async createTable(table) {
    const db = await this.#conn();
    if (db.objectStoreNames.contains(table)) return false;
    await this.#bump([table], []);
    return true;
  }

  /**
   * Drop a table. Returns false if it did not exist. Bumps the DB version.
   * @param {string} table
   * @returns {Promise<boolean>}
   */
  async dropTable(table) {
    const db = await this.#conn();
    if (!db.objectStoreNames.contains(table)) return false;
    await this.#bump([], [table]);
    return true;
  }

  /**
   * A handle scoped to one table, so row ops read as verbs on the table itself
   * (`storage.table('userFiles').put(key, value)`) instead of repeating the table name as an
   * argument to the db-level Storage instance on every call. Pure sugar — each method delegates
   * to the matching Storage method below with `table` bound; no separate transaction logic, no
   * state of its own (cheap to create, nothing to dispose).
   * @param {string} table
   * @returns {StorageTable}
   */
  table(table) {
    return {
      name: table,
      put: (key, value) => this.put(table, key, value),
      get: (key) => this.get(table, key),
      has: (key) => this.has(table, key),
      delete: (key) => this.delete(table, key),
      clear: () => this.clear(table),
      list: (opts) => this.list(table, opts),
      map: (fn) => this.map(table, fn),
    };
  }

  // --- row management -------------------------------------------------------------------

  /**
   * Store `value` under `key`, verbatim.
   * @param {string} table
   * @param {IDBValidKey} key
   * @param {*} value - anything structured-cloneable, stored exactly as given
   * @returns {Promise<IDBValidKey>} the key
   */
  async put(table, key, value) {
    if (!isPlainKey(key)) throw fail(`Storage.put: a key is required for "${table}"`);
    await this.#run(table, "readwrite", (s) => s.put(value, key));
    return key;
  }

  /**
   * → the stored value, or undefined if absent. (Absent and broken are distinguishable: a
   * broken read REJECTS rather than resolving undefined, unlike the old io/db.js.)
   * @param {string} table
   * @param {IDBValidKey} key
   * @returns {Promise<*>}
   */
  async get(table, key) {
    return this.#run(table, "readonly", (s) => s.get(key));
  }

  /**
   * True if `key` exists (distinguishes a stored `undefined` from a missing row).
   * @param {string} table
   * @param {IDBValidKey} key
   * @returns {Promise<boolean>}
   */
  async has(table, key) {
    const k = await this.#run(table, "readonly", (s) => s.getKey(key));
    return k !== undefined;
  }

  /**
   * Delete one row.
   * @param {string} table
   * @param {IDBValidKey} key
   * @returns {Promise<boolean>}
   */
  async delete(table, key) {
    await this.#run(table, "readwrite", (s) => s.delete(key));
    return true;
  }

  /**
   * Delete every row in `table`, keeping the table itself (contrast `clearAll()`, which clears every table).
   * @param {string} table
   * @returns {Promise<boolean>}
   */
  async clear(table) {
    await this.#run(table, "readwrite", (s) => s.clear());
    return true;
  }

  /**
   * List rows. `{ keys: true }` returns just the keys (cheap — no values deserialized), which is
   * what a picker listing filenames wants. `range` is an optional IDBKeyRange.
   * @param {string} table
   * @param {Object} [opts]
   * @param {boolean} [opts.keys]
   * @param {IDBKeyRange|null} [opts.range]
   * @returns {Promise<Array<{key: IDBValidKey, value: *}>|Array<IDBValidKey>>}
   */
  async list(table, { keys = false, range = null } = {}) {
    if (keys) return this.#run(table, "readonly", (s) => s.getAllKeys(range ?? undefined));

    const db = await this.#conn();
    this.#assertTable(db, table);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, "readonly");
      const out = [];
      const req = tx.objectStore(table).openCursor(range ?? undefined);
      req.onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) { out.push({ key: cur.key, value: cur.value }); cur.continue(); }
      };
      req.onerror = () => reject(fail(`Storage.list: cursor on "${table}" failed`, req.error));
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(fail(`Storage.list: transaction on "${table}" failed`, tx.error));
      tx.onabort = () => reject(fail(`Storage.list: transaction on "${table}" aborted`, tx.error));
    });
  }

  /**
   * Iterate `table`'s key→value pairs IN KEY ORDER, transforming each row in place — the general
   * iterate/transform primitive, and the DATA-migration tool (rename/add/drop a field, re-shape a
   * value, prune rows) that helps a version update WITHOUT a schema upgrade: values are verbatim and
   * keys are out-of-line, so a record's shape is not part of the schema. Runs in ONE readwrite
   * transaction. To read without changing anything, return `undefined` every time.
   *
   * `fn(key, value)` returns:
   *   • a value → update the row (skipped when strictly `=== value`, so an unchanged row costs nothing),
   *   • `Storage.DELETE` → delete the row,
   *   • `undefined` → leave the row untouched (a safe default: a callback that forgets to return does
   *     nothing rather than wiping data).
   *
   * @param {string} table
   * @param {(key: IDBValidKey, value: *) => *} fn
   * @returns {Promise<number>} how many rows were updated or deleted
   */
  async map(table, fn) {
    const db = await this.#conn();
    this.#assertTable(db, table);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, "readwrite");
      let changed = 0;
      const req = tx.objectStore(table).openCursor();
      req.onsuccess = (e) => {
        const cur = e.target.result;
        if (!cur) return;
        const next = fn(cur.key, cur.value);
        if (next === Storage.DELETE) { cur.delete(); changed++; }
        else if (next !== undefined && next !== cur.value) { cur.update(next); changed++; }
        cur.continue();
      };
      req.onerror = () => reject(fail(`Storage.map: cursor on "${table}" failed`, req.error));
      tx.oncomplete = () => resolve(changed);
      tx.onerror = () => reject(fail(`Storage.map on "${table}" failed`, tx.error));
      tx.onabort = () => reject(fail(`Storage.map on "${table}" aborted`, tx.error));
    });
  }

  // --- database management --------------------------------------------------------------

  /**
   * Clear every row from every existing store in ONE transaction — a full data wipe that keeps the
   * schema and the version. This is the "refresh completely" for a key-value store: to start over you
   * clear and re-add, no schema teardown needed. (Contrast `clear(table)` for one store, and
   * `destroy()` which deletes the whole database.)
   * @returns {Promise<string[]>} the tables that were cleared
   */
  async clearAll() {
    const db = await this.#conn();
    const names = [...db.objectStoreNames];
    if (!names.length) return [];
    await new Promise((resolve, reject) => {
      const tx = db.transaction(names, "readwrite");
      for (const n of names) tx.objectStore(n).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(fail(`Storage.clearAll on "${this.#name}" failed`, tx.error));
      tx.onabort = () => reject(fail(`Storage.clearAll on "${this.#name}" aborted`, tx.error));
    });
    return names;
  }

  /** Drop the in-memory connection. Data persists; the next call reopens. */
  async close() {
    if (!this.#opening) return;
    const db = await this.#opening.catch(() => null);
    db?.close();
    this.#opening = null;
  }

  /** Delete the entire database. */
  async destroy() {
    await this.close();
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(this.#name);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(fail(`Storage: cannot delete database "${this.#name}"`, req.error));
      req.onblocked = () => reject(fail(
        `Storage: deleting "${this.#name}" is blocked by another open connection`));
    });
  }
}
