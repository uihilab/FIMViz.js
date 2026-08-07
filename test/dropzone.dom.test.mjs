// createDropzone — dropping and browsing for files, BLACK BOX.
//
// The engine already takes a File through `fim.addDataset`, so what is worth testing here is the DOM
// contract around it, which is where the mistakes live: cancelling `dragover` (without it the browser
// navigates away and the drop handler never runs), counting dragenter/dragleave so the highlight does
// not flicker over child nodes, and filtering `dataTransfer.items` so a dragged link does not arrive
// as a null file.
//
// Plus the loading policy: one bad file must not take the rest down with it.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let dom, UI;

beforeEach(async () => {
  dom = new JSDOM("<!doctype html><body><div id='host'></div></body>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.navigator ??= dom.window.navigator;
  UI = await import("../src/ui/dropzone.js");
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  dom.window.close();
});

const host = () => document.getElementById("host");
const file = (name, body = "x") => new dom.window.File([body], name);

/** A FimMap stand-in recording what it was asked to load. `fail` names files that should throw. */
function fakeFim({ fail = [] } = {}) {
  const datasets = [], layers = [];
  return {
    datasets, layers,
    async addDataset(f, opts) {
      if (fail.includes(f.name)) throw new Error(`cannot parse ${f.name}`);
      const ds = { name: opts?.name ?? f.name, __ds: true };
      datasets.push(ds);
      return ds;
    },
    async addLayer(ds) { const l = { ds, __layer: true }; layers.push(l); return l; },
  };
}

/**
 * A drag event jsdom does not implement. `dataTransfer` is a plain stand-in exposing only what the
 * widget reads, and `defaultPrevented` is what the dragover assertions turn on.
 */
function dragEvent(type, { items, files } = {}) {
  const e = new dom.window.Event(type, { bubbles: true, cancelable: true });
  e.dataTransfer = {
    dropEffect: "",
    ...(items ? { items } : {}),
    ...(files ? { files } : {}),
  };
  return e;
}

const fileItem = (f) => ({ kind: "file", getAsFile: () => f });
const stringItem = () => ({ kind: "string", getAsFile: () => null });

describe("dropzone: mounting", () => {
  test("mounts a labelled, focusable target", () => {
    const z = UI.createDropzone(host(), { add: "none" });
    assert.equal(z.el.getAttribute("data-fim-ui"), "dropzone");
    assert.equal(z.el.getAttribute("tabindex"), "0");
    assert.match(z.el.textContent, /Drop a file here/);
    assert.equal(z.el.parentElement, host());
  });

  test("a custom label replaces the default", () => {
    assert.match(UI.createDropzone(host(), { add: "none", label: "Add a raster" }).el.textContent,
      /Add a raster/);
  });

  test("browse mounts a hidden file input, filtered to the accepted types", () => {
    const z = UI.createDropzone(host(), { add: "none" });
    const input = z.el.querySelector("input[type=file]");
    assert.ok(input);
    assert.equal(input.style.display, "none");
    assert.equal(input.multiple, true);
    assert.match(input.accept, /\.tif/);
    assert.match(input.accept, /\.geojson/);
  });

  test("browse:false leaves the input out and open() is a harmless no-op", () => {
    const z = UI.createDropzone(host(), { add: "none", browse: false });
    assert.equal(z.el.querySelector("input[type=file]"), null);
    assert.doesNotThrow(() => z.open());
  });

  // Adding needs a map; reporting does not. Saying so at construction beats failing on the first drop.
  test("adding without a fim is refused up front, naming the way out", () => {
    assert.throws(() => UI.createDropzone(host(), {}), /\{ fim \} is required.*add:'none'/);
    assert.doesNotThrow(() => UI.createDropzone(host(), { add: "none" }));
  });

  test("a bad target is a clear error", () => {
    assert.throws(() => UI.createDropzone("#nope", { add: "none" }), /not found/);
  });
});

describe("dropzone: the drag contract", () => {
  // THE bug this widget exists to not have. Without preventDefault on dragover the browser takes its
  // default action for a dropped file — navigating away to display it — and `drop` never fires.
  test("dragover is cancelled, and asks for a copy cursor", () => {
    const z = UI.createDropzone(host(), { add: "none" });
    const e = dragEvent("dragover");
    z.el.dispatchEvent(e);
    assert.equal(e.defaultPrevented, true, "an uncancelled dragover means the drop never happens");
    assert.equal(e.dataTransfer.dropEffect, "copy");
  });

  test("dragenter highlights, dragleave clears", () => {
    const z = UI.createDropzone(host(), { add: "none" });
    z.el.dispatchEvent(dragEvent("dragenter"));
    assert.ok(z.el.hasAttribute("data-over"));
    z.el.dispatchEvent(dragEvent("dragleave"));
    assert.equal(z.el.hasAttribute("data-over"), false);
  });

  // dragenter/dragleave fire for every descendant crossed, so a naive pair flickers as the pointer
  // moves over the label or the hidden input.
  test("nested enter/leave pairs do not flicker the highlight", () => {
    const z = UI.createDropzone(host(), { add: "none" });
    z.el.dispatchEvent(dragEvent("dragenter"));      // the zone
    z.el.dispatchEvent(dragEvent("dragenter"));      // a child, bubbling
    z.el.dispatchEvent(dragEvent("dragleave"));      // leaving the child
    assert.ok(z.el.hasAttribute("data-over"), "still inside the zone");
    z.el.dispatchEvent(dragEvent("dragleave"));      // leaving the zone
    assert.equal(z.el.hasAttribute("data-over"), false);
  });

  test("a stray dragleave cannot drive the counter negative", () => {
    const z = UI.createDropzone(host(), { add: "none" });
    z.el.dispatchEvent(dragEvent("dragleave"));
    z.el.dispatchEvent(dragEvent("dragleave"));
    z.el.dispatchEvent(dragEvent("dragenter"));
    assert.ok(z.el.hasAttribute("data-over"), "one enter must still light it up");
  });

  test("drop is cancelled and clears the highlight", async () => {
    const z = UI.createDropzone(host(), { add: "none" });
    z.el.dispatchEvent(dragEvent("dragenter"));
    const e = dragEvent("drop", { items: [fileItem(file("a.tif"))] });
    z.el.dispatchEvent(e);
    assert.equal(e.defaultPrevented, true);
    assert.equal(z.el.hasAttribute("data-over"), false);
  });
});

describe("dropzone: loading", () => {
  const settle = () => new Promise((r) => setTimeout(r, 0));

  test("a dropped file becomes a dataset AND a layer by default", async () => {
    const fim = fakeFim();
    const loaded = [];
    const z = UI.createDropzone(host(), { fim, onLoad: (r, f) => loaded.push(f.name) });
    z.el.dispatchEvent(dragEvent("drop", { items: [fileItem(file("flood.tif"))] }));
    await settle();
    assert.deepEqual(fim.datasets.map((d) => d.name), ["flood.tif"]);
    assert.equal(fim.layers.length, 1);
    assert.deepEqual(loaded, ["flood.tif"]);
  });

  test("add:'dataset' stops short of the map; add:'none' loads nothing at all", async () => {
    const fim = fakeFim();
    const got = [];
    const z = UI.createDropzone(host(), { fim, add: "dataset", onLoad: (r) => got.push(r) });
    await z.load([file("a.tif")]);
    assert.equal(fim.layers.length, 0);
    assert.equal(got[0].__ds, true);

    const fim2 = fakeFim();
    const raw = [];
    await UI.createDropzone(host(), { add: "none", onLoad: (r) => raw.push(r) }).load([file("b.tif")]);
    assert.equal(fim2.datasets.length, 0);
    assert.equal(raw[0].name, "b.tif", "the File itself comes back");
  });

  // The policy that matters: five files dropped, one bad, four should still land.
  test("one bad file reports and the rest still load", async () => {
    const fim = fakeFim({ fail: ["broken.tif"] });
    const ok = [], bad = [];
    const z = UI.createDropzone(host(), { fim, onLoad: (r, f) => ok.push(f.name), onError: (e, f) => bad.push(f.name) });
    const results = await z.load([file("a.tif"), file("broken.tif"), file("c.tif")]);
    assert.deepEqual(ok, ["a.tif", "c.tif"]);
    assert.deepEqual(bad, ["broken.tif"]);
    assert.equal(results.length, 3, "one result per file, in order");
    assert.match(results[1].error.message, /cannot parse/);
  });

  test("files load in the order dropped, not whichever finished first", async () => {
    const order = [];
    const fim = fakeFim();
    const realAdd = fim.addDataset.bind(fim);
    fim.addDataset = async (f, o) => {
      // The first file is slow: parallel loading would let the second overtake it.
      await new Promise((r) => setTimeout(r, f.name === "slow.tif" ? 25 : 0));
      order.push(f.name);
      return realAdd(f, o);
    };
    await UI.createDropzone(host(), { fim }).load([file("slow.tif"), file("fast.tif")]);
    assert.deepEqual(order, ["slow.tif", "fast.tif"], "stacking order must match the drop order");
  });

  test("an unaccepted extension is refused with a message, not silently skipped", async () => {
    const fim = fakeFim();
    const bad = [];
    const z = UI.createDropzone(host(), { fim, onError: (e, f) => bad.push(e.message) });
    const results = await z.load([file("notes.docx"), file("ok.tif")]);
    assert.equal(fim.datasets.length, 1, "only the acceptable one loaded");
    assert.match(bad[0], /notes\.docx: not an accepted file type/);
    assert.equal(results.length, 2);
  });

  test("accept may be a predicate, or empty to accept everything", async () => {
    const fim = fakeFim();
    await UI.createDropzone(host(), { fim, accept: (f) => f.name.startsWith("keep") })
      .load([file("keep-1.tif"), file("drop-1.tif")]);
    assert.deepEqual(fim.datasets.map((d) => d.name), ["keep-1.tif"]);

    const fim2 = fakeFim();
    await UI.createDropzone(host(), { fim: fim2, accept: [] }).load([file("anything.weird")]);
    assert.equal(fim2.datasets.length, 1);
  });

  test("onDrop sees the raw files first, onDone the whole outcome", async () => {
    const fim = fakeFim({ fail: ["b.tif"] });
    const seen = { dropped: null, done: null };
    const z = UI.createDropzone(host(), {
      fim, onDrop: (fs) => { seen.dropped = fs.map((f) => f.name); }, onDone: (r) => { seen.done = r; },
    });
    await z.load([file("a.tif"), file("b.tif")]);
    assert.deepEqual(seen.dropped, ["a.tif", "b.tif"]);
    assert.equal(seen.done.length, 2);
    assert.ok(seen.done[0].result && seen.done[1].error);
  });

  test("busy is set while loading and cleared after — including on failure", async () => {
    const fim = fakeFim({ fail: ["x.tif"] });
    const z = UI.createDropzone(host(), { fim });
    const p = z.load([file("x.tif")]);
    assert.equal(z.busy, true);
    assert.ok(z.el.hasAttribute("data-busy"));
    await p;
    assert.equal(z.busy, false);
    assert.equal(z.el.hasAttribute("data-busy"), false);
  });

  test("an empty drop does nothing at all", async () => {
    const fim = fakeFim();
    let dropped = false;
    const z = UI.createDropzone(host(), { fim, onDrop: () => { dropped = true; } });
    assert.deepEqual(await z.load([]), []);
    assert.equal(dropped, false);
    z.el.dispatchEvent(dragEvent("drop", { items: [] }));
    await settle();
    assert.equal(fim.datasets.length, 0);
  });
});

describe("dropzone: what arrives on a drop", () => {
  const settle = () => new Promise((r) => setTimeout(r, 0));

  // dataTransfer.items also carries dragged text and links, which have no file behind them.
  test("a dragged link is filtered out rather than arriving as a null file", async () => {
    const fim = fakeFim();
    const z = UI.createDropzone(host(), { fim });
    z.el.dispatchEvent(dragEvent("drop", { items: [stringItem(), fileItem(file("a.tif")), stringItem()] }));
    await settle();
    assert.deepEqual(fim.datasets.map((d) => d.name), ["a.tif"]);
  });

  test("a dataTransfer with only `files` (no items) still works", async () => {
    const fim = fakeFim();
    const z = UI.createDropzone(host(), { fim });
    z.el.dispatchEvent(dragEvent("drop", { files: [file("a.tif")] }));
    await settle();
    assert.deepEqual(fim.datasets.map((d) => d.name), ["a.tif"]);
  });

  test("multiple:false takes only the first of several", async () => {
    const fim = fakeFim();
    const z = UI.createDropzone(host(), { fim, multiple: false });
    z.el.dispatchEvent(dragEvent("drop", { items: [fileItem(file("a.tif")), fileItem(file("b.tif"))] }));
    await settle();
    assert.deepEqual(fim.datasets.map((d) => d.name), ["a.tif"]);
  });

  test("a drop with no dataTransfer at all is survived", async () => {
    const fim = fakeFim();
    const z = UI.createDropzone(host(), { fim });
    const e = new dom.window.Event("drop", { bubbles: true, cancelable: true });
    assert.doesNotThrow(() => z.el.dispatchEvent(e));
    await settle();
    assert.equal(fim.datasets.length, 0);
  });
});

describe("dropzone: browse and teardown", () => {
  test("clicking the zone opens the picker; clicking the picker does not recurse", () => {
    const z = UI.createDropzone(host(), { add: "none" });
    const picker = z.el.querySelector("input[type=file]");
    let opens = 0;
    picker.click = () => { opens++; };
    z.el.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    assert.equal(opens, 1);

    // The picker lives inside the zone, so its own click bubbles back up. Re-opening from that would
    // be an infinite loop in a real browser.
    const inner = new dom.window.Event("click", { bubbles: true });
    picker.dispatchEvent(inner);
    assert.equal(opens, 1, "the picker's own click must not reopen it");
  });

  test("Enter and Space open the picker, so it is reachable from the keyboard", () => {
    const z = UI.createDropzone(host(), { add: "none" });
    let opens = 0;
    z.el.querySelector("input[type=file]").click = () => { opens++; };
    for (const key of ["Enter", " "]) {
      const e = new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      z.el.dispatchEvent(e);
      assert.equal(e.defaultPrevented, true, `${key} is handled, not left to scroll the page`);
    }
    assert.equal(opens, 2);
  });

  test("destroy() removes the element and stops responding to drags", async () => {
    const fim = fakeFim();
    const z = UI.createDropzone(host(), { fim });
    const el = z.el;
    z.destroy();
    assert.equal(host().querySelectorAll("[data-fim-ui=dropzone]").length, 0);
    el.dispatchEvent(dragEvent("drop", { items: [fileItem(file("a.tif"))] }));
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(fim.datasets.length, 0, "a destroyed zone must not keep loading files");
  });

  test("DROP_EXTENSIONS covers what parseSource can actually detect", () => {
    for (const ext of [".tif", ".geojson", ".kml", ".kmz", ".shp", ".csv", ".nc", ".grib2", ".zarr"]) {
      assert.ok(UI.DROP_EXTENSIONS.includes(ext), `${ext} should be accepted`);
    }
  });
});
