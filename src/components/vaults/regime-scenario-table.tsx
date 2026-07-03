import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { cn } from "@/lib/cn";
import { deriveStressRegimes, type StressRegime } from "@/lib/constants/vault";
import type { VaultProduct } from "@/lib/data/vaults";

const TONE_DOT: Record<StressRegime["tone"], string> = {
  success: "bg-[var(--ct-accent)]",
  danger: "bg-[var(--ct-text-faint)]",
};

const TONE_LABEL: Record<StressRegime["tone"], string> = {
  success: "text-[var(--ct-text-strong)]",
  danger: "text-[var(--ct-text-muted)]",
};

function PctCell({ value }: { value: number }) {
  return <span className="text-[length:var(--ct-text-14)] font-medium text-[var(--ct-text-strong)] tabular-nums">{value}%</span>;
}

interface RegimeScenarioTableProps {
  vault: VaultProduct;
}

export function RegimeScenarioTable({ vault }: RegimeScenarioTableProps) {
  const regimes = deriveStressRegimes(vault);
  return (
    <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
      <Table className="min-w-full text-sm">
        <TableHead>
          <TableRow className="border-b border-[var(--ct-border)]">
            <TableHeader className="pl-5 pr-4 py-3 text-left ct-bento-label">
              Regime
            </TableHeader>
            <TableHeader className="hidden md:table-cell px-4 py-3 text-left ct-bento-label">
              Scenario
            </TableHeader>
            <TableHeader className="px-4 py-3 text-left ct-bento-label">
              APY range
            </TableHeader>
            <TableHeader className="px-4 py-3 text-right ct-bento-label">
              Min
            </TableHeader>
            <TableHeader className="px-4 py-3 text-right ct-bento-label">
              BTC
            </TableHeader>
            <TableHeader className="px-4 py-3 text-right ct-bento-label">
              USDC
            </TableHeader>
            <TableHeader className="pr-5 pl-4 py-3 text-right ct-bento-label">
              Res
            </TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {regimes.map((row) => (
            <TableRow
              key={row.id}
              className="border-b border-[var(--ct-border-soft)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)] transition-colors"
            >
              <TableCell className="pl-5 pr-4 py-4 align-top">
                <div className="flex items-start gap-3">
                  <div className={cn("mt-1 w-1 h-9 rounded-full", TONE_DOT[row.tone])} />
                  <div className="flex flex-col gap-1">
                    <span
                      className={cn(
                        "text-[length:var(--ct-text-14)] font-medium uppercase tracking-wide",
                        TONE_LABEL[row.tone],
                      )}
                    >
                      {row.label}
                    </span>
                    <span className="md:hidden text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] leading-tight">
                      {row.scenario}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell px-4 py-4 align-top max-w-[18rem] text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)] leading-relaxed">
                {row.scenario}
              </TableCell>
              <TableCell className="px-4 py-4 align-top">
                <span className="text-[length:var(--ct-text-14)] font-medium text-[var(--ct-accent)] tabular-nums whitespace-nowrap">
                  {row.apyLow.toFixed(1)} <span className="text-[var(--ct-text-faint)] mx-0.5">—</span>{" "}
                  {row.apyHigh.toFixed(1)} <span className="text-[var(--ct-text-faint)]">%</span>
                </span>
              </TableCell>
              <TableCell className="px-4 py-4 align-top text-right">
                <PctCell value={row.miningPct} />
              </TableCell>
              <TableCell className="px-4 py-4 align-top text-right">
                <PctCell value={row.btcTacticalPct} />
              </TableCell>
              <TableCell className="px-4 py-4 align-top text-right">
                <PctCell value={row.usdcBasePct} />
              </TableCell>
              <TableCell className="pr-5 pl-4 py-4 align-top text-right">
                <PctCell value={row.stableReservePct} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
