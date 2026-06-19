import { describe, expect, it, vi } from "vitest";

import { resolveAdminDemoMode } from "@/lib/demo/admin-mode";

vi.mock("@/lib/demo/guard", () => ({
  canRunDemoProvider: vi.fn(),
}));

vi.mock("@/lib/dev/investor-demo-visible", () => ({
  databaseHasDemoProofs: vi.fn(),
}));

import { canRunDemoProvider } from "@/lib/demo/guard";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";

describe("resolveAdminDemoMode", () => {
  it("enables provider path without DB probe", async () => {
    vi.mocked(canRunDemoProvider).mockReturnValue(true);
    const mode = await resolveAdminDemoMode();
    expect(mode).toEqual({
      providerEnabled: true,
      showDemoBanner: true,
      demo: true,
    });
    expect(databaseHasDemoProofs).not.toHaveBeenCalled();
  });

  it("falls back to seeded demo proofs in DB", async () => {
    vi.mocked(canRunDemoProvider).mockReturnValue(false);
    vi.mocked(databaseHasDemoProofs).mockResolvedValue(true);
    const mode = await resolveAdminDemoMode();
    expect(mode).toEqual({
      providerEnabled: false,
      showDemoBanner: true,
      demo: true,
    });
  });

  it("is off when provider and DB are clean", async () => {
    vi.mocked(canRunDemoProvider).mockReturnValue(false);
    vi.mocked(databaseHasDemoProofs).mockResolvedValue(false);
    const mode = await resolveAdminDemoMode();
    expect(mode).toEqual({
      providerEnabled: false,
      showDemoBanner: false,
      demo: false,
    });
  });
});
