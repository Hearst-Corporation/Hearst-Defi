import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * PROMPT 232 — repository-wide DS canonicalization guards.
 * Extends the Visual Direction contract to admin, vaults, proof-center, and catalyst primitives.
 */

const ROOT = process.cwd();

const SCOPE_DIRS = [
  "src/components/admin",
  "src/components/vaults",
  "src/components/proof-center",
  "src/components/catalyst",
  "src/app/admin",
  "src/app/(product)/vaults",
  "src/app/(product)/proof-center",
];

const EXT = /\.(tsx?|jsx?)$/;
const SKIP_SEGMENTS = new Set(["__tests__", "node_modules", ".next"]);

const ALLOWLIST_FILES = new Set([
  "src/lib/brand-constants.ts",
  "src/lib/pdf/pdf-palette.ts",
  "src/lib/product-strategies/lab-colors.ts",
]);

const FORBIDDEN: { id: string; re: RegExp }[] = [
  { id: "BENTO_PRIMARY_BTN runtime", re: /BENTO_PRIMARY_BTN/ },
  { id: "BENTO_SECONDARY_BTN runtime", re: /BENTO_SECONDARY_BTN/ },
  { id: "CATALYST_ACCENT_BTN", re: /CATALYST_ACCENT_BTN/ },
  { id: "catalyst/button import", re: /from ["']@\/components\/catalyst\/button["']/ },
  { id: "ui/card import", re: /from ["']@\/components\/ui\/card["']/ },
  { id: "font-mono", re: /\bfont-mono\b/ },
  { id: "const FIELD =", re: /const FIELD\s*=/ },
  { id: "const INPUT_CLASS =", re: /const INPUT_CLASS\s*=/ },
  { id: "bg-[#hex]", re: /bg-\[#[0-9a-fA-F]/ },
  { id: "text-[#hex]", re: /text-\[#[0-9a-fA-F]/ },
  { id: "border-[#hex]", re: /border-\[#[0-9a-fA-F]/ },
];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (rel.split(sep).some((seg) => SKIP_SEGMENTS.has(seg))) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(rel);
  }
  return out;
}

const FILES = SCOPE_DIRS.flatMap((d) => walk(join(ROOT, d)));

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("DS canonicalization guards (PROMPT 232)", () => {
  it("scans a non-trivial scope", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  for (const { id, re } of FORBIDDEN) {
    it(`forbids "${id}" in scoped surfaces`, () => {
      const offenders: string[] = [];
      for (const rel of FILES) {
        if (ALLOWLIST_FILES.has(rel)) continue;
        if (rel === "src/components/catalyst/bento.tsx" && id.includes("BENTO")) continue;
        if (rel === "src/lib/ui/catalyst-accent.ts" && id.includes("CATALYST_ACCENT")) continue;
        if (rel === "src/components/catalyst/button.tsx" && id.includes("catalyst/button")) continue;
        let text: string;
        try {
          text = stripComments(readFileSync(join(ROOT, rel), "utf8"));
        } catch {
          continue;
        }
        if (re.test(text)) offenders.push(rel);
      }
      expect(
        offenders,
        `"${id}" is banned after PROMPT 232 canonicalization. Offenders:\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    });
  }

  it("catalyst primitives exist", () => {
    expect(readFileSync(join(ROOT, "src/components/catalyst/cockpit-button.tsx"), "utf8")).toMatch(
      /export function CockpitButton/,
    );
    expect(readFileSync(join(ROOT, "src/components/catalyst/select.tsx"), "utf8")).toMatch(/export const Select/);
    expect(readFileSync(join(ROOT, "src/components/catalyst/textarea.tsx"), "utf8")).toMatch(/export const Textarea/);
    expect(readFileSync(join(ROOT, "src/components/catalyst/field.tsx"), "utf8")).toMatch(/export function Field/);
  });
});

/**
 * Mission Z1 — single-green invariant at the HEX level.
 * `#4ade80` was the second green (--color-success pre-Z1, now aliased to the
 * accent) and `#fb7185` a stray rose. Neither may reappear in the runtime
 * styling sources (src/styles, src/ui) nor in the canonicalized scopes above.
 * Same mechanism as the guards above: readFileSync + regex, comments stripped.
 */
const HEX_SCOPE_DIRS = ["src/styles", "src/ui", ...SCOPE_DIRS];

const HEX_EXT = /\.(tsx?|jsx?|css)$/;

const FORBIDDEN_HEX: { id: string; re: RegExp }[] = [
  { id: "second green #4ade80", re: /#4ade80/i },
  { id: "rose #fb7185", re: /#fb7185/i },
];

function walkAnyStyled(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (rel.split(sep).some((seg) => SKIP_SEGMENTS.has(seg))) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkAnyStyled(full, out);
    else if (HEX_EXT.test(name)) out.push(rel);
  }
  return out;
}

describe("DS canonicalization guards — forbidden hexes (Mission Z1)", () => {
  const files = HEX_SCOPE_DIRS.flatMap((d) => walkAnyStyled(join(ROOT, d)));

  it("scans styles + ui + canonicalized scopes", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith("theme.css"))).toBe(true);
    expect(files.some((f) => f.endsWith("typography.css"))).toBe(true);
  });

  for (const { id, re } of FORBIDDEN_HEX) {
    it(`forbids "${id}" in styles, ui and scoped surfaces`, () => {
      const offenders: string[] = [];
      for (const rel of files) {
        if (ALLOWLIST_FILES.has(rel)) continue;
        let text: string;
        try {
          text = stripComments(readFileSync(join(ROOT, rel), "utf8"));
        } catch {
          continue;
        }
        if (re.test(text)) offenders.push(rel);
      }
      expect(
        offenders,
        `"${id}" is banned (single-green invariant, Mission Z1). Offenders:\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    });
  }
});
