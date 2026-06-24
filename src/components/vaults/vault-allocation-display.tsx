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
    <div className="vault-alloc-bar group/bar transition-all duration-300 hover:translate-x-1">
      <div className="vault-alloc-bar__head">
        <div className="flex items-center gap-(--ct-space-2_5) min-width-0 flex-1">
          <span
            aria-hidden
            className="vault-alloc-bar__swatch border border-white/10 shadow-sm transition-transform duration-300 group-hover/bar:scale-110"
            style={{ background: color }}
          />
          <span className="vault-alloc-bar__label body-sm font-semibold ct-text-strong truncate group-hover/bar:ct-text-primary">
            {ALLOCATION_INVESTOR_LABELS[bucket]}
          </span>
        </div>
        <span className="vault-alloc-bar__pct body-sm font-bold tabular mono ct-text-strong group-hover/bar:ct-text-accent">
          {bpsToPercent(bps, 0)}%
        </span>
      </div>
      <div
        className="vault-alloc-bar__track bg-(--ct-surface-2) border border-(--ct-border-ghost) transition-colors group-hover/bar:border-(--ct-border-soft)"
        role="img"
        aria-label={`${ALLOCATION_INVESTOR_LABELS[bucket]} ${bpsToPercent(bps, 0)}%`}
      >
        <span
          className="vault-alloc-bar__fill transition-all duration-500 ease-out group-hover/bar:brightness-110"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="vault-alloc-bar__desc body-xs ct-text-faint leading-relaxed transition-colors group-hover/bar:ct-text-muted">
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
  })).filter((s) => s.bps > 0);

  // Donut chart calculations
  const radius = 40;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  let accumulatedBps = 0;

  return (
    <div className="vault-alloc-chart-circular">
      <div className="vault-alloc-donut">
        <svg
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          className="vault-alloc-donut__svg"
        >
          {segments.map((s) => {
            const pct = s.bps / 10000;
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const rotation = (accumulatedBps / 10000) * 360;
            accumulatedBps += s.bps;

            return (
              <circle
                key={s.bucket}
                cx={radius}
                cy={radius}
                r={normalizedRadius}
                fill="transparent"
                stroke={s.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={0}
                transform={`rotate(${rotation - 90} ${radius} ${radius})`}
                className="transition-all duration-700 ease-in-out hover:stroke-white/20 cursor-help"
              />
            );
          })}
        </svg>
        <div className="vault-alloc-donut__center">
          <span className="body-xs ct-text-faint uppercase tracking-widest">Target</span>
          <span className="body-lg font-bold ct-text-strong">100%</span>
        </div>
      </div>

      <div className="vault-alloc-legend">
        {segments.map((s) => (
          <div key={s.bucket} className="vault-alloc-legend__item group/item">
            <div className="flex items-center gap-(--ct-space-3)">
              <span
                className="w-2 h-2 rounded-full shrink-0 transition-transform duration-300 group-hover/item:scale-125"
                style={{ background: s.color }}
              />
              <div className="flex flex-col">
                <div className="flex items-baseline gap-(--ct-space-2)">
                  <span className="body-sm font-semibold ct-text-strong group-hover/item:ct-text-primary">
                    {ALLOCATION_INVESTOR_LABELS[s.bucket]}
                  </span>
                  <span className="body-xs mono ct-text-accent">
                    {bpsToPercent(s.bps, 0)}%
                  </span>
                </div>
                <p className="body-xs ct-text-faint leading-tight mt-0.5">
                  {ALLOCATION_DESCRIPTIONS[s.bucket]}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
