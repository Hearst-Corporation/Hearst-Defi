import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { HeaderConnect } from "@/components/connect/header-connect";

describe("HeaderConnect", () => {
  it("renders nothing when Privy is not configured (no usePrivy crash)", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "");
    const html = renderToStaticMarkup(<HeaderConnect />);
    expect(html).toBe("");
  });
});
