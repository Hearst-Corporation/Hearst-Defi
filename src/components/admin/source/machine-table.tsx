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
  | "landedUsd"
  | "capexUsdPerThDay"
  | "energyUsdPerThDay"
  | "totalCostUsdPerThDay"
  | "marginUsdPerThDay";

const COOLING_DOT: Record<string, string> = {
  air: "#7fd3ff",
  hydro: "#A7FB90",
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(["all", "air", "hydro", "immersion"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg border px-3 py-1 text-[12px] capitalize transition-colors",
              filter === f
                ? "border-[#A7FB90]/40 bg-[#A7FB90]/10 text-[#A7FB90]"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
            )}
          >
            {f === "all" ? "Tous" : f} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface-inset">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-white/5">
              <Th label="Modèle" k="model" sort={sort} onSort={toggleSort} />
              <Th label="Cooling" k="cooling" sort={sort} onSort={toggleSort} />
              <Th label="Région" k="region" sort={sort} onSort={toggleSort} />
              <Th label="TH/s" k="thPerUnit" sort={sort} onSort={toggleSort} num />
              <Th label="J/TH" k="efficiencyJTh" sort={sort} onSort={toggleSort} num />
              <Th label="Ex-works" k="exWorksUsd" sort={sort} onSort={toggleSort} num />
              <Th label="Landed" k="landedUsd" sort={sort} onSort={toggleSort} num />
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
                className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2.5 font-medium text-white">
                  {r.model}
                </td>
                <td className="px-3 py-2.5 text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: COOLING_DOT[r.cooling] }}
                    />
                    {r.cooling}
                  </span>
                </td>
                <td className="px-3 py-2.5 uppercase text-zinc-500">
                  {r.region === "usa" ? "USA" : "Chine"}
                </td>
                <Num>{r.thPerUnit}</Num>
                <Num>{r.efficiencyJTh ?? "—"}</Num>
                <Num>${r.exWorksUsd.toLocaleString()}</Num>
                <Num>${r.landedUsd.toLocaleString()}</Num>
                <Num>{fmtUsd(r.capexUsdPerThDay, 5)}</Num>
                <Num>{fmtUsd(r.energyUsdPerThDay, 5)}</Num>
                <Num>{fmtUsd(r.totalCostUsdPerThDay, 5)}</Num>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right font-semibold tabular-nums",
                    r.marginUsdPerThDay === null
                      ? "text-zinc-500"
                      : r.marginUsdPerThDay >= 0
                        ? "text-[#A7FB90]"
                        : "text-rose-400",
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
        "cursor-pointer select-none whitespace-nowrap px-3 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 hover:text-[#A7FB90]",
        num ? "text-right" : "text-left",
        active && "text-[#A7FB90]",
      )}
    >
      {label}
      {active ? (sort.asc ? " ↑" : " ↓") : ""}
    </th>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">
      {children}
    </td>
  );
}
