import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BentoPageShell, BentoPanel } from "@/components/catalyst/bento";

// Bento canon now lives in catalyst/; ui/bento.tsx is a thin re-export façade.
const BENTO_SRC = readFileSync(
  join(process.cwd(), "src/components/catalyst/bento.tsx"),
  "utf8",
);

const DASHBOARD_SRC = readFileSync(
  join(process.cwd(), "src/app/admin/dashboard/page.tsx"),
  "utf8",
);

const MONITORING_SRC = readFileSync(
  join(process.cwd(), "src/app/admin/monitoring/page.tsx"),
  "utf8",
);

describe("bento DS contract", () => {
  it("BentoPanel uses the hc-surface recipe, not bg-black in classNames", () => {
    expect(BENTO_SRC).toContain("hc-surface");
    expect(BENTO_SRC).not.toMatch(/className=.*bg-black/);
  });

  it("BentoPageShell uses hc-page token shell", () => {
    expect(BENTO_SRC).toContain("hc-page");
    expect(BENTO_SRC).not.toContain("bg-zinc-900");
  });

  it("BentoPanel render exposes hc-surface class", () => {
    const html = renderToStaticMarkup(
      <BentoPanel>
        <span>child</span>
      </BentoPanel>,
    );
    expect(html).toContain("hc-surface");
    expect(html).not.toContain("bg-black");
  });

  it("BentoPageShell render exposes hc-page class", () => {
    const html = renderToStaticMarkup(
      <BentoPageShell testId="shell">
        <span>child</span>
      </BentoPageShell>,
    );
    expect(html).toContain("hc-page");
    expect(html).not.toContain("bg-zinc-900");
  });
});

describe("primary pages — no ad-hoc surface hardcodes in patched files", () => {

  it("dashboard page uses the greenfield admin view wrapper", () => {
    expect(DASHBOARD_SRC).toContain("AdminDashboardView");
    expect(DASHBOARD_SRC).not.toContain("bg-zinc-900");
    expect(DASHBOARD_SRC).not.toContain("text-[#A7FB90]");
  });

  it("monitoring page uses the greenfield admin view wrapper", () => {
    expect(MONITORING_SRC).toContain("AdminMonitoringView");
    expect(MONITORING_SRC).not.toContain("AdminPageShell");
  });
});
