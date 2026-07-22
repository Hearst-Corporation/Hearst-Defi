export type Series1Pocket = {
  id: "B1" | "B2" | "B3";
  label: string;
  targetPct: number;
  detail?: string;
};

export const SERIES1_POCKETS: Series1Pocket[] = [
  { id: "B1", label: "Mining Power", targetPct: 40, detail: "Hashrate deployment funding accumulation" },
  { id: "B2", label: "BTC Reserve", targetPct: 27, detail: "Accumulated Bitcoin held for delivery at maturity" },
  { id: "B3", label: "Operating Reserve", targetPct: 33, detail: "USDC reserve funding electricity and operations" },
];

export function Series1Allocation({ pockets = SERIES1_POCKETS }: { pockets?: Series1Pocket[] }) {
  return (
    <div className="flex flex-col gap-5 p-5">
      {pockets.map((pocket) => (
        <div key={pocket.id}>
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {pocket.id} · {pocket.label}
              </p>
              {pocket.detail ? (
                <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
                  {pocket.detail}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-lg font-semibold tabular-nums">{pocket.targetPct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--s1-panel-soft)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${pocket.targetPct}%`, background: "var(--s1-accent)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
