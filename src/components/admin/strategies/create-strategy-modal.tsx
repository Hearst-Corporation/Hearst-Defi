"use client";

/**
 * CreateStrategyModal — 6-step admin builder for ProductStrategy drafts.
 *
 * Local state only (useState). No fetch, no DB, no Date.now(), no Math.random().
 * Timestamps come from the `now` prop. Sleeve colors come from SLEEVE_COLORS only.
 * All tokens are --ct-* vars; text sizes via text-[length:var(--ct-text-*)];
 * spacing via var(--ct-space-*). No forbidden words.
 */

import { useState, useCallback, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/catalyst/modal";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { BENTO_PRIMARY_BTN, BENTO_SECONDARY_BTN } from "@/components/catalyst/bento";
import {
  PRODUCT_FAMILY_LABEL,
  PRIORITY_LABEL,
  RISK_LABEL,
  bpsToPct,
  type ProductFamily,
  type ProductStrategy,
  type RiskProfileKey,
  type HorizonMonths,
  type Priority,
} from "@/lib/product-strategies/types";
import { validateStrategySet, type StrategyViolation } from "@/lib/product-strategies/validate";
import {
  newStrategyDraft,
  persistencePending,
} from "@/components/admin/strategies/use-strategy-store";
import { SLEEVE_COLORS, SLEEVE_LABEL, sleeveOrder } from "@/lib/product-strategies/lab-colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initial?: ProductStrategy;
  onSave: (strategy: ProductStrategy) => void;
  onOpenLab?: (strategy: ProductStrategy) => void;
  now: string;
}

type StepIndex = 1 | 2 | 3 | 4 | 5 | 6;

// Allocation form: four percentages (stored as strings for input binding)
interface AllocForm {
  miningPct: string;
  btcPct: string;
  stableReservePct: string;
  yieldOverlayPct: string;
}

interface AssumptionsForm {
  btcAnnualVolPct: string;   // fraction stored as %, e.g. "60" = 0.60
  borrowAprPct: string;
  electricityMonthlyCost: string;
  stableYieldPct: string;
  overlayYieldPct: string;
  miningYieldPct: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctToNum(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function allocFormToBps(form: AllocForm): {
  miningBps: number;
  btcBps: number;
  stableReserveBps: number;
  yieldOverlayBps: number;
} {
  return {
    miningBps: Math.round(pctToNum(form.miningPct) * 100),
    btcBps: Math.round(pctToNum(form.btcPct) * 100),
    stableReserveBps: Math.round(pctToNum(form.stableReservePct) * 100),
    yieldOverlayBps: Math.round(pctToNum(form.yieldOverlayPct) * 100),
  };
}

function allocSum(form: AllocForm): number {
  return (
    pctToNum(form.miningPct) +
    pctToNum(form.btcPct) +
    pctToNum(form.stableReservePct) +
    pctToNum(form.yieldOverlayPct)
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function toAssumptionsFromForm(
  form: AssumptionsForm,
): Pick<
  ProductStrategy["scenarios"]["balanced"]["assumptions"],
  "btcAnnualVol"
> {
  return {
    btcAnnualVol: pctToNum(form.btcAnnualVolPct) / 100,
  };
}

function initAllocForm(strategy: ProductStrategy, profile: RiskProfileKey): AllocForm {
  const alloc = strategy.scenarios[profile].allocation;
  return {
    miningPct: String(bpsToPct(alloc.miningBps)),
    btcPct: String(bpsToPct(alloc.btcBps)),
    stableReservePct: String(bpsToPct(alloc.stableReserveBps)),
    yieldOverlayPct: String(bpsToPct(alloc.yieldOverlayBps)),
  };
}

function initAssumptionsForm(strategy: ProductStrategy): AssumptionsForm {
  const a = strategy.scenarios.balanced.assumptions;
  return {
    btcAnnualVolPct: String(Math.round(a.btcAnnualVol * 100)),
    borrowAprPct: "8",
    electricityMonthlyCost: "0",
    stableYieldPct: "5",
    overlayYieldPct: "6",
    miningYieldPct: "12",
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<StepIndex, string> = {
  1: "Identity",
  2: "Product",
  3: "Allocation",
  4: "Assumptions",
  5: "Rules",
  6: "Review",
};

interface StepperProps {
  current: StepIndex;
}

function Stepper({ current }: StepperProps) {
  const steps = [1, 2, 3, 4, 5, 6] as StepIndex[];
  return (
    <nav
      aria-label="Form steps"
      className="flex items-center gap-[var(--ct-space-1)] mb-[var(--ct-space-5)]"
    >
      {steps.map((step, idx) => {
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-[var(--ct-space-1)] min-w-0">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[length:var(--ct-text-micro)] font-bold",
                active &&
                  "bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
                done &&
                  "bg-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)] text-[var(--ct-accent)]",
                !active && !done &&
                  "border border-[var(--ct-border-soft)] text-[var(--ct-text-muted)]",
              )}
            >
              {done ? "✓" : step}
            </div>
            <span
              className={cn(
                "truncate text-[length:var(--ct-text-xs)] hidden sm:inline",
                active && "ct-text-strong font-medium",
                !active && "text-[var(--ct-text-muted)]",
              )}
            >
              {STEP_LABELS[step]}
            </span>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "mx-[var(--ct-space-1)] h-px w-4 shrink-0",
                  done ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-border-soft)]",
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, error, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-[var(--ct-space-1)]">
      <label className="text-[length:var(--ct-text-xs)] font-medium ct-text-strong">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">{hint}</p>
      )}
      {error && (
        <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-status-danger)]">{error}</p>
      )}
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-md border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_4%,transparent)] px-[var(--ct-space-3)] py-[var(--ct-space-2)] text-[length:var(--ct-text-xs)] ct-text-strong placeholder:text-[var(--ct-text-muted)] focus:outline-none focus:border-[var(--ct-accent)] transition-colors disabled:opacity-[var(--ct-opacity-50)]";

const SELECT_CLS =
  "w-full rounded-md border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_4%,transparent)] px-[var(--ct-space-3)] py-[var(--ct-space-2)] text-[length:var(--ct-text-xs)] ct-text-strong focus:outline-none focus:border-[var(--ct-accent)] transition-colors";

// Allocation bar component
interface AllocBarProps {
  form: AllocForm;
}

function AllocBar({ form }: AllocBarProps) {
  const vals = {
    mining: pctToNum(form.miningPct),
    btc: pctToNum(form.btcPct),
    stableReserve: pctToNum(form.stableReservePct),
    yieldOverlay: pctToNum(form.yieldOverlayPct),
  };
  const total = vals.mining + vals.btc + vals.stableReserve + vals.yieldOverlay;
  const safeTotal = total > 0 ? total : 1;

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label="Allocation preview">
      {sleeveOrder.map((key) => {
        const val = vals[key];
        const pct = (val / safeTotal) * 100;
        return (
          <div
            key={key}
            style={{
              width: `${pct}%`,
              backgroundColor: SLEEVE_COLORS[key],
            }}
            title={`${SLEEVE_LABEL[key]} ${val.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

interface AllocLegendProps {
  form: AllocForm;
}

function AllocLegend({ form }: AllocLegendProps) {
  const vals: Record<(typeof sleeveOrder)[number], number> = {
    mining: pctToNum(form.miningPct),
    btc: pctToNum(form.btcPct),
    stableReserve: pctToNum(form.stableReservePct),
    yieldOverlay: pctToNum(form.yieldOverlayPct),
  };
  return (
    <div className="flex flex-wrap gap-[var(--ct-space-3)] mt-[var(--ct-space-2)]">
      {sleeveOrder.map((key) => (
        <div key={key} className="flex items-center gap-[var(--ct-space-1)]">
          <span
            className="inline-block h-2 w-2 rounded-sm shrink-0"
            style={{ backgroundColor: SLEEVE_COLORS[key] }}
          />
          <span className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">
            {SLEEVE_LABEL[key]}{" "}
            <span className="ct-text-strong font-medium">{vals[key].toFixed(1)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// Number input component
interface NumberInputProps {
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
  disabled?: boolean;
}

function NumberInput({ value, onChange, suffix, min, max, step = "0.1", placeholder, disabled }: NumberInputProps) {
  return (
    <div className="flex items-center gap-[var(--ct-space-2)]">
      <input
        type="number"
        className={cn(INPUT_CLS, "flex-1")}
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder ?? "0"}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
      {suffix && (
        <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] shrink-0">
          {suffix}
        </span>
      )}
    </div>
  );
}

// Violation list
interface ViolationListProps {
  violations: StrategyViolation[];
}

function ViolationList({ violations }: ViolationListProps) {
  if (violations.length === 0) return null;
  return (
    <div className="rounded-md border border-[var(--ct-status-danger)] bg-[color-mix(in_srgb,var(--ct-status-danger)_8%,transparent)] px-[var(--ct-space-3)] py-[var(--ct-space-2)]">
      <p className="text-[length:var(--ct-text-xs)] font-semibold text-[var(--ct-status-danger)] mb-[var(--ct-space-1)]">
        Validation issues — save blocked
      </p>
      <ul className="list-disc list-inside space-y-[var(--ct-space-1)]">
        {violations.map((v) => (
          <li key={v.code} className="text-[length:var(--ct-text-micro)] text-[var(--ct-status-danger)]">
            <span className="font-mono text-[var(--ct-status-danger)] opacity-80">[{v.code}]</span>{" "}
            {v.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step panels
// ---------------------------------------------------------------------------

// Step 1: Identity
interface Step1Props {
  name: string;
  slug: string;
  description: string;
  slugManual: boolean;
  onChange: (field: "name" | "slug" | "description", value: string) => void;
  onSlugManual: () => void;
}

function Step1Identity({ name, slug, description, onChange, slugManual, onSlugManual }: Step1Props) {
  return (
    <div className="flex flex-col gap-[var(--ct-space-4)]">
      <Field label="Strategy name" error={name.trim().length < 3 && name.length > 0 ? "Name must be at least 3 characters" : undefined}>
        <input
          type="text"
          className={INPUT_CLS}
          value={name}
          placeholder="e.g. BTC Mining Balanced"
          maxLength={80}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange("name", e.target.value)}
        />
      </Field>
      <Field label="Slug" hint="URL-safe identifier — auto-derived from name. Editable if needed.">
        <div className="flex gap-[var(--ct-space-2)]">
          <input
            type="text"
            className={cn(INPUT_CLS, "font-mono")}
            value={slug}
            maxLength={60}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              onSlugManual();
              onChange("slug", e.target.value);
            }}
          />
          {slugManual && (
            <CockpitButton
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange("slug", slugify(name));
                onSlugManual();
              }}
            >
              Reset
            </CockpitButton>
          )}
        </div>
      </Field>
      <Field label="Description" hint="Short description shown in the strategy library. No financial outcomes here.">
        <textarea
          className={cn(INPUT_CLS, "resize-none min-h-[80px]")}
          value={description}
          placeholder="Describe the strategy's focus and use-case…"
          maxLength={300}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange("description", e.target.value)}
        />
        <span className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)] text-right">
          {description.length}/300
        </span>
      </Field>
    </div>
  );
}

// Step 2: Product family, risk profile, horizon, priority
interface Step2Props {
  family: ProductFamily;
  riskProfile: RiskProfileKey;
  horizon: HorizonMonths;
  priority: Priority;
  onChange: (
    field: "family" | "riskProfile" | "horizon" | "priority",
    value: string,
  ) => void;
}

function Step2Product({ family, riskProfile, horizon, priority, onChange }: Step2Props) {
  return (
    <div className="flex flex-col gap-[var(--ct-space-4)]">
      <Field label="Product family">
        <select
          className={SELECT_CLS}
          value={family}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange("family", e.target.value)}
        >
          {(Object.entries(PRODUCT_FAMILY_LABEL) as [ProductFamily, string][]).map(
            ([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ),
          )}
        </select>
      </Field>
      <Field label="Default risk profile" hint="The scenario shown by default in the product workspace.">
        <select
          className={SELECT_CLS}
          value={riskProfile}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange("riskProfile", e.target.value)}
        >
          {(["safe", "balanced", "opportunistic"] as RiskProfileKey[]).map((k) => (
            <option key={k} value={k}>
              {RISK_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Projection horizon">
        <select
          className={SELECT_CLS}
          value={horizon}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange("horizon", e.target.value)}
        >
          {([12, 24, 36] as HorizonMonths[]).map((h) => (
            <option key={h} value={h}>
              {h} months
            </option>
          ))}
        </select>
      </Field>
      <Field label="Default priority">
        <select
          className={SELECT_CLS}
          value={priority}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange("priority", e.target.value)}
        >
          {(Object.entries(PRIORITY_LABEL) as [Priority, string][]).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

// Step 3: Scenario allocation (balanced scenario, others auto-derived)
interface Step3Props {
  allocForm: AllocForm;
  riskProfile: RiskProfileKey;
  onChangeAlloc: (field: keyof AllocForm, value: string) => void;
}

function Step3Allocation({ allocForm, riskProfile, onChangeAlloc }: Step3Props) {
  const total = allocSum(allocForm);
  const atHundred = Math.abs(total - 100) < 0.15;

  return (
    <div className="flex flex-col gap-[var(--ct-space-4)]">
      <div className="rounded-md border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-accent)_4%,transparent)] px-[var(--ct-space-3)] py-[var(--ct-space-2)]">
        <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">
          Editing allocation for the{" "}
          <span className="font-semibold ct-text-strong">{RISK_LABEL[riskProfile]}</span>{" "}
          scenario. The Safe and Opportunistic scenarios are auto-derived from default
          templates — editable later in the Data Lab.
        </p>
      </div>

      <div className="flex flex-col gap-[var(--ct-space-3)]">
        {([
          { field: "miningPct" as const, sleeve: "mining" as const, label: "Mining" },
          { field: "btcPct" as const, sleeve: "btc" as const, label: "BTC" },
          { field: "stableReservePct" as const, sleeve: "stableReserve" as const, label: "Stable Reserve" },
          { field: "yieldOverlayPct" as const, sleeve: "yieldOverlay" as const, label: "Yield Overlay" },
        ]).map(({ field, sleeve, label }) => (
          <div key={field} className="flex items-center gap-[var(--ct-space-3)]">
            <div
              className="h-3 w-3 rounded-sm shrink-0"
              style={{ backgroundColor: SLEEVE_COLORS[sleeve] }}
            />
            <label className="w-28 shrink-0 text-[length:var(--ct-text-xs)] ct-text-strong">
              {label}
            </label>
            <NumberInput
              value={allocForm[field]}
              onChange={(v) => onChangeAlloc(field, v)}
              suffix="%"
              min={0}
              max={100}
              step="0.5"
              placeholder="0"
            />
          </div>
        ))}
      </div>

      {/* Live allocation bar */}
      <div className="flex flex-col gap-[var(--ct-space-2)]">
        <AllocBar form={allocForm} />
        <AllocLegend form={allocForm} />
        <div
          className={cn(
            "text-[length:var(--ct-text-xs)] font-semibold text-right",
            atHundred ? "text-[var(--ct-accent)]" : "text-[var(--ct-status-danger)]",
          )}
        >
          {total.toFixed(2)}% {atHundred ? "✓ sums to 100%" : "— must equal 100%"}
        </div>
      </div>
    </div>
  );
}

// Step 4: Collateral / debt assumptions
interface Step4Props {
  assumptions: AssumptionsForm;
  onChangeAssumptions: (field: keyof AssumptionsForm, value: string) => void;
}

function Step4Assumptions({ assumptions, onChangeAssumptions }: Step4Props) {
  return (
    <div className="flex flex-col gap-[var(--ct-space-4)]">
      <div className="rounded-md border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)] px-[var(--ct-space-3)] py-[var(--ct-space-2)]">
        <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">
          These assumptions inform scenario modelling. Market parameters not stored on
          ProductStrategy (borrow APR, electricity, per-sleeve yields) are informational
          here — they are applied in the Data Lab&apos;s projection engine.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ct-space-4)]">
        <Field label="BTC annual volatility" hint="Used by the scenario engine. Fraction as %, e.g. 60 = 0.60.">
          <NumberInput
            value={assumptions.btcAnnualVolPct}
            onChange={(v) => onChangeAssumptions("btcAnnualVolPct", v)}
            suffix="%"
            min={0}
            max={200}
            step="1"
          />
        </Field>
        <Field label="Borrow APR" hint="Data Lab only — not stored on strategy.">
          <NumberInput
            value={assumptions.borrowAprPct}
            onChange={(v) => onChangeAssumptions("borrowAprPct", v)}
            suffix="%"
            min={0}
            step="0.25"
          />
        </Field>
        <Field label="Electricity cost / month" hint="Data Lab only — not stored on strategy.">
          <NumberInput
            value={assumptions.electricityMonthlyCost}
            onChange={(v) => onChangeAssumptions("electricityMonthlyCost", v)}
            suffix="USD"
            min={0}
            step="100"
          />
        </Field>
        <Field label="Stable sleeve yield" hint="Data Lab only — not stored on strategy.">
          <NumberInput
            value={assumptions.stableYieldPct}
            onChange={(v) => onChangeAssumptions("stableYieldPct", v)}
            suffix="%"
            min={0}
            step="0.25"
          />
        </Field>
        <Field label="Overlay sleeve yield" hint="Data Lab only — not stored on strategy.">
          <NumberInput
            value={assumptions.overlayYieldPct}
            onChange={(v) => onChangeAssumptions("overlayYieldPct", v)}
            suffix="%"
            min={0}
            step="0.25"
          />
        </Field>
        <Field label="Mining sleeve yield" hint="Data Lab only — not stored on strategy.">
          <NumberInput
            value={assumptions.miningYieldPct}
            onChange={(v) => onChangeAssumptions("miningYieldPct", v)}
            suffix="%"
            min={0}
            step="0.5"
          />
        </Field>
      </div>

      <div className="rounded-md border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)] px-[var(--ct-space-3)] py-[var(--ct-space-2)]">
        <p className="text-[length:var(--ct-text-xs)] font-semibold ct-text-strong mb-[var(--ct-space-1)]">
          Liquidation / de-risk / re-risk triggers
        </p>
        <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">
          Liquidation LTV, de-risk trigger, and re-risk trigger thresholds are
          applied as rule parameters in the Data Lab engine. They are not part of
          the ProductStrategy schema and can be configured per backtest run in the
          Lab&apos;s sensitivity panel.
        </p>
      </div>
    </div>
  );
}

// Step 5: Rebalancing rules (read-only note)
function Step5Rules() {
  return (
    <div className="flex flex-col gap-[var(--ct-space-4)]">
      <div className="rounded-md border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-accent)_4%,transparent)] px-[var(--ct-space-4)] py-[var(--ct-space-4)]">
        <p className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong mb-[var(--ct-space-2)]">
          Default rebalancing rules applied
        </p>
        <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] mb-[var(--ct-space-3)]">
          This draft will use the standard liquidate / repurchase rule set:
        </p>
        <ul className="space-y-[var(--ct-space-2)] text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">
          <li className="flex gap-[var(--ct-space-2)]">
            <span className="text-[var(--ct-accent)] shrink-0">·</span>
            Liquidation triggered at the configured LTV threshold (Data Lab parameter)
          </li>
          <li className="flex gap-[var(--ct-space-2)]">
            <span className="text-[var(--ct-accent)] shrink-0">·</span>
            De-risk sweep moves BTC proceeds to stable reserve sleeve
          </li>
          <li className="flex gap-[var(--ct-space-2)]">
            <span className="text-[var(--ct-accent)] shrink-0">·</span>
            Re-risk re-enters BTC at the configured trigger (price recovery)
          </li>
          <li className="flex gap-[var(--ct-space-2)]">
            <span className="text-[var(--ct-accent)] shrink-0">·</span>
            Monthly distribution target derived from distribution bps in the scenario assumptions
          </li>
        </ul>
        <p className="mt-[var(--ct-space-3)] text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">
          All rebalancing rules are fully editable in the Data Lab after saving this draft.
          Sensitivity thresholds, sweep percentages, and timing are configured per backtest
          run — they are not part of the strategy schema itself.
        </p>
      </div>
    </div>
  );
}

// Step 6: Review & save
interface Step6Props {
  strategy: ProductStrategy;
  violations: StrategyViolation[];
  onSave: () => void;
  onSaveAndLab: (() => void) | undefined;
  allocForm: AllocForm;
}

function Step6Review({ strategy, violations, onSave, onSaveAndLab, allocForm }: Step6Props) {
  const allocPct = {
    mining: bpsToPct(strategy.scenarios[strategy.defaultRiskProfile].allocation.miningBps),
    btc: bpsToPct(strategy.scenarios[strategy.defaultRiskProfile].allocation.btcBps),
    stableReserve: bpsToPct(strategy.scenarios[strategy.defaultRiskProfile].allocation.stableReserveBps),
    yieldOverlay: bpsToPct(strategy.scenarios[strategy.defaultRiskProfile].allocation.yieldOverlayBps),
  };

  const blocked = violations.length > 0;

  return (
    <div className="flex flex-col gap-[var(--ct-space-4)]">
      {/* Summary card */}
      <div className="rounded-lg border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)] p-[var(--ct-space-4)]">
        <div className="flex items-start justify-between gap-[var(--ct-space-3)] mb-[var(--ct-space-3)]">
          <div>
            <p className="text-[length:var(--ct-text-sm)] font-bold ct-text-strong">{strategy.name}</p>
            <p className="text-[length:var(--ct-text-micro)] font-mono text-[var(--ct-text-muted)]">
              {strategy.slug}
            </p>
          </div>
          <span className="rounded-full border border-[var(--ct-border-soft)] px-[var(--ct-space-2)] py-[var(--ct-space-1)] text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">
            draft
          </span>
        </div>

        {strategy.description && (
          <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] mb-[var(--ct-space-3)]">
            {strategy.description}
          </p>
        )}

        <div className="grid grid-cols-3 gap-[var(--ct-space-3)] mb-[var(--ct-space-3)]">
          <div>
            <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">Family</p>
            <p className="text-[length:var(--ct-text-xs)] ct-text-strong font-medium">
              {PRODUCT_FAMILY_LABEL[strategy.productFamily]}
            </p>
          </div>
          <div>
            <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">Default risk</p>
            <p className="text-[length:var(--ct-text-xs)] ct-text-strong font-medium">
              {RISK_LABEL[strategy.defaultRiskProfile]}
            </p>
          </div>
          <div>
            <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">Horizon</p>
            <p className="text-[length:var(--ct-text-xs)] ct-text-strong font-medium">
              {strategy.defaultHorizonMonths}mo
            </p>
          </div>
        </div>

        {/* Allocation preview */}
        <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)] mb-[var(--ct-space-1)]">
          {RISK_LABEL[strategy.defaultRiskProfile]} allocation
        </p>
        <AllocBar form={allocForm} />
        <div className="flex flex-wrap gap-[var(--ct-space-3)] mt-[var(--ct-space-2)]">
          {sleeveOrder.map((key) => (
            <div key={key} className="flex items-center gap-[var(--ct-space-1)]">
              <span
                className="inline-block h-2 w-2 rounded-sm shrink-0"
                style={{ backgroundColor: SLEEVE_COLORS[key] }}
              />
              <span className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">
                {SLEEVE_LABEL[key]}{" "}
                <span className="ct-text-strong font-medium">{allocPct[key]}%</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Persistence note */}
      {persistencePending && (
        <div className="flex items-center gap-[var(--ct-space-2)] rounded-md border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_4%,transparent)] px-[var(--ct-space-3)] py-[var(--ct-space-2)]">
          <span className="h-2 w-2 rounded-full bg-[var(--ct-status-warning)] shrink-0" />
          <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)]">
            Local draft — persistence pending. This strategy lives in browser memory only
            and will be lost on page reload until a DB save is wired.
          </p>
        </div>
      )}

      {/* Disclaimer (product non-negotiable) */}
      <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)] italic">
        Projections are conditional on the stated assumptions and are not guaranteed.
        This draft has not been reviewed or activated.
      </p>

      {/* Violations */}
      <ViolationList violations={violations} />

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-[var(--ct-space-3)] pt-[var(--ct-space-2)] border-t border-[var(--ct-border-soft)]">
        {onSaveAndLab && (
          <button
            type="button"
            className={cn(
              BENTO_SECONDARY_BTN,
              blocked && "opacity-[var(--ct-opacity-50)] cursor-not-allowed",
            )}
            disabled={blocked}
            onClick={onSaveAndLab}
          >
            Save &amp; Open Data Lab
          </button>
        )}
        <button
          type="button"
          className={cn(
            BENTO_PRIMARY_BTN,
            blocked && "opacity-[var(--ct-opacity-50)] cursor-not-allowed",
          )}
          disabled={blocked}
          onClick={onSave}
        >
          Save draft
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CreateStrategyModal({
  isOpen,
  onClose,
  mode,
  initial,
  onSave,
  onOpenLab,
  now,
}: CreateStrategyModalProps) {
  // Build baseline draft from initial or fresh defaults
  const baseline: ProductStrategy = initial ?? newStrategyDraft({}, now);

  // ---- Step state ----
  const [step, setStep] = useState<StepIndex>(1);

  // ---- Step 1 state ----
  const [name, setName] = useState(baseline.name);
  const [slug, setSlug] = useState(baseline.slug);
  const [description, setDescription] = useState(baseline.description);
  const [slugManual, setSlugManual] = useState(false);

  // ---- Step 2 state ----
  const [family, setFamily] = useState<ProductFamily>(baseline.productFamily);
  const [riskProfile, setRiskProfile] = useState<RiskProfileKey>(baseline.defaultRiskProfile);
  const [horizon, setHorizon] = useState<HorizonMonths>(baseline.defaultHorizonMonths);
  const [priority, setPriority] = useState<Priority>(baseline.defaultPriority);

  // ---- Step 3 state ----
  const [allocForm, setAllocForm] = useState<AllocForm>(() =>
    initAllocForm(baseline, baseline.defaultRiskProfile),
  );

  // ---- Step 4 state ----
  const [assumptionsForm, setAssumptionsForm] = useState<AssumptionsForm>(() =>
    initAssumptionsForm(baseline),
  );

  // ---- Allocation validation ----
  const allocTotal = allocSum(allocForm);
  const allocValid = Math.abs(allocTotal - 100) < 0.15;

  // ---- Build current strategy from form state ----
  const buildStrategy = useCallback((): ProductStrategy => {
    const bps = allocFormToBps(allocForm);
    const volFraction = toAssumptionsFromForm(assumptionsForm).btcAnnualVol;
    const horizonVal: HorizonMonths = horizon;

    // Merge balanced allocation from form; safe/opportunistic from baseline defaults
    const updatedScenarios: ProductStrategy["scenarios"] = {
      safe: {
        ...baseline.scenarios.safe,
        assumptions: {
          ...baseline.scenarios.safe.assumptions,
          horizonMonths: horizonVal,
          btcAnnualVol: volFraction,
        },
      },
      balanced: {
        ...baseline.scenarios.balanced,
        allocation: bps,
        assumptions: {
          ...baseline.scenarios.balanced.assumptions,
          horizonMonths: horizonVal,
          btcAnnualVol: volFraction,
        },
      },
      opportunistic: {
        ...baseline.scenarios.opportunistic,
        assumptions: {
          ...baseline.scenarios.opportunistic.assumptions,
          horizonMonths: horizonVal,
          btcAnnualVol: volFraction,
        },
      },
    };

    // In create mode build fresh draft; in edit mode merge into initial
    if (mode === "edit" && initial) {
      return {
        ...initial,
        name,
        slug,
        description,
        productFamily: family,
        defaultRiskProfile: riskProfile,
        defaultHorizonMonths: horizonVal,
        defaultPriority: priority,
        scenarios: updatedScenarios,
        updatedAt: now,
      };
    }

    return newStrategyDraft(
      {
        name,
        slug,
        description,
        productFamily: family,
        defaultRiskProfile: riskProfile,
        defaultHorizonMonths: horizonVal,
        defaultPriority: priority,
        scenarios: updatedScenarios,
      },
      now,
    );
  }, [
    allocForm,
    assumptionsForm,
    baseline,
    description,
    family,
    horizon,
    initial,
    mode,
    name,
    now,
    priority,
    riskProfile,
    slug,
  ]);

  // ---- Violations (computed on review step) ----
  const [reviewViolations, setReviewViolations] = useState<StrategyViolation[]>([]);

  // ---- Navigation ----
  const canProceedStep: Record<StepIndex, boolean> = {
    1: name.trim().length >= 3 && slug.trim().length >= 1,
    2: true,
    3: allocValid,
    4: true,
    5: true,
    6: true,
  };

  const goNext = useCallback(() => {
    if (step < 6) {
      const next = (step + 1) as StepIndex;
      if (next === 6) {
        // Run validation before showing the review step
        const built = buildStrategy();
        const violations = validateStrategySet([built]);
        setReviewViolations(violations);
      }
      setStep(next);
    }
  }, [step, buildStrategy]);

  const goBack = useCallback(() => {
    if (step > 1) setStep((s) => (s - 1) as StepIndex);
  }, [step]);

  // ---- Identity field handler ----
  const handleIdentityChange = useCallback(
    (field: "name" | "slug" | "description", value: string) => {
      if (field === "name") {
        setName(value);
        if (!slugManual) setSlug(slugify(value));
      } else if (field === "slug") {
        setSlug(value);
      } else {
        setDescription(value);
      }
    },
    [slugManual],
  );

  // ---- Product field handler ----
  const handleProductChange = useCallback(
    (field: "family" | "riskProfile" | "horizon" | "priority", value: string) => {
      if (field === "family") setFamily(value as ProductFamily);
      else if (field === "riskProfile") {
        const rp = value as RiskProfileKey;
        setRiskProfile(rp);
        // Re-initialise alloc form for the newly chosen scenario
        setAllocForm(initAllocForm(baseline, rp));
      } else if (field === "horizon") setHorizon(Number(value) as HorizonMonths);
      else if (field === "priority") setPriority(value as Priority);
    },
    [baseline],
  );

  // ---- Alloc handler ----
  const handleAllocChange = useCallback(
    (field: keyof AllocForm, value: string) => {
      setAllocForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // ---- Assumptions handler ----
  const handleAssumptionsChange = useCallback(
    (field: keyof AssumptionsForm, value: string) => {
      setAssumptionsForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // ---- Save handlers ----
  const handleSave = useCallback(() => {
    const built = buildStrategy();
    onSave(built);
    onClose();
  }, [buildStrategy, onSave, onClose]);

  const handleSaveAndLab = useCallback(() => {
    if (!onOpenLab) return;
    const built = buildStrategy();
    onSave(built);
    onOpenLab(built);
    onClose();
  }, [buildStrategy, onSave, onOpenLab, onClose]);

  // ---- Built strategy for review ----
  const builtForReview = step === 6 ? buildStrategy() : baseline;

  const title = mode === "edit" ? `Edit strategy — ${initial?.name ?? ""}` : "Create strategy";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-[var(--ct-space-2)] min-w-0">
        <Stepper current={step} />

        {/* Step content */}
        <div className="min-h-[280px]">
          {step === 1 && (
            <Step1Identity
              name={name}
              slug={slug}
              description={description}
              slugManual={slugManual}
              onChange={handleIdentityChange}
              onSlugManual={() => setSlugManual(true)}
            />
          )}
          {step === 2 && (
            <Step2Product
              family={family}
              riskProfile={riskProfile}
              horizon={horizon}
              priority={priority}
              onChange={handleProductChange}
            />
          )}
          {step === 3 && (
            <Step3Allocation
              allocForm={allocForm}
              riskProfile={riskProfile}
              onChangeAlloc={handleAllocChange}
            />
          )}
          {step === 4 && (
            <Step4Assumptions
              assumptions={assumptionsForm}
              onChangeAssumptions={handleAssumptionsChange}
            />
          )}
          {step === 5 && <Step5Rules />}
          {step === 6 && (
            <Step6Review
              strategy={builtForReview}
              violations={reviewViolations}
              onSave={handleSave}
              onSaveAndLab={onOpenLab ? handleSaveAndLab : undefined}
              allocForm={allocForm}
            />
          )}
        </div>

        {/* Navigation footer (not shown on step 6 — it has its own actions) */}
        {step < 6 && (
          <div className="flex items-center justify-between pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)] mt-[var(--ct-space-2)]">
            <CockpitButton
              variant="ghost"
              size="md"
              onClick={goBack}
              disabled={step === 1}
            >
              ← Back
            </CockpitButton>
            <CockpitButton
              variant="primary"
              size="md"
              onClick={goNext}
              disabled={!canProceedStep[step]}
            >
              {step === 5 ? "Review →" : "Next →"}
            </CockpitButton>
          </div>
        )}
        {step === 6 && (
          <div className="flex items-center justify-start pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)] mt-[var(--ct-space-2)]">
            <CockpitButton variant="ghost" size="md" onClick={goBack}>
              ← Back
            </CockpitButton>
          </div>
        )}
      </div>
    </Modal>
  );
}
