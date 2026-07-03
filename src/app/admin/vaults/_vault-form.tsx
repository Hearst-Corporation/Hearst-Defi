"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { ApyRange } from "@/components/catalyst/apy-range";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { BentoPanel } from "@/components/catalyst/bento";
import { Progress } from "@/components/catalyst/progress";
import { MonteCarloReview } from "@/components/admin/monte-carlo-review";
import { ProjectionFooter } from "@/components/admin/projection-footer";
import { ForbiddenWordsInput } from "@/components/admin/forbidden-words-input";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { SHARE_CLASS_A } from "@/lib/engine/share-class";
import { BENTO_INPUT } from "@/components/admin/outreach/bento-form";
import { cn } from "@/lib/cn";
import {
  createDraftVault,
  updateDraftVault,
  type CreateDraftInput,
  type VaultActionResult,
} from "./actions";
import { saveWizardStep, discardWizardDraft } from "./draft-actions";

// ---------------------------------------------------------------------------
// Step types
// ---------------------------------------------------------------------------

type Step =
  | "identity"
  | "economics"
  | "allocations"
  | "legal"
  | "governance"
  | "review_simulate"
  | "sign_deploy";

const STEPS: { key: Step; label: string }[] = [
  { key: "identity", label: "Identity" },
  { key: "economics", label: "Economics" },
  { key: "allocations", label: "Allocations" },
  { key: "legal", label: "Legal" },
  { key: "governance", label: "Governance" },
  { key: "review_simulate", label: "Review" },
  { key: "sign_deploy", label: "Deploy" },
];

// ---------------------------------------------------------------------------
// Form state type — exported so the edit page and draft loader can use it
// ---------------------------------------------------------------------------

export type FormState = CreateDraftInput & { colorTag: string };

// #6 — derive fee defaults from SHARE_CLASS_A so form and engine stay in sync.
// #5 — hurdleBps added to form state with default 0.
const FORM_INITIAL: FormState = {
  ticker: "",
  name: "",
  description: "",
  strategy: "mining_yield",
  colorTag: "accent",
  minTicketUsdc: SHARE_CLASS_A.minTicketUsdc,
  capacityUsdc: 10000000,
  mgmtFeeBps: SHARE_CLASS_A.mgmtFeeBps,
  perfFeeBps: SHARE_CLASS_A.perfFeeBps,
  hurdleBps: SHARE_CLASS_A.hurdleBps,
  softLockupDays: SHARE_CLASS_A.softLockupDays,
  targetApyLowBps: 800,
  targetApyHighBps: 1500,
  spvJurisdiction: "cayman",
  shareClass: "A",
  regExemption: "regD_506c",
  disclaimers:
    "This vault is offered exclusively to qualified purchasers as defined in Section 2(a)(51) of the Investment Company Act. Past performance is not indicative of future results. This is not a solicitation or offer in any jurisdiction where such offer is unlawful. Distributions are not guaranteed and are subject to operational performance.",
  targetMiningBps: 5000,
  targetBtcTacticalBps: 2500,
  targetUsdcBaseBps: 1500,
  targetStableReserveBps: 1000,
  signersWhitelist: ["", ""],
  requiredSigners: 2,
};

// ---------------------------------------------------------------------------
// Props — discriminated union for create vs edit mode
// ---------------------------------------------------------------------------

export type VaultFormProps = (
  | { mode: "create"; resumeStep?: Step; resumeForm?: Partial<FormState> }
  | { mode: "edit"; vaultId: string; initial: FormState }
) & {
  /** Authenticated admin's signer identity (walletAddress ?? userId). Surfaced
   *  in the Governance step so the admin knows what to whitelist to be able to
   *  sign the deployment later (cf. signApproval actorWallet derivation). */
  adminId?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(bps: number) {
  return (bps / 100).toFixed(1);
}

/**
 * A signer identity is valid if it is a 0x… Ethereum address OR a 25-char admin
 * cuid. Mirrors the server-side accepted shapes (cf. GAP 1). An empty value is
 * "not invalid" (it's just an unfilled slot) so the per-row error only fires on
 * a genuinely malformed entry; the submit-gate separately requires enough
 * NON-empty valid entries.
 */
function isValidSigner(raw: string): boolean {
  const v = raw.trim();
  if (v.length === 0) return true;
  return /^0x[0-9a-fA-F]{40}$/.test(v) || /^[a-z0-9]{25}$/.test(v);
}

// Bento form chrome — shared sub-surface input (BENTO_INPUT), overridden to the
// denser text-xs variant this wizard uses. Micro uppercase labels, accent
// (#A7FB90) focus ring. One source for every native control in the form.
const BENTO_FIELD_HINT = "text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]";
const BENTO_LABEL =
  "text-[length:var(--ct-text-deci)] font-bold uppercase tracking-[0.15em] text-[var(--ct-text-faint)]";

function inputClass(extra?: string) {
  return cn(BENTO_INPUT, "text-[length:var(--ct-text-xs)]", extra);
}

/** Bento section heading inside a panel body. */
function StepHeader({ title }: { title: string }) {
  return (
    <h2 className="text-[length:var(--ct-text-sm)] font-semibold tracking-tight text-[var(--ct-text-strong)]">
      {title}
    </h2>
  );
}

/** Bento two/three-column field grid (replaces MetricGrid). */
function FieldGrid({
  columns = 2,
  className,
  children,
}: {
  columns?: 2 | 3;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5",
        columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Read-only recap row (label left, value right) for the review step. */
function RecapRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={BENTO_LABEL}>{label}</span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VaultForm — shared form for create and edit modes
// ---------------------------------------------------------------------------

export function VaultForm(props: VaultFormProps) {
  const router = useRouter();

  const initialStep: Step =
    props.mode === "create" && props.resumeStep ? props.resumeStep : "identity";

  const initialForm: FormState =
    props.mode === "edit"
      ? props.initial
      : props.mode === "create" && props.resumeForm
        ? { ...FORM_INITIAL, ...props.resumeForm }
        : FORM_INITIAL;

  const [step, setStep] = useState<Step>(initialStep);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  // ---------------------------------------------------------------------------
  // Autosave — debounced on blur or step change (create mode only)
  // ---------------------------------------------------------------------------

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleAutosave = useCallback(
    (currentStep: Step, currentForm: FormState) => {
      if (props.mode !== "create") return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        void saveWizardStep(currentStep, currentForm);
      }, 800);
    },
    [props.mode],
  );

  // Autosave whenever step changes
  useEffect(() => {
    if (props.mode === "create") {
      scheduleAutosave(step, form);
    }
    // Only trigger on step change, not form change (form blur handles that)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setNumber(key: keyof FormState, raw: string) {
    const n = parseFloat(raw);
    if (!isNaN(n)) set(key, n as FormState[typeof key]);
  }

  function setAllocationBps(key: keyof FormState, raw: string) {
    const n = Math.round(parseFloat(raw));
    if (!isNaN(n)) set(key, n as FormState[typeof key]);
  }

  function allocTotal() {
    return (
      form.targetMiningBps +
      form.targetBtcTacticalBps +
      form.targetUsdcBaseBps +
      form.targetStableReserveBps
    );
  }

  // ---------------------------------------------------------------------------
  // Signer-whitelist validation (drives the Sign & Deploy gate + recap)
  // ---------------------------------------------------------------------------

  // Non-empty entries only — the persisted payload also strips blanks.
  const filledSigners = form.signersWhitelist.filter((s) => s.trim().length > 0);
  const validFilledSigners = filledSigners.filter((s) => isValidSigner(s));
  const hasMalformedSigner = filledSigners.some((s) => !isValidSigner(s));
  const distinctValidSignerCount = new Set(
    validFilledSigners.map((s) => s.trim()),
  ).size;
  const adminInWhitelist =
    props.adminId !== undefined &&
    filledSigners.some((s) => s.trim() === props.adminId);
  // Submit is allowed only when every filled entry is well-formed AND there are
  // at least `requiredSigners` distinct valid signers (mirrors the server Zod
  // refine: requiredSigners ≤ signersWhitelist.length, min 2 signers).
  const signersOk =
    !hasMalformedSigner && distinctValidSignerCount >= form.requiredSigners;

  function handleBlur() {
    scheduleAutosave(step, form);
  }

  function nextStep() {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) {
      const nextKey = STEPS[idx + 1]!.key;
      setStep(nextKey);
      scheduleAutosave(nextKey, form);
    }
  }

  function prevStep() {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1]!.key);
  }

  function goToStep(target: Step) {
    const targetIdx = STEPS.findIndex((s) => s.key === target);
    if (targetIdx < stepIndex) {
      setStep(target);
    }
  }

  function buildInput(): CreateDraftInput {
    return {
      ticker: form.ticker,
      name: form.name,
      description: form.description,
      strategy: form.strategy,
      colorTag: form.colorTag,
      minTicketUsdc: form.minTicketUsdc,
      capacityUsdc: form.capacityUsdc,
      mgmtFeeBps: form.mgmtFeeBps,
      perfFeeBps: form.perfFeeBps,
      hurdleBps: form.hurdleBps,
      softLockupDays: form.softLockupDays,
      targetApyLowBps: form.targetApyLowBps,
      targetApyHighBps: form.targetApyHighBps,
      spvJurisdiction: form.spvJurisdiction,
      shareClass: form.shareClass,
      regExemption: form.regExemption,
      disclaimers: form.disclaimers,
      targetMiningBps: form.targetMiningBps,
      targetBtcTacticalBps: form.targetBtcTacticalBps,
      targetUsdcBaseBps: form.targetUsdcBaseBps,
      targetStableReserveBps: form.targetStableReserveBps,
      signersWhitelist: form.signersWhitelist.filter((s) => s.trim().length > 0),
      requiredSigners: form.requiredSigners,
    };
  }

  function formatIssues(issues: Extract<VaultActionResult, { ok: false }>["issues"]): string {
    return typeof issues === "string" ? issues : issues.map((i) => i.message).join(", ");
  }

  function handleSubmit() {
    setError(null);

    // Client-side gate (the server re-validates): block submission of a
    // malformed or under-quorum whitelist before round-tripping, with a clear
    // message instead of the raw Zod issue list.
    if (hasMalformedSigner) {
      setError(
        "One or more signers is malformed. Each must be a 0x… Ethereum address or a 25-char admin id.",
      );
      setStep("governance");
      return;
    }
    if (distinctValidSignerCount < form.requiredSigners) {
      setError(
        `Need at least ${form.requiredSigners} distinct valid signers — only ${distinctValidSignerCount} provided. Add signers in the Governance step.`,
      );
      setStep("governance");
      return;
    }

    startTransition(async () => {
      const input = buildInput();

      if (props.mode === "create") {
        const result = await createDraftVault(input);
        if (!result.ok) { setError(formatIssues(result.issues)); return; }
        // Clean up autosave draft on successful submission
        await discardWizardDraft();
        router.push(`/admin/vaults/${result.id}`);
      } else {
        const result = await updateDraftVault(props.vaultId, input);
        if (!result.ok) { setError(formatIssues(result.issues)); return; }
        router.push(`/admin/vaults/${props.vaultId}`);
      }
    });
  }

  const submitLabel =
    props.mode === "create"
      ? isPending
        ? "Creating…"
        : "Submit for Review"
      : isPending
        ? "Saving…"
        : "Save Changes";

  return (
    <div
      className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
      onBlur={handleBlur}
    >
      {/* Progress bar — spans both columns */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {STEPS.map((s, i) => {
            const isActive = i === stepIndex;
            const isCompleted = i < stepIndex;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => goToStep(s.key)}
                className={cn(
                  "flex flex-col items-center gap-1.5",
                  isCompleted ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border font-mono text-[length:var(--ct-text-2xs)] transition-colors",
                    isActive &&
                      "border-[var(--ct-accent)] text-[var(--ct-accent)] ring-2 ring-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)]",
                    isCompleted &&
                      "border-[var(--ct-accent)] bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
                    !isActive &&
                      !isCompleted &&
                      "border-[var(--ct-border)] bg-surface-inset text-[var(--ct-text-faint)]",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "text-[length:var(--ct-text-2xs)] font-medium transition-colors",
                    isActive
                      ? "text-[var(--ct-text-strong)]"
                      : isCompleted
                        ? "text-[var(--ct-text-muted)]"
                        : "text-[var(--ct-text-faint)]",
                  )}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
        <Progress value={progressPct} label="Wizard progress" className="h-1" />
      </div>

      <div className="min-w-0">
      <BentoPanel className="gap-6 p-5 lg:p-6">
        {/* Step 1 — Identity & Strategy */}
        {step === "identity" && (
          <div className="flex flex-col gap-5">
            <StepHeader title="Identity & Strategy" />

            <FieldGrid columns={2}>
              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Ticker *</span>
                <input
                  className={inputClass()}
                  value={form.ticker}
                  onChange={(e) => set("ticker", e.target.value.toUpperCase())}
                  placeholder="HYV-A"
                  maxLength={12}
                />
                <span className={BENTO_FIELD_HINT}>
                  3-12 uppercase letters, digits, hyphens
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Name *</span>
                <ForbiddenWordsInput
                  className={inputClass()}
                  value={form.name}
                  onChange={(v) => set("name", v)}
                  placeholder="Hearst Yield Vault — Series A"
                  maxLength={80}
                  aria-label="Vault name"
                />
              </label>
            </FieldGrid>

            <FieldGrid columns={2}>
              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Strategy *</span>
                <select
                  className={inputClass()}
                  value={form.strategy}
                  onChange={(e) =>
                    set("strategy", e.target.value as FormState["strategy"])
                  }
                >
                  <option value="mining_yield">Mining Yield</option>
                  <option value="btc_tactical">BTC Tactical</option>
                  <option value="stable_reserve">Stable Reserve</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>UI Theme Color</span>
                <input
                  className={inputClass()}
                  value={form.colorTag}
                  onChange={(e) => set("colorTag", e.target.value)}
                  placeholder="e.g. accent, emerald"
                  maxLength={32}
                />
                <span className={BENTO_FIELD_HINT}>
                  CSS variable or hex code for visual branding
                </span>
              </label>
            </FieldGrid>

            <label className="flex flex-col gap-2">
              <span className={BENTO_LABEL}>Description</span>
              <ForbiddenWordsInput
                multiline
                className={inputClass("resize-y")}
                value={form.description ?? ""}
                onChange={(v) => set("description", v)}
                rows={3}
                placeholder="Optional — brief fund description for admin UI"
                aria-label="Vault description"
              />
            </label>
          </div>
        )}

        {/* Step 2 — Economics */}
        {step === "economics" && (
          <div className="flex flex-col gap-5">
            <StepHeader title="Economics" />

            <FieldGrid columns={2}>
              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Min Ticket (USDC) *</span>
                <input
                  type="number"
                  className={inputClass("tabular-nums")}
                  value={form.minTicketUsdc}
                  onChange={(e) => setNumber("minTicketUsdc", e.target.value)}
                  min={1000}
                  placeholder="e.g. 250000"
                />
                <span className={BENTO_FIELD_HINT}>Minimum investment per LP</span>
              </label>

              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Vault Capacity (USDC) *</span>
                <input
                  type="number"
                  className={inputClass("tabular-nums")}
                  value={form.capacityUsdc}
                  onChange={(e) => setNumber("capacityUsdc", e.target.value)}
                  min={1000}
                  placeholder="e.g. 10000000"
                />
                <span className={BENTO_FIELD_HINT}>Hard cap for this share class</span>
              </label>
            </FieldGrid>

            <FieldGrid columns={2}>
              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Mgmt Fee (bps) *</span>
                <input
                  type="number"
                  className={inputClass("tabular-nums")}
                  value={form.mgmtFeeBps}
                  onChange={(e) => setNumber("mgmtFeeBps", e.target.value)}
                  min={0}
                  max={500}
                />
                <span className={BENTO_FIELD_HINT}>
                  {pct(form.mgmtFeeBps)}% annually
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Perf Fee (bps) *</span>
                <input
                  type="number"
                  className={inputClass("tabular-nums")}
                  value={form.perfFeeBps}
                  onChange={(e) => setNumber("perfFeeBps", e.target.value)}
                  min={0}
                  max={3000}
                />
                <span className={BENTO_FIELD_HINT}>
                  {pct(form.perfFeeBps)}% of profits
                </span>
              </label>
            </FieldGrid>

            <FieldGrid columns={2}>
              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Hurdle Rate (bps)</span>
                <input
                  type="number"
                  className={inputClass("tabular-nums")}
                  value={form.hurdleBps}
                  onChange={(e) => setNumber("hurdleBps", e.target.value)}
                  min={0}
                  max={2000}
                />
                <span className={BENTO_FIELD_HINT}>
                  {pct(form.hurdleBps)}% annual hurdle (optional)
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Soft Lock-up (days) *</span>
                <input
                  type="number"
                  className={inputClass("tabular-nums")}
                  value={form.softLockupDays}
                  onChange={(e) => setNumber("softLockupDays", e.target.value)}
                  min={0}
                  max={365}
                />
                <span className={BENTO_FIELD_HINT}>
                  Redemption notice period
                </span>
              </label>
            </FieldGrid>

            <FieldGrid columns={2}>
              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Target APY Low (bps) *</span>
                <input
                  type="number"
                  className={inputClass("tabular-nums")}
                  value={form.targetApyLowBps}
                  onChange={(e) => setNumber("targetApyLowBps", e.target.value)}
                  min={0}
                />
                <span className={BENTO_FIELD_HINT}>{pct(form.targetApyLowBps)}%</span>
              </label>

              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Target APY High (bps) *</span>
                <input
                  type="number"
                  className={inputClass("tabular-nums")}
                  value={form.targetApyHighBps}
                  onChange={(e) => setNumber("targetApyHighBps", e.target.value)}
                  min={0}
                />
                <span className={BENTO_FIELD_HINT}>{pct(form.targetApyHighBps)}%</span>
              </label>
            </FieldGrid>

            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-5">
              <span className={BENTO_LABEL}>APY Range Preview</span>
              <ApyRange
                low={form.targetApyLowBps / 100}
                high={form.targetApyHighBps / 100}
                precision={1}
                className="text-[length:var(--ct-text-xl-fixed)] font-medium tabular-nums text-[var(--ct-accent)]"
              />
            </div>
          </div>
        )}

        {/* Step 3 — Allocation targets */}
        {step === "allocations" && (
          <div className="flex flex-col gap-5">
            <StepHeader title="Allocation Targets" />
            <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">
              Must sum to exactly 10 000 bps (100%). Currently:{" "}
              <span
                className={cn(
                  "font-semibold",
                  allocTotal() === 10000 ? "text-[var(--ct-accent)]" : "text-[var(--ct-status-danger)]",
                )}
              >
                {allocTotal()} / 10 000
              </span>
            </p>

            <FieldGrid columns={2} className="gap-y-6">
              {(
                [
                  { key: "targetMiningBps", label: "Mining" },
                  { key: "targetBtcTacticalBps", label: "BTC Tactical" },
                  { key: "targetUsdcBaseBps", label: "USDC Base" },
                  { key: "targetStableReserveBps", label: "Stable Reserve" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className={BENTO_LABEL}>{label}</span>
                    <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-strong)]">
                      {pct(form[key])}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10000}
                    step={50}
                    value={form[key]}
                    onChange={(e) => setAllocationBps(key, e.target.value)}
                    className="w-full accent-[var(--ct-accent)]"
                    aria-label={`${label} allocation`}
                  />
                  <Progress value={form[key]} max={10000} label={`${label} allocation`} className="h-1" />
                </div>
              ))}
            </FieldGrid>
          </div>
        )}

        {/* Step 4 — Legal & SPV */}
        {step === "legal" && (
          <div className="flex flex-col gap-5">
            <StepHeader title="Legal & SPV" />

            <FieldGrid columns={3}>
              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>SPV Jurisdiction *</span>
                <select
                  className={inputClass()}
                  value={form.spvJurisdiction}
                  onChange={(e) =>
                    set("spvJurisdiction", e.target.value as FormState["spvJurisdiction"])
                  }
                >
                  <option value="cayman">Cayman Islands</option>
                  <option value="bvi">British Virgin Islands</option>
                  <option value="delaware">Delaware</option>
                  <option value="lux">Luxembourg</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Share Class *</span>
                <input
                  className={inputClass()}
                  value={form.shareClass}
                  onChange={(e) => set("shareClass", e.target.value.toUpperCase().slice(0, 1))}
                  placeholder="A"
                  maxLength={1}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className={BENTO_LABEL}>Regulatory Exemption *</span>
                <select
                  className={inputClass()}
                  value={form.regExemption}
                  onChange={(e) =>
                    set("regExemption", e.target.value as FormState["regExemption"])
                  }
                >
                  <option value="regD_506c">Reg D 506(c)</option>
                  <option value="regS">Reg S</option>
                  <option value="art2_lux">Art. 2 Lux</option>
                </select>
              </label>
            </FieldGrid>

            <label className="flex flex-col gap-2">
              <span className={BENTO_LABEL}>Legal Disclaimers *</span>
              <ForbiddenWordsInput
                multiline
                className={inputClass("resize-y")}
                value={form.disclaimers}
                onChange={(v) => set("disclaimers", v)}
                rows={6}
                placeholder="Institutional disclaimers. Must include 'not guaranteed' and mention risks..."
                aria-label="Vault disclaimers"
              />
              <div className="flex items-center justify-between gap-3">
                <span className={BENTO_FIELD_HINT}>
                  {form.disclaimers.length} chars (min 80)
                </span>
                <span className={BENTO_FIELD_HINT}>
                  Restricted terms will be flagged
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Step 5 — Governance */}
        {step === "governance" && (
          <div className="flex flex-col gap-5">
            <StepHeader title="Governance" />

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className={cn(BENTO_LABEL, "mb-1")}>
                  Authorized Signers (2–5 identities) *
                </span>
                <div className="flex flex-col gap-2">
                  {form.signersWhitelist.map((s, i) => {
                    const isValid = isValidSigner(s);
                    return (
                      <div key={i} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            className={inputClass("flex-1 font-mono")}
                            value={s}
                            onChange={(e) => {
                              const next = [...form.signersWhitelist];
                              next[i] = e.target.value;
                              set("signersWhitelist", next);
                            }}
                            placeholder={`0x… or admin id — signer ${i + 1}`}
                            aria-invalid={!isValid}
                          />
                          {form.signersWhitelist.length > 2 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              className="h-9 w-9 p-0"
                              onClick={() => {
                                const next = form.signersWhitelist.filter((_, j) => j !== i);
                                set("signersWhitelist", next);
                              }}
                              aria-label="Remove signer"
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                        {!isValid && (
                          <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-status-danger)]">
                            Invalid format: must be a 0x… address or 25-char ID.
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {form.signersWhitelist.length < 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="mt-1 w-fit"
                    onClick={() => set("signersWhitelist", [...form.signersWhitelist, ""])}
                  >
                    + Add another signer
                  </Button>
                )}
              </div>

              {/* Admin identity helper */}
              {props.adminId && (
                <div className="flex flex-col gap-2 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-5">
                  <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)]">
                    Your current admin identity:
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <code className="select-all break-all font-mono text-[length:var(--ct-text-2xs)] text-[var(--ct-text-strong)]">{props.adminId}</code>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(props.adminId!);
                        }}
                        title="Copy to clipboard"
                      >
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => {
                          const list = form.signersWhitelist;
                          if (list.some((s) => s.trim() === props.adminId)) return;
                          const slot = list.findIndex((s) => s.trim().length === 0);
                          const next = [...list];
                          if (slot >= 0) {
                            next[slot] = props.adminId!;
                          } else if (next.length < 5) {
                            next.push(props.adminId!);
                          } else {
                            return;
                          }
                          set("signersWhitelist", next);
                        }}
                      >
                        Add to list
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Required signers — multisig threshold M-of-N */}
              <div className="flex flex-col gap-2 border-t border-[var(--ct-border)] pt-5">
                <span className={cn(BENTO_LABEL, "mb-1")}>
                  Approval Quorum (M-of-N) *
                </span>
                <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Approval quorum">
                  {[2, 3, 4, 5].map((n) => {
                    const disabled = n > form.signersWhitelist.length;
                    const active = form.requiredSigners === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={disabled}
                        onClick={() => set("requiredSigners", n)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-[length:var(--ct-text-2xs)] font-medium transition-colors",
                          active
                            ? "border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
                            : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-body)] hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]",
                          disabled && "cursor-not-allowed opacity-[var(--ct-opacity-40)]",
                        )}
                      >
                        {n} of {form.signersWhitelist.length}
                      </button>
                    );
                  })}
                </div>
                <p className={cn(BENTO_FIELD_HINT, "mt-1")}>
                  Threshold of distinct signatures required to authorize deployment.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 6 — Review & Simulate (read-only recap) */}
        {step === "review_simulate" && (
          <div className="flex flex-col gap-5">
            <StepHeader title="Review & Simulate" />

            <div className="flex flex-col divide-y divide-white/5 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-5">
              <FieldGrid columns={2} className="pb-4">
                <RecapRow label="Ticker">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-strong)]">{form.ticker}</span>
                </RecapRow>
                <RecapRow label="Name">
                  <span className="truncate text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]" title={form.name}>{form.name}</span>
                </RecapRow>
                <RecapRow label="Strategy">
                  <span className="text-[length:var(--ct-text-xs)] capitalize text-[var(--ct-text-body)]">{form.strategy.replace(/_/g, " ")}</span>
                </RecapRow>
                <RecapRow label="UI Theme">
                  <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]">{form.colorTag}</span>
                </RecapRow>
              </FieldGrid>

              <FieldGrid columns={2} className="py-4">
                <RecapRow label="Min Ticket">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">{formatUsdFull(form.minTicketUsdc)}</span>
                </RecapRow>
                <RecapRow label="Capacity">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">{formatUsdFull(form.capacityUsdc)}</span>
                </RecapRow>
                <RecapRow label="Fees">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">
                    {pct(form.mgmtFeeBps)}% mgmt / {pct(form.perfFeeBps)}% perf
                    {form.hurdleBps > 0 ? ` / ${pct(form.hurdleBps)}% hurdle` : ""}
                  </span>
                </RecapRow>
                <RecapRow label="Lockup">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">{form.softLockupDays} days</span>
                </RecapRow>
                <RecapRow label="Target APY">
                  <ApyRange
                    low={form.targetApyLowBps / 100}
                    high={form.targetApyHighBps / 100}
                    precision={1}
                    className="text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-accent)]"
                  />
                </RecapRow>
              </FieldGrid>

              <FieldGrid columns={3} className="py-4">
                <RecapRow label="SPV">
                  <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]">{form.spvJurisdiction}</span>
                </RecapRow>
                <RecapRow label="Share Class">
                  <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]">{form.shareClass}</span>
                </RecapRow>
                <RecapRow label="Reg Exemption">
                  <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]">{form.regExemption}</span>
                </RecapRow>
              </FieldGrid>

              <FieldGrid columns={2} className="py-4">
                <RecapRow label="Mining">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">{pct(form.targetMiningBps)}%</span>
                </RecapRow>
                <RecapRow label="BTC Tactical">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">{pct(form.targetBtcTacticalBps)}%</span>
                </RecapRow>
                <RecapRow label="USDC Base">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">{pct(form.targetUsdcBaseBps)}%</span>
                </RecapRow>
                <RecapRow label="Stable Reserve">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">{pct(form.targetStableReserveBps)}%</span>
                </RecapRow>
                <RecapRow label="Total">
                  <span
                    className={cn(
                      "font-mono text-[length:var(--ct-text-xs)] font-semibold tabular-nums",
                      allocTotal() === 10000 ? "text-[var(--ct-accent)]" : "text-[var(--ct-status-danger)]",
                    )}
                  >
                    {pct(allocTotal())}%
                  </span>
                </RecapRow>
              </FieldGrid>

              <FieldGrid columns={2} className="pt-4">
                <RecapRow label="Signers">
                  <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]">
                    {form.signersWhitelist.filter((s) => s.trim().length > 0).length} whitelisted
                  </span>
                </RecapRow>
                <RecapRow label="Required Quorum">
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">
                    {form.requiredSigners} of {form.signersWhitelist.filter((s) => s.trim().length > 0).length}
                  </span>
                </RecapRow>
              </FieldGrid>
            </div>

            {/* Monte Carlo inline projection (ADR-006, methodology v2.0 ratified 2026-05-22) */}
            <MonteCarloReview
              vaultDraft={{
                targetApyLowBps: form.targetApyLowBps,
                targetApyHighBps: form.targetApyHighBps,
                targetMiningBps: form.targetMiningBps,
                targetUsdcBaseBps: form.targetUsdcBaseBps,
                targetStableReserveBps: form.targetStableReserveBps,
              }}
              seed={42}
              runs={1000}
            />

            <p className="border-t border-[var(--ct-border)] pt-4 text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
              Assumptions: mining yields, BTC price, network difficulty, energy costs are
              projected based on historical ranges. Target APY is a range, not guaranteed.
              Past performance is not indicative of future results.
            </p>
          </div>
        )}

        {/* Step 7 — Sign & Deploy */}
        {step === "sign_deploy" && (
          <div className="flex flex-col gap-5">
            <StepHeader title="Sign & Deploy" />

            <div className="flex flex-col gap-4 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-5">
              <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">
                This vault draft will be submitted to the multisig review queue. Once submitted,
                it requires the configured quorum of signers to approve before deployment.
              </p>
              <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]">
                Click <strong className="font-semibold text-[var(--ct-text-strong)]">Submit for Review</strong> below to enter the multisig queue.
              </p>
              <div className="flex flex-col gap-2 border-t border-[var(--ct-border-soft)] pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className={BENTO_LABEL}>Vault</span>
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-strong)]">{form.ticker || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className={BENTO_LABEL}>Required signers</span>
                  <span className="font-mono text-[length:var(--ct-text-xs)] tabular-nums text-[var(--ct-text-body)]">
                    {form.requiredSigners} of {filledSigners.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Signer whitelist recap — surfaces malformed entries and whether
                THIS admin can sign later (cf. signApproval actorWallet). */}
            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-5">
              <span className={BENTO_LABEL}>Signers whitelist</span>
              {filledSigners.length === 0 ? (
                <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-status-danger)]">
                  No signers added — add at least {form.requiredSigners} in the
                  Governance step.
                </span>
              ) : (
                <ul className="flex flex-col gap-2">
                  {filledSigners.map((s, i) => {
                    const valid = isValidSigner(s);
                    const isMe =
                      props.adminId !== undefined && s.trim() === props.adminId;
                    return (
                      <li
                        key={`${s}-${i}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <code className="break-all font-mono text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)]">
                          {s.trim()}
                          {isMe && (
                            <span className="text-[var(--ct-text-faint)]"> (you)</span>
                          )}
                        </code>
                        {!valid && (
                          <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-status-danger)]">malformed</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {props.adminId !== undefined && !adminInWhitelist && (
                <p className="pt-1 text-[length:var(--ct-text-2xs)] text-[var(--ct-status-danger)]">
                  Your identity ({props.adminId}) is not in the whitelist — you
                  will not be able to sign this deployment yourself.
                </p>
              )}
            </div>

            {!signersOk && (
              <div
                role="status"
                className="rounded-lg border border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] px-4 py-3 text-[length:var(--ct-text-xs)] text-[var(--ct-status-danger)]"
              >
                {hasMalformedSigner
                  ? "Fix the malformed signer(s) in the Governance step before submitting."
                  : `Add at least ${form.requiredSigners} distinct valid signers in the Governance step before submitting.`}
              </div>
            )}

            <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
              Target APY range: {pct(form.targetApyLowBps)}%–{pct(form.targetApyHighBps)}%.
              Not guaranteed. Subject to market conditions.
            </p>
          </div>
        )}

        {/* Navigation */}
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] px-4 py-3 text-[length:var(--ct-text-xs)] text-[var(--ct-status-danger)]"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--ct-border-soft)] pt-5">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={prevStep}
            disabled={stepIndex === 0}
          >
            Back
          </Button>

          <div className="flex items-center gap-2">
            {stepIndex < STEPS.length - 1 ? (
              <Button variant="primary" size="md" type="button" onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                type="button"
                onClick={handleSubmit}
                disabled={isPending || allocTotal() !== 10000 || !signersOk}
              >
                {submitLabel}
              </Button>
            )}
          </div>
        </div>
      </BentoPanel>
      </div>

      <aside className="lg:sticky lg:top-6">
        {/* ProjectionFooter renders its own bento panel — no extra wrapper. */}
        <ProjectionFooter vaultDraft={form} />
      </aside>
    </div>
  );
}
