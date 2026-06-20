import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TaxPreviewPanel } from "@/components/portfolio/tax-preview-panel";
import { getTaxPreview } from "@/lib/portfolio/tax";

describe("TaxPreviewPanel", () => {
  it("renders 1099-INT interest from ledger overrides", () => {
    const preview = getTaxPreview("inv_test", 2026, {
      actualInterestIncomeUsd: 12_345.67,
      actualPrincipalUsd: 500_000,
      actualAccruedYieldUsd: 8_000,
      actualDaysHeld: 200,
    });

    const html = renderToStaticMarkup(<TaxPreviewPanel preview={preview} />);

    expect(html).toContain("tax-preview-panel");
    expect(html).toContain("1099-INT");
    expect(html).toContain("$12,345.67");
    expect(html).toContain("Preview only");
  });
});
