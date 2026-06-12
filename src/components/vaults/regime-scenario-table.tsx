import { ApyRange } from "@/components/ui/apy-range";
import { cn } from "@/lib/cn";

interface StressRegime {
  id: string;
  label: string;
  scenario: string;
  apyLow: number;
  apyHigh: number;
  miningPct: number;
  btcTacticalPct: number;
  usdcBasePct: number;
  stableReservePct: number;
  tone: "success" | "danger";
}

const STRESS_REGIMES: StressRegime[] = [
  {
    id: "bull",
    label: "Bull",
    scenario: "BTC rally > +20% QoQ",
    apyLow: 12.8,
    apyHigh: 15.2,
    miningPct: 45,
    btcTacticalPct: 35,
    usdcBasePct: 12,
    stableReservePct: 8,
    tone: "success",
  },
  {
    id: "bear",
    label: "Bear",
    scenario: "BTC drawdown > −30% QoQ",
    apyLow: 5.2,
    apyHigh: 8.4,
    miningPct: 70,
    btcTacticalPct: 5,
    usdcBasePct: 15,
    stableReservePct: 10,
    tone: "danger",
  },
];

const TONE_TEXT: Record<StressRegime["tone"], string> = {
  success: "ct-status-success",
  danger: "ct-status-danger",
};

function pctCell(value: number) {
  return <span className="tabular mono body-sm ct-text-body">{value}%</span>;
}

export function RegimeScenarioTable() {
  return (
    <div className="regime-scenario-table ct-table-surface">
      <table>
        <thead>
          <tr>
            <th scope="col" className="stat-label ct-table-header font-medium">
              Regime
            </th>
            <th
              scope="col"
              className="stat-label ct-table-header font-medium regime-scenario-table__col-scenario"
            >
              Scenario
            </th>
            <th scope="col" className="stat-label ct-table-header font-medium">
              APY range
            </th>
            <th scope="col" className="stat-label ct-table-header font-medium text-right">
              Min
            </th>
            <th scope="col" className="stat-label ct-table-header font-medium text-right">
              BTC
            </th>
            <th
              scope="col"
              className="stat-label ct-table-header font-medium text-right regime-scenario-table__col-wide"
            >
              USDC
            </th>
            <th
              scope="col"
              className="stat-label ct-table-header font-medium text-right regime-scenario-table__col-wide"
            >
              Res
            </th>
          </tr>
        </thead>
        <tbody>
          {STRESS_REGIMES.map((row) => (
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
