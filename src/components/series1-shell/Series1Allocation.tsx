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
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                {pocket.id} · {pocket.label}
              </p>
              {pocket.detail ? (
                <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {pocket.detail}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-lg font-semibold text-zinc-950 tabular-nums dark:text-white">
              {pocket.targetPct}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/5">
            {/* The accent fills the bar because the bar IS the datum. */}
            <div
              className="h-full rounded-full bg-[#a7fb90]"
              style={{ width: `${pocket.targetPct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
