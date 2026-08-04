// dom.js — instance-scoped DOM lookups.
//
// THE seam the single-document multi-instance migration routes through. Two widgets mounted on
// one page both carry `#layer-panel`, `#lp-tab-metrics`, etc. `document.getElementById(id)` returns
// only the FIRST match document-wide, so with duplicate ids the second instance's code drives the
// first instance's DOM. Every `document.getElementById(id)` / `document.querySelector('#id')`
// becomes a lookup scoped to the owning FimMap root, and the ambiguity disappears.
//
// The ~604 call sites (see docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.2) migrate onto `scoped(root)` — a UI module holds
// one bound scope for its instance root and never touches the global `document` again.

// `#foo` -> `[id="foo"]`. Some engines optimize a bare `#id` selector by routing through
// document.getElementById (first match document-wide, then subtree filter) — which finds NOTHING
// when ids repeat across instances. The attribute form is engine-independent. Only an exact
// `#identifier` is rewritten; compound selectors pass through untouched (rewriting inside them
// risks mangling quoted attribute values). Mirrors the rule documented on FimMap.$().
const ID_ONLY = /^#([A-Za-z_][\w-]*)$/;
export function scopedSel(sel) {
  const m = ID_ONLY.exec(String(sel).trim());
  return m ? `[id="${m[1]}"]` : sel;
}

// A bound scope for one root: `{ byId, $, $$ }`. `root == null` falls back to `document` — the
// transitional single-instance default while call sites are still being threaded a root; the
// end state passes a real FimMap root everywhere and the fallback becomes dead.
export function scoped(root) {
  const base = root || (typeof document !== "undefined" ? document : null);
  return {
    root: base,
    byId: (id) => (base ? base.querySelector(`[id="${id}"]`) : null),
    $: (sel) => (base ? base.querySelector(scopedSel(sel)) : null),
    $$: (sel) => (base ? [...base.querySelectorAll(scopedSel(sel))] : []),
  };
}

// ---- Ambient active scope ------------------------------------------------------------------
//
// The big stateful subsystems (layers/*, io/*, package/script.js) are not yet per-instance objects,
// so they can't hold their own root the way the ui/ factories do. Until they are, they resolve DOM
// through this ambient active scope — the same pattern as the event sink (reportError()): the app whose
// map is booting sets it (mount.js → setActiveDom(container)), and the ~452 migrated call sites read
// it via el()/qs()/qsa() instead of document.getElementById. Single-instance: scoped to the one
// container (correct). Multi-instance: set per boot, with the known across-await caveat those
// subsystems inherit, for code that is not a per-instance object.
let _active = scoped(null);

// Set the ambient scope to a mount root. Called at boot with the widget container.
export function setActiveDom(root) { _active = scoped(root); }

// Reset to document (teardown / tests).
export function resetActiveDom() { _active = scoped(null); }

// Migration aliases for `document.getElementById` / `querySelector` / `querySelectorAll`, resolved
// against the active scope. Named with a `dom` prefix (not `el`/`qs`) because `el` collides with
// the pervasive `const el = ...` locals in the subsystems being migrated. A bare `#id` passed to
// domQs/domQsa is rewritten to `[id="..."]` (see scopedSel).
export function domId(id) { return _active.byId(id); }
export function domQs(sel) { return _active.$(sel); }
export function domQsa(sel) { return _active.$$(sel); }
