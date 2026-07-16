import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MiningDTO } from "../application/mining.js";
import type { MiningRepository, MiningTelemetryRow } from "../persistence/mining-repository.js";
import type { Resolved } from "../domain/index.js";

// The v2 contract is NOT deployed and Antpool was never integrated → every
// on-chain / attested mining surface must be honestly NOT_CONFIGURED with a null
// value. The only surface that can be LIVE is the DB-backed operational telemetry,
// and ONLY when a real row exists.
describe("buildMining (contract not deployed)", () => {
  const NOW = 1_800_000_000_000;

  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("DYNAVAULT_ADDRESS", "");
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  const repoEmpty: MiningRepository = { getLatestTelemetry: async () => null };

  async function build(repo: MiningRepository): Promise<MiningDTO> {
    const { buildMining } = await import("../application/mining.js");
    return buildMining("user-1", { repo, nowMs: NOW });
  }

  it("reports runtime mode not_configured", async () => {
    const dto = await build(repoEmpty);
    expect(dto.runtime.mode).toBe("not_configured");
  });

  it("returns NOT_CONFIGURED for every on-chain / attested field", async () => {
    const dto = await build(repoEmpty);
    const onChain: ReadonlyArray<Resolved<unknown>> = [
      dto.hashrate,
      dto.btcEarned,
      dto.electricity,
      dto.curtailment,
      dto.engine,
    ];
    for (const f of onChain) {
      expect(f.status).toBe("NOT_CONFIGURED");
      expect(f.value).toBeNull(); // NEVER a fabricated hashrate / uptime / BTC earned
    }
  });

  it("with an EMPTY telemetry table, operationalTelemetry is NOT_CONFIGURED (null, not zero)", async () => {
    const dto = await build(repoEmpty);
    expect(dto.operationalTelemetry.status).toBe("NOT_CONFIGURED");
    expect(dto.operationalTelemetry.value).toBeNull();
  });

  it("with a REAL telemetry row, operationalTelemetry is LIVE from the DB (never invented)", async () => {
    const row: MiningTelemetryRow = {
      takenAt: new Date(NOW).toISOString(),
      deployedHashrateTh: "1200.5",
      uptimePct: "99.1",
      hashprice: "0.052",
      difficulty: "1.1e14",
      btcPrice: "64000",
      energyCost: "0.045",
      miningMarginScore: 72,
      hashpriceTrendPct: "-3.2",
      operationalConfidence: 80,
      alertLevel: "green",
      summary: null,
      recommendation: null,
    };
    const repo: MiningRepository = { getLatestTelemetry: async () => row };
    const dto = await build(repo);
    expect(dto.operationalTelemetry.status).toBe("LIVE");
    expect(dto.operationalTelemetry.provenance).toBe("db");
    expect(dto.operationalTelemetry.value).toEqual(row);
    // On-chain fields stay NOT_CONFIGURED even when DB telemetry is present.
    expect(dto.hashrate.status).toBe("NOT_CONFIGURED");
    expect(dto.hashrate.value).toBeNull();
  });

  it("honesty invariant: any null value carries a non-LIVE status", async () => {
    const dto = await build(repoEmpty);
    const all: ReadonlyArray<Resolved<unknown>> = [
      dto.hashrate,
      dto.btcEarned,
      dto.electricity,
      dto.curtailment,
      dto.engine,
      dto.operationalTelemetry,
    ];
    for (const f of all) {
      if (f.value === null) {
        expect(f.status).not.toBe("LIVE");
      }
    }
  });

  it("degrades to UNAVAILABLE (not a fabricated value) when the DB throws", async () => {
    const repo: MiningRepository = {
      getLatestTelemetry: async () => {
        throw new Error("db down");
      },
    };
    const dto = await build(repo);
    expect(dto.operationalTelemetry.status).toBe("UNAVAILABLE");
    expect(dto.operationalTelemetry.value).toBeNull();
  });
});
