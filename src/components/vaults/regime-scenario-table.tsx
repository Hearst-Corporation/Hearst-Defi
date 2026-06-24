import { ApyRange } from "@/components/ui/apy-range";
import { cn } from "@/lib/cn";
import { deriveStressRegimes, type StressRegime } from "@/lib/constants/vault";
import type { VaultProduct } from "@/lib/data/vaults";

const TONE_TEXT: Record<StressRegime["tone"], string> = {
  success: "ct-status-success",
  danger: "ct-status-danger",
};

function pctCell(value: number) {
  return <span className="tabular mono body-sm font-semibold ct-text-strong">{value}%</span>;
}

interface RegimeScenarioTableProps {
  vault: VaultProduct;
}

export function RegimeScenarioTable({ vault }: RegimeScenarioTableProps) {
  const regimes = deriveStressRegimes(vault);
  return (
    <div className="regime-scenario-table">
      <table>
          <thead>
            <tr>
              <th scope="col" className="stat-label ct-table-header">
                Regime
              </th>
              <th
                scope="col"
                className="stat-label ct-table-header regime-scenario-table__col-scenario"
              >
                Scenario
              </th>
              <th scope="col" className="stat-label ct-table-header">
                APY range
              </th>
              <th scope="col" className="stat-label ct-table-header text-right">
                Min
              </th>
              <th scope="col" className="stat-label ct-table-header text-right">
                BTC
              </th>
              <th
                scope="col"
                className="stat-label ct-table-header text-right regime-scenario-table__col-wide"
              >
                USDC
              </th>
              <th
                scope="col"
                className="stat-label ct-table-header text-right regime-scenario-table__col-wide"
              >
                Res
              </th>
            </tr>
          </thead>
          <tbody>
            {regimes.map((row) => (
              <tr key={row.id} className="group/row transition-colors duration-200 hover:bg-(--ct-accent)/5">
                <td className="ct-table-cell align-top">
                  <div className="flex flex-col gap-(--ct-space-0_5)">
                    <span className={cn("body-sm font-bold uppercase tracking-wide", TONE_TEXT[row.tone])}>
                      {row.label}
                    </span>
                    <span className="regime-scenario-table__scenario-inline body-xs ct-text-faint leading-tight">
                      {row.scenario}
                    </span>
                  </div>
                </td>
                <td className="ct-table-cell align-top body-xs ct-text-muted ct-cell-note-max regime-scenario-table__col-scenario leading-relaxed">
                  {row.scenario}
                </td>
                <td className="ct-table-cell align-top">
                  <ApyRange
                    low={row.apyLow}
                    high={row.apyHigh}
                    precision={1}
                    className="body-sm font-bold ct-text-strong tabular mono"
                  />
                </td>
                <td className="ct-table-cell align-top text-right">
                  {pctCell(row.miningPct)}
                </td>
                <td className="ct-table-cell align-top text-right">
                  {pctCell(row.btcTacticalPct)}
                </td>
                <td className="ct-table-cell align-top text-right regime-scenario-table__col-wide">
                  {pctCell(row.usdcBasePct)}
                </td>
                <td className="ct-table-cell align-top text-right regime-scenario-table__col-wide">
                  {pctCell(row.stableReservePct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}
