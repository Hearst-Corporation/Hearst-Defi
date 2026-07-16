// src/app/(product)/btc/_components/btc-custody-panel.tsx
//
// Custody block — provider, vault account, last proof-of-reserve attestation,
// withdrawal policy. Honest NOT_CONFIGURED / PARTIAL rendering when the
// custody link isn't established yet.

import { BentoDetailRow } from "@/components/catalyst/bento";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  DataNotConfigured,
  DataPartial,
} from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { BtcCustodyViewModel } from "../_data/btc-page-types";
import { formatIsoDate } from "../_data/format-btc";

const PROVIDER_LABEL: Record<NonNullable<BtcCustodyViewModel["provider"]>, string> = {
  fireblocks: "Fireblocks",
  unknown: "Unknown",
};

export function BtcCustodyPanel({
  custody,
}: {
  custody: ResolvedViewModel<BtcCustodyViewModel>;
}) {
  if (custody.status === "PARTIAL" && custody.value === null) {
    return (
      <DataPartial
        label="Custody"
        detail={custody.freshness ?? "Custody provider linked, attestation pending."}
      />
    );
  }

  if (custody.status === "NOT_CONFIGURED" || custody.value === null) {
    return (
      <DataNotConfigured
        label="Custody"
        detail="No custody provider is linked to this vault yet."
      />
    );
  }

  const { value } = custody;

  const body = (
    <dl className="flex flex-col gap-0">
      <BentoDetailRow label="Provider">
        {value.provider ? PROVIDER_LABEL[value.provider] : "—"}
      </BentoDetailRow>
      <BentoDetailRow label="Vault account">
        {value.vaultAccountId ?? "—"}
      </BentoDetailRow>
      <BentoDetailRow label="Last PoR attestation">
        <span className="inline-flex items-center gap-[var(--ct-space-1_5)]">
          {formatIsoDate(value.proofOfReserveAttestedAt)}
          <ProvenanceBadge kind="attested" compact />
        </span>
      </BentoDetailRow>
      <BentoDetailRow label="Withdrawal policy">
        {value.withdrawalPolicy ?? "—"}
      </BentoDetailRow>
    </dl>
  );

  return custody.status === "PARTIAL" ? (
    <DataPartial label="Custody" detail={custody.freshness}>
      {body}
    </DataPartial>
  ) : (
    body
  );
}
