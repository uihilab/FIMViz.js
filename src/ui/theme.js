// ui/theme.js — the kit's three themes, and the one stylesheet that carries their tokens.
//
// WHY TOKENS AND NOT THREE COPIES OF EVERY RULE. Each module owns its own structural CSS (layout,
// spacing, type scale) and injects it once under its own id. Colour is the only part that varies by
// theme, so colour lives in custom properties defined here and every module rule reads them through
// `var(--fim-…)`. A new theme is a token block, not a second copy of six stylesheets that then drift.
//
// THREE THEMES:
//   'normal'  the default — light, for a page with a white background
//   'dark'    the palette the kit shipped with before themes existed
//   'none'    no CSS at all; the kit emits its markup and the host styles it by class name
//
// The `pretty` boolean is the older spelling and still works: `pretty: false` means 'none', and
// `pretty: true` (or nothing) means 'normal'. It is kept because it is in every published example,
// but `theme` is the option to reach for, and an explicit `theme` always wins.
//
// A themed element carries BOTH `.fim-pretty` and `data-fim-theme="<name>"`. The class is what the
// older selectors and tests key on; the attribute is what the token blocks below key on, and what
// lets one panel be dark while another beside it is light.

/** The theme names this module understands. @type {string[]} */
export const THEMES = ["normal", "dark", "none"];

const TOKENS = `
[data-fim-theme="normal"]{
  --fim-bg:#ffffff; --fim-fg:#1a1d21; --fim-muted:#5b6570;
  --fim-line:#d8dde3; --fim-line-hover:#9aa4ae;
  --fim-field:#ffffff; --fim-hover:#f4f6f8; --fim-sel:#eef4fb;
  --fim-accent:#2f6fb0; --fim-accent-fg:#ffffff; --fim-accent-soft:rgba(47,111,176,.10);
}
[data-fim-theme="dark"]{
  --fim-bg:#161b22; --fim-fg:#e6edf3; --fim-muted:#8b949e;
  --fim-line:#2b3440; --fim-line-hover:#3d4756;
  --fim-field:#0f1216; --fim-hover:#0f1216; --fim-sel:#132135;
  --fim-accent:#58a6ff; --fim-accent-fg:#08111f; --fim-accent-soft:rgba(88,166,255,.08);
}
`;

/**
 * The theme a factory should use, from whichever of the two options the caller passed.
 *
 * @param {{ theme?: string, pretty?: boolean }} [opts]
 * @returns {'normal'|'dark'|'none'}
 */
export function resolveTheme({ theme, pretty } = {}) {
  if (theme != null) {
    if (!THEMES.includes(theme)) {
      throw new Error(`theme: unknown theme '${theme}' — expected one of ${THEMES.join(", ")}`);
    }
    return theme;
  }
  return pretty === false ? "none" : "normal";
}

/**
 * Injects the token stylesheet once per document. A no-op for 'none', so a host that themes nothing
 * gets no engine CSS at all.
 * @param {Document} doc
 * @param {string} theme
 * @returns {void}
 */
export function injectTokens(doc, theme) {
  if (theme === "none" || !doc || doc.getElementById("fim-theme-css")) return;
  const s = doc.createElement("style");
  s.id = "fim-theme-css";
  s.textContent = TOKENS;
  (doc.head || doc.body || doc.documentElement).appendChild(s);
}

/**
 * Marks `el` as themed: the legacy `.fim-pretty` class plus the `data-fim-theme` attribute the token
 * blocks key on. Returns the class string so a caller can build `className` in one expression.
 * @param {Element} el
 * @param {string} base - the module's own class, i.e. 'fim-layer-panel'
 * @param {string} theme
 * @returns {string}
 */
export function applyTheme(el, base, theme) {
  const cls = theme === "none" ? base : `${base} fim-pretty`;
  if (el) {
    el.className = cls;
    if (theme === "none") el.removeAttribute("data-fim-theme");
    else el.setAttribute("data-fim-theme", theme);
  }
  return cls;
}
