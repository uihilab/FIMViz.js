// create() injects the widget markup into the container — scoped to THAT container.
//
// The check used to be `document.getElementById("map")`, which returns the first #map on the whole
// page. Mounting a second widget therefore found the FIRST widget's map div, concluded the markup
// was already present, and injected nothing — leaving the second container empty. With a registered
// runtime that means the entire widget is missing, silently.
//
// It is the one lookup the DOM-scoping migration never reached, because it runs before the FimMap
// that would scope it exists. Boot itself fails in jsdom (no real map provider); injection happens
// synchronously inside create() before any of that, so it is observable either way.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom, mount, registerRuntime, FimViz;

const html = "<!doctype html><body><div id='a'></div><div id='b'></div></body>";

beforeEach(async () => {
  dom = new JSDOM(html, { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.navigator ??= dom.window.navigator;
  // Fresh module state per test: mount.js holds the runtime registry and fimViz.js the default app.
  const mod = await import("../src/package/mount.js?markup=" + Math.random());
  ({ mount, registerRuntime, FimViz } = mod);
  // Cache-busting mount.js gives a fresh runtime registry, but its `./fimViz.js` import resolves to
  // the ONE cached module — so the default app (and its "already mounted" guard) leaks between
  // tests. Reset it at the boundary, never BETWEEN the two mounts of a test: reset() destroys the
  // mounted map, and destroy() un-injects the markup, so the first widget's #map would be gone
  // before the second mount looked for it — the exact condition under test. The second widget gets
  // `isolated: true` (its own app) instead, which is how two live widgets actually coexist.
  FimViz.reset?.();
});

afterEach(() => {
  FimViz?.reset?.();
  delete globalThis.window;
  delete globalThis.document;
  dom.window.close();
});

// Boot needs a real map SDK; we only care about what landed in the DOM first. `provider` is
// mandatory (mount() throws config-invalid before touching the container without one), so it is
// part of the minimum viable config here, not incidental.
const mountQuiet = (target, opts = {}) => {
  const p = mount(target, { provider: "google", apiKey: "k", ...opts });
  p.then(undefined, () => {});
  return p;
};

describe("markup injection is scoped to the mount container", () => {
  test("a bare mount injects #map into its own container", async () => {
    await mountQuiet("a").catch(() => {});
    const a = document.getElementById("a");
    assert.ok(a.querySelector('[id="map"]'), "the container it was given must receive the map div");
  });

  test("a SECOND container also gets markup, even though the page already has a #map", async () => {
    await mountQuiet("a").catch(() => {});
    assert.ok(document.getElementById("a").querySelector('[id="map"]'), "precondition: #a is set up");

    // #a is still mounted and still holds a #map. The bug: a document-wide lookup finds THAT one
    // and skips injecting into #b entirely.
    await mountQuiet("b", { isolated: true }).catch(() => {});
    assert.ok(document.getElementById("b").querySelector('[id="map"]'),
      "the second widget must not be left empty because an unrelated container already has a #map");
  });

  test("a container that ALREADY holds #map is left alone (host-supplied DOM)", async () => {
    const a = document.getElementById("a");
    a.innerHTML = '<div id="map" data-mine="1"></div>';
    await mountQuiet("a").catch(() => {});
    assert.equal(a.querySelector('[id="map"]').dataset.mine, "1",
      "host-provided widget DOM must survive — injection would overwrite it");
  });

  test("a #map elsewhere on the page does not count as this container's markup", async () => {
    document.body.insertAdjacentHTML("beforeend", '<div id="map" data-stray="1"></div>');
    await mountQuiet("a").catch(() => {});
    const injected = document.getElementById("a").querySelector('[id="map"]');
    assert.ok(injected, "an unrelated #map must not suppress injection");
    assert.notEqual(injected.dataset.stray, "1");
  });

  test("with a runtime registered, the second container gets the runtime's markup", async () => {
    registerRuntime({ bootstrap: async () => {}, markup: '<div id="map"></div><div id="panel"></div>' });
    await mountQuiet("a").catch(() => {});
    await mountQuiet("b", { isolated: true }).catch(() => {});
    assert.ok(document.getElementById("b").querySelector('[id="panel"]'),
      "the whole widget — not just #map — went missing when injection was skipped");
  });
});
