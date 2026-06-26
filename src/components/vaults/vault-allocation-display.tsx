import { Progress } from "@/components/ui/progress";
import { allocationStrokeFor } from "@/lib/allocation-colors";
import {
  ALLOCATION_ADMIN_LABELS,
  ALLOCATION_BUCKETS,
  ALLOCATION_DESCRIPTIONS,
  ALLOCATION_INVESTOR_LABELS,
  allocationBps,
  bpsToPercent,
  type VaultAllocationFacts,
} from "@/lib/vaults/vault-detail-facts";

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

  // Precompute each segment's cumulative rotation before render so we never
  // mutate a variable during the JSX map (react-hooks/immutability).
  const donutSegments = segments.reduce<
    Array<{ bucket: (typeof segments)[number]["bucket"]; color: string; bps: number; strokeDasharray: string; rotation: number }>
  >((acc, s) => {
    const precedingBps = acc.reduce((sum, prev) => sum + prev.bps, 0);
    const pct = s.bps / 10000;
    // Canonical donut dasharray (DESIGN_SYSTEM §5): `${arc} ${C - arc}` — the gap
    // must be the *remaining* circumference, never the full C (that repeats the
    // dash pattern → phantom arcs). Each segment is its own rotated <circle>.
    const arc = pct * circumference;
    acc.push({
      bucket: s.bucket,
      color: s.color,
      bps: s.bps,
      strokeDasharray: `${arc} ${circumference - arc}`,
      rotation: (precedingBps / 10000) * 360,
    });
    return acc;
  }, []);

  return (
    <div className="vault-alloc-chart-circular">
      <div className="vault-alloc-donut">
        <svg
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          className="vault-alloc-donut__svg"
        >
          {donutSegments.map((s) => (
            <circle
              key={s.bucket}
              cx={radius}
              cy={radius}
              r={normalizedRadius}
              fill="transparent"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={s.strokeDasharray}
              strokeDashoffset={0}
              transform={`rotate(${s.rotation - 90} ${radius} ${radius})`}
              className="ct-donut-seg"
            />
          ))}
        </svg>
        <div className="vault-alloc-donut__center">
          <span className="body-xs ct-text-muted uppercase tracking-widest">Target</span>
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
