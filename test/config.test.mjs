// config.js — URL resolution seam (proxiedUrl / resolveUrl hook) + the one process-global setting
// (gdalPath). See docs/DECISIONS_TRADEOFFS_INCOMPLETE_ITEMS.md §1.1 "the app policy leaking into
// library code" pattern. Headless: everything here is callable without a DOM.

import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  proxiedUrl, defaultResolveUrl, isLoopbackHost, newConfig,
  getGdalPath, setGdalPath, resetGdalPath,
} from "../src/package/config.js";

describe("defaultResolveUrl — the library's neutral fallback", () => {
  // Deployment-specific URL rules belong to a host's own config, not the library. The library's
  // default is IDENTITY: it cannot know a host's CORS story, and guessing caused a real bug (a dev
  // server on http://[::1] read as production).
  test("returns the URL unchanged", () => {
    for (const u of ["https://hydroinformatics.tulane.edu/x.tif", "https://iowawis.org/a",
                     "https://data.example/f.json", "assets/local.tif"]) {
      assert.equal(defaultResolveUrl(u), u);
    }
  });

  test("the library ships no deployment topology", () => {
    const src = readFileSync(new URL("../src/package/config.js", import.meta.url), "utf8");
    for (const host of ["tulane", "iowawis", "hydroinformatics"]) {
      // Comments may explain the seam; control flow must not branch on a host.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ 	]*\/\/.*$/gm, "");
      assert.equal(code.includes(host), false, `config.js still references "${host}" in code`);
    }
  });
});

describe("isLoopbackHost — dev-server detection", () => {
  // REGRESSION: this was `origin.includes("localhost")`, so a dev server reached over IPv6
  // (http://[::1]:3001 — what the browser navigates to when the dev host resolves to IPv6 first)
  // was classified as PRODUCTION. Same-origin URLs were then fetched unproxied and the browser blocked
  // them on CORS, with the failure surfacing far from its cause.
  test("IPv6 loopback is dev, with or without URL brackets", () => {
    assert.equal(isLoopbackHost("[::1]"), true, "a URL hostname carries the brackets");
    assert.equal(isLoopbackHost("::1"), true);
  });

  test("the whole 127.0.0.0/8 block is loopback, not just 127.0.0.1", () => {
    for (const h of ["127.0.0.1", "127.0.0.2", "127.1.2.3"]) {
      assert.equal(isLoopbackHost(h), true, h);
    }
  });

  test("localhost and the reserved .localhost TLD (RFC 2606)", () => {
    assert.equal(isLoopbackHost("localhost"), true);
    assert.equal(isLoopbackHost("LOCALHOST"), true, "hostnames are case-insensitive");
    assert.equal(isLoopbackHost("app.localhost"), true);
  });

  test("real hosts are not loopback", () => {
    for (const h of ["hydroinformatics.tulane.edu", "example.com", "127.0.0.1.evil.com",
                     "notlocalhost.com", "localhost.evil.com", ""]) {
      assert.equal(isLoopbackHost(h), false, h);
    }
  });

  test("null/undefined do not throw", () => {
    assert.equal(isLoopbackHost(undefined), false);
    assert.equal(isLoopbackHost(null), false);
  });
});

describe("proxiedUrl — pure, instance-safe URL resolution", () => {
  test("a config's resolveUrl hook is used, and receives (url, cfg)", () => {
    let seen;
    const cfg = newConfig({ resolveUrl: (url, c) => { seen = { url, hasCfg: !!c }; return "REWRITTEN:" + url; } });
    assert.equal(proxiedUrl("https://anything/x", cfg), "REWRITTEN:https://anything/x");
    assert.deepEqual(seen, { url: "https://anything/x", hasCfg: true });
  });

  test("without a hook, falls back to identity", () => {
    assert.equal(proxiedUrl("https://iowawis.org/a", newConfig({ corsProxy: "https://p/" })),
      "https://iowawis.org/a");
  });

  test("no cfg at all → identity (safe default)", () => {
    assert.equal(proxiedUrl("https://data.gov/x"), "https://data.gov/x");
  });

  test("two configs never interfere — instance-safe, no shared pointer", () => {
    // This is the whole point of retiring the ambient config pointer: the resolver comes from the
    // config passed in, so a second app can never make the first read the wrong rule.
    const a = newConfig({ resolveUrl: (u) => "A:" + u });
    const b = newConfig({ resolveUrl: (u) => "B:" + u });
    assert.equal(proxiedUrl("x", a), "A:x");
    assert.equal(proxiedUrl("x", b), "B:x");
    assert.equal(proxiedUrl("x", a), "A:x", "a's rule is unchanged by b existing");
  });
});

describe("gdalPath — the one genuinely process-global setting", () => {
  afterEach(() => resetGdalPath());

  test("defaults to the pinned gdal3.js CDN", () => {
    assert.match(getGdalPath(), /gdal3\.js@/);
  });

  test("setGdalPath overrides; falsy values are ignored (GDAL is a per-page singleton)", () => {
    setGdalPath("https://self-host/gdal");
    assert.equal(getGdalPath(), "https://self-host/gdal");
    setGdalPath("");           assert.equal(getGdalPath(), "https://self-host/gdal");
    setGdalPath(undefined);    assert.equal(getGdalPath(), "https://self-host/gdal");
    setGdalPath(null);         assert.equal(getGdalPath(), "https://self-host/gdal");
  });

  test("resetGdalPath restores the built-in default", () => {
    setGdalPath("https://x/");
    resetGdalPath();
    assert.match(getGdalPath(), /gdal3\.js@/);
  });
});

describe("the ambient whole-config pointer is retired", () => {
  // The prior design kept `_active`/getConfig/setActiveConfig — a shared pointer to whichever app
  // booted last, a real last-writer-wins hazard. It is gone: gdalPath (process-global anyway) is the
  // only module-level runtime value, and everything else is read per-instance via `fim.config`.
  test("no engine module references getConfig / setConfig / setActiveConfig", () => {
    const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
    const files = [];
    (function walk(dir) {
      for (const e of readdirSync(dir)) {
        if (e === "vendor" || e === "arcgislink.js") continue;
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (e.endsWith(".js")) files.push(full);
      }
    })(SRC);

    const banned = ["getConfig", "setActiveConfig", "setConfig"];
    const offenders = [];
    for (const f of files) {
      const rel = f.slice(SRC.length + 1).split(sep).join("/");
      const src = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
      for (const name of banned) {
        if (new RegExp(`\\b${name}\\b`).test(src)) offenders.push(`${rel} → ${name}`);
      }
    }
    assert.deepEqual(offenders, [],
      "the ambient config pointer is retired; use fim.config per-instance:\n  " + offenders.join("\n  "));
  });
});
