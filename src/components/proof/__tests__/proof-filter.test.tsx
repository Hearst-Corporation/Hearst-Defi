import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/proof-center",
  useSearchParams: () => new URLSearchParams(),
}));

import { ProofFilter } from "@/components/proof/proof-filter";

describe("ProofFilter", () => {
  it("uses doc-flow-tablist (product + admin), not admin-doc-inline-row alone", () => {
    const html = renderToStaticMarkup(<ProofFilter />);
    expect(html).toContain('class="doc-flow-tablist"');
    expect(html).not.toContain("admin-doc-inline-row");
    expect(html).toContain('role="tablist"');
    expect(html).toContain(">All</button>");
    expect(html).toContain(">Mining</button>");
  });
});
