import { Progress } from "@/components/ui/progress";
import { allocationDashToneFor } from "@/lib/allocation-colors";
import { cn } from "@/lib/cn";
import type { AllocationBucket } from "@/lib/engine/types";
import {
  ALLOCATION_ADMIN_LABELS,
  ALLOCATION_BUCKETS,
  ALLOCATION_DESCRIPTIONS,
  ALLOCATION_INVESTOR_LABELS,
  allocationBps,
  bpsToPercent,
  type VaultAllocationFacts,
} from "@/lib/vaults/vault-detail-facts";

function AllocationInvestorRow({
  bucket,
  bps,
}: {
  bucket: AllocationBucket;
  bps: number;
}) {
  const dotTone = allocationDashToneFor(bucket);

  return (
    <div className="vault-allocation-row">
      <span
        aria-hidden
        className={cn("dash-legend-dot mt-1 shrink-0", `dot-${dotTone}`)}
      />
      <div className="vault-allocation-row__body">
        <div className="min-w-0">
          <p className="body-sm font-semibold ct-text-primary">
            {ALLOCATION_INVESTOR_LABELS[bucket]}
          </p>
          <p className="body-xs ct-text-muted mt-0.5">
            {ALLOCATION_DESCRIPTIONS[bucket]}
          </p>
        </div>
        <span className="h4 tabular mono ct-text-strong shrink-0">
          {bpsToPercent(bps, 0)}%
        </span>
      </div>
    </div>
  );
}

export function VaultAllocationAdminRows({
  facts,
}: {
  facts: VaultAllocationFacts;
}) {
  return (
    <div className="mt-4 admin-doc-stack admin-doc-stack--relaxed">
      {ALLOCATION_BUCKETS.map((bucket) => {
        const bps = allocationBps(facts, bucket);
        const label = ALLOCATION_ADMIN_LABELS[bucket];
        return (
          <div key={bucket} className="admin-doc-stack admin-doc-stack--compact">
            <div className="admin-doc-row-spread">
              <span className="stat-label">{label}</span>
              <span className="mono tabular body-sm ct-text-primary">
                {bpsToPercent(bps)}%
              </span>
            </div>
            <Progress value={bps} max={10000} label={`${label} allocation`} />
          </div>
        );
      })}
    </div>
  );
}

export function VaultAllocationInvestorList({
  facts,
}: {
  facts: VaultAllocationFacts;
}) {
  return (
    <div>
      {ALLOCATION_BUCKETS.map((bucket) => (
        <AllocationInvestorRow
          key={bucket}
          bucket={bucket}
          bps={allocationBps(facts, bucket)}
        />
      ))}
    </div>
  );
}
