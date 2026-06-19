/**
 * Document-flow shell guardrails — every routed page must use a known layout
 * primitive or an explicit, whitelisted exception.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const APP_ROOT = join(process.cwd(), "src/app");

function findPages(dir: string): string[] {
  const pages: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      pages.push(...findPages(abs));
    } else if (entry === "page.tsx") {
      pages.push(abs);
    }
  }
  return pages;
}

function rel(abs: string): string {
  return relative(process.cwd(), abs).replaceAll("\\", "/");
}

function read(abs: string): string {
  return readFileSync(abs, "utf8");
}

const ADMIN_SHELL_MARKERS = [
  "admin-doc-shell",
  "admin-doc-spec-layout",
  "scenario-lab-page",
  "ProofCenterHub", // admin proof-center = cockpit fit-gate hub (no-scroll)
] as const;

const PRODUCT_SHELL_MARKERS = [
  "product-doc-shell",
  "InvestFlowShell",
  "pf-container",
  "proof-center-shell",
  "ProofCenterHub", // product proof-center = cockpit fit-gate hub
  "PortfolioLeafShell", // portfolio leaf pages (activity/distributions/positions/yield)
  "portfolio-leaf-shell",
  "prof-shell",
  "position-detail-shell",
] as const;

/** Redirect-only or empty-state pages — no shell required in the file itself. */
const ADMIN_PAGE_EXCEPTIONS = new Set([
  "src/app/admin/page.tsx",
  "src/app/admin/spec/page.tsx",
]);

const PRODUCT_ONBOARDING_PREFIX = "src/app/(product)/onboarding/";

const PRODUCT_PAGE_EXCEPTIONS = new Set([
  "src/app/(product)/onboarding/page.tsx",
]);

function isRedirectOnly(source: string): boolean {
  return source.includes("redirect(") && !ADMIN_SHELL_MARKERS.some((m) => source.includes(m));
}

function hasMarker(source: string, markers: readonly string[]): boolean {
  return markers.some((m) => source.includes(m));
}

describe("doc-flow shells", () => {
  const allPages = findPages(APP_ROOT);

  const adminPages = allPages.filter((p) => rel(p).startsWith("src/app/admin/"));
  const productPages = allPages.filter((p) =>
    rel(p).startsWith("src/app/(product)/"),
  );

  it("admin layout provides .admin-doc scope", () => {
    const layout = read(join(APP_ROOT, "admin/layout.tsx"));
    expect(layout).toContain('className="admin-doc');
  });

  it("onboarding layout provides OnboardingShell", () => {
    const layout = read(join(APP_ROOT, "(product)/onboarding/layout.tsx"));
    expect(layout).toContain("OnboardingShell");
  });

  it("every admin page.tsx uses admin-doc-shell or a whitelisted exception", () => {
    const offenders: string[] = [];

    for (const page of adminPages) {
      const path = rel(page);
      if (ADMIN_PAGE_EXCEPTIONS.has(path)) continue;

      const source = read(page);
      if (isRedirectOnly(source)) continue;
      if (hasMarker(source, ADMIN_SHELL_MARKERS)) continue;

      offenders.push(path);
    }

    expect(offenders).toEqual([]);
  });

  it("every product page.tsx uses a document-flow shell or onboarding exception", () => {
    const offenders: string[] = [];

    for (const page of productPages) {
      const path = rel(page);
      if (PRODUCT_PAGE_EXCEPTIONS.has(path)) continue;
      if (path.startsWith(PRODUCT_ONBOARDING_PREFIX)) continue;

      const source = read(page);
      if (isRedirectOnly(source)) continue;
      if (hasMarker(source, PRODUCT_SHELL_MARKERS)) continue;

      offenders.push(path);
    }

    expect(offenders).toEqual([]);
  });
});
