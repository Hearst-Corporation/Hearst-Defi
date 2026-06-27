"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import type { MachineRow } from "@/lib/telegram/read-machines";

type CoolingFilter = "all" | "air" | "hydro" | "immersion";
type SortKey =
  | "model"
  | "cooling"
  | "region"
  | "thPerUnit"
  | "efficiencyJTh"
  | "exWorksUsd"
  | "capexUsdPerThDay"
  | "energyUsdPerThDay"
  | "totalCostUsdPerThDay"
  | "marginUsdPerThDay";

const COOLING_DOT: Record<string, string> = {
  air: "#7fd3ff",
  hydro: "var(--ct-accent)",
  immersion: "#ffce6b",
};

function fmtUsd(n: number | null, digits = 4): string {
  return n === null ? "—" : `$${n.toFixed(digits)}`;
}

export function MachineTable({ rows }: { rows: MachineRow[] }) {
  const [filter, setFilter] = useState<CoolingFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: "marginUsdPerThDay",
    asc: false,
  });

  const view = useMemo(() => {
    const filtered =
      filter === "all" ? rows : rows.filter((r) => r.cooling === filter);
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      // nulls last regardless of direction
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.asc ? cmp : -cmp;
    });
    return sorted;
  }, [rows, filter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));

  const counts = useMemo(
    () => ({
      all: rows.length,
      air: rows.filter((r) => r.cooling === "air").length,
      hydro: rows.filter((r) => r.cooling === "hydro").length,
      immersion: rows.filter((r) => r.cooling === "immersion").length,
    }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-[var(--ct-space-3)]">
      <div className="flex flex-wrap gap-[var(--ct-space-2)]">
        {(["all", "air", "hydro", "immersion"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-[var(--ct-radius-md)] border px-[var(--ct-space-3)] py-[var(--ct-space-1)] body-xs capitalize transition-colors",
              filter === f
                ? "border-[var(--ct-accent)] text-[var(--ct-accent)]"
                : "border-[var(--ct-border-soft)] ct-text-muted hover:ct-text-strong",
            )}
          >
            {f === "all" ? "Tous" : f} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[var(--ct-radius-lg)] border border-[var(--ct-border-soft)]">
        <table className="w-full border-collapse body-xs">
          <thead>
            <tr className="bg-[var(--ct-surface-1)] ct-text-muted">
              <Th label="Modèle" k="model" sort={sort} onSort={toggleSort} />
              <Th label="Cooling" k="cooling" sort={sort} onSort={toggleSort} />
              <Th label="Région" k="region" sort={sort} onSort={toggleSort} />
              <Th label="TH/s" k="thPerUnit" sort={sort} onSort={toggleSort} num />
              <Th label="J/TH" k="efficiencyJTh" sort={sort} onSort={toggleSort} num />
              <Th label="Ex-works" k="exWorksUsd" sort={sort} onSort={toggleSort} num />
              <Th label="CAPEX $/TH/j" k="capexUsdPerThDay" sort={sort} onSort={toggleSort} num />
              <Th label="Énergie $/TH/j" k="energyUsdPerThDay" sort={sort} onSort={toggleSort} num />
              <Th label="Coût total $/TH/j" k="totalCostUsdPerThDay" sort={sort} onSort={toggleSort} num />
              <Th label="Marge $/TH/j" k="marginUsdPerThDay" sort={sort} onSort={toggleSort} num />
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr
                key={`${r.model}-${r.thPerUnit}-${i}`}
                className="border-t border-[var(--ct-border-soft)] hover:bg-[var(--ct-surface-1)]"
              >
                <td className="px-[var(--ct-space-3)] py-[var(--ct-space-2)] ct-text-strong">
                  {r.model}
                </td>
                <td className="px-[var(--ct-space-3)] py-[var(--ct-space-2)]">
                  <span className="inline-flex items-center gap-[var(--ct-space-1)]">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: COOLING_DOT[r.cooling] }}
                    />
                    {r.cooling}
                  </span>
                </td>
                <td className="px-[var(--ct-space-3)] py-[var(--ct-space-2)] ct-text-muted uppercase">
                  {r.region === "usa" ? "USA" : "Chine"}
                </td>
                <Num>{r.thPerUnit}</Num>
                <Num>{r.efficiencyJTh ?? "—"}</Num>
                <Num>${r.exWorksUsd.toLocaleString()}</Num>
                <Num>{fmtUsd(r.capexUsdPerThDay, 5)}</Num>
                <Num>{fmtUsd(r.energyUsdPerThDay, 5)}</Num>
                <Num>{fmtUsd(r.totalCostUsdPerThDay, 5)}</Num>
                <td
                  className={cn(
                    "px-[var(--ct-space-3)] py-[var(--ct-space-2)] text-right tabular-nums font-semibold",
                    r.marginUsdPerThDay === null
                      ? "ct-text-muted"
                      : r.marginUsdPerThDay >= 0
                        ? "text-[var(--ct-accent)]"
                        : "text-[var(--ct-status-danger,#ff6b6b)]",
                  )}
                >
                  {fmtUsd(r.marginUsdPerThDay, 5)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  label,
  k,
  sort,
  onSort,
  num,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; asc: boolean };
  onSort: (k: SortKey) => void;
  num?: boolean;
}) {
  const active = sort.key === k;
  return (
    <th
      onClick={() => onSort(k)}
      className={cn(
        "cursor-pointer select-none whitespace-nowrap px-[var(--ct-space-3)] py-[var(--ct-space-2)] font-semibold hover:text-[var(--ct-accent)]",
        num ? "text-right" : "text-left",
        active && "text-[var(--ct-accent)]",
      )}
    >
      {label}
      {active ? (sort.asc ? " ↑" : " ↓") : ""}
    </th>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-[var(--ct-space-3)] py-[var(--ct-space-2)] text-right tabular-nums">
      {children}
    </td>
  );
}
