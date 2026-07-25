import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Typography canon CONTRACT (Mission Z1 / D2) — the test that would have
 * prevented the breakage: components kept emitting canon typo classes
 * (.h1, .page-canon-kicker, .admin-page-header__row, …) while NO runtime CSS
 * defined them anymore (cockpit.css/globals.css became Storybook-only archives
 * and app.css never picked the roles up).
 *
 * Mechanism: for every className literal emitted by the canon header/shell
 * emitters, every CUSTOM (non-Tailwind) class from the explicit canon
 * vocabulary below MUST be defined in the concatenation of the stylesheets the
 * runtime ACTUALLY loads: app.css + its ./ imports (theme.css,
 * legacy-bridge.css, typography.css) + admin-canon.css (loaded by
 * src/app/admin/layout.tsx). Failure names the missing class and the emitter.
 */

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

/** The canon emitters under contract. */
const EMITTERS = [
  "src/components/connect/page-header-base.tsx",
  "src/components/admin/admin-page-shell.tsx",
] as const;

/** Explicit canon vocabulary — exact class names (non-Tailwind). */
const CANON_EXACT = new Set([
  "h1",
  "h1-accent",
  "eyebrow",
  "ct-section-title",
  "ct-metric-caption",
  "ct-bento-label",
  "body-md",
  "ct-prose-md",
  "mono",
]);

/** Explicit canon vocabulary — prefix families (BEM skeletons + page-canon). */
const CANON_PREFIXES = ["page-canon-", "admin-page-header", "product-page-header"];

function isCanonClass(cls: string): boolean {
  return CANON_EXACT.has(cls) || CANON_PREFIXES.some((p) => cls.startsWith(p));
}

/**
 * The runtime CSS bundle: app.css + the ./ files it imports + admin-canon.css.
 * Reads the REAL import list from app.css — if typography.css stops being
 * imported, its classes disappear from the bundle and this contract fails.
 */
function loadRuntimeCssBundle(): { files: string[]; css: string } {
  const entry = "src/styles/app.css";
  const entrySrc = read(entry);
  const files = [entry];
  const chunks = [entrySrc];
  for (const m of entrySrc.matchAll(/@import\s+"\.\/([^"]+\.css)"/g)) {
    if (!m[1]) continue;
    const rel = `src/styles/${m[1]}`;
    files.push(rel);
    chunks.push(read(rel));
  }
  // Loaded by src/app/admin/layout.tsx on every /admin surface.
  const adminCanon = "src/app/admin/admin-canon.css";
  files.push(adminCanon);
  chunks.push(read(adminCanon));
  return { files, css: chunks.join("\n") };
}

/**
 * Extract candidate class names from a component source: every double-quoted
 * string literal, plus template literals — `${rootClass}` (PageHeaderBase BEM
 * namespace) is expanded into BOTH concrete namespaces. Non-class fragments
 * (import paths, prose) are discarded by the canon-vocabulary filter.
 */
function extractEmittedClasses(source: string): Set<string> {
  const out = new Set<string>();
  const addFragment = (fragment: string) => {
    for (const cls of fragment.split(/\s+/)) {
      if (cls) out.add(cls);
    }
  };
  for (const m of source.matchAll(/"([^"\n]+)"/g)) addFragment(m[1] ?? "");
  for (const m of source.matchAll(/`([^`\n]+)`/g)) {
    const raw = m[1] ?? "";
    if (raw.includes("${rootClass}")) {
      addFragment(raw.replaceAll("${rootClass}", "admin-page-header"));
      addFragment(raw.replaceAll("${rootClass}", "product-page-header"));
    } else if (!raw.includes("${")) {
      addFragment(raw);
    }
  }
  return out;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A class is "defined" when `.name` appears as a selector (not a longer name). */
function isDefinedIn(css: string, cls: string): boolean {
  return new RegExp(`\\.${escapeForRegExp(cls)}(?![\\w-])`).test(css);
}

describe("typography canon contract — runtime CSS bundle", () => {
  const bundle = loadRuntimeCssBundle();

  it("app.css imports the three canon stylesheets", () => {
    expect(bundle.files).toContain("src/styles/theme.css");
    expect(bundle.files).toContain("src/styles/legacy-bridge.css");
    expect(bundle.files).toContain("src/styles/typography.css");
  });

  for (const emitter of EMITTERS) {
    it(`every canon class emitted by ${emitter} is defined in the runtime CSS`, () => {
      const emitted = [...extractEmittedClasses(read(emitter))]
        .filter(isCanonClass)
        .sort();
      // Sanity: the emitters DO emit canon vocabulary (extraction not broken).
      expect(emitted.length).toBeGreaterThan(0);

      const missing = emitted.filter((cls) => !isDefinedIn(bundle.css, cls));
      expect(
        missing,
        `Classes canon émises par ${emitter} SANS définition CSS runtime ` +
          `(bundle réel : ${bundle.files.join(" + ")}) :\n  .${missing.join("\n  .")}\n` +
          `→ définir la classe dans src/styles/typography.css (ou corriger l'émetteur).`,
      ).toEqual([]);
    });
  }

  it("the canon vocabulary itself is fully defined (incl. .mono / .tabular)", () => {
    const required = [
      ...CANON_EXACT,
      "tabular",
      "page-canon-kicker",
      "page-canon-rule",
      "page-canon-toolbar",
      "admin-page-header",
      "product-page-header",
    ];
    const missing = required.filter((cls) => !isDefinedIn(bundle.css, cls));
    expect(
      missing,
      `Vocabulaire canon sans définition CSS runtime :\n  .${missing.join("\n  .")}`,
    ).toEqual([]);
  });
});
