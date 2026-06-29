import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Admin VISUAL canon — start-pattern guard (Mission #051).
 *
 * Locks the way every admin page *starts* so future surfaces can't silently
 * regress to a bare grid / hand-rolled header. The canon grammar is frozen in
 * `src/components/admin/admin-page-shell.tsx`:
 *
 *   AdminPageShell  → outer box (bg-surface-page) + AdminPageHeader (the H1)
 *     AdminSectionCard | AdminKpiStripPanel → the canon "first block"
 *
 * For every `src/app/admin/** /page.tsx` that is NOT allowlisted, we assert
 * three things on the page SOURCE (robust text checks — same mechanism as the
 * other DS guards: ds-authority-lock, bento-ds-contract, proof-center-hub-root):
 *
 *   1. it mounts the canon shell  → source contains `AdminPageShell`;
 *   2. it never hand-rolls the H1  → source must NOT contain `<h1`
 *      (the title comes from AdminPageHeader, inside the shell);
 *   3. it opens on a canon first-block primitive → source contains
 *      `AdminSectionCard` OR `AdminKpiStripPanel`.
 *
 * Why assertion (3) matters: `AdminPageShell` alone is not enough. A page can
 * mount the shell and then render a bare `<div className="grid …">` or a raw
 * `BentoPanel` as its first block — that page passes (1) and (2) but breaks the
 * visual start pattern. Requiring a canon first-block primitive is the lock.
 *
 * Mechanism note: we deliberately do NOT parse the JSX tree / "first child" via
 * an AST. Substring presence of a canon primitive is the agreed, robust
 * mechanism — AST coupling would be brittle against formatting and would drift
 * with every refactor. The other guards in this repo use the same readFileSync
 * + substring approach.
 */

const ROOT = process.cwd();
const ADMIN_DIR = join(ROOT, "src", "app", "admin");

/** Normalize an absolute path to a repo-relative POSIX string. */
function toRepoRel(absPath: string): string {
  return relative(ROOT, absPath).split(sep).join("/");
}

/** Recursively collect every file named exactly `page.tsx` under `dir`. */
function collectAdminPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...collectAdminPages(abs));
    } else if (entry === "page.tsx") {
      out.push(toRepoRel(abs));
    }
  }
  return out.sort();
}

/**
 * PRIMARY allowlist — pages exempt from ALL three assertions.
 * Each entry is a deliberate, owner-blessed exception (not a TODO).
 * Dynamic segments are kept literally (`[id]`, `[canvasId]`).
 */
const PRIMARY_ALLOWLIST: ReadonlySet<string> = new Set([
  // Root redirect — no UI at all.
  "src/app/admin/page.tsx",
  // Cockpit dashboard — exempt by owner (its own bento/cockpit composition).
  "src/app/admin/dashboard/page.tsx",
  // Proof Center — product layout, not the admin canon shell.
  "src/app/admin/proof-center/page.tsx",
  "src/app/admin/proof-center/full/page.tsx",
  // Agent canvas — bespoke live workspace surface.
  "src/app/admin/agent-canvas/[canvasId]/page.tsx",
  // Vault creation — multi-step wizard with its own framing.
  "src/app/admin/vaults/new/page.tsx",
  // Construction report print page — standalone print/PDF layout (light theme,
  // window.print), deliberately outside the admin canon shell.
  "src/app/admin/product-workspace/report/print/page.tsx",
  // Agentic console — covered by the separate PR #81 redesign; exempt for now
  // so this guard doesn't conflict with that in-flight work. Re-fold it into
  // the enforced set (or its own contract) once #81 lands.
  "src/app/admin/agentic/page.tsx",
]);

/**
 * SECONDARY allowlist — pages that DO mount the canon shell and DO avoid a
 * hand-rolled `<h1` (assertions 1 + 2 are still enforced below), but whose
 * canon "first block" is intentionally a different welded surface than
 * AdminSectionCard / AdminKpiStripPanel. Wrapping them in AdminSectionCard
 * would double-frame. Assertion (3) is skipped ONLY for these, each justified.
 */
const SECONDARY_ALLOWLIST: ReadonlyMap<string, string> = new Map([
  [
    "src/app/admin/vaults/[id]/page.tsx",
    // First block is <VaultAdminKpiStrip> — a domain-specialized WELDED canon
    // card (same bg-surface-card welded grammar as AdminSectionCard), followed
    // by AdminDetailSection blocks. Re-wrapping in AdminSectionCard would
    // double-frame the KPI strip.
    "renders VaultAdminKpiStrip (domain welded canon card) + AdminDetailSection",
  ],
  [
    "src/app/admin/governance/allowlist/page.tsx",
    // <AllowlistBoard> renders its own framed BentoPanels; wrapping it in an
    // AdminSectionCard would double-frame the board.
    "AllowlistBoard renders framed BentoPanels; a wrap would double-frame",
  ],
  [
    "src/app/admin/spec/page.tsx",
    // Redirect page: when spec entries exist it redirect()s to the first slug;
    // the only rendered fallback is <EmptySurface> alone (a documented DS
    // exception — EmptySurface needs no enclosing card).
    "redirect page; only rendered fallback is EmptySurface alone (DS exception)",
  ],
]);

const ALL_ALLOWLISTED: ReadonlySet<string> = new Set([
  ...PRIMARY_ALLOWLIST,
  ...SECONDARY_ALLOWLIST.keys(),
]);

const ADMIN_PAGES = collectAdminPages(ADMIN_DIR);
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

describe("admin canon start-pattern — discovery", () => {
  it("finds the admin page surfaces (sanity: walk actually ran)", () => {
    expect(ADMIN_PAGES.length).toBeGreaterThan(20);
    expect(ADMIN_PAGES).toContain("src/app/admin/customers/page.tsx");
    expect(ADMIN_PAGES).toContain("src/app/admin/vaults/[id]/page.tsx");
  });
});

describe("admin canon start-pattern — allowlist is accurate (can't rot)", () => {
  for (const rel of [...PRIMARY_ALLOWLIST, ...SECONDARY_ALLOWLIST.keys()]) {
    it(`allowlist entry exists on disk: ${rel}`, () => {
      expect(
        ADMIN_PAGES,
        `Allowlisted path "${rel}" no longer exists (or was renamed). ` +
          `Update the allowlist in admin-canon-start-pattern.test.ts.`,
      ).toContain(rel);
    });
  }
});

describe("admin canon start-pattern — every non-allowlisted page conforms", () => {
  const enforced = ADMIN_PAGES.filter((p) => !PRIMARY_ALLOWLIST.has(p));

  it("there is something to enforce", () => {
    expect(enforced.length).toBeGreaterThan(0);
  });

  for (const rel of enforced) {
    const isSecondary = SECONDARY_ALLOWLIST.has(rel);
    const label = isSecondary
      ? `${rel} (shell + no-h1 only — ${SECONDARY_ALLOWLIST.get(rel)})`
      : rel;

    it(label, () => {
      const src = read(rel);

      // (1) Canon shell — every admin page mounts the header via AdminPageShell.
      expect(
        src.includes("AdminPageShell"),
        `${rel} must mount the canon shell (AdminPageShell) — ` +
          `it provides the bg-surface-page frame and the AdminPageHeader.`,
      ).toBe(true);

      // (2) No hand-rolled H1 — the title comes from AdminPageHeader.
      expect(
        src.includes("<h1"),
        `${rel} must NOT hand-roll an <h1> — the page title comes from ` +
          `AdminPageHeader inside AdminPageShell, never inline.`,
      ).toBe(false);

      // (3) Canon first block — skipped for the secondary allowlist.
      if (!isSecondary) {
        const hasFirstBlock =
          src.includes("AdminSectionCard") ||
          src.includes("AdminKpiStripPanel");
        expect(
          hasFirstBlock,
          `${rel} must open on a canon first-block primitive ` +
            `(AdminSectionCard or AdminKpiStripPanel). Mounting AdminPageShell ` +
            `is not enough — a bare grid / raw BentoPanel as the first block ` +
            `breaks the visual start pattern. If this page legitimately needs a ` +
            `different welded canon surface, add it to SECONDARY_ALLOWLIST with ` +
            `a justification.`,
        ).toBe(true);
      }
    });
  }
});

describe("admin canon start-pattern — guard self-consistency", () => {
  it("primary and secondary allowlists do not overlap", () => {
    for (const rel of SECONDARY_ALLOWLIST.keys()) {
      expect(
        PRIMARY_ALLOWLIST.has(rel),
        `${rel} is in BOTH allowlists — pick one.`,
      ).toBe(false);
    }
  });

  it("every secondary allowlist entry carries a non-empty justification", () => {
    for (const [rel, reason] of SECONDARY_ALLOWLIST) {
      expect(reason.trim().length, `${rel} needs a justification comment`).toBeGreaterThan(
        0,
      );
    }
  });

  it("the merged allowlist count matches its parts (no silent dupes)", () => {
    expect(ALL_ALLOWLISTED.size).toBe(
      PRIMARY_ALLOWLIST.size + SECONDARY_ALLOWLIST.size,
    );
  });
});
