"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/catalyst/badge";
import { SegmentedControl } from "@/components/catalyst/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { ManufacturerLogo } from "@/components/admin/source/manufacturer-mark";
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

// Cooling → DS Badge colour (token-only via the Badge primitive, never an inline
// background-color). air = info, hydro = accent/success, immersion = warning.
const COOLING_BADGE: Record<MachineRow["cooling"], "blue" | "green" | "amber"> = {
  air: "blue",
  hydro: "green",
  immersion: "amber",
};

// Catalyst head/cell chrome — the same literals the canon customers table uses,
// so the source table reads identically (nano uppercase head; the edge gutter is
// owned by the cells via pl-5/pr-5).
const HEAD = "bg-transparent ct-bento-label";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";

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
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.asc ? cmp : -cmp;
    });
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

  const coolingItems = useMemo(
    () =>
      (["all", "air", "hydro", "immersion"] as const).map((f) => ({
        value: f,
        label: (
          <span className="capitalize">
            {f === "all" ? "Tous" : f} {counts[f]}
          </span>
        ),
      })),
    [counts],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="ct-bento-label">Cooling</span>
        <SegmentedControl
          items={coolingItems}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filtrer par refroidissement"
          variant="radiogroup"
        />
      </div>

      <Table className="[&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <TableHead>
          <TableRow>
            <SortHeader label="Modèle" k="model" sort={sort} onSort={toggleSort} className="pl-5" />
            <SortHeader label="Cooling" k="cooling" sort={sort} onSort={toggleSort} />
            <SortHeader label="Région" k="region" sort={sort} onSort={toggleSort} />
            <SortHeader label="TH/s" k="thPerUnit" sort={sort} onSort={toggleSort} num />
            <SortHeader label="J/TH" k="efficiencyJTh" sort={sort} onSort={toggleSort} num />
            <SortHeader label="Ex-works" k="exWorksUsd" sort={sort} onSort={toggleSort} num />
            <SortHeader label="Landed" k="landedUsd" sort={sort} onSort={toggleSort} num />
            <SortHeader label="CAPEX $/TH/j" k="capexUsdPerThDay" sort={sort} onSort={toggleSort} num />
            <SortHeader label="Énergie $/TH/j" k="energyUsdPerThDay" sort={sort} onSort={toggleSort} num />
            <SortHeader label="Coût total $/TH/j" k="totalCostUsdPerThDay" sort={sort} onSort={toggleSort} num />
            <SortHeader label="Marge $/TH/j" k="marginUsdPerThDay" sort={sort} onSort={toggleSort} num className="pr-5" />
          </TableRow>
        </TableHead>
        <TableBody>
          {view.map((r, i) => (
            <TableRow key={`${r.model}-${r.thPerUnit}-${i}`} className={ROW}>
              <TableCell
                className="ct-metric-caption min-w-[12rem] max-w-[20rem] pl-5 font-medium text-[var(--ct-text-strong)]"
                title={r.model}
              >
                <span className="flex items-center gap-2.5">
                  <ManufacturerLogo manufacturer={r.manufacturer} size={20} />
                  <span className="min-w-0 truncate">{r.model}</span>
                </span>
              </TableCell>
              <TableCell>
                <Badge color={COOLING_BADGE[r.cooling]} className="capitalize">
                  {r.cooling}
                </Badge>
              </TableCell>
              <TableCell className="ct-metric-caption uppercase">
                {r.region === "usa" ? "USA" : "Chine"}
              </TableCell>
              <Num>{r.thPerUnit}</Num>
              <Num muted={r.efficiencyJTh === null}>{r.efficiencyJTh ?? "—"}</Num>
              <Num>${r.exWorksUsd.toLocaleString()}</Num>
              <Num>${r.landedUsd.toLocaleString()}</Num>
              <Num muted={r.capexUsdPerThDay === null}>{fmtUsd(r.capexUsdPerThDay, 5)}</Num>
              <Num muted={r.energyUsdPerThDay === null}>{fmtUsd(r.energyUsdPerThDay, 5)}</Num>
              <Num muted={r.totalCostUsdPerThDay === null}>{fmtUsd(r.totalCostUsdPerThDay, 5)}</Num>
              <TableCell
                className={cn(
                  "pr-5 text-right font-semibold tabular-nums",
                  r.marginUsdPerThDay === null
                    ? "text-[var(--ct-text-muted)]"
                    : r.marginUsdPerThDay >= 0
                      ? "text-[var(--ct-accent)]"
                      : "text-[var(--ct-status-danger)]",
                )}
              >
                {fmtUsd(r.marginUsdPerThDay, 5)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  num,
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; asc: boolean };
  onSort: (k: SortKey) => void;
  num?: boolean;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <TableHeader
      className={cn(HEAD, num && "text-right", className)}
      aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex cursor-pointer select-none items-center gap-1 whitespace-nowrap transition-colors hover:text-[var(--ct-accent)]",
          num && "flex-row-reverse",
          active && "text-[var(--ct-accent)]",
        )}
      >
        {label}
        <span aria-hidden className="text-[length:var(--ct-text-nano)]">
          {active ? (sort.asc ? "↑" : "↓") : ""}
        </span>
      </button>
    </TableHeader>
  );
}

function Num({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "ct-metric-caption text-right tabular-nums",
        muted
          ? "text-[var(--ct-text-muted)]"
          : "text-[var(--ct-text-secondary)]",
      )}
    >
      {children}
    </TableCell>
  );
}
