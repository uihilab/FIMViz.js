// FimMap delegated actions + scoped $() — the Phase 4 seam that replaces the window.* bridge.
// See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.2/§3.2.
//
// Runs in jsdom. This does NOT cover google.maps rendering — that still needs a real browser.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let FimMap;

// FimMap imports script.js (map boot) at module load; jsdom globals must exist first.
beforeEach(async () => {
  dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.navigator ??= dom.window.navigator;
  ({ FimMap } = await import("../src/package/fimMap.js"));
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  dom.window.close();
});

// A FimMap needs an `app` only for config/events; actions and $() need just the root.
const mapWith = (html) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  const fim = new FimMap({ app: { _release() {} }, root });
  fim.bindActions();
  return { fim, root };
};
// Minimal FimViz stand-in: a FimMap only reaches up for config, storage and the event bus.
const fakeApp = () => ({ _release() {}, config: {}, on() {}, off() {}, emit() {} });
const click = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));
const change = (el) => el.dispatchEvent(new window.Event("change", { bubbles: true }));

describe("FimMap: scoped $()", () => {
  test("duplicate ids across instances resolve to each instance's own element", () => {
    // THE multi-instance property: two widgets both carry e.g. #layer-panel, and each must see
    // its own. document.getElementById cannot express this — that is why all ~604 call sites move.
    const a = mapWith(`<span id="dup">A</span>`);
    const b = mapWith(`<span id="dup">B</span>`);
    assert.equal(a.fim.$("#dup").textContent, "A");
    assert.equal(b.fim.$("#dup").textContent, "B", "the SECOND instance must not resolve to the first");
    assert.equal(document.getElementById("dup").textContent, "A",
      "getElementById sees only the first — the bug this replaces");
  });

  test("known engine quirk: a raw scoped '#id' querySelector is unreliable under nwsapi/jsdom", () => {
    // Documents WHY $() rewrites '#id' to '[id="..."]'. nwsapi optimizes id selectors through
    // document.getElementById (first match document-wide), then filters to the subtree → null.
    // Real browsers resolve this correctly, so this assertion pins jsdom's behaviour, not the web's.
    const { root } = mapWith(`<span id="dup">A</span>`);
    mapWith(`<span id="dup">B</span>`);
    const second = document.body.lastChild;
    assert.equal(second.querySelector("#dup"), null, "jsdom: raw #id fails to scope");
    assert.equal(second.querySelector('[id="dup"]').textContent, "B", "attribute form scopes correctly");
    assert.ok(root);
  });

  test("compound selectors scope", () => {
    const { fim } = mapWith(`<div class="p"><i class="x">1</i></div>`);
    assert.equal(fim.$(".p .x").textContent, "1");
  });

  test("$$ returns an array scoped to the root", () => {
    const { fim } = mapWith(`<i class="x"></i><i class="x"></i>`);
    mapWith(`<i class="x"></i>`);   // a second instance's elements must not leak in
    assert.equal(fim.$$(".x").length, 2);
  });

  test("$ returns null for a miss rather than throwing", () => {
    const { fim } = mapWith(`<i></i>`);
    assert.equal(fim.$("#nope"), null);
    assert.deepEqual(fim.$$(".nope"), []);
  });
});

describe("FimMap: delegated actions", () => {
  test("click dispatch is the default", () => {
    const { fim, root } = mapWith(`<button data-action="go">go</button>`);
    let hits = 0;
    fim.registerAction("go", () => hits++);
    click(root.querySelector("button"));
    assert.equal(hits, 1);
  });

  test("data-args passes typed JSON arguments", () => {
    // Mirrors widget.html's load_inundation_nid(30301, 0, 'scenario')
    const { fim, root } = mapWith(
      `<button data-action="nid" data-args='[30301, 0, "scenario"]'>x</button>`);
    let got;
    fim.registerAction("nid", (...a) => { got = a; });
    click(root.querySelector("button"));
    assert.deepEqual(got, [30301, 0, "scenario"], "numbers stay numbers");
  });

  test("`this` is the element — inline-handler semantics preserved", () => {
    // Mirrors countySelectorChange(this) and `this.checked = false`.
    const { fim, root } = mapWith(
      `<input type="checkbox" data-action="pick" data-on="change">`);
    let self;
    fim.registerAction("pick", function () { self = this; this.checked = false; });
    const el = root.querySelector("input");
    el.checked = true;
    change(el);
    assert.equal(self, el);
    assert.equal(el.checked, false, "handler can mutate the element via `this`");
  });

  test("data-on gates the event type — a checkbox must not fire twice", () => {
    // A checkbox emits click AND change; dispatching on both would double-fire every handler.
    const { fim, root } = mapWith(
      `<input type="checkbox" data-action="once" data-on="change">`);
    let hits = 0;
    fim.registerAction("once", () => hits++);
    const el = root.querySelector("input");
    click(el);      // ignored: declares change
    change(el);
    assert.equal(hits, 1);
  });

  test("dispatch works from a nested target (closest)", () => {
    const { fim, root } = mapWith(`<button data-action="go"><span>label</span></button>`);
    let hits = 0;
    fim.registerAction("go", () => hits++);
    click(root.querySelector("span"));
    assert.equal(hits, 1);
  });

  test("actions are per-instance — two widgets do not cross-fire", () => {
    const a = mapWith(`<button data-action="shared">A</button>`);
    const b = mapWith(`<button data-action="shared">B</button>`);
    const hits = [];
    a.fim.registerAction("shared", () => hits.push("a"));
    b.fim.registerAction("shared", () => hits.push("b"));
    click(a.root.querySelector("button"));
    click(b.root.querySelector("button"));
    assert.deepEqual(hits, ["a", "b"], "each root dispatches only its own");
  });
});

describe("FimMap: action resolution + transition", () => {
  test("falls back to window[name] so migration is incremental", () => {
    const { fim, root } = mapWith(`<button data-action="legacyFn">x</button>`);
    let hit = false;
    window.legacyFn = () => { hit = true; };
    click(root.querySelector("button"));
    assert.equal(hit, true, "unmigrated window.* handlers keep working");
  });

  test("the instance registry wins over the window fallback", () => {
    const { fim, root } = mapWith(`<button data-action="both">x</button>`);
    const hits = [];
    window.both = () => hits.push("window");
    fim.registerAction("both", () => hits.push("registry"));
    click(root.querySelector("button"));
    assert.deepEqual(hits, ["registry"]);
  });

  test("an unknown action warns and does not throw", () => {
    const { root } = mapWith(`<button data-action="ghost">x</button>`);
    const warns = [];
    const orig = console.warn;
    console.warn = (m) => warns.push(String(m));
    click(root.querySelector("button"));
    console.warn = orig;
    assert.equal(warns.length, 1);
    assert.match(warns[0], /no action "ghost"/);
  });

  test("malformed data-args warns and does not invoke", () => {
    const { fim, root } = mapWith(`<button data-action="go" data-args="{nope">x</button>`);
    let hits = 0;
    fim.registerAction("go", () => hits++);
    const orig = console.warn;
    console.warn = () => {};
    click(root.querySelector("button"));
    console.warn = orig;
    assert.equal(hits, 0, "a bad payload must not reach the handler");
  });

  test("registerAction rejects non-functions", () => {
    const { fim } = mapWith(`<i></i>`);
    assert.throws(() => fim.registerAction("x", "notafn"), /must be a function/);
  });

  test("registerActions bulk-registers", () => {
    const { fim } = mapWith(`<i></i>`);
    fim.registerActions({ a() {}, b() {} });
    assert.deepEqual(fim.actionNames.sort(), ["a", "b"]);
  });

  test("bindActions is idempotent — no double dispatch", () => {
    const { fim, root } = mapWith(`<button data-action="go">x</button>`);
    let hits = 0;
    fim.registerAction("go", () => hits++);
    fim.bindActions();
    fim.bindActions();
    click(root.querySelector("button"));
    assert.equal(hits, 1);
  });
});

describe("FimMap owns its map reference (not the runtime's singleton)", () => {
  // BLOCKER 2: `get map()` used to delegate to the runtime's getMountedMap() — a module-level
  // `let map` in the app's script.js. Every FimMap on a page would therefore report the SAME map,
  // whichever booted last. mount.js now calls _adoptMap() once boot resolves.
  test("two instances report their own maps, not a shared one", () => {
    const a = new FimMap({ app: fakeApp(), root: dom.window.document.body });
    const b = new FimMap({ app: fakeApp(), root: dom.window.document.body });
    a._adoptMap({ id: "map-a" });
    b._adoptMap({ id: "map-b" });

    assert.equal(a.map.id, "map-a");
    assert.equal(b.map.id, "map-b", "a second instance must not inherit the first's map");
  });

  test("the adopted map wins over the injected fallback accessor", () => {
    const fim = new FimMap({
      app: fakeApp(),
      root: dom.window.document.body,
      getMap: () => ({ id: "singleton" }),
    });
    assert.equal(fim.map.id, "singleton", "fallback applies before boot reports a map");
    fim._adoptMap({ id: "mine" });
    assert.equal(fim.map.id, "mine", "once adopted, the instance's own ref is authoritative");
  });

  test("fim.map is the ONLY map accessor — the v0 getMap() alias is gone", () => {
    const fim = new FimMap({ app: fakeApp(), root: dom.window.document.body });
    fim._adoptMap({ id: "m" });
    assert.equal(fim.map.id, "m");
    assert.equal(fim.getMap, undefined, "one name for one concept: getMap() was removed, not deprecated");
    fim.destroy();
    assert.equal(fim.map, null, "teardown drops the reference");
  });

  test("config resolves through the owning app, not the ambient pointer", () => {
    const app = fakeApp();
    app.config = { apiKey: "instance-key" };
    const fim = new FimMap({ app, root: dom.window.document.body });
    assert.equal(fim.config.apiKey, "instance-key");
  });
});
