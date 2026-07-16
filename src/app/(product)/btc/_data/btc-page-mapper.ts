// src/app/(product)/btc/_data/btc-page-mapper.ts
//
// Maps hearst-connect-backend's BtcDTO (src/lib/backend/contracts.ts) onto
// this page's BtcPageExtraViewModel (btc-page-types.ts). This is the ONE
// place that translates the backend's wire shape into the page's
// presentation shape — the page component itself never touches BtcDTO
// directly (see btc-page-types.ts header: "the field names below were
// chosen to make that a rename, not a redesign").

import { resolved, type ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { DataStatus, BtcDTO, VaultEvent } from "@/lib/backend";
import type {
  BtcAttributionViewModel,
  BtcCustodyViewModel,
  BtcEventViewModel,
  BtcEventType,
  BtcPageExtraViewModel,
  BtcProductionViewModel,
  BtcProofRefViewModel,
} from "./btc-page-types";

const AI_EXPERTS_CONTEXTUAL = [
  {
    id: "btc-reserve-analyst",
    name: "BTC Reserve Analyst",
    focus: "Reserve sizing & accumulation pace",
    summary:
      "Tracks the B2 BTC Pouch against the 24-month accumulation term and flags pace deviations — advisory only, no autonomous action.",
  },
  {
    id: "custody-attestation-reviewer",
    name: "Custody Attestation Reviewer",
    focus: "Proof-of-reserve cadence",
    summary:
      "Confirms the custody attestation cadence stays current and cross-checks it against the Proof Center log.",
  },
] as const;

function toUiStatus(status: DataStatus): ResolvedViewModel<unknown>["status"] {
  switch (status) {
    case "LIVE":
      return "LIVE";
    case "STALE":
      return "STALE";
    case "PARTIAL":
      return "PARTIAL";
    case "NOT_CONFIGURED":
    case "NOT_SUPPORTED":
    case "PERMISSION_DENIED":
      return "NOT_CONFIGURED";
    case "UNAVAILABLE":
      return "UNAVAILABLE";
  }
}

function toFreshness(freshness: { readonly asOf: string | null; readonly stale: boolean }): string {
  if (freshness.asOf == null) return "unavailable";
  return freshness.stale ? `stale — last updated ${freshness.asOf}` : `as of ${freshness.asOf}`;
}

/** The backend reported a status implying a value (LIVE/STALE), but one or
 *  more fields this page's viewmodel requires were still null — an honest
 *  partial read, never upgraded to LIVE with a fabricated field. Anything
 *  already non-LIVE-ish stays as-is. */
function downgradeForMissingFields(status: DataStatus): ResolvedViewModel<unknown>["status"] {
  return status === "LIVE" || status === "STALE" ? "PARTIAL" : toUiStatus(status);
}

// The backend's VaultEvent (generic chain-event shape) doesn't carry a
// BtcEventType — this maps the handful of event names relevant to the BTC
// ledger. Any event name outside this map is dropped from the /btc ledger
// (it isn't a BTC-relevant movement) rather than mis-typed.
const EVENT_NAME_TO_TYPE: Partial<Record<VaultEvent["name"], BtcEventType>> = {
  MiningMetricsReported: "mining_settlement",
  Deposit: "btc_purchase",
  ElectricityPaid: "operational_conversion",
};

function mapEvent(e: VaultEvent): BtcEventViewModel | null {
  const type = EVENT_NAME_TO_TYPE[e.name];
  if (!type) return null;
  return {
    type,
    label: e.name,
    occurredAt: e.timestamp ?? "",
    deltaSats: e.amount,
    source: e.category,
    status: e.severity === "warning" ? "pending" : "confirmed",
    detail: null,
    txHash: e.txHash,
    proofHref: "/proof-center",
  };
}

export function mapBtcExtra(dto: BtcDTO): BtcPageExtraViewModel {
  const attribution = dto.attribution;
  const production = dto.production;
  const custody = dto.custody;
  const events = dto.events;
  const proofs = dto.proofs;

  // BtcAttributionViewModel/BtcProductionViewModel require every field
  // non-null once a value is present — the backend's Resolved<T> allows
  // status LIVE/PARTIAL with SOME inner fields still null (an honest partial
  // read). If any required field is missing, this is reported as PARTIAL
  // with value: null rather than fabricating a placeholder or forcing a type
  // cast — the page then renders the honest "partial" state for that block.
  const attributionComplete =
    attribution.value != null &&
    attribution.value.attributedBtcSats != null &&
    attribution.value.attributedBtcUsd != null &&
    attribution.value.lastVerifiedAt != null
      ? {
          attributedBtcSats: attribution.value.attributedBtcSats,
          attributedBtcUsd: attribution.value.attributedBtcUsd,
          lastVerifiedAt: attribution.value.lastVerifiedAt,
        }
      : null;
  const attributionVm = resolved<BtcAttributionViewModel>(
    attributionComplete != null ? toUiStatus(attribution.status) : downgradeForMissingFields(attribution.status),
    attributionComplete,
    {
      provenance: `backend:${attribution.provenance}`,
      freshness: toFreshness(attribution.freshness),
      error: attribution.reason ? { code: attribution.reason, message: attribution.reason } : null,
    },
  );

  const productionComplete =
    production.value != null &&
    production.value.cumulativeSatsEarned != null &&
    production.value.cumulativeBtcEarned != null
      ? {
          monthly: production.value.monthly,
          cumulativeSatsEarned: production.value.cumulativeSatsEarned,
          cumulativeBtcEarned: production.value.cumulativeBtcEarned,
        }
      : null;
  const productionVm = resolved<BtcProductionViewModel>(
    productionComplete != null ? toUiStatus(production.status) : downgradeForMissingFields(production.status),
    productionComplete,
    {
      provenance: `backend:${production.provenance}`,
      freshness: toFreshness(production.freshness),
      error: production.reason ? { code: production.reason, message: production.reason } : null,
    },
  );

  const custodyVm = resolved<BtcCustodyViewModel>(toUiStatus(custody.status), custody.value, {
    provenance: `backend:${custody.provenance}`,
    freshness: toFreshness(custody.freshness),
    error: custody.reason ? { code: custody.reason, message: custody.reason } : null,
  });

  const eventsVm = resolved<readonly BtcEventViewModel[]>(
    toUiStatus(events.status),
    events.value == null ? null : events.value.map(mapEvent).filter((e): e is BtcEventViewModel => e !== null),
    {
      provenance: `backend:${events.provenance}`,
      freshness: toFreshness(events.freshness),
      error: events.reason ? { code: events.reason, message: events.reason } : null,
    },
  );

  const proofsVm = resolved<readonly BtcProofRefViewModel[]>(toUiStatus(proofs.status), proofs.value, {
    provenance: `backend:${proofs.provenance}`,
    freshness: toFreshness(proofs.freshness),
    error: proofs.reason ? { code: proofs.reason, message: proofs.reason } : null,
  });

  return {
    attribution: attributionVm,
    production: productionVm,
    custody: custodyVm,
    events: eventsVm,
    proofs: proofsVm,
    aiExperts: AI_EXPERTS_CONTEXTUAL,
  };
}
