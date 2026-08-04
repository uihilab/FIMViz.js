// Storage — the generic key-value store (io/storage.js). See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1/§2.3.
//
// Runs against fake-indexeddb, so this exercises a real IndexedDB implementation rather than a
// mock: structured clone, transaction semantics and version-bumping all behave as in a browser.

import "fake-indexeddb/auto";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Storage } from "../src/io/storage.js";

// Unique DB per test — fake-indexeddb/auto is a shared global namespace.
let _n = 0;
const dbName = (t) => `test_${t}_${++_n}`;

describe("Storage: construction", () => {
  test("requires a database name — the host owns the schema", () => {
    assert.throws(() => new Storage({}), /`name` is required/);
    assert.throws(() => new Storage(), /`name` is required/);
  });

  test("exposes its name", () => {
    assert.equal(new Storage({ name: "abc" }).name, "abc");
  });
});

describe("Storage: table management", () => {
  test("declared tables are created on first open", async () => {
    const db = new Storage({ name: dbName("decl"), version: 1, tables: ["files"] });
    assert.deepEqual(await db.tables(), ["files"]);
  });

  test("createTable/dropTable bump the version at runtime", async () => {
    const db = new Storage({ name: dbName("ddl"), version: 1, tables: ["files"] });
    assert.equal(await db.createTable("files"), false, "existing table → false");
    assert.equal(await db.createTable("notes"), true, "new table → true");
    assert.deepEqual((await db.tables()).sort(), ["files", "notes"]);
    assert.equal(await db.dropTable("notes"), true);
    assert.deepEqual(await db.tables(), ["files"]);
    assert.equal(await db.dropTable("gone"), false, "absent table → false");
  });

  test("operating on an unknown table throws a listing error", async () => {
    const db = new Storage({ name: dbName("unk"), version: 1, tables: ["files"] });
    await assert.rejects(() => db.put("ghost", "k", 1), /does not exist.*Known tables: \[files\]/s);
  });
});

describe("Storage: resetTablesOnUpgrade", () => {
  // Seed an IN-LINE-keyed store directly (raw IndexedDB), simulating a pre-existing database from
  // a host that used to derive keys from the value (e.g. keyPath: "filename") before adopting
  // Storage's out-of-line scheme. A version bump alone leaves such a store untouched — Storage's
  // normal open path only creates tables that don't already exist.
  function seedInLineKeyed(name, version, table, row) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        db.createObjectStore(table, { keyPath: "filename" });
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(table, "readwrite");
        tx.objectStore(table).put(row);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  test("without the option, an existing same-named table is left untouched (and out-of-line put fails)", async () => {
    const name = dbName("noreset");
    await seedInLineKeyed(name, 1, "files", { filename: "a.tif", data: 1 });
    const db = new Storage({ name, version: 2, tables: ["files"] });
    // The in-line-keyed store survives; an out-of-line put (explicit key) against it throws.
    await assert.rejects(() => db.put("files", "a.tif", { data: 2 }));
  });

  test("with the option, an upgrade drops and recreates the table — old rows gone, out-of-line puts work", async () => {
    const name = dbName("reset");
    await seedInLineKeyed(name, 1, "files", { filename: "a.tif", data: 1 });
    const db = new Storage({ name, version: 2, tables: ["files"], resetTablesOnUpgrade: true });
    await db.put("files", "a.tif", { data: 2 });
    assert.deepEqual(await db.get("files", "a.tif"), { data: 2 }, "fresh out-of-line row, not the old in-line one");
  });

  test("harmless on a brand-new database (dropping a table that doesn't exist yet is a no-op)", async () => {
    const db = new Storage({ name: dbName("fresh"), version: 1, tables: ["files"], resetTablesOnUpgrade: true });
    await db.put("files", "k", 1);
    assert.equal(await db.get("files", "k"), 1);
  });

  test("does not re-trigger on a later open at the same version (no data loss on normal reboots)", async () => {
    const name = dbName("stable");
    const first = new Storage({ name, version: 2, tables: ["files"], resetTablesOnUpgrade: true });
    await first.put("files", "k", "v1");
    const second = new Storage({ name, version: 2, tables: ["files"], resetTablesOnUpgrade: true });
    assert.equal(await second.get("files", "k"), "v1", "reopening at the SAME version must not wipe data");
  });
});

describe("Storage: map (ordered iterate/transform, data migration without a schema upgrade)", () => {
  const seed = async (name) => {
    const db = new Storage({ name, version: 1, tables: ["files"] });
    await db.put("files", "a", { v: 1, keep: "a" });
    await db.put("files", "b", { v: 2, keep: "b" });
    await db.put("files", "c", { v: 3, keep: "c" });
    return db;
  };

  test("transforms each row in place and reports the changed count", async () => {
    const db = await seed(dbName("map"));
    const changed = await db.map("files", (key, val) => ({ ...val, v: val.v * 10 }));
    assert.equal(changed, 3);
    assert.deepEqual(await db.get("files", "a"), { v: 10, keep: "a" });
    assert.deepEqual(await db.get("files", "c"), { v: 30, keep: "c" });
  });

  test("iterates in KEY order (a pure read returns undefined and changes nothing)", async () => {
    const db = await seed(dbName("maporder"));
    const seenKeys = [];
    const changed = await db.map("files", (key) => { seenKeys.push(key); return undefined; });
    assert.deepEqual(seenKeys, ["a", "b", "c"], "visited in key order");
    assert.equal(changed, 0, "read-only pass changed nothing");
  });

  test("returning undefined leaves a row untouched; Storage.DELETE removes it", async () => {
    const db = await seed(dbName("mapdel"));
    const changed = await db.map("files", (key, val) =>
      (val.v === 2 ? Storage.DELETE : val.v === 1 ? undefined : { ...val, v: 99 }));
    assert.equal(changed, 2, "one deleted + one updated; the untouched one is not counted");
    assert.deepEqual(await db.get("files", "a"), { v: 1, keep: "a" }, "undefined = unchanged");
    assert.equal(await db.has("files", "b"), false, "DELETE removed it");
    assert.deepEqual(await db.get("files", "c"), { v: 99, keep: "c" });
  });

  test("the key is passed first (prune by key)", async () => {
    const db = await seed(dbName("mapkey"));
    await db.map("files", (key, val) => (key === "b" ? Storage.DELETE : val));
    assert.deepEqual((await db.list("files", { keys: true })).sort(), ["a", "c"]);
  });
});

describe("Storage: clearAll (complete data refresh for a KV store)", () => {
  const seed = async (name, opts = {}) => {
    const db = new Storage({ name, version: 1, tables: ["files", "notes"], ...opts });
    await db.put("files", "a", 1);
    await db.put("notes", "n", 2);
    return db;
  };

  test("clearAll wipes every store but keeps the schema and version", async () => {
    const db = await seed(dbName("clearall"));
    const cleared = await db.clearAll();
    assert.deepEqual(cleared.sort(), ["files", "notes"]);
    assert.equal((await db.list("files")).length, 0);
    assert.equal((await db.list("notes")).length, 0);
    assert.deepEqual((await db.tables()).sort(), ["files", "notes"], "schema intact");
  });

  test("start over = clearAll then re-add (no schema teardown needed)", async () => {
    const db = await seed(dbName("startover"));
    await db.clearAll();
    assert.equal(await db.has("files", "a"), false);
    await db.put("files", "z", 9);
    assert.equal(await db.get("files", "z"), 9, "usable immediately after the wipe");
  });
});

describe("Storage: versionMigrate hook (structural upgrade, inside the versionchange tx)", () => {
  test("runs on the declared-version upgrade; can create a store and copy rows across it", async () => {
    const name = dbName("migrate");
    // v1: one store with a couple of rows.
    const v1 = new Storage({ name, version: 1, tables: ["files"] });
    await v1.put("files", "a", { n: 1 });
    await v1.put("files", "b", { n: 2 });
    await v1.close();

    // v2: add an "archive" store and copy every files row into it — inside the upgrade transaction.
    let sawOld = -1;
    const v2 = new Storage({
      name, version: 2, tables: ["files", "archive"],
      versionMigrate: ({ transaction, oldVersion }) => {
        sawOld = oldVersion;
        const src = transaction.objectStore("files");
        const dst = transaction.objectStore("archive");
        src.openCursor().onsuccess = (e) => {
          const cur = e.target.result;
          if (!cur) return;
          dst.put(cur.value, cur.key);
          cur.continue();
        };
      },
    });
    assert.deepEqual((await v2.tables()).sort(), ["archive", "files"]);
    assert.equal(sawOld, 1, "oldVersion reported to the hook");
    assert.deepEqual(await v2.get("archive", "a"), { n: 1 }, "rows copied in-upgrade");
    assert.deepEqual(await v2.get("archive", "b"), { n: 2 });
    assert.deepEqual(await v2.get("files", "a"), { n: 1 }, "originals preserved");
  });

  test("the hook does NOT fire on createTable's incremental bump", async () => {
    const name = dbName("migrate-bump");
    let fired = 0;
    const db = new Storage({ name, version: 1, tables: ["files"], versionMigrate: () => { fired++; } });
    await db.tables();                     // declared-version open — hook may fire (oldVersion 0)
    const baseline = fired;
    await db.createTable("extra");          // incremental bump — must NOT re-run versionMigrate
    assert.equal(fired, baseline, "createTable's bump does not re-run the versionMigrate hook");
  });
});

describe("Storage: values are stored verbatim", () => {
  const fresh = async () => {
    const db = new Storage({ name: dbName("val"), version: 1, tables: ["t"] });
    await db.tables();
    return db;
  };

  test("ArrayBuffer round-trips as an ArrayBuffer with bytes intact", async () => {
    // The case JSON would silently destroy: JSON.stringify(arrayBuffer) === "{}".
    const db = await fresh();
    await db.put("t", "bin", new Uint8Array([1, 2, 3, 250]).buffer);
    const got = await db.get("t", "bin");
    assert.ok(got instanceof ArrayBuffer);
    assert.deepEqual([...new Uint8Array(got)], [1, 2, 3, 250]);
  });

  test("structured-clone types survive (Date, Map, Set, nested objects)", async () => {
    const db = await fresh();
    await db.put("t", "d", new Date(0));
    await db.put("t", "m", new Map([["k", "v"]]));
    await db.put("t", "s", new Set([1, 2]));
    await db.put("t", "o", { a: 1, nested: { b: [1, 2] } });
    assert.ok((await db.get("t", "d")) instanceof Date);
    assert.equal((await db.get("t", "m")).get("k"), "v");
    assert.ok((await db.get("t", "s")).has(2));
    assert.deepEqual(await db.get("t", "o"), { a: 1, nested: { b: [1, 2] } });
  });

  test("the store does not touch your value (no key derivation, no savedAt)", async () => {
    // The old wrapper derived a key from name||filename||id, deleted those fields, and stamped
    // savedAt into the caller's object. A generic store must not.
    const db = await fresh();
    const input = { name: "x.tif", id: "abc", payload: 1 };
    await db.put("t", "my-key", input);
    const got = await db.get("t", "my-key");
    assert.deepEqual(got, input, "value returned byte-identical");
    assert.ok(!("savedAt" in got), "no timestamp injected");
  });

  test("put requires a key", async () => {
    const db = await fresh();
    await assert.rejects(() => db.put("t", null, 1), /a key is required/);
  });
});

describe("Storage: read semantics", () => {
  test("missing key resolves undefined; has() distinguishes missing from stored-undefined", async () => {
    const db = new Storage({ name: dbName("read"), version: 1, tables: ["t"] });
    await db.put("t", "present", 1);
    assert.equal(await db.get("t", "absent"), undefined);
    assert.equal(await db.has("t", "absent"), false);
    assert.equal(await db.has("t", "present"), true);
  });
});

describe("Storage: table(name) — row ops scoped to one table, not the db-level instance", () => {
  test("put/get/has/delete/clear/list/map all delegate to the matching Storage method, table bound", async () => {
    const db = new Storage({ name: dbName("table"), version: 1, tables: ["t"] });
    const t = db.table("t");
    assert.equal(t.name, "t");

    assert.equal(await t.put("k1", { v: 1 }), "k1");
    assert.deepEqual(await t.get("k1"), { v: 1 });
    assert.equal(await t.has("k1"), true);
    assert.equal(await t.has("missing"), false);

    await t.put("k2", { v: 2 });
    assert.deepEqual(await t.list({ keys: true }), ["k1", "k2"]);

    const changed = await t.map((key, value) => ({ ...value, seen: true }));
    assert.equal(changed, 2);
    assert.deepEqual(await t.get("k1"), { v: 1, seen: true });

    assert.equal(await t.delete("k1"), true);
    assert.equal(await t.has("k1"), false);

    await t.clear();
    assert.deepEqual(await t.list({ keys: true }), []);
  });

  test("is equivalent to calling the db-level methods directly — same table, same rows", async () => {
    const db = new Storage({ name: dbName("table-parity"), version: 1, tables: ["a", "b"] });
    const a = db.table("a");
    await a.put("x", 1);
    assert.equal(await db.get("a", "x"), 1, "written through the handle, readable through the db instance");
    await db.put("b", "y", 2);
    assert.equal(await db.table("b").get("y"), 2, "written through the db instance, readable through a handle");
  });
});

describe("Storage: list", () => {
  const seed = async () => {
    const db = new Storage({ name: dbName("list"), version: 1, tables: ["t"] });
    await db.put("t", "b", 2);
    await db.put("t", "a", 1);
    await db.put("t", "c", 3);
    return db;
  };

  test("returns {key,value} pairs in IDB key order", async () => {
    const rows = await (await seed()).list("t");
    assert.deepEqual(rows, [
      { key: "a", value: 1 }, { key: "b", value: 2 }, { key: "c", value: 3 },
    ]);
  });

  test("{ keys: true } returns keys only", async () => {
    assert.deepEqual(await (await seed()).list("t", { keys: true }), ["a", "b", "c"]);
  });

  test("range filters", async () => {
    const db = await seed();
    assert.deepEqual(await db.list("t", { keys: true, range: IDBKeyRange.bound("a", "b") }),
      ["a", "b"]);
  });

  test("empty table lists empty", async () => {
    const db = new Storage({ name: dbName("empty"), version: 1, tables: ["t"] });
    assert.deepEqual(await db.list("t"), []);
  });
});

describe("Storage: delete / clear", () => {
  test("delete removes one row; clear empties the table", async () => {
    const db = new Storage({ name: dbName("del"), version: 1, tables: ["t"] });
    await db.put("t", "a", 1);
    await db.put("t", "b", 2);
    await db.delete("t", "a");
    assert.equal(await db.has("t", "a"), false);
    assert.equal(await db.has("t", "b"), true);
    await db.clear("t");
    assert.deepEqual(await db.list("t"), []);
  });
});

describe("Storage: durability + lifecycle", () => {
  test("a resolved put has really committed (survives close + reopen)", async () => {
    // Regression: the old io/db.js putFile never awaited transaction completion,
    // so save() resolved before the write committed.
    const name = dbName("commit");
    const db = new Storage({ name, version: 1, tables: ["t"] });
    await db.put("t", "k", "v");
    await db.close();
    const reopened = new Storage({ name });        // no version → opens whatever exists
    assert.equal(await reopened.get("t", "k"), "v");
  });

  test("destroy deletes the database", async () => {
    const name = dbName("destroy");
    const db = new Storage({ name, version: 1, tables: ["t"] });
    await db.put("t", "k", "v");
    await db.destroy();
    assert.deepEqual(await new Storage({ name }).tables(), [], "no tables after destroy");
  });

  test("concurrent calls share one open connection", async () => {
    const db = new Storage({ name: dbName("conc"), version: 1, tables: ["t"] });
    await Promise.all([db.put("t", "a", 1), db.put("t", "b", 2), db.tables()]);
    assert.equal((await db.list("t")).length, 2);
  });
});

describe("Storage: discovery — what exists, at what version", () => {
  // Found in manual browser testing: createTable/dropTable bump the on-disk version as a side effect,
  // so the number a host passed to the constructor goes stale on its own. Reopening at the stale
  // number throws a hard VersionError, and there was no way to ASK first without opening.

  test("version() is null before the database exists, then reports the real version", async () => {
    const name = "disc-" + Math.random().toString(36).slice(2);
    const db = new Storage({ name, version: 1, tables: ["t"] });
    assert.equal(await db.version(), null, "nothing on disk yet");
    await db.put("t", "k", 1);                       // forces the open
    assert.equal(await db.version(), 1);
    await db.destroy();
  });

  test("version() tracks the bumps createTable/dropTable cause behind the host's back", async () => {
    const name = "disc-" + Math.random().toString(36).slice(2);
    const db = new Storage({ name, version: 1, tables: ["t"] });
    await db.put("t", "k", 1);
    assert.equal(await db.version(), 1);
    await db.createTable("extra");
    assert.equal(await db.version(), 2, "createTable bumped it");
    await db.dropTable("extra");
    assert.equal(await db.version(), 3, "dropTable bumped it again");
    assert.equal(db.declaredVersion, 3, "declaredVersion follows the bumps too");
    await db.destroy();
  });

  test("exists() / databases()", async () => {
    const name = "disc-" + Math.random().toString(36).slice(2);
    assert.equal(await Storage.exists(name), false);
    const db = new Storage({ name, version: 1, tables: ["t"] });
    await db.put("t", "k", 1);
    assert.equal(await Storage.exists(name), true);
    const found = (await Storage.databases()).find((d) => d.name === name);
    assert.ok(found && found.version === 1);
    await db.destroy();
    assert.equal(await Storage.exists(name), false, "destroy() removes it from the listing");
  });

  test("a downgrade throws an ACTIONABLE error naming the way out", async () => {
    const name = "disc-" + Math.random().toString(36).slice(2);
    const v3 = new Storage({ name, version: 3, tables: ["t"] });
    await v3.put("t", "k", 1);
    await v3.close();
    const stale = new Storage({ name, version: 2, tables: ["t"] });
    await assert.rejects(() => stale.put("t", "x", 1), (e) => {
      assert.match(e.message, /NEWER version already exists/);
      assert.match(e.message, /Storage\.exists|db\.version\(\)/, "names the check to run");
      assert.match(e.message, /omit `version`|destroy/, "names the ways out");
      return true;
    });
    await new Storage({ name, tables: ["t"] }).destroy();
  });

  test("omitting `version` attaches to whatever exists — the safe open", async () => {
    const name = "disc-" + Math.random().toString(36).slice(2);
    const v5 = new Storage({ name, version: 5, tables: ["t"] });
    await v5.put("t", "k", "survives");
    await v5.close();
    const any = new Storage({ name, tables: ["t"] });     // no version
    assert.equal(await any.get("t", "k"), "survives");
    assert.equal(await any.version(), 5);
    await any.destroy();
  });
});
