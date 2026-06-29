import type { ReactNode } from "react";
import { VaultDetailRow } from "@/components/vaults/vault-flow-primitives";
import {
  REG_LABELS,
  REG_LABELS_LONG,
  SPV_LABELS,
  SPV_LABELS_LONG,
  STRATEGY_LABELS,
  VAULT_AUDIT_LABEL,
  VAULT_CUSTODY_LABEL,
  VAULT_MULTISIG_LABEL,
} from "@/lib/constants/vault";
import { formatUsdFull } from "@/lib/vaults/product-display";
import type { VaultLegalFacts } from "@/lib/vaults/vault-detail-facts";

interface VaultLegalProofRowsProps {
  facts: VaultLegalFacts;
  variant: "admin" | "investor";
}

function ProofRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] py-3">
      <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">{label}</span>
      <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)] tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function VaultLegalProofRows({ facts, variant }: VaultLegalProofRowsProps) {
  if (variant === "admin") {
    return (
      <>
        <ProofRow
          label="Strategy"
          value={STRATEGY_LABELS[facts.strategy] ?? facts.strategy}
        />
        <ProofRow
          label="SPV"
          value={SPV_LABELS[facts.spvJurisdiction] ?? facts.spvJurisdiction}
        />
        <ProofRow label="Share Class" value={facts.shareClass} />
        <ProofRow
          label="Reg Exemption"
          value={REG_LABELS[facts.regExemption] ?? facts.regExemption}
        />
        <ProofRow
          label="Min Ticket"
          value={`${formatUsdFull(facts.minTicketUsdc)} USDC`}
        />
      </>
    );
  }

  return (
    <>
      <VaultDetailRow
        label="SPV structure"
        value={SPV_LABELS_LONG[facts.spvJurisdiction] ?? facts.spvJurisdiction}
      />
      <VaultDetailRow label="Share class" value={`Class ${facts.shareClass}`} />
      <VaultDetailRow
        label="Regulatory exemption"
        value={REG_LABELS_LONG[facts.regExemption] ?? facts.regExemption}
      />
      <VaultDetailRow label="Custodian" value={VAULT_CUSTODY_LABEL} />
      <VaultDetailRow label="Multisig threshold" value={VAULT_MULTISIG_LABEL} />
      <VaultDetailRow label="Audit" value={VAULT_AUDIT_LABEL} />
    </>
  );
}
