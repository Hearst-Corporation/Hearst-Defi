import {
  ALLOCATION_ADMIN_LABELS,
  ALLOCATION_BUCKETS,
  ALLOCATION_DESCRIPTIONS,
  ALLOCATION_INVESTOR_LABELS,
  allocationBps,
  bpsToPercent,
  type VaultAllocationFacts,
} from "@/lib/vaults/vault-detail-facts";

// Bento accent tiers — a single green (#A7FB90) stepped down by opacity so the
// donut + dots read as one colour family (matches the Portfolio Capital & Yield
// bento). Index 0 = full accent, then 50%, 25%, 12% for any further sleeves.
const ACCENT = "#A7FB90";
const ACCENT_STROKES = [
  "#A7FB90",
  "rgba(167,251,144,0.5)",
  "rgba(167,251,144,0.25)",
  "rgba(167,251,144,0.12)",
] as const;
const ACCENT_DOT_CLASSES = [
  "bg-[#A7FB90]",
  "bg-[#A7FB90]/50",
  "bg-[#A7FB90]/25",
  "bg-[#A7FB90]/12",
] as const;

function accentStrokeFor(index: number): string {
  return ACCENT_STROKES[index] ?? ACCENT;
}

function accentDotClassFor(index: number): string {
  return ACCENT_DOT_CLASSES[index] ?? ACCENT_DOT_CLASSES[0];
}

export function VaultAllocationAdminRows({
  facts,
}: {
  facts: VaultAllocationFacts;
}) {
  const rows = ALLOCATION_BUCKETS.map((bucket, index) => ({
    bucket,
    label: ALLOCATION_ADMIN_LABELS[bucket],
    bps: allocationBps(facts, bucket),
    index,
  }));

  return (
    <div className="mt-5 flex flex-col gap-4">
      {rows.map((row) => (
        <div
          key={row.bucket}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 pb-3 border-b border-white/5 last:border-b-0 last:pb-0"
        >
          <div
            className={`size-2.5 rounded-full border-2 border-[#15191C] ${accentDotClassFor(
              row.index,
            )}`}
          />
          <span className="text-[13px] font-medium text-zinc-200">
            {row.label}
          </span>
          <span className="text-sm font-bold text-white tabular-nums">
            {bpsToPercent(row.bps)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function VaultAllocationInvestorList({
  facts,
}: {
  facts: VaultAllocationFacts;
}) {
  const segments = ALLOCATION_BUCKETS.map((bucket, sourceIndex) => ({
    bucket,
    bps: allocationBps(facts, bucket),
    sourceIndex,
  })).filter((s) => s.bps > 0);

  // Bento donut geometry (matches Portfolio Capital & Yield): viewBox 0 0 160
  // 160, cx/cy 80, r 66, strokeWidth 16. The wrapper carries the -rotate-90 so
  // each segment's `rotation` is measured clockwise from 12 o'clock.
  const cx = 80;
  const cy = 80;
  const radius = 66;
  const strokeWidth = 16;
  const circumference = radius * 2 * Math.PI;

  // Precompute each segment's cumulative rotation before render so we never
  // mutate a variable during the JSX map (react-hooks/immutability).
  const donutSegments = segments.reduce<
    Array<{
      bucket: (typeof segments)[number]["bucket"];
      stroke: string;
      bps: number;
      strokeDasharray: string;
      rotation: number;
      index: number;
    }>
  >((acc, s, index) => {
    const precedingBps = acc.reduce((sum, prev) => sum + prev.bps, 0);
    const pct = s.bps / 10000;
    // Canonical donut dasharray (DESIGN_SYSTEM §5): `${arc} ${C - arc}` — the gap
    // must be the *remaining* circumference, never the full C (that repeats the
    // dash pattern → phantom arcs). Each segment is its own rotated <circle>.
    const arc = pct * circumference;
    acc.push({
      bucket: s.bucket,
      stroke: accentStrokeFor(index),
      bps: s.bps,
      strokeDasharray: `${arc} ${circumference - arc}`,
      rotation: (precedingBps / 10000) * 360,
      index,
    });
    return acc;
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] items-center gap-8">
      <div className="relative size-[160px] shrink-0 mx-auto md:mx-0">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#15191C"
            strokeWidth={strokeWidth}
          />
          {donutSegments.map((s) => (
            <circle
              key={s.bucket}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={s.stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={s.strokeDasharray}
              strokeLinecap="round"
              transform={`rotate(${s.rotation} ${cx} ${cy})`}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500">
            Target
          </span>
          <span className="text-[22px] font-medium text-white leading-none">
            100%
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 min-w-0">
        {donutSegments.map((s) => (
          <div
            key={s.bucket}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-4 pb-3 border-b border-white/5 last:border-b-0 last:pb-0"
          >
            <div
              className={`size-2.5 rounded-full border-2 border-[#15191C] ${accentDotClassFor(
                s.index,
              )}`}
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] font-medium text-zinc-200">
                {ALLOCATION_INVESTOR_LABELS[s.bucket]}
              </span>
              <p className="text-[12px] text-zinc-500 leading-tight">
                {ALLOCATION_DESCRIPTIONS[s.bucket]}
              </p>
            </div>
            <span className="text-sm font-bold text-white tabular-nums self-start">
              {bpsToPercent(s.bps, 0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
