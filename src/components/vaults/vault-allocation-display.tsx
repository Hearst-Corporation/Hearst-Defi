import { Progress } from "@/components/ui/progress";
import { allocationStrokeFor } from "@/lib/allocation-colors";
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

function AllocationBar({
  bucket,
  bps,
}: {
  bucket: AllocationBucket;
  bps: number;
}) {
  const color = allocationStrokeFor(bucket);
  const pct = bps / 100;

  return (
    <div className="vault-alloc-bar">
      <div className="vault-alloc-bar__head">
        <div className="flex items-center gap-(--ct-space-2_5) min-width-0 flex-1">
          <span
            aria-hidden
            className="vault-alloc-bar__swatch border border-white/10 shadow-sm"
            style={{ background: color }}
          />
          <span className="vault-alloc-bar__label body-sm font-semibold ct-text-strong truncate">
            {ALLOCATION_INVESTOR_LABELS[bucket]}
          </span>
        </div>
        <span className="vault-alloc-bar__pct body-sm font-bold tabular mono ct-text-strong">
          {bpsToPercent(bps, 0)}%
        </span>
      </div>
      <div
        className="vault-alloc-bar__track bg-(--ct-surface-2) border border-(--ct-border-ghost)"
        role="img"
        aria-label={`${ALLOCATION_INVESTOR_LABELS[bucket]} ${bpsToPercent(bps, 0)}%`}
      >
        <span
          className="vault-alloc-bar__fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="vault-alloc-bar__desc body-xs ct-text-faint leading-relaxed">
        {ALLOCATION_DESCRIPTIONS[bucket]}
      </p>
    </div>
  );
}

export function VaultAllocationAdminRows({
  facts,
}: {
  facts: VaultAllocationFacts;
}) {
  return (
    <div className="mt-(--ct-space-4) admin-doc-stack admin-doc-stack--relaxed">
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
  const segments = ALLOCATION_BUCKETS.map((bucket) => ({
    bucket,
    bps: allocationBps(facts, bucket),
    color: allocationStrokeFor(bucket),
  }));

  return (
    <div className="vault-alloc-chart">
      <div
        className="vault-alloc-stack"
        role="img"
        aria-label="Target allocation breakdown"
      >
        {segments
          .filter((s) => s.bps > 0)
          .map((s) => (
            <span
              key={s.bucket}
              className="vault-alloc-stack__seg"
              style={{ width: `${s.bps / 100}%`, background: s.color }}
            />
          ))}
      </div>

      <div className="vault-alloc-bars">
        {segments.map((s) => (
          <AllocationBar key={s.bucket} bucket={s.bucket} bps={s.bps} />
        ))}
      </div>
    </div>
  );
}
