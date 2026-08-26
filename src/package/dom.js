// dom.js — instance-scoped DOM lookups.
//
// Two widgets mounted on one page both carry `#layer-panel`, `#lp-tab-metrics` and the rest.
// `document.getElementById(id)` returns only the first match in the document, so with duplicate ids
// the second instance's code drives the first instance's DOM. Scoping every lookup to the owning
// FimMap root removes the ambiguity.
//
// docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.2 covers the migration onto `scoped(root)`. A
// migrated UI module holds one bound scope for its own root and never touches the global
// `document`.

// Rewrites `#foo` to `[id="foo"]`. Some engines optimize a bare `#id` selector through
// document.getElementById, taking the first match in the document and then filtering by subtree,
// which finds nothing when ids repeat across instances. The attribute form behaves the same
// everywhere. Only an exact `#identifier` is rewritten, because rewriting inside a compound
// selector risks mangling a quoted attribute value. FimMap.$() documents the same rule.
const ID_ONLY = /^#([A-Za-z_][\w-]*)$/;
export function scopedSel(sel) {
  const m = ID_ONLY.exec(String(sel).trim());
  return m ? `[id="${m[1]}"]` : sel;
}

// A bound scope for one root: `{ byId, $, $$ }`. A null root falls back to `document`, which is the
// single-instance default while call sites are still being given a root. Once every call site
// passes a real FimMap root, the fallback goes dead.
export function scoped(root) {
  const base = root || (typeof document !== "undefined" ? document : null);
  return {
    root: base,
    byId: (id) => (base ? base.querySelector(`[id="${id}"]`) : null),
    $: (sel) => (base ? base.querySelector(scopedSel(sel)) : null),
    $$: (sel) => (base ? [...base.querySelectorAll(scopedSel(sel))] : []),
  };
}

// ---- Ambient active scope, for host code only ------------------------------------------------
//
// No module under src/ calls setActiveDom or reads domId, domQs or domQsa. mount.js leaves the
// ambient scope alone and says so, the engine emits instead of writing host markup, and
// test/hostEvents.test.mjs enforces the rule: it fails if any engine module outside this file
// mentions one of the five. These stay for host code that has not moved onto scoped(root) yet.
//
// `_active` is one module-level variable, so a host using it inherits one hazard. Two widgets
// booting means the second setActiveDom call replaces the first. Host code that awaits and then
// calls domId gets whichever root booted last, and it gets a wrong element rather than an error.
// Pass an explicit root to scoped(root) to avoid that; that is what the ui/ factories do.
let _active = scoped(null);

// Points the ambient scope at a mount root. Host code calls this; nothing in src/ does.
export function setActiveDom(root) { _active = scoped(root); }

// Reset to document (teardown / tests).
export function resetActiveDom() { _active = scoped(null); }

// Replacements for document.getElementById, querySelector and querySelectorAll, resolved against
// the active scope. They carry a `dom` prefix rather than `el`/`qs` because `el` collides with the
// `const el = ...` locals throughout the subsystems that were migrating. A bare `#id` given to
// domQs or domQsa is rewritten to `[id="..."]` (see scopedSel). Host code only, per the note above.
export function domId(id) { return _active.byId(id); }
export function domQs(sel) { return _active.$(sel); }
export function domQsa(sel) { return _active.$$(sel); }
