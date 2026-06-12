import { ProofRow } from "@/components/ui/nested-panel";
import {
  REG_LABELS,
  REG_LABELS_LONG,
  SPV_LABELS,
  SPV_LABELS_LONG,
  STRATEGY_LABELS,
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
        <ProofRow label="Strategy">
          {STRATEGY_LABELS[facts.strategy] ?? facts.strategy}
        </ProofRow>
        <ProofRow label="SPV">
          {SPV_LABELS[facts.spvJurisdiction] ?? facts.spvJurisdiction}
        </ProofRow>
        <ProofRow label="Share Class">{facts.shareClass}</ProofRow>
        <ProofRow label="Reg Exemption">
          {REG_LABELS[facts.regExemption] ?? facts.regExemption}
        </ProofRow>
        <ProofRow label="Min Ticket">
          {`${formatUsdFull(facts.minTicketUsdc)} USDC`}
        </ProofRow>
      </>
    );
  }

  return (
    <>
      <ProofRow label="SPV structure">
        {SPV_LABELS_LONG[facts.spvJurisdiction] ?? facts.spvJurisdiction}
      </ProofRow>
      <ProofRow label="Share class">{`Class ${facts.shareClass}`}</ProofRow>
      <ProofRow label="Regulatory exemption">
        {REG_LABELS_LONG[facts.regExemption] ?? facts.regExemption}
      </ProofRow>
      <ProofRow label="Custodian">Custody configuration pending</ProofRow>
      <ProofRow label="Multisig threshold">Multisig approval required</ProofRow>
      <ProofRow label="Audit">Spearbit · scheduled</ProofRow>
    </>
  );
}
