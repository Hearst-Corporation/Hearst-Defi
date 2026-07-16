// src/app/(product)/btc/_components/btc-proof-panel.tsx
//
// Compact contextual-proof panel for the /btc operational strip. Improved
// replacement for the shared ContextualProofPanel on this page:
//  - shows the REAL `kind` of each proof (por / mining-attestation /
//    custody-attestation / event-log) as a discreet BentoBadge;
//  - NO fabricated "Verified {date}" line — the proof ref view model carries
//    no verification date, so none is rendered (the falsified lastVerified
//    derived from the page's generatedAt is retired);
//  - provenance via the unified toProvenance mapping.

import { Card } from "@/components/catalyst/card";
import { Link } from "@/components/catalyst/link";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { Activity } from "lucide-react";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import type { BtcProofRefViewModel } from "../_data/btc-page-types";

const KIND_META: Record<
  BtcProofRefViewModel["kind"],
  { badge: string; icon: "btc" | "mining" | "reserve" | null }
> = {
  por: { badge: "PoR", icon: "btc" },
  "mining-attestation": { badge: "Mining", icon: "mining" },
  "custody-attestation": { badge: "Custody", icon: "reserve" },
  "event-log": { badge: "Event log", icon: null },
};

export function BtcProofPanel({
  proofs,
  provenance = "simulated",
}: {
  proofs: readonly BtcProofRefViewModel[];
  provenance?: Provenance;
}) {
  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-4)]">
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <Activity size={16} className="ct-text-muted" aria-hidden />
          <span className="ct-bento-label">Contextual proofs</span>
        </div>
        <ProvenanceBadge kind={provenance} variant="compact" />
      </div>

      {proofs.length === 0 ? (
        <p className="body-sm ct-text-muted m-0">
          Proof references will appear once attestations are indexed.
        </p>
      ) : (
        <div className="flex flex-col">
          {proofs.map((proof, i) => {
            const meta = KIND_META[proof.kind];
            return (
              <div
                key={`${proof.kind}-${i}`}
                className={`flex items-center justify-between gap-[var(--ct-space-3)] py-[var(--ct-space-2)] ${
                  i > 0 ? "border-t border-[var(--ct-border-soft)]" : ""
                }`}
              >
                <div className="flex items-center gap-[var(--ct-space-2)] min-w-0">
                  <span className="shrink-0" aria-hidden>
                    {meta.icon != null ? (
                      <AssetIcon variant={meta.icon} size="sm" />
                    ) : (
                      <Activity size={16} className="ct-text-muted" />
                    )}
                  </span>
                  <span className="body-sm ct-text-strong font-medium truncate">{proof.label}</span>
                </div>
                <span className="flex items-center gap-[var(--ct-space-2)] shrink-0">
                  <BentoBadge>{meta.badge}</BentoBadge>
                  <Link href={proof.href} className="body-xs ct-link-accent">
                    View proof
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
