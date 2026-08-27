// ui/dropzone.js — drop (or browse for) files and turn them into layers (PACKAGE_ROADMAP.md §5).
//
// The engine's front door is `fim.addDataset(source)`, which already takes a File. So this widget is
// mostly about the DOM contract around it, which is where the mistakes live — see the notes on
// `dragover` and the enter/leave counter below. Loading is per file: one bad file reports and the
// rest still land, because dropping five files and getting nothing because the third was a text file
// is a worse outcome than four layers and one message.
//
// Headless rule: DOM only inside functions; no `window.foo()`.

import { resolveTheme, injectTokens, applyTheme } from "./theme.js";
const PRETTY_CSS = `
.fim-drop[data-fim-theme]{display:flex;align-items:center;justify-content:center;gap:8px;min-height:74px;padding:12px;
  border:1.5px dashed var(--fim-line);border-radius:8px;color:var(--fim-muted);background:transparent;cursor:pointer;
  font:13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;transition:border-color .12s,background .12s}
.fim-drop[data-fim-theme]:hover{border-color:var(--fim-line-hover)}
.fim-drop[data-fim-theme][data-over]{border-color:var(--fim-accent);background:var(--fim-accent-soft);color:var(--fim-fg)}
.fim-drop[data-fim-theme][data-busy]{opacity:.6;cursor:progress}
`;

function injectStyles(doc) {
  if (doc.getElementById("fim-drop-css")) return;
  const s = doc.createElement("style");
  s.id = "fim-drop-css"; s.textContent = PRETTY_CSS;
  (doc.head || doc.body || doc.documentElement).appendChild(s);
}

/** Every extension `parseSource` can detect, for the default `accept` filter and the browse dialog. */
export const DROP_EXTENSIONS = [
  ".tif", ".tiff", ".geotiff",
  ".geojson", ".json", ".kml", ".kmz", ".zip", ".shp", ".csv", ".xyz", ".txt",
  ".nc", ".nc3", ".nc4", ".cdf", ".netcdf", ".grib", ".grib2", ".grb", ".grb2", ".zarr",
];

const extOf = (name) => {
  const m = /(\.[^.\\/]+)$/.exec(String(name || "").toLowerCase());
  return m ? m[1] : "";
};

/**
 * Mount a drop target that loads files through `fim.addDataset`.
 *
 * ```js
 * createDropzone('#drop', { fim, onLoad: (layer) => layer.fit() });
 * ```
 *
 * @param {Element|string} root
 * @param {{ fim?: import('../package/fimMap.js').FimMap,
 *           add?: 'layer'|'dataset'|'none',
 *           accept?: string[]|((file: File) => boolean),
 *           multiple?: boolean,
 *           browse?: boolean,
 *           label?: string,
 *           pretty?: boolean,
 *           onDrop?: (files: File[]) => void,
 *           onLoad?: (result: *, file: File, i: number) => void,
 *           onError?: (err: Error, file: File) => void,
 *           onDone?: (results: Array<{file: File, result?: *, error?: Error}>) => void }} [opts]
 * @returns {{ el: Element, open: () => void, load: (files: Iterable<File>) => Promise<Array>,
 *             busy: boolean, destroy: () => void }}
 */
export function createDropzone(root, {
  fim, add = "layer", accept = DROP_EXTENSIONS, multiple = true, browse = true,
  label = "Drop a file here, or click to browse", theme, pretty = true,
  onDrop, onLoad, onError, onDone,
} = {}) {
  const host = typeof root === "string" ? document.querySelector(root) : root;
  if (!host) throw new Error("createDropzone: target element not found");
  if (add !== "none" && !fim) {
    throw new Error(`createDropzone: { fim } is required to add:'${add}' — pass add:'none' to only report files`);
  }
  const doc = host.ownerDocument || document;

  const el = doc.createElement("div");
  const _theme = resolveTheme({ theme, pretty });
  if (_theme !== "none") { injectTokens(doc, _theme); injectStyles(doc); }
  applyTheme(el, "fim-drop", _theme);
  el.setAttribute("data-fim-ui", "dropzone");
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "button");
  el.textContent = label;
  host.appendChild(el);

  let picker = null;
  if (browse) {
    picker = doc.createElement("input");
    picker.type = "file";
    picker.multiple = !!multiple;
    if (Array.isArray(accept) && accept.length) picker.accept = accept.join(",");
    picker.style.display = "none";
    picker.addEventListener("change", () => {
      const files = [...(picker.files || [])];
      picker.value = "";                 // so re-picking the SAME file fires change again
      if (files.length) load(files);
    });
    el.appendChild(picker);
  }

  const accepts = (file) => {
    if (typeof accept === "function") return !!accept(file);
    if (!Array.isArray(accept) || !accept.length) return true;
    return accept.includes(extOf(file.name));
  };

  let busy = false;
  function setBusy(on) {
    busy = on;
    if (on) el.setAttribute("data-busy", ""); else el.removeAttribute("data-busy");
  }

  /**
   * Load files, one result per file.
   *
   * Sequential rather than parallel: `addDataset` on several large GeoTIFFs at once competes for the
   * same decode budget and makes every one of them slower, and the layer stacking order becomes
   * whichever finished first rather than the order they were dropped in.
   */
  async function load(input) {
    const files = [...(input || [])];
    if (!files.length) return [];
    onDrop?.(files);
    setBusy(true);
    const results = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!accepts(file)) {
          const err = new Error(`${file.name}: not an accepted file type`);
          results.push({ file, error: err });
          onError?.(err, file);
          continue;
        }
        try {
          // One try per file: dropping five and getting nothing because the third was a text file is
          // a worse outcome than four layers and one message.
          let result = file;
          if (add !== "none") {
            const ds = await fim.addDataset(file, { name: file.name });
            result = add === "layer" ? await fim.addLayer(ds) : ds;
          }
          results.push({ file, result });
          onLoad?.(result, file, i);
        } catch (err) {
          results.push({ file, error: err });
          console.error(`[fimviz] dropzone: ${file.name} failed`, err);
          onError?.(err, file);
        }
      }
    } finally {
      setBusy(false);
    }
    onDone?.(results);
    return results;
  }

  // A drop target is defined by CANCELLING dragover. Without preventDefault the browser takes the
  // default action for a dropped file — navigating away from the page to display it — and the drop
  // handler never runs at all. This is the single most common way a dropzone silently does nothing.
  const onDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  // dragenter/dragleave fire for every DESCENDANT crossed, not just the zone's own edge, so a naive
  // "highlight on enter, clear on leave" flickers as the pointer moves across the label or the hidden
  // input. Counting depth and clearing only at zero is what makes the highlight steady.
  let depth = 0;
  const onDragEnter = (e) => {
    e.preventDefault();
    if (++depth === 1) el.setAttribute("data-over", "");
  };
  const onDragLeave = () => {
    if (--depth <= 0) { depth = 0; el.removeAttribute("data-over"); }
  };

  const onDropEvent = (e) => {
    e.preventDefault();
    depth = 0;
    el.removeAttribute("data-over");
    const dt = e.dataTransfer;
    if (!dt) return;
    // `items` also carries dragged TEXT and URLs, which have no `.getAsFile()` — filtering by kind is
    // what keeps a dragged link from arriving as a null "file".
    const files = dt.items
      ? [...dt.items].filter((it) => it.kind === "file").map((it) => it.getAsFile()).filter(Boolean)
      : [...(dt.files || [])];
    load(multiple ? files : files.slice(0, 1));
  };

  const onClick = (e) => { if (e.target !== picker) picker?.click(); };
  const onKey = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); picker?.click(); } };

  el.addEventListener("dragover", onDragOver);
  el.addEventListener("dragenter", onDragEnter);
  el.addEventListener("dragleave", onDragLeave);
  el.addEventListener("drop", onDropEvent);
  if (browse) {
    el.addEventListener("click", onClick);
    el.addEventListener("keydown", onKey);
  }

  return {
    el,
    /** Open the file picker programmatically (no-op with `browse:false`). */
    open: () => picker?.click(),
    load,
    get busy() { return busy; },
    destroy() {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDropEvent);
      el.removeEventListener("click", onClick);
      el.removeEventListener("keydown", onKey);
      el.remove();
    },
  };
}
