import { describe, expect, it } from "vitest";

import { PRODUCT_STRATEGIES } from "@/lib/product-strategies";
import {
  ensureUniqueDraftIdentity,
  newStrategyDraft,
} from "@/components/admin/strategies/use-strategy-store";

describe("ensureUniqueDraftIdentity", () => {
  it("keeps a unique draft unchanged", () => {
    const draft = newStrategyDraft(
      {
        name: "Fresh Draft",
        slug: "fresh-draft",
        id: "draft-fresh-draft",
      },
      "2026-07-01T00:00:00.000Z",
    );

    const unique = ensureUniqueDraftIdentity(draft, PRODUCT_STRATEGIES);

    expect(unique.id).toBe("draft-fresh-draft");
    expect(unique.slug).toBe("fresh-draft");
  });

  it("suffixes slug and id when the incoming draft already exists", () => {
    const existing = [
      ...PRODUCT_STRATEGIES,
      newStrategyDraft(
        {
          name: "Draft Strategy 1",
          slug: "draft-strategy-1",
          id: "draft-draft-strategy-1",
        },
        "2026-07-01T00:00:00.000Z",
      ),
      newStrategyDraft(
        {
          name: "Draft Strategy 1 (copy)",
          slug: "draft-strategy-1-2",
          id: "draft-draft-strategy-1-2",
        },
        "2026-07-01T00:00:00.000Z",
      ),
    ];

    const duplicate = newStrategyDraft(
      {
        name: "Draft Strategy 1",
        slug: "draft-strategy-1",
        id: "draft-draft-strategy-1",
      },
      "2026-07-01T00:00:00.000Z",
    );

    const unique = ensureUniqueDraftIdentity(duplicate, existing);

    expect(unique.slug).toBe("draft-strategy-1-3");
    expect(unique.id).toBe("draft-draft-strategy-1-3");
  });
});
