import { cn } from "@/lib/cn";
import { deriveStressRegimes, type StressRegime } from "@/lib/constants/vault";
import type { VaultProduct } from "@/lib/data/vaults";

const TONE_DOT: Record<StressRegime["tone"], string> = {
  success: "bg-[var(--ct-accent)]",
  danger: "bg-zinc-600",
};

const TONE_LABEL: Record<StressRegime["tone"], string> = {
  success: "text-white",
  danger: "text-zinc-400",
};

function PctCell({ value }: { value: number }) {
  return <span className="text-[14px] font-medium text-white tabular-nums">{value}%</span>;
}

interface RegimeScenarioTableProps {
  vault: VaultProduct;
}

export function RegimeScenarioTable({ vault }: RegimeScenarioTableProps) {
  const regimes = deriveStressRegimes(vault);
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th
                scope="col"
                className="pl-5 pr-4 py-3 text-left ct-bento-label"
              >
                Regime
              </th>
              <th
                scope="col"
                className="hidden md:table-cell px-4 py-3 text-left ct-bento-label"
              >
                Scenario
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left ct-bento-label"
              >
                APY range
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right ct-bento-label"
              >
                Min
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right ct-bento-label"
              >
                BTC
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right ct-bento-label"
              >
                USDC
              </th>
              <th
                scope="col"
                className="pr-5 pl-4 py-3 text-right ct-bento-label"
              >
                Res
              </th>
            </tr>
          </thead>
          <tbody>
            {regimes.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
              >
                <td className="pl-5 pr-4 py-4 align-top">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-1 w-1 h-9 rounded-full", TONE_DOT[row.tone])} />
                    <div className="flex flex-col gap-1">
                      <span
                        className={cn(
                          "text-[14px] font-medium uppercase tracking-wide",
                          TONE_LABEL[row.tone],
                        )}
                      >
                        {row.label}
                      </span>
                      <span className="md:hidden text-[10px] text-zinc-500 leading-tight">
                        {row.scenario}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell px-4 py-4 align-top max-w-[18rem] text-[length:var(--ct-text-2xs)] text-zinc-400 leading-relaxed">
                  {row.scenario}
                </td>
                <td className="px-4 py-4 align-top">
                  <span className="text-[14px] font-medium text-[var(--ct-accent)] tabular-nums whitespace-nowrap">
                    {row.apyLow.toFixed(1)} <span className="text-zinc-500 mx-0.5">—</span>{" "}
                    {row.apyHigh.toFixed(1)} <span className="text-zinc-500">%</span>
                  </span>
                </td>
                <td className="px-4 py-4 align-top text-right">
                  <PctCell value={row.miningPct} />
                </td>
                <td className="px-4 py-4 align-top text-right">
                  <PctCell value={row.btcTacticalPct} />
                </td>
                <td className="px-4 py-4 align-top text-right">
                  <PctCell value={row.usdcBasePct} />
                </td>
                <td className="pr-5 pl-4 py-4 align-top text-right">
                  <PctCell value={row.stableReservePct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
