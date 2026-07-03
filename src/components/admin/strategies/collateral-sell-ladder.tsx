"use client";

import type { SellStep } from "@/lib/strategy-data-lab";
import { cn } from "@/lib/cn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";

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
      <Table className="min-w-[52rem] text-[length:var(--ct-text-xs)] tabular-nums">
        <TableHead className="ct-text-tertiary">
          <TableRow className="border-b border-[var(--ct-border-soft)]">
            <TableHeader className="text-left">Step</TableHeader>
            <TableHeader className="text-right">BTC trigger price</TableHeader>
            <TableHeader className="text-right">LTV before</TableHeader>
            <TableHeader className="text-right">BTC sold</TableHeader>
            <TableHeader className="text-right">USDC received</TableHeader>
            <TableHeader className="text-right">Debt repaid</TableHeader>
            <TableHeader className="text-right">LTV after</TableHeader>
            <TableHeader className="text-right">Liq. price after</TableHeader>
            <TableHeader className="text-left">Feasible / Reason</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {steps.map((step) => (
            <TableRow
              key={step.step}
              className="border-b border-[var(--ct-border-soft)] align-top"
            >
              <TableCell className="ct-text-strong">{`S${step.step}`}</TableCell>
              <TableCell className="text-right ct-text-body">
                {usd(step.triggerPriceUsd)}
              </TableCell>
              <TableCell className="text-right ct-text-body">
                {pct(step.ltvBeforePct)}
              </TableCell>
              <TableCell className="text-right ct-text-body">
                {step.btcSold > 0 ? `-${btc(step.btcSold)}` : "—"}
              </TableCell>
              <TableCell className="text-right ct-text-body">
                {step.usdcReceived > 0 ? usd(step.usdcReceived) : "—"}
              </TableCell>
              <TableCell className="text-right ct-text-body">
                {step.debtRepaidUsdc > 0 ? usd(step.debtRepaidUsdc) : "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right",
                  step.feasible ? "ct-text-accent" : "text-[var(--ct-status-warning)]",
                )}
              >
                {pct(step.ltvAfterPct)}
              </TableCell>
              <TableCell className="text-right ct-text-body">
                {usd(step.liquidationPriceAfterUsd)}
              </TableCell>
              <TableCell className="text-left">
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
          Advanced sell details
        </summary>
        <div className="border-t border-[var(--ct-border-soft)] p-(--ct-space-3)">
          <Table className="min-w-[52rem] text-[length:var(--ct-text-xs)] tabular-nums">
            <TableHead className="ct-text-tertiary">
              <TableRow className="border-b border-[var(--ct-border-soft)]">
                <TableHeader className="text-left">Step</TableHeader>
                <TableHeader className="text-right">Working reserve after</TableHeader>
                <TableHeader className="text-right">wBTC collateral after</TableHeader>
                <TableHeader className="text-right">Debt after</TableHeader>
                <TableHeader className="text-right">Buffer restored</TableHeader>
                <TableHeader className="text-left">Formula note</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {steps.map((step) => (
                <TableRow
                  key={`advanced-${step.step}`}
                  className="border-b border-[var(--ct-border-soft)] align-top"
                >
                  <TableCell className="ct-text-strong">{`S${step.step}`}</TableCell>
                  <TableCell className="text-right ct-text-body">
                    {usd(step.workingReserveAfterUsdc)}
                  </TableCell>
                  <TableCell className="text-right ct-text-body">
                    {btc(step.wbtcCollateralAfter)}
                  </TableCell>
                  <TableCell className="text-right ct-text-body">
                    {usd(step.debtAfterUsdc)}
                  </TableCell>
                  <TableCell className="text-right ct-text-body">
                    {pct(step.bufferRestoredPct)}
                  </TableCell>
                  <TableCell className="text-left text-[length:var(--ct-text-2xs)] ct-text-tertiary">
                    {step.feasible
                      ? "sellUsdc = btcSold × triggerPrice; proceeds repay debt first, excess stays in working reserve."
                      : "Blocked sells remain visible so infeasible delever states are explicit."}
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
