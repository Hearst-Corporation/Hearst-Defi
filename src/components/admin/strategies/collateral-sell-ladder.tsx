"use client";

import type { SellStep } from "@/lib/strategy-data-lab";
import { cn } from "@/lib/cn";

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function btc(value: number): string {
  return `${value.toFixed(3)} BTC`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function CollateralSellLadder({
  steps,
  initialOpenAdvanced = false,
}: {
  steps: readonly SellStep[];
  initialOpenAdvanced?: boolean;
}) {
  if (steps.length === 0) {
    return (
      <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
        No delever ladder is available for the current input set.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-(--ct-space-4)">
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-[length:var(--ct-text-xs)] tabular-nums">
          <thead>
            <tr className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
              <th className="p-(--ct-space-2) text-left">Step</th>
              <th className="p-(--ct-space-2) text-right">BTC trigger price</th>
              <th className="p-(--ct-space-2) text-right">LTV before</th>
              <th className="p-(--ct-space-2) text-right">BTC sold</th>
              <th className="p-(--ct-space-2) text-right">USDC received</th>
              <th className="p-(--ct-space-2) text-right">Debt repaid</th>
              <th className="p-(--ct-space-2) text-right">LTV after</th>
              <th className="p-(--ct-space-2) text-right">Liq. price after</th>
              <th className="p-(--ct-space-2) text-left">Feasible / Reason</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr
                key={step.step}
                className="border-b border-[var(--ct-border-soft)] align-top"
              >
                <td className="p-(--ct-space-2) ct-text-strong">{`S${step.step}`}</td>
                <td className="p-(--ct-space-2) text-right ct-text-body">
                  {usd(step.triggerPriceUsd)}
                </td>
                <td className="p-(--ct-space-2) text-right ct-text-body">
                  {pct(step.ltvBeforePct)}
                </td>
                <td className="p-(--ct-space-2) text-right ct-text-body">
                  {step.btcSold > 0 ? `-${btc(step.btcSold)}` : "—"}
                </td>
                <td className="p-(--ct-space-2) text-right ct-text-body">
                  {step.usdcReceived > 0 ? usd(step.usdcReceived) : "—"}
                </td>
                <td className="p-(--ct-space-2) text-right ct-text-body">
                  {step.debtRepaidUsdc > 0 ? usd(step.debtRepaidUsdc) : "—"}
                </td>
                <td
                  className={cn(
                    "p-(--ct-space-2) text-right",
                    step.feasible ? "ct-text-accent" : "text-[var(--ct-status-warning)]",
                  )}
                >
                  {pct(step.ltvAfterPct)}
                </td>
                <td className="p-(--ct-space-2) text-right ct-text-body">
                  {usd(step.liquidationPriceAfterUsd)}
                </td>
                <td className="p-(--ct-space-2) text-left">
                  <div className="flex flex-col gap-(--ct-space-1)">
                    <span
                      className={cn(
                        "text-[length:var(--ct-text-2xs)] font-medium uppercase tracking-wide",
                        step.feasible
                          ? "ct-text-accent"
                          : "text-[var(--ct-status-warning)]",
                      )}
                    >
                      {step.feasible ? "Feasible" : "Blocked"}
                    </span>
                    <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
                      {step.reason}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details
        className="group rounded-(--ct-radius-md) border border-[var(--ct-border-soft)]"
        {...(initialOpenAdvanced ? { open: true } : {})}
      >
        <summary className="flex cursor-pointer list-none items-center gap-(--ct-space-2) px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-tertiary select-none hover:ct-text-body">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Advanced sell details
        </summary>
        <div className="min-w-0 overflow-x-auto border-t border-[var(--ct-border-soft)] p-(--ct-space-3)">
          <table className="w-full min-w-[52rem] border-collapse text-[length:var(--ct-text-xs)] tabular-nums">
            <thead>
              <tr className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
                <th className="p-(--ct-space-2) text-left">Step</th>
                <th className="p-(--ct-space-2) text-right">Working reserve after</th>
                <th className="p-(--ct-space-2) text-right">wBTC collateral after</th>
                <th className="p-(--ct-space-2) text-right">Debt after</th>
                <th className="p-(--ct-space-2) text-right">Buffer restored</th>
                <th className="p-(--ct-space-2) text-left">Formula note</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => (
                <tr
                  key={`advanced-${step.step}`}
                  className="border-b border-[var(--ct-border-soft)] align-top"
                >
                  <td className="p-(--ct-space-2) ct-text-strong">{`S${step.step}`}</td>
                  <td className="p-(--ct-space-2) text-right ct-text-body">
                    {usd(step.workingReserveAfterUsdc)}
                  </td>
                  <td className="p-(--ct-space-2) text-right ct-text-body">
                    {btc(step.wbtcCollateralAfter)}
                  </td>
                  <td className="p-(--ct-space-2) text-right ct-text-body">
                    {usd(step.debtAfterUsdc)}
                  </td>
                  <td className="p-(--ct-space-2) text-right ct-text-body">
                    {pct(step.bufferRestoredPct)}
                  </td>
                  <td className="p-(--ct-space-2) text-left text-[length:var(--ct-text-2xs)] ct-text-tertiary">
                    {step.feasible
                      ? "sellUsdc = btcSold × triggerPrice; proceeds repay debt first, excess stays in working reserve."
                      : "Blocked sells remain visible so infeasible delever states are explicit."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
