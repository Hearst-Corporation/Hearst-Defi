"use client";

/**
 * Strategy selection test panel — an admin plays a structured request against the
 * deterministic selection engine and sees which strategy wins, the score, the
 * matched rules, and whether the fallback was used. Pure client-side call into
 * the same pure engine the pipeline uses; no I/O, no LLM.
 */

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import {
  selectProductStrategy,
  PRODUCT_STRATEGIES,
  PRODUCT_FAMILY_LABEL,
  PRIORITY_LABEL,
  type ProductFamily,
  type Priority,
  type RiskProfileKey,
  type StrategySelectionRequest,
} from "@/lib/product-strategies";

const FAMILIES: (ProductFamily | "")[] = ["", "btc_mining", "stable_income", "btc_upside", "defi_yield", "generic"];
const RISKS: (RiskProfileKey | "")[] = ["", "safe", "balanced", "opportunistic"];
const PRIORITIES: (Priority | "")[] = ["", "monthly_income", "capital_protection", "btc_upside", "total_return", "liquidity"];
const HORIZONS: (number | "")[] = ["", 12, 24, 36];

const selectClass =
  "min-w-0 rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-inset px-(--ct-space-2) py-(--ct-space-1_5) text-[length:var(--ct-text-sm)] ct-text-strong focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]";
const labelClass = "ct-bento-label";

export function StrategyTestPanel() {
  const [family, setFamily] = useState<ProductFamily | "">("");
  const [risk, setRisk] = useState<RiskProfileKey | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [horizon, setHorizon] = useState<number | "">("");
  const [note, setNote] = useState("");

  const result = useMemo(() => {
    const req: StrategySelectionRequest = {};
    if (family) req.productFamily = family;
    if (risk) req.riskProfile = risk;
    if (priority) req.priority = priority;
    if (typeof horizon === "number") req.horizonMonths = horizon;
    if (note.trim()) req.note = note.trim();
    return selectProductStrategy(req, PRODUCT_STRATEGIES);
  }, [family, risk, priority, horizon, note]);

  return (
    <div className="flex flex-col gap-(--ct-space-4) p-(--ct-space-5)">
      <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-(--ct-space-1)">
          <span className={labelClass}>Product family</span>
          <select className={selectClass} value={family} onChange={(e) => setFamily(e.target.value as ProductFamily | "")}>
            {FAMILIES.map((f) => (
              <option key={f || "any"} value={f}>
                {f ? PRODUCT_FAMILY_LABEL[f] : "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-(--ct-space-1)">
          <span className={labelClass}>Risk profile</span>
          <select className={selectClass} value={risk} onChange={(e) => setRisk(e.target.value as RiskProfileKey | "")}>
            {RISKS.map((r) => (
              <option key={r || "any"} value={r}>
                {r ? r[0]!.toUpperCase() + r.slice(1) : "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-(--ct-space-1)">
          <span className={labelClass}>Priority</span>
          <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")}>
            {PRIORITIES.map((p) => (
              <option key={p || "any"} value={p}>
                {p ? PRIORITY_LABEL[p] : "Any"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-(--ct-space-1)">
          <span className={labelClass}>Horizon</span>
          <select
            className={selectClass}
            value={horizon}
            onChange={(e) => setHorizon(e.target.value ? Number(e.target.value) : "")}
          >
            {HORIZONS.map((h) => (
              <option key={h || "any"} value={h}>
                {h ? `${h} months` : "Any"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-(--ct-space-1)">
        <span className={labelClass}>Note (free text)</span>
        <input
          type="text"
          value={note}
          maxLength={220}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. conservative monthly income mining vault"
          className={cn(selectClass, "w-full")}
        />
      </label>

      {/* Result */}
      <div className="flex flex-col gap-(--ct-space-2) rounded-(--ct-radius-xl) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-4)">
        <div className="flex flex-wrap items-baseline justify-between gap-(--ct-space-2)">
          <span className="body-sm ct-text-strong">{result.strategy.name}</span>
          <span className="mono text-[length:var(--ct-text-xs)] tabular-nums ct-text-tertiary">
            score {result.score}
            {result.fallbackUsed ? " · fallback" : ""}
          </span>
        </div>
        <p className="text-[length:var(--ct-text-xs)] ct-text-body [overflow-wrap:anywhere]">
          {result.matchedRules.length > 0
            ? `Matched: ${result.matchedRules.join(", ")}`
            : "No rules matched — using the generic fallback."}
        </p>
      </div>
    </div>
  );
}
