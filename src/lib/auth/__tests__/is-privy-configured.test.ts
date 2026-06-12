import { afterEach, describe, expect, it, vi } from "vitest";

import { isPrivyConfigured } from "@/lib/auth/is-privy-configured";

describe("isPrivyConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when NEXT_PUBLIC_PRIVY_APP_ID is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "");
    expect(isPrivyConfigured()).toBe(false);
  });

  it("returns true when NEXT_PUBLIC_PRIVY_APP_ID is set", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "cl-test-app-id");
    expect(isPrivyConfigured()).toBe(true);
  });
});
