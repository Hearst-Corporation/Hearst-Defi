"use client";

import type { BuybackStep } from "@/lib/strategy-data-lab";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
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

export function CollateralBuybackLadder({
  steps,
  initialOpenAdvanced = false,
}: {
  steps: readonly BuybackStep[];
  initialOpenAdvanced?: boolean;
}) {
  if (steps.length === 0) {
    return (
      <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
        No buyback ladder is available for the current input set.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-(--ct-space-4)">
      <Table className="min-w-[48rem] text-[length:var(--ct-text-xs)] tabular-nums">
        <TableHead>
          <TableRow className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
            <TableHeader className="p-(--ct-space-2) text-left">Step</TableHeader>
            <TableHeader className="p-(--ct-space-2) text-right">BTC trigger price</TableHeader>
            <TableHeader className="p-(--ct-space-2) text-right">Distance before</TableHeader>
            <TableHeader className="p-(--ct-space-2) text-right">USDC deployed</TableHeader>
            <TableHeader className="p-(--ct-space-2) text-right">BTC bought</TableHeader>
            <TableHeader className="p-(--ct-space-2) text-right">Reserve after</TableHeader>
            <TableHeader className="p-(--ct-space-2) text-right">LTV after</TableHeader>
            <TableHeader className="p-(--ct-space-2) text-left">Allowed / Reason</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {steps.map((step) => (
            <TableRow
              key={step.step}
              className="border-b border-[var(--ct-border-soft)] align-top"
            >
              <TableCell className="p-(--ct-space-2) ct-text-strong">{`B${step.step}`}</TableCell>
              <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                {usd(step.triggerPriceUsd)}
              </TableCell>
              <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                {pct(step.distanceBeforePct)}
              </TableCell>
              <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                {step.usdcDeployed > 0 ? usd(step.usdcDeployed) : "—"}
              </TableCell>
              <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                {step.btcBought > 0 ? btc(step.btcBought) : "—"}
              </TableCell>
              <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                {usd(step.workingReserveAfterUsdc)}
              </TableCell>
              <TableCell
                className={cn(
                  "p-(--ct-space-2) text-right",
                  step.allowed ? "ct-text-accent" : "text-[var(--ct-status-warning)]",
                )}
              >
                {pct(step.ltvAfterPct)}
              </TableCell>
              <TableCell className="p-(--ct-space-2) text-left">
                <div className="flex flex-col gap-(--ct-space-1)">
                  <span
                    className={cn(
                      "text-[length:var(--ct-text-2xs)] font-medium uppercase tracking-wide",
                      step.allowed
                        ? "ct-text-accent"
                        : "text-[var(--ct-status-warning)]",
                    )}
                  >
                    {step.allowed ? "Allowed" : "Blocked"}
                  </span>
                  <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
                    {step.reason}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <details
        className="group rounded-(--ct-radius-md) border border-[var(--ct-border-soft)]"
        {...(initialOpenAdvanced ? { open: true } : {})}
      >
        <summary className="flex cursor-pointer list-none items-center gap-(--ct-space-2) px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-tertiary select-none hover:ct-text-body">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Advanced buyback details
        </summary>
        <div className="border-t border-[var(--ct-border-soft)] p-(--ct-space-3)">
          <Table className="min-w-[52rem] text-[length:var(--ct-text-xs)] tabular-nums">
            <TableHead>
              <TableRow className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
                <TableHeader className="p-(--ct-space-2) text-left">Step</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">Reserve floor ok</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">Max LTV ok</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">Distance ok</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">wBTC collateral after</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-left">Formula note</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {steps.map((step) => (
                <TableRow
                  key={`advanced-${step.step}`}
                  className="border-b border-[var(--ct-border-soft)] align-top"
                >
                  <TableCell className="p-(--ct-space-2) ct-text-strong">{`B${step.step}`}</TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {step.reserveFloorOk ? "Yes" : "No"}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {step.maxLtvOk ? "Yes" : "No"}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {step.distanceOk ? "Yes" : "No"}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {btc(step.wbtcCollateralAfter)}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-left text-[length:var(--ct-text-2xs)] ct-text-tertiary">
                    buyAllowed = distanceOk && maxLtvOk && reserveFloorOk.
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}
