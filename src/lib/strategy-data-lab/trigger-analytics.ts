/**
 * TriggerAnalytics — pure. Reads a ScenarioReport's monthly events and answers:
 * which rule fires most, which costs the most BTC, which saves the most debt,
 * the first liquidation / repurchase month, and the typical sequence.
 */

import type { ScenarioReport } from "@/lib/scenario-runner";
import type { TriggerAnalyticsReport } from "./types";

export function analyzeTriggers(report: ScenarioReport): TriggerAnalyticsReport {
  const events = report.snapshots.flatMap((s) => s.events);

  const count = new Map<string, number>();
  const btcCost = new Map<string, number>();
  const debtSaved = new Map<string, number>();
  let firstLiq: number | null = null;
  let firstRep: number | null = null;

  for (const s of report.snapshots) {
    for (const e of s.events) {
      count.set(e.ruleId, (count.get(e.ruleId) ?? 0) + 1);
      btcCost.set(e.ruleId, (btcCost.get(e.ruleId) ?? 0) + Math.max(0, -e.btcDelta));
      debtSaved.set(e.ruleId, (debtSaved.get(e.ruleId) ?? 0) + e.debtRepaid);
      if (e.type === "LIQUIDATE" && firstLiq === null) firstLiq = s.month;
      if (e.type === "REPURCHASE" && firstRep === null) firstRep = s.month;
    }
  }

  const argmax = (m: Map<string, number>): string | null => {
    let best: string | null = null;
    let bestVal = -Infinity;
    for (const [k, v] of m) if (v > bestVal) { bestVal = v; best = k; }
    return best;
  };

  // Typical sequence: is there a liquidation, then a recovery in distance, then a repurchase?
  let typicalSequence = "no rebalancing events";
  if (firstLiq !== null && firstRep !== null && firstRep > firstLiq) {
    typicalSequence = "liquidation → recovery → repurchase";
  } else if (firstLiq !== null) {
    typicalSequence = "liquidation only";
  } else if (firstRep !== null) {
    typicalSequence = "repurchase only";
  }

  return {
    mostFrequentTriggerRuleId: argmax(count),
    costliestByBtcRuleId: argmax(btcCost),
    mostDebtSavedRuleId: argmax(debtSaved),
    firstLiquidationMonth: firstLiq,
    firstRepurchaseMonth: firstRep,
    liquidationCount: events.filter((e) => e.type === "LIQUIDATE").length,
    repurchaseCount: events.filter((e) => e.type === "REPURCHASE").length,
    typicalSequence,
  };
}
