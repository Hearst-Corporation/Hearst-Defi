import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Right Chat Rail Design-System Guard — Mission #061.
 *
 * The right rail (assistant panel) lives in cockpit-shell and had drifted off
 * the DS: hardcoded #0B0E10 / #15191C / bg-black surfaces, border-white/* and
 * bg-white/* chrome, text-white / text-zinc-* text, and an inline
 * style="background:#A7FB90" accent. Mission #061 tokenized all of it
 * (--ct-* surfaces / borders / text / accent).
 *
 * This guard freezes that: the chat/rail files may NOT re-introduce raw colour
 * classes. Data-viz series colours inside chart SVGs are exempt (they are
 * semantic series colours, not UI chrome) — see DATAVIZ_EXEMPT.
 */

const ROOT = process.cwd();

// The chat/rail surface files this guard governs.
const RAIL_FILES = [
  "cockpit-shell/src/shell/RailRight.tsx",
  "cockpit-shell/src/chat/ChatKimi.tsx",
  "cockpit-shell/src/chat/ChatSettings.tsx",
  "cockpit-shell/src/chat/ChatHistory.tsx",
];

// Forbidden raw-colour patterns (Tailwind class fragments / inline styles).
const FORBIDDEN: { id: string; re: RegExp }[] = [
  { id: "bg-[#0B0E10]", re: /bg-\[#0B0E10\]/i },
  { id: "bg-[#15191C]", re: /bg-\[#15191C\]/i },
  { id: "bg-black", re: /\bbg-black\b/ },
  { id: "bg-white/", re: /\bbg-white\/\d/ },
  { id: "border-white/", re: /\bborder-white\/\d/ },
  { id: "text-white", re: /\btext-white\b/ },
  { id: "text-zinc-", re: /\btext-zinc-\d/ },
  { id: "hover:text-white", re: /\bhover:text-white\b/ },
  { id: "#A7FB90 literal", re: /#A7FB90/i },
  { id: 'inline style="background:"', re: /style=\{?\s*\{?\s*background:/ },
];

// Data-viz series colours legitimately appear inside chart <svg> stroke/fill —
// they are semantic series colours, NOT UI chrome, and are out of scope.
const DATAVIZ_EXEMPT = [/#f9a03f/i, /#60a5fa/i];

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Strip the data-viz chart colours so they don't trip the hex/series checks. */
function stripDataviz(src: string): string {
  let out = src;
  for (const re of DATAVIZ_EXEMPT) out = out.replace(new RegExp(re, "gi"), "DATAVIZ");
  return out;
}

describe("Right Chat Rail DS Guard (Mission #061)", () => {
  it("the governed rail files all exist", () => {
    for (const rel of RAIL_FILES) {
      expect(() => read(rel), `${rel} should exist`).not.toThrow();
    }
  });

  for (const { id, re } of FORBIDDEN) {
    it(`no "${id}" in any right-rail file`, () => {
      const offenders: string[] = [];
      for (const rel of RAIL_FILES) {
        const text = stripDataviz(read(rel));
        if (re.test(text)) offenders.push(rel);
      }
      expect(
        offenders,
        `"${id}" is a raw-colour pattern banned from the right chat rail. ` +
          `Use --ct-* tokens instead. Offenders:\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    });
  }

  it("the rail consumes the canonical tokens (accent / bg-deep / surfaces)", () => {
    const railRight = read(RAIL_FILES[0]!);
    const chat = read(RAIL_FILES[1]!);
    // Accent green is the single brand/active/send colour.
    expect(railRight).toMatch(/var\(--ct-accent\)/);
    // Foreground on accent (send button icon, online-dot ring) = bg-deep.
    expect(railRight).toMatch(/var\(--ct-bg-deep\)/);
    // Composer + cards use tokenized surfaces.
    expect(chat).toMatch(/var\(--ct-surface-(card|inset)\)/);
    // Send-enabled state is full accent with bg-deep foreground.
    expect(chat).toMatch(/bg-\[var\(--ct-accent\)\][^"]*text-\[var\(--ct-bg-deep\)\]|text-\[var\(--ct-bg-deep\)\][^"]*bg-\[var\(--ct-accent\)\]/);
  });
});
