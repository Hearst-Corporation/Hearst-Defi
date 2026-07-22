// src/lib/backend/__tests__/contract.test.ts
//
// Contract test against a REAL running hearst-connect-backend instance.
// contracts.ts is a hand-maintained LOCAL COPY of the backend's domain
// types (the two repos can't share a runtime import — see contracts.ts
// header) — nothing stops that copy from silently drifting from the real
// DTO shape the backend actually returns (this happened once: MiningDTO was
// guessed as `{metrics, engine, electricity, vault}` when the real shape is
// `{hashrate, btcEarned, electricity, curtailment, engine,
// operationalTelemetry}`, and it only surfaced as a runtime crash on
// /dashboard). This test catches that class of drift automatically whenever
// a real backend is reachable.
//
// Skipped (not failed) when no backend is running at BACKEND_INTERNAL_URL /
// NEXT_PUBLIC_BACKEND_URL / localhost:3900 — this is an integration check,
// not a unit test; CI can opt in by starting the backend first (see
// hearst-connect-backend's CI which already does this for its own Docker
// healthcheck). A local `pnpm test` with no backend running skips cleanly.

import { createHmac } from "node:crypto";

import { describe, expect, it, beforeAll } from "vitest";

const BASE_URL = (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3900").replace(/\/+$/, "");

let backendReachable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    backendReachable = res.ok;
  } catch {
    backendReachable = false;
  }
});

function mintTestToken(): string {
  // Matches hearst-connect-backend/src/auth/session.ts's expected payload —
  // this key is a shared LOCAL dev convention (see both repos' .env.example),
  // never a real secret.
  const key = process.env.BACKEND_SESSION_SIGNING_KEY || "local-dev-signing-key-not-a-real-secret-16";
  const payload = { userId: "contract-test-user", role: "investor", exp: Math.floor(Date.now() / 1000) + 60 };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", key).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

const EXPECTED_BTC_KEYS = [
  "runtime", "reserve", "exposure", "btcProduced", "takeProfitTiers",
  "events", "attribution", "production", "custody", "proofs",
].sort();

const EXPECTED_MINING_KEYS = [
  "runtime", "hashrate", "btcEarned", "electricity", "curtailment",
  "engine", "operationalTelemetry",
].sort();

const EXPECTED_DASHBOARD_KEYS = [
  "runtime", "meta", "identity", "position", "distributions", "activity",
  "proofs", "allocation", "subscription", "alerts", "capacity", "reserve",
  "mining", "performance", "rebalancing", "engine", "aiExperts", "vault",
  "strategies", "recentEvents",
].sort();

describe("hearst-connect-backend contract (integration, skipped if backend unreachable)", () => {
  it("BtcDTO shape matches src/lib/backend/contracts.ts", async () => {
    if (!backendReachable) return;
    const res = await fetch(`${BASE_URL}/api/v1/btc`, { headers: { Authorization: `Bearer ${mintTestToken()}` } });
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(Object.keys(body.data).sort()).toEqual(EXPECTED_BTC_KEYS);
  });

  it("MiningDTO shape matches src/lib/backend/contracts.ts", async () => {
    if (!backendReachable) return;
    const res = await fetch(`${BASE_URL}/api/v1/mining`, { headers: { Authorization: `Bearer ${mintTestToken()}` } });
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(Object.keys(body.data).sort()).toEqual(EXPECTED_MINING_KEYS);
  });

  it("DashboardDTO shape matches src/lib/backend/contracts.ts", async () => {
    if (!backendReachable) return;
    const res = await fetch(`${BASE_URL}/api/v1/dashboard`, { headers: { Authorization: `Bearer ${mintTestToken()}` } });
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(Object.keys(body.data).sort()).toEqual(EXPECTED_DASHBOARD_KEYS);
  });

  it("Series1EventsDTO shape matches src/lib/backend/contracts.ts", async () => {
    if (!backendReachable) return;
    const res = await fetch(`${BASE_URL}/api/v1/series1/events`, {
      headers: { Authorization: `Bearer ${mintTestToken()}` },
    });
    const body = (await res.json()) as {
      data: { events: { status: string; value: Array<Record<string, unknown>> | null } };
    };
    expect(Object.keys(body.data).sort()).toEqual(["events"]);
    expect(body.data.events).toHaveProperty("status");
    expect(body.data.events).toHaveProperty("provenance", "indexed");
    const first = body.data.events.status === "LIVE" ? body.data.events.value?.[0] : undefined;
    if (first) {
      expect(Object.keys(first).sort()).toEqual(
        [
          "id", "eventName", "chainId", "contractAddress", "blockNumber", "txHash",
          "logIndex", "investorAddress", "assetAmountAtomic", "shareAmountAtomic",
          "occurredAt", "indexedAt",
        ].sort(),
      );
    }
  });

  it("every envelope carries the versioned meta contract", async () => {
    if (!backendReachable) return;
    const res = await fetch(`${BASE_URL}/api/v1/btc`, { headers: { Authorization: `Bearer ${mintTestToken()}` } });
    const body = (await res.json()) as { meta: Record<string, unknown> };
    expect(body.meta).toHaveProperty("status");
    expect(body.meta).toHaveProperty("version", "v1");
    expect(body.meta).toHaveProperty("generatedAt");
  });
});
