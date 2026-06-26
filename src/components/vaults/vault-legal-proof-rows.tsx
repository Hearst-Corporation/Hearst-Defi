import { LegalMetadataRow } from "@/components/ui/nested-panel";
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

export function VaultLegalProofRows({ facts, variant }: VaultLegalProofRowsProps) {
  if (variant === "admin") {
    return (
      <>
        <LegalMetadataRow label="Strategy">
          {STRATEGY_LABELS[facts.strategy] ?? facts.strategy}
        </LegalMetadataRow>
        <LegalMetadataRow label="SPV">
          {SPV_LABELS[facts.spvJurisdiction] ?? facts.spvJurisdiction}
        </LegalMetadataRow>
        <LegalMetadataRow label="Share Class">{facts.shareClass}</LegalMetadataRow>
        <LegalMetadataRow label="Reg Exemption">
          {REG_LABELS[facts.regExemption] ?? facts.regExemption}
        </LegalMetadataRow>
        <LegalMetadataRow label="Min Ticket">
          {`${formatUsdFull(facts.minTicketUsdc)} USDC`}
        </LegalMetadataRow>
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
