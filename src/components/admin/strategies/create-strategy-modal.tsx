"use client";

/**
 * CreateStrategyModal — short single-screen identity form for ProductStrategy drafts.
 *
 * Collects identity + family metadata only. Allocation, assumptions, and
 * rebalancing rules are calibrated afterwards in the Studio (sliders,
 * backtests) — `newStrategyDraft` fills valid scenario/allocation/rule
 * defaults so the draft passes `validateStrategy` immediately.
 *
 * Local state only (useState). No fetch, no DB, no Date.now(), no Math.random().
 * Timestamps come from the `now` prop. All tokens are --ct-* vars; text sizes
 * via text-[length:var(--ct-text-*)]; spacing via var(--ct-space-*). No forbidden words.
 */

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { Modal } from "@/components/catalyst/modal";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Input } from "@/components/catalyst/input";
import { SegmentedControl, type SegmentedItem } from "@/components/catalyst/segmented-control";
import {
  PRODUCT_FAMILY_LABEL,
  PRIORITY_LABEL,
  RISK_LABEL,
  type ProductFamily,
  type ProductStrategy,
  type RiskProfileKey,
  type HorizonMonths,
  type Priority,
} from "@/lib/product-strategies/types";
import { validateStrategy, type StrategyViolation } from "@/lib/product-strategies/validate";
import { newStrategyDraft } from "@/components/admin/strategies/use-strategy-store";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const RISK_ITEMS: ReadonlyArray<SegmentedItem<RiskProfileKey>> = (
  ["safe", "balanced", "opportunistic"] as RiskProfileKey[]
).map((k) => ({ value: k, label: RISK_LABEL[k] }));

const HORIZON_ITEMS: ReadonlyArray<SegmentedItem<"12" | "24" | "36">> = (
  [12, 24, 36] as HorizonMonths[]
).map((h) => ({ value: String(h) as "12" | "24" | "36", label: `${h}mo` }));

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

const TEXTAREA_CLS =
  "w-full rounded-md border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_4%,transparent)] px-[var(--ct-space-3)] py-[var(--ct-space-2)] text-[length:var(--ct-text-xs)] ct-text-strong placeholder:text-[var(--ct-text-muted)] focus:outline-none focus:border-[var(--ct-accent)] transition-colors resize-none min-h-[80px]";

const SELECT_CLS =
  "w-full rounded-md border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_4%,transparent)] px-[var(--ct-space-3)] py-[var(--ct-space-2)] text-[length:var(--ct-text-xs)] ct-text-strong focus:outline-none focus:border-[var(--ct-accent)] transition-colors";

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
            <span className="mono text-[var(--ct-status-danger)] opacity-80">[{v.code}]</span>{" "}
            {v.detail}
          </li>
        ))}
      </ul>
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
  // Build baseline draft from initial or fresh defaults — memoised so
  // newStrategyDraft (and its _draftCounter) is only called once per mount.
  const baseline: ProductStrategy = useMemo(
    () => initial ?? newStrategyDraft({}, now),
    [initial, now],
  );

  // ---- Identity state ----
  // Create mode opens EMPTY so the operator names the strategy deliberately
  // (the auto "Draft Strategy N" default made zero-thought creation valid).
  const [name, setName] = useState(mode === "edit" ? baseline.name : "");
  const [slug, setSlug] = useState(mode === "edit" ? baseline.slug : "");
  const [description, setDescription] = useState(
    mode === "edit" ? baseline.description : "",
  );
  const [slugManual, setSlugManual] = useState(false);

  // ---- Family metadata state ----
  const [family, setFamily] = useState<ProductFamily>(baseline.productFamily);
  const [riskProfile, setRiskProfile] = useState<RiskProfileKey>(baseline.defaultRiskProfile);
  const [horizon, setHorizon] = useState<HorizonMonths>(baseline.defaultHorizonMonths);
  const [priority, setPriority] = useState<Priority>(baseline.defaultPriority);

  // ---- Violations (computed on submit) ----
  const [violations, setViolations] = useState<StrategyViolation[]>([]);

  const nameValid = name.trim().length >= 3;
  const slugValid = slug.trim().length >= 1;
  const formValid = nameValid && slugValid;

  const handleNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setName(value);
      if (!slugManual) setSlug(slugify(value));
    },
    [slugManual],
  );

  const handleSlugChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSlugManual(true);
    setSlug(e.target.value);
  }, []);

  const handleSlugReset = useCallback(() => {
    setSlug(slugify(name));
    setSlugManual(false);
  }, [name]);

  // ---- Build strategy from form state ----
  const buildStrategy = useCallback((): ProductStrategy => {
    if (mode === "edit" && initial) {
      return {
        ...initial,
        name,
        slug,
        description,
        productFamily: family,
        defaultRiskProfile: riskProfile,
        defaultHorizonMonths: horizon,
        defaultPriority: priority,
        updatedAt: now,
      };
    }

    return newStrategyDraft(
      {
        name,
        slug,
        // Empty description → let newStrategyDraft fill its honest default.
        description: description.trim() === "" ? undefined : description,
        productFamily: family,
        defaultRiskProfile: riskProfile,
        defaultHorizonMonths: horizon,
        defaultPriority: priority,
      },
      now,
    );
  }, [description, family, horizon, initial, mode, name, now, priority, riskProfile, slug]);

  const handleSubmit = useCallback(() => {
    const built = buildStrategy();
    const found = validateStrategy(built);
    if (found.length > 0) {
      setViolations(found);
      return;
    }
    onSave(built);
    if (onOpenLab) onOpenLab(built);
    onClose();
  }, [buildStrategy, onClose, onOpenLab, onSave]);

  const title = mode === "edit" ? `Edit strategy — ${initial?.name ?? ""}` : "Create strategy";
  const submitLabel = mode === "edit" ? "Save changes" : "Create & open Studio";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-2xl">
      <div className="flex flex-col gap-[var(--ct-space-4)] min-w-0">
        <Field
          label="Strategy name"
          error={!nameValid && name.length > 0 ? "Name must be at least 3 characters" : undefined}
        >
          <Input
            type="text"
            value={name}
            placeholder="e.g. BTC Mining Balanced"
            maxLength={80}
            onChange={handleNameChange}
          />
        </Field>

        <Field label="Slug" hint="URL-safe identifier — auto-derived from name. Editable if needed.">
          <div className="flex gap-[var(--ct-space-2)]">
            <Input
              type="text"
              className="mono"
              value={slug}
              maxLength={60}
              onChange={handleSlugChange}
            />
            {slugManual && (
              <CockpitButton size="sm" variant="ghost" onClick={handleSlugReset}>
                Reset
              </CockpitButton>
            )}
          </div>
        </Field>

        <Field label="Description" hint="Short description shown in the strategy library.">
          <textarea
            className={TEXTAREA_CLS}
            value={description}
            placeholder="Describe the strategy's focus and use-case… (optional)"
            maxLength={300}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          />
        </Field>

        <Field label="Product family">
          <select
            className={SELECT_CLS}
            value={family}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFamily(e.target.value as ProductFamily)}
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
          <SegmentedControl
            items={RISK_ITEMS}
            value={riskProfile}
            onChange={setRiskProfile}
            ariaLabel="Default risk profile"
            variant="radiogroup"
            scroll={false}
          />
        </Field>

        <Field label="Projection horizon">
          <SegmentedControl
            items={HORIZON_ITEMS}
            value={String(horizon) as "12" | "24" | "36"}
            onChange={(v) => setHorizon(Number(v) as HorizonMonths)}
            ariaLabel="Projection horizon"
            variant="radiogroup"
            scroll={false}
          />
        </Field>

        <Field label="Default priority">
          <select
            className={SELECT_CLS}
            value={priority}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setPriority(e.target.value as Priority)}
          >
            {(Object.entries(PRIORITY_LABEL) as [Priority, string][]).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <p className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)] italic">
          Allocation, assumptions, and rebalancing rules are calibrated in the Studio after
          creation.
        </p>

        <ViolationList violations={violations} />

        <div className="flex flex-wrap items-center justify-end gap-[var(--ct-space-3)] pt-[var(--ct-space-2)] border-t border-[var(--ct-border-soft)]">
          <CockpitButton variant="ghost" size="md" onClick={onClose}>
            Cancel
          </CockpitButton>
          <CockpitButton
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!formValid}
          >
            {submitLabel}
          </CockpitButton>
        </div>
      </div>
    </Modal>
  );
}
