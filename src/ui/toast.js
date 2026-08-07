// ui/toast.js — a standalone DOM toast widget (docs/PACKAGE_ROADMAP.md §5).
//
// HEADLESS RULE: this module is NOT imported by any engine core module — the engine never calls UI.
// It touches the DOM only INSIDE functions (never at import time), and uses bare globals (document,
// setTimeout) not `window.foo()`, so importing the barrel stays Node-safe and the headless guard
// (test/hostEvents.test.mjs) still passes. Wiring it to the engine's `notify` bus is the HOST's job
// (connectToast) — the engine emits, this subscribes.

const LEVEL_BG = { info: "#2563eb", success: "#16a34a", warn: "#d97706", error: "#dc2626" };

/**
 * Create a toast container and a `show()` to push messages into it.
 * @param {Element|null} [root] - where to mount (default document.body)
 * @param {{ corner?: 'br'|'bl'|'tr'|'tl' }} [opts]
 * @returns {{ show: (msg: string, o?: {level?: string, timeout?: number}) => Element, clear: () => void, destroy: () => void, el: Element }}
 */
export function createToast(root = null, opts = {}) {
  const doc = root?.ownerDocument || document;
  const container = doc.createElement("div");
  container.className = "fim-toast-container";
  container.setAttribute("data-fim-ui", "toast");
  const corner = opts.corner || "br";
  const vpos = corner[0] === "t" ? { top: "16px" } : { bottom: "16px" };
  const hpos = corner[1] === "l" ? { left: "16px" } : { right: "16px" };
  Object.assign(container.style, {
    position: "fixed", zIndex: 99999, display: "flex", flexDirection: "column",
    gap: "8px", pointerEvents: "none", ...vpos, ...hpos,
  });
  (root || doc.body).appendChild(container);

  const timers = new Set();

  function show(message, { level = "info", timeout = 4000 } = {}) {
    const t = doc.createElement("div");
    t.className = `fim-toast fim-toast-${level}`;
    t.textContent = message;
    Object.assign(t.style, {
      pointerEvents: "auto", padding: "8px 12px", borderRadius: "6px", color: "#fff",
      font: "13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif", maxWidth: "320px",
      boxShadow: "0 2px 8px rgba(0,0,0,.3)", background: LEVEL_BG[level] || LEVEL_BG.info,
      opacity: "0", transition: "opacity .15s ease",
    });
    container.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = "1"; });
    if (timeout > 0) {
      const id = setTimeout(() => dismiss(t), timeout);
      timers.add(id);
    }
    return t;
  }

  function dismiss(t) {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 160);
  }

  function clear() { container.replaceChildren(); }
  function destroy() { timers.forEach(clearTimeout); timers.clear(); container.remove(); }

  return { show, clear, destroy, el: container };
}

// Two engine warnings that describe something the USER can see going wrong, and that until now only
// reached `console.warn` — where nobody looking at the map would find them. They are phrased here
// rather than in the engine because the engine emits structured payloads, not sentences.
const WARNINGS = {
  "layer:raster-oversized": ({ datasetName, plan } = {}) =>
    `${datasetName || "This raster"} is too large for one image — drawn downsampled` +
    (plan?.reason ? ` (${plan.reason})` : ""),
  "layer:crs-unrenderable": ({ datasetName, crs, provider } = {}) =>
    `${datasetName || "This layer"} is ${crs || "in a CRS"}, which ${provider || "this provider"} ` +
    "cannot draw — reproject it to EPSG:4326 first",
};

/**
 * Subscribe a toast to the engine's user-facing host events (the host wires this — the engine never
 * reaches for the UI). `notify` maps its levels (info/warn/error/success) onto toast levels;
 * `layer:raster-oversized` and `layer:crs-unrenderable` become warnings, since both describe
 * something visibly wrong with what was just drawn.
 *
 * @param {import('../package/fimMap.js').FimMap|{on: Function, off?: Function}} fim
 * @param {ReturnType<typeof createToast>} [toast]
 * @param {{ warnings?: boolean }} [opts] - `warnings:false` keeps this to `notify` only
 * @returns {ReturnType<typeof createToast> & { off: () => void }} the toast, plus an unsubscribe
 */
export function connectToast(fim, toast, { warnings = true } = {}) {
  const t = toast || createToast();
  const subs = [];
  const sub = (evt, fn) => { fim.on(evt, fn); subs.push([evt, fn]); };

  sub("notify", ({ message, level } = {}) => {
    if (!message) return;
    const lvl = level === "warn" ? "warn" : level === "error" ? "error" : level === "success" ? "success" : "info";
    t.show(message, { level: lvl });
  });

  if (warnings) {
    for (const [evt, phrase] of Object.entries(WARNINGS)) {
      sub(evt, (payload) => t.show(phrase(payload), { level: "warn", timeout: 8000 }));
    }
  }

  // `off` rather than replacing the toast handle, so `connectToast(fim, createToast())` keeps
  // returning something the caller can still call `show()` on.
  t.off = () => { for (const [evt, fn] of subs) fim.off?.(evt, fn); subs.length = 0; };
  return t;
}
