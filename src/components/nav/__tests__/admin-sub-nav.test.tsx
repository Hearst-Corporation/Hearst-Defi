import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/customers",
  useSearchParams: () => new URLSearchParams("vault=yield"),
}));

vi.mock("@/lib/vaults/dashboard-scope", () => ({
  withAdminVaultQuery: (href: string, vaultScope: string | null) =>
    vaultScope ? `${href}?vault=${vaultScope}` : href,
}));

import { AdminSubNav } from "@/components/nav/admin-sub-nav";

describe("AdminSubNav", () => {
  it("marks the active admin tab with aria-current and active class", () => {
    const html = renderToStaticMarkup(<AdminSubNav />);

    expect(html).toContain('aria-label="Dashboard sections"');
    expect(html).toContain('href="/admin/customers?vault=yield"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("admin-doc-sub-nav__link admin-doc-sub-nav__link--active");
    expect(html).toContain(">Investors</a>");
  });
});
