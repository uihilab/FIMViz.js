// mount() returns a Promise<FimMap> — the forgot-to-await guard.
//
// `create()` glues .on/.off onto the returned promise so a caller can subscribe to 'ready'/'error'
// before it resolves. That makes the promise look PARTLY like a FimMap, which is exactly what makes
//     const fim = mount('#el', opts);   // no await
//     fim.addLayer(...)                 // → "fim.addLayer is not a function"
// a natural mistake — docs/usage/APP_STARTUP.md already called it "a common mistake", but nothing
// caught it. These accessors throw with the cause AND the fix.
//
// Runs in jsdom. The boot itself is expected to fail here (no real map provider); the guard lives on
// the promise returned synchronously, so it is observable regardless of how boot ends.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom;
let mount;

beforeEach(async () => {
  dom = new JSDOM("<!doctype html><body><div id='el'></div></body>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.navigator ??= dom.window.navigator;
  ({ mount } = await import("../src/package/mount.js"));
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  dom.window.close();
});

// Start a mount and neutralize the boot rejection — we are testing the promise's shape, not boot.
function pending() {
  const p = mount("el", { apiKey: "" });
  p.then(undefined, () => {});
  return p;
}

describe("mount(): the un-awaited promise", () => {
  test("is still a real thenable", () => {
    const p = pending();
    assert.equal(typeof p.then, "function");
    assert.equal(typeof p.catch, "function");
  });

  test(".on()/.off() DO work before it resolves (the whole reason it is decorated)", () => {
    const p = pending();
    assert.equal(typeof p.on, "function");
    assert.equal(p.on("ready", () => {}), p, "chainable");
    assert.equal(p.off("ready", () => {}), p);
  });

  test("every FimMap instance member throws naming the cause AND the fix", () => {
    const p = pending();
    for (const k of ["addLayer", "addDataset", "getLayer", "layers", "datasets", "map", "storage",
                     "destroy", "$", "$$"]) {
      assert.throws(() => p[k], (e) => {
        assert.match(e.message, /returns a Promise<FimMap>/, `${k}: names the cause`);
        assert.match(e.message, /has not been awaited/, `${k}: names the mistake`);
        assert.match(e.message, /const fim = await mount/, `${k}: shows the fix`);
        assert.ok(e.message.includes(`\`.${k}\``), `${k}: names the member`);
        return true;
      }, `accessing .${k} on an un-awaited mount() must throw`);
    }
  });

  test("the guard is on the PROMISE only — awaiting yields an unguarded FimMap", async () => {
    // Boot fails without a usable provider, so assert on the rejection rather than a live map: the
    // point is that the guard belongs to the promise object and is not inherited by the result.
    const p = mount("el", { apiKey: "" });
    await assert.rejects(() => p);
    const { FimMap } = await import("../src/package/fimMap.js");
    assert.equal(typeof FimMap.prototype.addLayer, "function",
      "the real FimMap keeps ordinary, non-throwing members");
  });

  test("the guarded properties are configurable (never wedge a debugger/inspector)", () => {
    const p = pending();
    const d = Object.getOwnPropertyDescriptor(p, "addLayer");
    assert.equal(d.configurable, true);
    assert.equal(typeof d.get, "function");
  });
});
