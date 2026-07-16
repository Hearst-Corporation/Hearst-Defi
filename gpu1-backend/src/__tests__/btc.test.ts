import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BtcDTO } from "../application/btc.js";
import type { Resolved } from "../domain/index.js";

// The v2 contract is NOT deployed (no DYNAVAULT_ADDRESS in the stubbed env), so
// EVERY BTC surface must be honestly NOT_CONFIGURED with a null value — never a
// fabricated reserve/exposure/BTC-produced figure.
describe("buildBtc (contract not deployed)", () => {
  const NOW = 1_800_000_000_000;

  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("DYNAVAULT_ADDRESS", ""); // absent → runtime not_configured
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  async function build(): Promise<BtcDTO> {
    const { buildBtc } = await import("../application/btc.js");
    return buildBtc("user-1", { nowMs: NOW });
  }

  it("reports runtime mode not_configured", async () => {
    const dto = await build();
    expect(dto.runtime.mode).toBe("not_configured");
    expect(dto.runtime.contractAddress).toBeNull();
    expect(dto.runtime.codePresent).toBe(false);
  });

  it("returns NOT_CONFIGURED for every contract-owned field", async () => {
    const dto = await build();
    const fields: ReadonlyArray<Resolved<unknown>> = [
      dto.reserve,
      dto.exposure,
      dto.btcProduced,
      dto.takeProfitTiers,
      dto.events,
    ];
    for (const f of fields) {
      expect(f.status).toBe("NOT_CONFIGURED");
    }
  });

  it("NEVER fabricates a value: value is null exactly when status is NOT_CONFIGURED", async () => {
    const dto = await build();
    const fields: ReadonlyArray<Resolved<unknown>> = [
      dto.reserve,
      dto.exposure,
      dto.btcProduced,
      dto.takeProfitTiers,
      dto.events,
    ];
    for (const f of fields) {
      if (f.status === "NOT_CONFIGURED") {
        expect(f.value).toBeNull();
      }
      // Contrapositive: a null value must carry a non-LIVE status (honesty invariant).
      if (f.value === null) {
        expect(["NOT_CONFIGURED", "UNAVAILABLE", "PARTIAL", "STALE", "NOT_SUPPORTED", "PERMISSION_DENIED"]).toContain(
          f.status,
        );
      }
    }
  });

  it("carries a machine reason for the unavailable fields", async () => {
    const dto = await build();
    expect(dto.reserve.reason).toBe("dynavault_not_deployed");
    expect(dto.events.reason).toBe("dynavault_not_deployed");
  });
});
