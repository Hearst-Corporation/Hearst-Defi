import { ApyRange } from "@/components/ui/apy-range";
import { cn } from "@/lib/cn";
import { deriveStressRegimes, type StressRegime } from "@/lib/constants/vault";
import type { VaultProduct } from "@/lib/data/vaults";

const TONE_TEXT: Record<StressRegime["tone"], string> = {
  success: "ct-status-success",
  danger: "ct-status-danger",
};

function pctCell(value: number) {
  return <span className="tabular mono body-sm ct-text-body">{value}%</span>;
}

interface RegimeScenarioTableProps {
  /** Vault whose APY range and sleeve mix drive the stress-regime rows. */
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
            <tr key={row.id}>
              <td className="ct-table-cell align-top">
                <span className={cn("body-sm font-semibold", TONE_TEXT[row.tone])}>
                  {row.label}
                </span>
                <span className="regime-scenario-table__scenario-inline body-xs ct-text-faint">
                  {row.scenario}
                </span>
              </td>
              <td className="ct-table-cell align-top body-xs ct-text-muted ct-cell-note-max regime-scenario-table__col-scenario">
                {row.scenario}
              </td>
              <td className="ct-table-cell align-top">
                <ApyRange
                  low={row.apyLow}
                  high={row.apyHigh}
                  precision={1}
                  className="body-sm font-semibold ct-text-strong"
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
