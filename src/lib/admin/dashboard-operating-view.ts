// dashboard-operating-view — pure view resolvers for the rebuilt
// /admin/dashboard (docs/front-dashboard-zero-rebuild-canon.md).
//
// Replaces `resolveSystemReadiness`, which was bound to the retired yield-era
// fixture model (canon F5): it derived its posture from `risk.dimensions`
// (market / liquidity / counterparty scores of the yield vaults) and named a
// vault out of `DASHBOARD_FIXTURE_VAULTS`. None of that describes Series 1.
//
// Every figure here is derived from something actually measured — proof
// freshness, custody configuration, the operator queue, the audit trail. When
// a signal is absent the tone is `idle` and the copy says so; nothing is
// invented (canon §3 / F4: no synthetic uptime, no synthetic scan time, no
// green pill that is not computed). A signal whose READ failed (null counts,
// custody `unavailable`) is reported as unreachable/unavailable — never as
// "Clear", "Empty" or "Manual".
//
// Pure: no I/O, no Prisma, no fetch. Same testable seam as the other
// `src/lib/admin/*-view.ts` resolvers.

import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { HeroKpi } from "@/lib/admin/kpi-strip-view";

export type OperatingTone = "ok" | "watch" | "alert" | "idle";

export interface OperatingFactor {
  id: string;
  label: string;
  status: string;
  detail: string;
  tone: OperatingTone;
}

export interface OperatingReadinessView {
  posture: OperatingTone;
  postureLabel: string;
  postureBlurb: string;
  factors: OperatingFactor[];
}

const POSTURE_LABEL: Record<OperatingTone, string> = {
  ok: "Operational",
  watch: "Attention required",
  alert: "Action required",
  idle: "Awaiting telemetry",
};

/** Worst tone wins — a single alert makes the whole posture an alert. */
const TONE_RANK: Record<OperatingTone, number> = {
  ok: 0,
  idle: 1,
  watch: 2,
  alert: 3,
};

/** Operator queue length above this asks for attention (`watch`).
 *  Operational threshold — hand-tuned, no external source. */
const QUEUE_WATCH_THRESHOLD = 3;

export function worstTone(tones: readonly OperatingTone[]): OperatingTone {
  return tones.reduce<OperatingTone>(
    (worst, tone) => (TONE_RANK[tone] > TONE_RANK[worst] ? tone : worst),
    "ok",
  );
}

export interface OperatingInputs {
  proof: AdminProofStatus;
  /** Items currently sitting in the operator queue.
   *  `null` = the queue could NOT be read (DB error) — distinct from 0. */
  operatorQueueCount: number | null;
  /** Audit entries on file — 0 means the trail has never been written to.
   *  `null` = the trail could NOT be read (DB error) — distinct from 0. */
  auditEntryCount: number | null;
  /** Series 1 contract mode, from `getVaultMode()`. */
  vaultMode: "v2" | "legacy" | "not_configured";
}

/**
 * Readiness posture from real operator signals only.
 *
 * Deliberately NOT included: uptime (no feed exists), "last scan" (no scan
 * runs), and any fixture-era product posture / risk band (retired model).
 */
export function resolveOperatingReadiness(
  input: OperatingInputs,
): OperatingReadinessView {
  const { proof, operatorQueueCount, auditEntryCount, vaultMode } = input;

  const factors: OperatingFactor[] = [
    contractFactor(vaultMode),
    proofFactor(proof),
    custodyFactor(proof),
    queueFactor(operatorQueueCount),
    auditFactor(auditEntryCount),
  ];

  const posture = worstTone(factors.map((f) => f.tone));

  return {
    posture,
    postureLabel: POSTURE_LABEL[posture],
    postureBlurb: postureBlurb(posture, vaultMode),
    factors,
  };
}

function contractFactor(mode: OperatingInputs["vaultMode"]): OperatingFactor {
  if (mode === "v2") {
    return {
      id: "contract",
      label: "Contract",
      status: "Deployed",
      detail: "PermissionedDynaVault v2.1 is the active deployment",
      tone: "ok",
    };
  }
  if (mode === "legacy") {
    return {
      id: "contract",
      label: "Contract",
      status: "Legacy",
      detail: "Running on the prior deployment; the v2.1 address is not posted yet",
      tone: "watch",
    };
  }
  return {
    id: "contract",
    label: "Contract",
    status: "Not configured",
    detail: "No vault address is configured on this environment",
    tone: "idle",
  };
}

function proofFactor(proof: AdminProofStatus): OperatingFactor {
  if (proof.attestationsCount === 0) {
    return {
      id: "proof",
      label: "Proof",
      status: "No attestation",
      detail: "No mining attestation has been filed yet",
      tone: "idle",
    };
  }
  const tone: OperatingTone = proof.miningFreshness === "live" ? "ok" : "watch";
  return {
    id: "proof",
    label: "Proof",
    status: proof.miningFreshness === "live" ? "Current" : "Overdue",
    detail: `${proof.attestationsCount} mining attestation${
      proof.attestationsCount === 1 ? "" : "s"
    } on file · ${proof.proofsTotal} proof${proof.proofsTotal === 1 ? "" : "s"} total`,
    tone,
  };
}

function custodyFactor(proof: AdminProofStatus): OperatingFactor {
  if (!proof.custodyConfigured) {
    return {
      id: "custody",
      label: "Custody",
      status: "Not configured",
      detail: "No custody scope is pinned for proof-of-reserve",
      tone: "idle",
    };
  }
  // Outage branch — the provider was configured but could not be reached.
  // This is NOT "Manual": nothing was entered by anyone, nothing was read.
  if (proof.custodyProvenance === "unavailable") {
    return {
      id: "custody",
      label: "Custody",
      status: "Unreachable",
      detail:
        "The custody provider could not be reached — no reserve figure was read",
      tone: "alert",
    };
  }
  return {
    id: "custody",
    label: "Custody",
    status: proof.custodyProvenance === "live" ? "Live read" : "Manual",
    detail:
      proof.custodyProvenance === "live"
        ? "Reserve balance read from the custody provider"
        : "Reserve balance entered manually",
    tone: proof.custodyProvenance === "live" ? "ok" : "watch",
  };
}

function queueFactor(count: number | null): OperatingFactor {
  // Unreadable queue ≠ clear queue: the read failed, we know nothing.
  if (count === null) {
    return {
      id: "queue",
      label: "Operator queue",
      status: "Unavailable",
      detail: "Operator queue could not be read — database error",
      tone: "idle",
    };
  }
  if (count === 0) {
    return {
      id: "queue",
      label: "Operator queue",
      status: "Clear",
      detail: "Nothing is waiting on an operator",
      tone: "ok",
    };
  }
  return {
    id: "queue",
    label: "Operator queue",
    status: `${count} pending`,
    detail: `${count} item${count === 1 ? "" : "s"} awaiting an operator decision`,
    tone: count > QUEUE_WATCH_THRESHOLD ? "watch" : "ok",
  };
}

function auditFactor(count: number | null): OperatingFactor {
  // Unreadable trail ≠ empty trail: the read failed, we know nothing.
  if (count === null) {
    return {
      id: "audit",
      label: "Audit trail",
      status: "Unavailable",
      detail: "Audit trail could not be read — database error",
      tone: "idle",
    };
  }
  if (count === 0) {
    return {
      id: "audit",
      label: "Audit trail",
      status: "Empty",
      detail: "No audited action has been recorded yet",
      tone: "idle",
    };
  }
  return {
    id: "audit",
    label: "Audit trail",
    status: "Recording",
    detail: `${count} recent action${count === 1 ? "" : "s"} on file`,
    tone: "ok",
  };
}

function postureBlurb(
  posture: OperatingTone,
  mode: OperatingInputs["vaultMode"],
): string {
  const contract =
    mode === "v2"
      ? "The v2.1 contract is live."
      : mode === "legacy"
        ? "The platform is running on the legacy deployment while the v2.1 address is pending."
        : "No vault contract is configured on this environment.";

  switch (posture) {
    case "ok":
      return `${contract} Every supervised signal resolved and is within its expected range.`;
    case "watch":
      return `${contract} At least one signal needs an operator's attention before it degrades.`;
    case "alert":
      return `${contract} At least one signal requires action now.`;
    case "idle":
      return `${contract} Some signals have not produced data yet — they are reported as awaiting, not as healthy.`;
  }
}

/**
 * Proof / custody as KPI cells for the canon strip. Values are formatted from
 * the real read; an absent value is an em dash, never a zero. Provenance is
 * resolved HERE from the loader-borne facts — the render layer passes it
 * through untouched.
 */
export function buildOperatingKpis(input: {
  proof: AdminProofStatus;
  /** `null` = the operator queue could not be read (DB error). */
  operatorQueueCount: number | null;
  investorCount: number;
  investedCapitalUsdc: number;
}): HeroKpi[] {
  const { proof, operatorQueueCount, investorCount, investedCapitalUsdc } = input;

  return [
    {
      label: "Capital deployed",
      value: investedCapitalUsdc > 0 ? formatUsdCompact(investedCapitalUsdc) : "—",
      sublabel: investedCapitalUsdc > 0 ? "across every vault" : "no subscription recorded",
      provenance: "manual",
    },
    {
      label: "Investors",
      value: investorCount > 0 ? String(investorCount) : "—",
      sublabel: investorCount > 0 ? "with a position on file" : "none on file",
      provenance: "manual",
    },
    {
      label: "Proofs on file",
      value: proof.proofsTotal > 0 ? String(proof.proofsTotal) : "—",
      sublabel:
        proof.attestationsCount > 0
          ? `${proof.attestationsCount} mining attestation${proof.attestationsCount === 1 ? "" : "s"}`
          : "no attestation yet",
      provenance: proof.miningFreshness === "live" ? "attested" : "stale",
    },
    custodyKpi(proof),
    operatorQueueKpi(operatorQueueCount),
  ];
}

function custodyKpi(proof: AdminProofStatus): HeroKpi {
  // Outage: configured, but nothing was read. "—" + stale badge + alert —
  // never "manually recorded" (nobody recorded anything).
  if (proof.custodyConfigured && proof.custodyProvenance === "unavailable") {
    return {
      label: "Custody reserves",
      value: "—",
      sublabel: "provider unreachable — nothing was read",
      provenance: "stale",
      alert: true,
    };
  }
  return {
    label: "Custody reserves",
    // A null reserve means nothing was read (provider unreachable, or not
    // configured) — it is shown as absent, never as "$0", which would assert
    // a measured empty vault.
    value:
      proof.custodyConfigured && proof.custodyReservesUsdc !== null
        ? formatUsdCompact(proof.custodyReservesUsdc)
        : "—",
    sublabel: proof.custodyConfigured
      ? proof.custodyProvenance === "live"
        ? "live custody read"
        : "manually recorded"
      : "custody scope not configured",
    provenance: proof.custodyProvenance === "live" ? "live" : "manual",
  };
}

function operatorQueueKpi(count: number | null): HeroKpi {
  // Unreadable queue: "—" + stale badge — never "0 · nothing pending".
  if (count === null) {
    return {
      label: "Operator queue",
      value: "—",
      sublabel: "queue unavailable — database read failed",
      provenance: "stale",
      alert: true,
    };
  }
  return {
    label: "Operator queue",
    value: String(count),
    sublabel: count === 0 ? "nothing pending" : "awaiting a decision",
    provenance: "live",
    accent: count > 0,
  };
}

/** Compact USD for operator density. Local to keep this module pure. */
function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}
