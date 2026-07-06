import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Admin VISUAL FRAME guard (Mission #055).
 *
 * The start-pattern guard (Mission #051, admin-canon-start-pattern.test.ts)
 * already locks WHICH primitives a page opens with. This guard locks the
 * shared FRAME those primitives render — the thing that actually made admin
 * pages look the same vs. different:
 *
 *   - the page frame and every AdminSectionCard must be able to SHRINK
 *     (`min-w-0`). Without it, a wide Catalyst table's intrinsic width wins
 *     and the card overflows the content slot → the table crops on the right
 *     and the frame width jumps when the chat rail opens. `min-w-0` is the fix;
 *     this guard makes its removal a failing test, not a silent visual regression.
 *   - the canon frame classes (`admin-canon-page-frame` / `admin-canon-first-block`)
 *     are emitted by the shell primitives and backed by a real CSS contract.
 *   - the canon CSS exists and is loaded by the admin layout.
 *
 * Mechanism: substring assertions on source — the same robust approach the
 * other DS guards use (ds-authority-lock, bento-ds-contract, start-pattern).
 * No AST coupling. "Progressive, not absurd": it locks the primitive + CSS
 * contract, it does not try to police every page's hand-written JSX.
 */

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const SHELL = "src/components/admin/admin-page-shell.tsx";
const CANON_CSS = "src/app/admin/admin-canon.css";
const ADMIN_LAYOUT = "src/app/admin/layout.tsx";

describe("admin visual frame — canon CSS contract", () => {
  it("ships the canon frame stylesheet", () => {
    expect(() => read(CANON_CSS)).not.toThrow();
  });

  it("the admin layout loads the canon stylesheet", () => {
    expect(read(ADMIN_LAYOUT)).toContain("admin-canon.css");
  });

  it("defines the four canon frame classes", () => {
    const css = read(CANON_CSS);
    for (const cls of [
      ".admin-canon-page-frame",
      ".admin-canon-first-block",
      ".admin-canon-table-surface",
      ".admin-canon-form-surface",
    ]) {
      expect(css).toContain(cls);
    }
  });

  it("the crop fix is encoded as a real rule — page frame + first block can shrink", () => {
    const css = read(CANON_CSS);
    // Both surfaces must carry `min-width: 0` so a wide table can't push the
    // frame past the slot. (Regex tolerates formatting/whitespace.)
    expect(css).toMatch(/\.admin-canon-page-frame\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.admin-canon-first-block\s*\{[^}]*min-width:\s*0/);
    // The table surface scrolls horizontally LOCALLY (never bleeds the frame).
    expect(css).toMatch(/\.admin-canon-table-surface\s*\{[^}]*overflow-x:\s*auto/);
  });
});

describe("admin visual frame — shell primitive emits the canon frame", () => {
  it("AdminPageShell tags its padded column as the canon page frame", () => {
    expect(read(SHELL)).toContain("admin-canon-page-frame");
  });

  it("AdminSectionCard tags itself as the canon first block", () => {
    expect(read(SHELL)).toContain("admin-canon-first-block");
  });

  it("the crop fix is wired into the primitives — both carry min-w-0", () => {
    const shell = read(SHELL);
    // The page frame container.
    expect(shell).toMatch(/admin-canon-page-frame[^"]*min-w-0|min-w-0[^"]*admin-canon-page-frame/);
    // The section card (flex item) must declare min-w-0 so it can shrink.
    expect(shell).toMatch(/admin-canon-first-block[\s\S]{0,80}min-w-0|min-w-0[\s\S]{0,80}admin-canon-first-block/);
  });

  it("exposes the canon table/form surface hooks pages apply", () => {
    const shell = read(SHELL);
    expect(shell).toContain("admin-canon-table-surface");
    expect(shell).toContain("admin-canon-form-surface");
    expect(shell).toContain("AdminTableSurface");
  });
});

/**
 * Frame exemptions — the non-canon admin surfaces, listed so the set is
 * explicit and reviewable (mirrors the start-pattern allowlist). These keep
 * their own framing on purpose; they are NOT held to the canon frame.
 */
const FRAME_EXEMPTIONS: ReadonlyMap<string, string> = new Map([
  ["src/app/admin/page.tsx", "root redirect — no UI"],
  ["src/app/admin/dashboard/page.tsx", "dashboard cockpit — own bento composition"],
  ["src/app/admin/proof-center/page.tsx", "product proof layout"],
  ["src/app/admin/proof-center/full/page.tsx", "product proof layout"],
  ["src/app/admin/agent-canvas/[canvasId]/page.tsx", "bespoke live canvas"],
  ["src/app/admin/vaults/new/page.tsx", "multi-step wizard"],
  [
    "src/app/admin/agentic/detailed/page.tsx",
    "control-tower archive — mounts the AgenticControlTower orchestrator",
  ],
]);

describe("admin visual frame — exemptions are explicit", () => {
  it("lists every non-canon admin surface with a reason", () => {
    expect(FRAME_EXEMPTIONS.size).toBe(7);
    for (const [, reason] of FRAME_EXEMPTIONS) {
      expect(reason.length).toBeGreaterThan(3);
    }
  });

  it("keeps dashboard cockpit and the agentic control-tower archive exempt (never forced onto the canon)", () => {
    expect(FRAME_EXEMPTIONS.has("src/app/admin/dashboard/page.tsx")).toBe(true);
    expect(FRAME_EXEMPTIONS.has("src/app/admin/agentic/detailed/page.tsx")).toBe(
      true,
    );
  });
});
