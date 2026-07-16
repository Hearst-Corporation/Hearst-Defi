// gpu1-backend/src/application/ai-context.ts
//
// The AI context provider. It gives an LLM surface (cockpit chat, memo agents…)
// a HONEST, machine-readable snapshot of what GPU1 actually knows for a given
// screen — so the model never states a number that isn't real.
//
// SINGLE SOURCE OF TRUTH. This does NOT re-derive facts from a parallel provider:
// it calls the SAME builders the HTTP screens use (`buildDashboard`, `buildBtc`,
// `buildMining`) and reads their `Resolved<T>` envelopes. If a field is
// NOT_CONFIGURED in the DTO, it appears in `unavailableFields` here — it is NEVER
// promoted to a `fact`. A field only becomes a `fact` when its status is
// LIVE/STALE/PARTIAL and `value !== null`.
import type { DataStatus, Resolved } from "../domain/index.js";
import type { VaultRepository } from "../persistence/vault-repository.js";
import type { MiningRepository } from "../persistence/mining-repository.js";
import { buildDashboard } from "./dashboard.js";
import { buildBtc } from "./btc.js";
import { buildMining } from "./mining.js";

export type AiSurface = "dashboard" | "btc" | "mining";

/** A field the model MAY assert, with where it came from and how fresh it is. */
export interface AiFact {
  readonly field: string;
  readonly value: unknown;
  readonly provenance: string;
  readonly asOf: string | null;
}

/** A field the model MUST NOT assert (no trustworthy value), with a machine reason. */
export interface AiUnavailableField {
  readonly field: string;
  readonly status: DataStatus;
  readonly reason: string;
}

export interface AiAlert {
  readonly severity: "info" | "notice" | "warning";
  readonly message: string;
}

export interface AiContext {
  readonly surface: AiSurface;
  readonly facts: readonly AiFact[];
  readonly alerts: readonly AiAlert[];
  readonly provenance: readonly string[]; // distinct provenances backing the facts
  readonly freshness: { readonly asOf: string | null; readonly stale: boolean };
  readonly unavailableFields: readonly AiUnavailableField[];
  readonly constraints: readonly string[]; // hard rails the model must respect
}

export interface AiContextDeps {
  readonly repo: VaultRepository;
  readonly miningRepo: MiningRepository;
  readonly nowMs: number;
}

// Product rails that hold on EVERY surface (mirrors the Connect non-negotiables).
const BASE_CONSTRAINTS: readonly string[] = [
  "APY must always be stated as a range, never a single point.",
  "Never use the words: guarantee, promise, certain, will deliver, risk-free.",
  "Never present a NOT_CONFIGURED / null value as zero or as a real figure.",
  "Every projection must show its assumptions and a 'not guaranteed' disclaimer.",
  "No financial or custodial action may be taken from the chat.",
];

/** Reduce a labelled `Resolved<T>` into either a fact (has a real value) or an
 *  unavailable-field entry (null value). Never both. */
function classify(
  field: string,
  r: Resolved<unknown>,
  facts: AiFact[],
  unavailable: AiUnavailableField[],
): void {
  const hasValue =
    (r.status === "LIVE" || r.status === "STALE" || r.status === "PARTIAL") && r.value !== null;
  if (hasValue) {
    facts.push({ field, value: r.value, provenance: r.provenance, asOf: r.freshness.asOf });
  } else {
    unavailable.push({ field, status: r.status, reason: r.reason ?? r.status.toLowerCase() });
  }
}

function assemble(
  surface: AiSurface,
  labelled: ReadonlyArray<readonly [string, Resolved<unknown>]>,
  extraConstraints: readonly string[],
): AiContext {
  const facts: AiFact[] = [];
  const unavailableFields: AiUnavailableField[] = [];
  for (const [field, r] of labelled) classify(field, r, facts, unavailableFields);

  const provenance = [...new Set(facts.map((f) => f.provenance))];
  // Freshest known timestamp across the real facts.
  const stamps = facts.map((f) => f.asOf).filter((s): s is string => s !== null).sort();
  const asOf = stamps.length > 0 ? stamps[stamps.length - 1]! : null;

  const alerts: AiAlert[] =
    unavailableFields.length > 0
      ? [
          {
            severity: "notice",
            message: `${unavailableFields.length} field(s) unavailable (contract not deployed / no data). Do not state values for them.`,
          },
        ]
      : [];

  return {
    surface,
    facts,
    alerts,
    provenance,
    freshness: { asOf, stale: false },
    unavailableFields,
    constraints: [...BASE_CONSTRAINTS, ...extraConstraints],
  };
}

export async function buildAiContext(surface: AiSurface, deps: AiContextDeps, userId: string): Promise<AiContext> {
  switch (surface) {
    case "dashboard": {
      const dto = await buildDashboard(userId, { repo: deps.repo, nowMs: deps.nowMs });
      return assemble(
        "dashboard",
        [
          ["vault", dto.vault],
          ["capacity", dto.capacity],
          ["position", dto.position],
          ["strategies", dto.strategies],
          ["mining", dto.mining],
          ["engine", dto.engine],
          ["recentEvents", dto.recentEvents],
        ],
        [`Contract runtime mode: ${dto.runtime.mode}.`],
      );
    }
    case "btc": {
      const dto = await buildBtc(userId, { nowMs: deps.nowMs });
      return assemble(
        "btc",
        [
          ["reserve", dto.reserve],
          ["exposure", dto.exposure],
          ["btcProduced", dto.btcProduced],
          ["takeProfitTiers", dto.takeProfitTiers],
          ["events", dto.events],
        ],
        [
          `Contract runtime mode: ${dto.runtime.mode}.`,
          "BTC reserve/exposure are on-chain facts; never substitute a spot BTC market price for the vault's actual position.",
        ],
      );
    }
    case "mining": {
      const dto = await buildMining(userId, { repo: deps.miningRepo, nowMs: deps.nowMs });
      return assemble(
        "mining",
        [
          ["hashrate", dto.hashrate],
          ["btcEarned", dto.btcEarned],
          ["electricity", dto.electricity],
          ["curtailment", dto.curtailment],
          ["engine", dto.engine],
          ["operationalTelemetry", dto.operationalTelemetry],
        ],
        [
          `Contract runtime mode: ${dto.runtime.mode}.`,
          "On-chain hashrate / BTC earned are attested by the contract; operationalTelemetry (if present) is fleet/market telemetry, not a per-investor figure.",
        ],
      );
    }
  }
}
