import { describe, expect, it } from "vitest";

import { truncateWallet } from "@/lib/wallet-display";

describe("truncateWallet", () => {
  it("truncates a 42-char ETH address", () => {
    const addr = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    expect(truncateWallet(addr)).toBe("0xAbCd…Ef12");
  });

  it("returns short addresses as-is", () => {
    expect(truncateWallet("0xAbCd")).toBe("0xAbCd");
  });

  it("truncates long non-hex strings", () => {
    expect(truncateWallet("admin-wallet-long-name")).toBe("admin-wall…");
  });
});
