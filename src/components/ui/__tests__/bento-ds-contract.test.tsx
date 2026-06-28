import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BentoPageShell, BentoPanel } from "@/components/ui/bento";

// Bento canon now lives in catalyst/; ui/bento.tsx is a thin re-export façade.
const BENTO_SRC = readFileSync(
  join(process.cwd(), "src/components/catalyst/bento.tsx"),
  "utf8",
);

const PROFILE_SRC = readFileSync(
  join(process.cwd(), "src/app/(product)/profile/page.tsx"),
  "utf8",
);

const DASHBOARD_SRC = readFileSync(
  join(process.cwd(), "src/app/admin/dashboard/page.tsx"),
  "utf8",
);

const AUDIT_SRC = readFileSync(
  join(process.cwd(), "src/app/admin/audit/page.tsx"),
  "utf8",
);

const BANNER_SRC = readFileSync(
  join(process.cwd(), "src/components/admin/projection/preview-source-banner.tsx"),
  "utf8",
);

describe("bento DS contract", () => {
  it("BentoPanel uses ct-glass-panel, not bg-black in classNames", () => {
    expect(BENTO_SRC).toContain("ct-glass-panel");
    expect(BENTO_SRC).not.toMatch(/className=.*bg-black/);
  });

  it("BentoPageShell uses ct-bento-page token shell", () => {
    expect(BENTO_SRC).toContain("ct-bento-page");
    expect(BENTO_SRC).not.toContain("bg-zinc-900");
  });

  it("BentoPanel render exposes ct-glass-panel class", () => {
    const html = renderToStaticMarkup(
      <BentoPanel>
        <span>child</span>
      </BentoPanel>,
    );
    expect(html).toContain("ct-glass-panel");
    expect(html).not.toContain("bg-black");
  });

  it("BentoPageShell render exposes ct-bento-page class", () => {
    const html = renderToStaticMarkup(
      <BentoPageShell testId="shell">
        <span>child</span>
      </BentoPageShell>,
    );
    expect(html).toContain("ct-bento-page");
    expect(html).not.toContain("bg-zinc-900");
  });
});

describe("primary pages — no ad-hoc surface hardcodes in patched files", () => {
  it("profile page uses BentoPageShell + DS primitives", () => {
    expect(PROFILE_SRC).toContain("BentoPageShell");
    expect(PROFILE_SRC).toContain("ProductPageHeader");
    expect(PROFILE_SRC).not.toContain("bg-zinc-900");
    expect(PROFILE_SRC).not.toContain("bg-[#15191C]");
    expect(PROFILE_SRC).not.toContain("text-[#A7FB90]");
  });

  it("dashboard page uses the canonical admin shell + AdminPageHeader", () => {
    // Canon update: admin surfaces migrated from BentoPageShell to AdminPageShell
    // (commits 891297d6 → a111eb82). AdminPageShell renders AdminPageHeader and the
    // bg-surface-page frame — it is the successor of the bento page shell here.
    expect(DASHBOARD_SRC).toContain("AdminPageShell");
    expect(DASHBOARD_SRC).not.toContain("bg-zinc-900");
    expect(DASHBOARD_SRC).not.toContain("text-[#A7FB90]");
  });

  it("audit page uses Catalyst primitives (Table/Input) on the canonical admin shell", () => {
    // Catalyst is the visual authority: the page composes the purchased
    // primitives instead of hand-rolled inputs/tables. (Supersedes the prior
    // ct-bento-input contract — that surface is now a Catalyst Input.) The shell
    // is AdminPageShell, the canonical admin frame (not the legacy BentoPageShell).
    expect(AUDIT_SRC).toContain("@/components/catalyst/input");
    expect(AUDIT_SRC).toContain("@/components/catalyst/table");
    expect(AUDIT_SRC).not.toContain("ct-bento-input");
    expect(AUDIT_SRC).not.toContain("bg-[#15191C]");
    expect(AUDIT_SRC).toContain("AdminPageShell");
  });

  it("preview source banner uses ct-glass-panel, not bg-[#15191C]", () => {
    expect(BANNER_SRC).toContain("ct-glass-panel");
    expect(BANNER_SRC).not.toContain("bg-[#15191C]");
    expect(BANNER_SRC).toContain("ct-text-accent");
    expect(BANNER_SRC).not.toContain("text-[#A7FB90]");
  });
});
