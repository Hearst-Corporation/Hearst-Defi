import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/onboarding/actions", () => ({
  bindWallet: vi.fn(),
}));

import { resolveBindWalletFailure } from "@/components/onboarding/privy-wallet-connect";

describe("resolveBindWalletFailure", () => {
  it("maps 'wallet already linked' to a user-facing conflict message without logging", () => {
    const result = resolveBindWalletFailure(
      "This wallet is already linked to another account.",
    );

    expect(result.shouldLog).toBe(false);
    expect(result.keepPersistedAddress).toBe(true);
    expect(result.message).toContain("Disconnect it from that account first");
  });

  it("keeps default error behavior for generic failures", () => {
    const result = resolveBindWalletFailure("Something unexpected happened.");

    expect(result.shouldLog).toBe(true);
    expect(result.keepPersistedAddress).toBe(false);
    expect(result.message).toBe("Something unexpected happened.");
  });

  it("falls back to generic copy when no error string is provided", () => {
    const result = resolveBindWalletFailure(undefined);
    expect(result.shouldLog).toBe(true);
    expect(result.keepPersistedAddress).toBe(false);
    expect(result.message).toBe("Could not link this wallet. Please try again.");
  });
});
