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
    <div className="overflow-x-auto">
      <table className="w-full min-w-0 border-collapse text-left">
        <thead>
          <tr className="border-b ct-bc-soft">
            <th scope="col" className="stat-label py-2 pr-3 font-medium">
              Regime
            </th>
            <th
              scope="col"
              className="stat-label py-2 pr-3 font-medium hidden sm:table-cell"
            >
              Scenario
            </th>
            <th scope="col" className="stat-label py-2 pr-3 font-medium">
              APY range
            </th>
            <th scope="col" className="stat-label py-2 pr-2 font-medium text-right">
              Min
            </th>
            <th scope="col" className="stat-label py-2 pr-2 font-medium text-right">
              BTC
            </th>
            <th
              scope="col"
              className="stat-label py-2 pr-2 font-medium text-right hidden md:table-cell"
            >
              USDC
            </th>
            <th
              scope="col"
              className="stat-label py-2 font-medium text-right hidden md:table-cell"
            >
              Res
            </th>
          </tr>
        </thead>
        <tbody>
          {STRESS_REGIMES.map((row) => (
            <tr
              key={row.id}
              className="border-b ct-bc-soft last:border-0"
            >
              <td className="py-2.5 pr-3 align-top">
                <span className={cn("body-sm font-semibold", TONE_TEXT[row.tone])}>
                  {row.label}
                </span>
                <span className="block body-xs ct-text-faint mt-0.5 sm:hidden">
                  {row.scenario}
                </span>
              </td>
              <td className="py-2.5 pr-3 align-top body-xs ct-text-muted max-w-40 hidden sm:table-cell">
                {row.scenario}
              </td>
              <td className="py-2.5 pr-3 align-top">
                <ApyRange
                  low={row.apyLow}
                  high={row.apyHigh}
                  precision={1}
                  className="body-sm font-semibold ct-text-strong"
                />
              </td>
              <td className="py-2.5 pr-2 align-top text-right">
                {pctCell(row.miningPct)}
              </td>
              <td className="py-2.5 pr-2 align-top text-right">
                {pctCell(row.btcTacticalPct)}
              </td>
              <td className="py-2.5 pr-2 align-top text-right hidden md:table-cell">
                {pctCell(row.usdcBasePct)}
              </td>
              <td className="py-2.5 align-top text-right hidden md:table-cell">
                {pctCell(row.stableReservePct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
