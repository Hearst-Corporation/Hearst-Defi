import { ApyRange } from "@/components/ui/apy-range";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { bpsToPercent, type VaultKpiFacts } from "@/lib/vaults/vault-detail-facts";

interface VaultAdminKpiStripProps {
  facts: VaultKpiFacts;
  showAumCard: boolean;
}

export function VaultAdminKpiStrip({
  facts,
  showAumCard,
}: VaultAdminKpiStripProps) {
  const aumPct =
    facts.capacityUsdc > 0
      ? (facts.currentAumUsdc / facts.capacityUsdc) * 100
      : 0;

  return (
    <div className="admin-doc-kpi-grid-4">
      <Card>
        <div className="admin-doc-inline-row admin-doc-inline-row--between mb-1">
          <span className="stat-label">Target APY</span>
          <ProvenanceBadge kind="estimated" />
        </div>
        <ApyRange low={facts.apyLow} high={facts.apyHigh} precision={1} />
        <p className="body-xs ct-text-faint mt-1">Not guaranteed — estimated</p>
      </Card>

      <Card>
        <span className="stat-label block mb-1">Fees</span>
        <span className="stat-value mono tabular">
          {bpsToPercent(facts.mgmtFeeBps)}% / {bpsToPercent(facts.perfFeeBps)}%
        </span>
        <p className="body-xs ct-text-faint mt-1">Mgmt / Perf</p>
      </Card>

      <Card>
        <span className="stat-label block mb-1">Lock-up</span>
        <span className="stat-value mono tabular">
          {facts.softLockupDays}d
        </span>
        <p className="body-xs ct-text-faint mt-1">Soft lock-up</p>
      </Card>

      {showAumCard ? (
        <Card>
          <div className="admin-doc-inline-row admin-doc-inline-row--between mb-1">
            <span className="stat-label">AUM</span>
            <ProvenanceBadge
              kind={facts.currentAumUsdc > 0 ? "live" : "estimated"}
            />
          </div>
          <span className="stat-value mono tabular">
            {formatUsdFull(facts.currentAumUsdc)}
          </span>
          <div className="mt-2">
            <Progress value={aumPct} label="AUM vs capacity" />
          </div>
          <p className="body-xs ct-text-faint mt-1">
            / {formatUsdFull(facts.capacityUsdc)} capacity
          </p>
        </Card>
      ) : null}
    </div>
  );
}
