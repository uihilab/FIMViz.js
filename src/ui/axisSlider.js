// ui/axisSlider.js — scrub a Dataset's selection axis (PACKAGE_ROADMAP.md §5, §8).
//
// A selection axis is a list of entries — timesteps, stages, levels, ensemble members — each of which
// `ds.select(coord)` resolves into a child Dataset, lazily. Scrubbing is therefore nothing more than
// `layer.setSources([ds.select(coord)])`; there is no bespoke temporal machinery anywhere, and this
// widget works on any axis the model can express, not just time.
//
// Two things it exists to get right, both learned from the hand-rolled version in
// examples/temporal-netcdf.html: a stale frame must never win, and a play loop must wait for the
// frame it asked for. Headless rule: DOM only inside functions; no `window.foo()`.

const PRETTY_CSS = `
.fim-axis{font:12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e6edf3}
.fim-axis .fim-axis-row{display:flex;gap:7px;align-items:center}
.fim-axis input[type=range]{flex:1;min-width:0;accent-color:#58a6ff}
.fim-axis button{background:transparent;color:#58a6ff;border:1px solid #2b3440;border-radius:6px;padding:3px 9px;font-size:12px;cursor:pointer;font-family:inherit}
.fim-axis button:disabled{opacity:.45;cursor:not-allowed}
.fim-axis .fim-axis-out{display:flex;justify-content:space-between;gap:8px;margin-top:4px;color:#8b949e}
.fim-axis .fim-axis-label{color:#e6edf3;font-family:ui-monospace,Menlo,monospace}
.fim-axis .fim-axis-none{color:#8b949e;font-style:italic}
`;

function injectStyles(doc) {
  if (doc.getElementById("fim-axis-css")) return;
  const s = doc.createElement("style");
  s.id = "fim-axis-css"; s.textContent = PRETTY_CSS;
  (doc.head || doc.body || doc.documentElement).appendChild(s);
}

/**
 * The axis a slider should drive, by index or by name. Accepts either the multi-axis `axes` array or
 * the 1-D `axis` sugar, so it works on every Dataset the model can produce.
 * @param {*} ds @param {number|string} which @returns {Object|null}
 */
export function axisOf(ds, which = 0) {
  const axes = ds?.axes?.length ? ds.axes : (ds?.axis ? [ds.axis] : []);
  if (!axes.length) return null;
  const ax = typeof which === "number" ? axes[which] : axes.find((a) => a?.name === which);
  return ax?.entries?.length ? ax : null;
}

/** The default readout for one entry: whatever the materializer labelled it, else its coord. */
export function axisEntryLabel(entry) {
  if (!entry) return "";
  const m = entry.meta || {};
  return String(m.label ?? m.time ?? m.name ?? entry.coord);
}

/**
 * Mount a slider that scrubs `layer` along one of its Dataset's selection axes.
 *
 * ```js
 * const slider = createAxisSlider('#time', { layer, onChange: (e, i) => console.log(i, e.meta) });
 * ```
 *
 * **A dataset with no axis is not an error** — the slider renders disabled with a note, because a
 * host mounting this against "whatever the user loaded" should not have to pre-check. `axis` reads
 * null in that case.
 *
 * @param {Element|string} root
 * @param {{ layer: import('../package/layer.js').Layer,
 *           dataset?: *,
 *           axis?: number|string,
 *           index?: number,
 *           label?: (entry: Object, i: number, axis: Object) => string,
 *           play?: boolean,
 *           interval?: number,
 *           loop?: boolean,
 *           pretty?: boolean,
 *           onChange?: (entry: Object, i: number, child: *) => void,
 *           onError?: (err: Error, i: number) => void }} opts
 * @returns {{ el: Element, index: number, entry: Object|null, axis: Object|null, length: number,
 *             playing: boolean, goto: (i: number) => Promise<void>, next: () => Promise<void>,
 *             prev: () => Promise<void>, play: () => void, pause: () => void,
 *             update: () => void, destroy: () => void }}
 */
export function createAxisSlider(root, {
  layer, dataset, axis = 0, index = 0, label = axisEntryLabel,
  play: showPlay = true, interval = 600, loop = true, pretty = true,
  onChange, onError,
} = {}) {
  if (!layer) throw new Error("createAxisSlider: { layer } is required");
  const host = typeof root === "string" ? document.querySelector(root) : root;
  if (!host) throw new Error("createAxisSlider: target element not found");
  const doc = host.ownerDocument || document;

  const ds = dataset || layer.dataset;
  const ax = axisOf(ds, axis);
  const entries = ax?.entries ?? [];

  const el = doc.createElement("div");
  el.className = "fim-axis" + (pretty ? " fim-pretty" : "");
  el.setAttribute("data-fim-ui", "axis-slider");
  if (pretty) injectStyles(doc);
  host.appendChild(el);

  const mk = (tag, props = {}, kids = []) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "attrs") for (const [a, av] of Object.entries(v)) e.setAttribute(a, av);
      else e[k] = v;
    }
    for (const k of kids) e.append(k);
    return e;
  };

  if (!entries.length) {
    el.append(mk("span", {
      className: "fim-axis-none",
      textContent: `no selection axis on "${ds?.name ?? "this dataset"}" — nothing to scrub`,
    }));
    const noop = async () => {};
    return {
      el, index: 0, entry: null, axis: null, length: 0, playing: false,
      goto: noop, next: noop, prev: noop, play: () => {}, pause: () => {},
      update: () => {}, destroy: () => el.remove(),
    };
  }

  let i = Math.min(Math.max(0 | index, 0), entries.length - 1);
  let seq = 0;            // the stale-frame guard — see goto()
  let timer = null;
  let dead = false;

  const prevBtn = mk("button", { type: "button", textContent: "‹", title: "previous", attrs: { "data-axis": "prev" } });
  const nextBtn = mk("button", { type: "button", textContent: "›", title: "next", attrs: { "data-axis": "next" } });
  const playBtn = mk("button", { type: "button", textContent: "▶", title: "play", attrs: { "data-axis": "play" } });
  const range = mk("input", {
    type: "range", min: 0, max: entries.length - 1, step: 1, value: String(i),
    attrs: { "data-axis": "range", "aria-label": ax.name || "axis" },
  });
  const readout = mk("span", { className: "fim-axis-label", attrs: { "data-axis": "label" } });
  const counter = mk("span", { attrs: { "data-axis": "counter" } });

  const row = mk("div", { className: "fim-axis-row" },
    [prevBtn, range, nextBtn, ...(showPlay ? [playBtn] : [])]);
  el.append(row, mk("div", { className: "fim-axis-out" }, [readout, counter]));

  function paint() {
    range.value = String(i);
    readout.textContent = label(entries[i], i, ax);
    counter.textContent = `${i + 1} / ${entries.length}${ax.unit ? ` ${ax.unit}` : ""}`;
    // Only meaningful when not looping — with loop on, both ends stay live.
    prevBtn.disabled = !loop && i === 0;
    nextBtn.disabled = !loop && i === entries.length - 1;
    playBtn.textContent = timer ? "❚❚" : "▶";
    playBtn.title = timer ? "pause" : "play";
  }

  /**
   * Swap the layer onto one axis entry.
   *
   * The token is the load-bearing part. Dragging the slider fires far faster than a grid decodes, so
   * several swaps are in flight at once and they do NOT finish in order — without this, the last
   * frame to *resolve* wins rather than the last one the user asked for, and the map ends up showing
   * a timestep nobody selected, with nothing to trigger a correction.
   */
  async function goto(next) {
    if (dead) return;
    const target = Math.min(Math.max(0 | next, 0), entries.length - 1);
    i = target;
    paint();                       // the readout moves NOW; the pixels catch up
    const mine = ++seq;
    const entry = entries[target];
    try {
      const child = ds.select(entry.coord, { axis });   // lazy — no decode, no second fetch
      await layer.setSources([child]);
      if (dead || mine !== seq) return;                 // a newer frame overtook this one
      onChange?.(entry, target, child);
    } catch (err) {
      if (dead || mine !== seq) return;
      console.error("[fimviz] axis slider frame failed:", err);
      onError?.(err, target);
    }
  }

  // Self-scheduling rather than setInterval: each frame is queued only once the previous one has
  // LANDED. On a source that decodes slower than the interval, a fixed timer would queue frames
  // faster than they can be drawn and the playhead would run away from the map.
  function tick() {
    if (dead || !timer) return;
    const at = i;
    const last = entries.length - 1;
    if (!loop && at === last) return pause();
    goto(at === last ? 0 : at + 1).then(() => {
      if (!dead && timer) timer = setTimeout(tick, interval);
    });
  }

  function play() {
    if (dead || timer) return;
    timer = setTimeout(tick, interval);
    paint();
  }
  function pause() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!dead) paint();
  }

  // The value is read BEFORE pause(), because pause() repaints and paint() writes `i` back into the
  // range. Reading afterwards got the pre-drag position every time — in a browser the thumb would
  // snap back to where it started on every drag.
  range.addEventListener("input", () => { const v = Number(range.value); pause(); goto(v); });
  prevBtn.addEventListener("click", () => { pause(); goto(i === 0 ? entries.length - 1 : i - 1); });
  nextBtn.addEventListener("click", () => { pause(); goto(i === entries.length - 1 ? 0 : i + 1); });
  playBtn.addEventListener("click", () => (timer ? pause() : play()));

  paint();

  return {
    el,
    get index() { return i; },
    get entry() { return entries[i]; },
    get axis() { return ax; },
    get length() { return entries.length; },
    get playing() { return timer !== null; },
    goto,
    next: () => goto(i === entries.length - 1 ? 0 : i + 1),
    prev: () => goto(i === 0 ? entries.length - 1 : i - 1),
    play, pause,
    update: paint,
    destroy() {
      dead = true;
      pause();
      seq++;                        // anything still in flight is now stale and will drop itself
      el.remove();
    },
  };
}
