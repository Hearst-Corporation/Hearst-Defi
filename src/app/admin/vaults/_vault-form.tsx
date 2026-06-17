"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { ApyRange } from "@/components/ui/apy-range";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PanelStatus } from "@/components/ui/panel-status";
import { Progress } from "@/components/ui/progress";
import { MonteCarloReview } from "@/components/admin/monte-carlo-review";
import { ProjectionFooter } from "@/components/admin/projection-footer";
import { ForbiddenWordsInput } from "@/components/admin/forbidden-words-input";
import { formatUsdFull } from "@/lib/vaults/product-display";
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

const FORM_INITIAL: FormState = {
  ticker: "",
  name: "",
  description: "",
  strategy: "mining_yield",
  colorTag: "accent",
  minTicketUsdc: 250000,
  capacityUsdc: 10000000,
  mgmtFeeBps: 200,
  perfFeeBps: 2000,
  softLockupDays: 60,
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

function inputClass(extra?: string) {
  return `ct-input w-full ${extra ?? ""}`;
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
    <div className="admin-doc-stack admin-doc-narrow pb-8" onBlur={handleBlur}>
      {/* Progress bar */}
      <div className="admin-doc-stack admin-doc-stack--actions">
        <div className="admin-doc-row-spread">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={
                i === stepIndex
                  ? "body-sm font-semibold ct-text-strong"
                  : i < stepIndex
                    ? "body-sm ct-text-muted"
                    : "body-sm ct-text-faint"
              }
            >
              {s.label}
            </span>
          ))}
        </div>
        <Progress value={progressPct} label="Wizard progress" />
      </div>

      <Card>
        {/* Step 1 — Identity & Strategy */}
        {step === "identity" && (
          <div className="admin-doc-stack">
            <CardTitle>Identity &amp; Strategy</CardTitle>

            <label className="admin-doc-field block">
              <span className="stat-label">Ticker *</span>
              <input
                className={inputClass()}
                value={form.ticker}
                onChange={(e) => set("ticker", e.target.value.toUpperCase())}
                placeholder="HYV-A"
                maxLength={12}
              />
              <span className="body-xs ct-text-faint">
                3-12 uppercase letters, digits, hyphens
              </span>
            </label>

            <label className="admin-doc-field block">
              <span className="stat-label">Name *</span>
              <ForbiddenWordsInput
                className={inputClass()}
                value={form.name}
                onChange={(v) => set("name", v)}
                placeholder="Hearst Yield Vault — Series A"
                maxLength={80}
                aria-label="Vault name"
              />
            </label>

            <label className="admin-doc-field block">
              <span className="stat-label">Strategy *</span>
              <select
                className={inputClass("ct-select")}
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

            <label className="admin-doc-field block">
              <span className="stat-label">Description</span>
              <ForbiddenWordsInput
                multiline
                className={inputClass("ct-textarea")}
                value={form.description ?? ""}
                onChange={(v) => set("description", v)}
                rows={3}
                placeholder="Optional — brief fund description for admin UI"
                aria-label="Vault description"
              />
            </label>

            <label className="admin-doc-field block">
              <span className="stat-label">Color Tag</span>
              <input
                className={inputClass()}
                value={form.colorTag}
                onChange={(e) => set("colorTag", e.target.value)}
                placeholder="accent"
                maxLength={32}
              />
              <span className="body-xs ct-text-faint">
                CSS token or hex color for UI tagging
              </span>
            </label>
          </div>
        )}

        {/* Step 2 — Economics */}
        {step === "economics" && (
          <div className="admin-doc-stack">
            <CardTitle>Economics</CardTitle>

            <div className="admin-doc-kpi-grid-2">
              <label className="admin-doc-field block">
                <span className="stat-label">Min Ticket (USDC) *</span>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.minTicketUsdc}
                  onChange={(e) => setNumber("minTicketUsdc", e.target.value)}
                  min={1000}
                />
              </label>

              <label className="admin-doc-field block">
                <span className="stat-label">Capacity (USDC) *</span>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.capacityUsdc}
                  onChange={(e) => setNumber("capacityUsdc", e.target.value)}
                  min={1000}
                />
              </label>
            </div>

            <div className="admin-doc-kpi-grid-2">
              <label className="admin-doc-field block">
                <span className="stat-label">Mgmt Fee (bps) *</span>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.mgmtFeeBps}
                  onChange={(e) => setNumber("mgmtFeeBps", e.target.value)}
                  min={0}
                  max={500}
                />
                <span className="body-xs ct-text-faint">
                  {pct(form.mgmtFeeBps)}% annually
                </span>
              </label>

              <label className="admin-doc-field block">
                <span className="stat-label">Perf Fee (bps) *</span>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.perfFeeBps}
                  onChange={(e) => setNumber("perfFeeBps", e.target.value)}
                  min={0}
                  max={3000}
                />
                <span className="body-xs ct-text-faint">
                  {pct(form.perfFeeBps)}% of profits
                </span>
              </label>
            </div>

            <label className="admin-doc-field block">
              <span className="stat-label">Soft Lock-up (days) *</span>
              <input
                type="number"
                className={inputClass()}
                value={form.softLockupDays}
                onChange={(e) => setNumber("softLockupDays", e.target.value)}
                min={0}
                max={365}
              />
            </label>

            <div className="admin-doc-kpi-grid-2">
              <label className="admin-doc-field block">
                <span className="stat-label">Target APY Low (bps) *</span>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.targetApyLowBps}
                  onChange={(e) => setNumber("targetApyLowBps", e.target.value)}
                  min={0}
                />
                <span className="body-xs ct-text-faint">{pct(form.targetApyLowBps)}%</span>
              </label>

              <label className="admin-doc-field block">
                <span className="stat-label">Target APY High (bps) *</span>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.targetApyHighBps}
                  onChange={(e) => setNumber("targetApyHighBps", e.target.value)}
                  min={0}
                />
                <span className="body-xs ct-text-faint">{pct(form.targetApyHighBps)}%</span>
              </label>
            </div>

            <div className="admin-doc-inset flex flex-col gap-1">
              <span className="stat-label block">APY Range Preview</span>
              <ApyRange
                low={form.targetApyLowBps / 100}
                high={form.targetApyHighBps / 100}
                precision={1}
              />
            </div>
          </div>
        )}

        {/* Step 3 — Allocation targets */}
        {step === "allocations" && (
          <div className="admin-doc-stack">
            <CardTitle>Allocation Targets</CardTitle>
            <p className="body-sm ct-text-muted">
              Must sum to exactly 10 000 bps (100%). Currently:{" "}
              <span
                className={
                  allocTotal() === 10000
                    ? "font-semibold ct-status-success"
                    : "font-semibold ct-status-danger"
                }
              >
                {allocTotal()} / 10 000
              </span>
            </p>

            {(
              [
                { key: "targetMiningBps", label: "Mining" },
                { key: "targetBtcTacticalBps", label: "BTC Tactical" },
                { key: "targetUsdcBaseBps", label: "USDC Base" },
                { key: "targetStableReserveBps", label: "Stable Reserve" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="admin-doc-stack admin-doc-stack--tight">
                <div className="admin-doc-row-spread">
                  <span className="stat-label">{label}</span>
                  <span className="mono tabular body-sm ct-text-primary">
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
                  className="w-full accent-(--ct-accent)"
                  aria-label={`${label} allocation`}
                />
                <Progress value={form[key]} max={10000} label={`${label} allocation`} />
              </div>
            ))}
          </div>
        )}

        {/* Step 4 — Legal & SPV */}
        {step === "legal" && (
          <div className="admin-doc-stack">
            <CardTitle>Legal &amp; SPV</CardTitle>

            <div className="admin-doc-kpi-grid-2">
              <label className="admin-doc-field block">
                <span className="stat-label">SPV Jurisdiction *</span>
                <select
                  className={inputClass("ct-select")}
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

              <label className="admin-doc-field block">
                <span className="stat-label">Share Class *</span>
                <input
                  className={inputClass()}
                  value={form.shareClass}
                  onChange={(e) => set("shareClass", e.target.value.toUpperCase().slice(0, 1))}
                  placeholder="A"
                  maxLength={1}
                />
              </label>
            </div>

            <label className="admin-doc-field block">
              <span className="stat-label">Regulatory Exemption *</span>
              <select
                className={inputClass("ct-select")}
                value={form.regExemption}
                onChange={(e) =>
                  set("regExemption", e.target.value as FormState["regExemption"])
                }
              >
                <option value="regD_506c">Reg D 506(c) — US Accredited</option>
                <option value="regS">Reg S — Non-US investors</option>
                <option value="art2_lux">Art. 2 Lux — Qualified Investors</option>
              </select>
            </label>

            <label className="admin-doc-field block">
              <span className="stat-label">Disclaimers * (min 80 chars)</span>
              <ForbiddenWordsInput
                multiline
                className={inputClass("ct-textarea")}
                value={form.disclaimers}
                onChange={(v) => set("disclaimers", v)}
                rows={6}
                placeholder="Required legal disclaimers. Must include 'not guaranteed' and assumptions..."
                aria-label="Vault disclaimers"
              />
              <span className="body-xs ct-text-faint">
                {form.disclaimers.length} chars — restricted terms will be flagged on submit
              </span>
            </label>
          </div>
        )}

        {/* Step 5 — Governance */}
        {step === "governance" && (
          <div className="admin-doc-stack">
            <CardTitle>Governance</CardTitle>

            <div className="admin-doc-stack admin-doc-stack--actions">
              <span className="stat-label block">Signers Whitelist (2–5 signer identities) *</span>
              {form.signersWhitelist.map((s, i) => {
                const isValid = isValidSigner(s);
                return (
                  <div key={i} className="admin-doc-stack admin-doc-stack--tight">
                    <div className="admin-doc-inline-row">
                      <input
                        className={inputClass("flex-1")}
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
                      <span className="body-xs ct-status-danger">
                        Must be a 0x… Ethereum address or a 25-char admin id.
                      </span>
                    )}
                  </div>
                );
              })}
              {form.signersWhitelist.length < 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => set("signersWhitelist", [...form.signersWhitelist, ""])}
                >
                  + Add signer
                </Button>
              )}

              {/* Admin identity helper — what to whitelist so THIS admin can sign.
                  signApproval derives actorWallet = walletAddress ?? userId; admins
                  have no walletAddress, so the userId below is the value to add. */}
              {props.adminId && (
                <div className="admin-doc-inset admin-doc-stack admin-doc-stack--tight">
                  <span className="body-xs ct-text-muted">
                    Votre identifiant admin (à whitelister pour pouvoir signer) :
                  </span>
                  <div className="admin-doc-inline-row admin-doc-inline-row--between">
                    <code className="mono body-xs ct-text-strong break-all">{props.adminId}</code>
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
                      Add me
                    </Button>
                  </div>
                </div>
              )}

              {/* Required signers — multisig threshold M-of-N */}
              <div className="admin-doc-stack admin-doc-stack--tight pt-2 border-t border-(--ct-border-soft)">
                <span className="stat-label block">
                  Required signers (M-of-N quorum) *
                </span>
                <div className="admin-doc-inline-row" role="radiogroup" aria-label="Required signers">
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
                        className={
                          active
                            ? "ct-pill accent"
                            : disabled
                              ? "ct-pill opacity-[var(--ct-opacity-40)] cursor-not-allowed"
                              : "ct-pill"
                        }
                      >
                        {n} of {form.signersWhitelist.length}
                      </button>
                    );
                  })}
                </div>
                <p className="body-xs ct-text-faint">
                  Threshold of distinct signers required to approve deployment. Must be ≤ whitelist size.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 6 — Review & Simulate (read-only recap) */}
        {step === "review_simulate" && (
          <div className="admin-doc-stack">
            <CardTitle>Review &amp; Simulate</CardTitle>

            <div className="admin-doc-inset admin-confirm-panel divide-y divide-border-subtle">
              <div className="admin-confirm-panel__rows pb-3">
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Ticker</span>
                  <span className="mono tabular body-sm ct-text-strong">{form.ticker}</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Name</span>
                  <span className="body-sm ct-text-primary">{form.name}</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Strategy</span>
                  <span className="body-sm ct-text-primary">{form.strategy}</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Color Tag</span>
                  <span className="body-sm ct-text-primary">{form.colorTag}</span>
                </div>
              </div>

              <div className="admin-confirm-panel__rows py-3">
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Min Ticket</span>
                  <span className="mono tabular body-sm">{formatUsdFull(form.minTicketUsdc)}</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Capacity</span>
                  <span className="mono tabular body-sm">{formatUsdFull(form.capacityUsdc)}</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Fees</span>
                  <span className="mono tabular body-sm">
                    {pct(form.mgmtFeeBps)}% mgmt / {pct(form.perfFeeBps)}% perf
                  </span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Lockup</span>
                  <span className="mono tabular body-sm">{form.softLockupDays} days</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Target APY</span>
                  <ApyRange
                    low={form.targetApyLowBps / 100}
                    high={form.targetApyHighBps / 100}
                    precision={1}
                  />
                </div>
              </div>

              <div className="admin-confirm-panel__rows py-3">
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">SPV</span>
                  <span className="body-sm ct-text-primary">{form.spvJurisdiction}</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Share Class</span>
                  <span className="body-sm">{form.shareClass}</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Reg Exemption</span>
                  <span className="body-sm">{form.regExemption}</span>
                </div>
              </div>

              <div className="admin-confirm-panel__rows py-3">
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Mining</span>
                  <span className="mono tabular body-sm">{pct(form.targetMiningBps)}%</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">BTC Tactical</span>
                  <span className="mono tabular body-sm">{pct(form.targetBtcTacticalBps)}%</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">USDC Base</span>
                  <span className="mono tabular body-sm">{pct(form.targetUsdcBaseBps)}%</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Stable Reserve</span>
                  <span className="mono tabular body-sm">{pct(form.targetStableReserveBps)}%</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Total</span>
                  <span
                    className={
                      allocTotal() === 10000
                        ? "mono tabular body-sm ct-status-success font-semibold"
                        : "mono tabular body-sm ct-status-danger font-semibold"
                    }
                  >
                    {pct(allocTotal())}%
                  </span>
                </div>
              </div>

              <div className="admin-confirm-panel__rows py-3">
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Signers</span>
                  <span className="body-sm ct-text-primary">
                    {form.signersWhitelist.filter((s) => s.trim().length > 0).length} whitelisted
                  </span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Required Quorum</span>
                  <span className="mono tabular body-sm">
                    {form.requiredSigners} of {form.signersWhitelist.filter((s) => s.trim().length > 0).length}
                  </span>
                </div>
              </div>
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

            <p className="body-xs ct-text-faint border-t border-(--ct-border-soft) pt-3">
              Assumptions: mining yields, BTC price, network difficulty, energy costs are
              projected based on historical ranges. Target APY is a range, not guaranteed.
              Past performance is not indicative of future results.
            </p>
          </div>
        )}

        {/* Step 7 — Sign & Deploy */}
        {step === "sign_deploy" && (
          <div className="admin-doc-stack">
            <CardTitle>Sign &amp; Deploy</CardTitle>

            <div className="admin-doc-inset admin-doc-stack admin-doc-stack--actions">
              <p className="body-sm ct-text-muted">
                This vault draft will be submitted to the multisig review queue. Once submitted,
                it requires the configured quorum of signers to approve before deployment.
              </p>
              <p className="body-sm ct-text-primary">
                Click <strong>Submit for Review</strong> below to enter the multisig queue.
              </p>
              <div className="admin-confirm-panel__rows pt-2">
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Vault</span>
                  <span className="mono tabular body-sm ct-text-strong">{form.ticker || "—"}</span>
                </div>
                <div className="admin-confirm-panel__row">
                  <span className="stat-label">Required signers</span>
                  <span className="mono tabular body-sm">
                    {form.requiredSigners} of {filledSigners.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Signer whitelist recap — surfaces malformed entries and whether
                THIS admin can sign later (cf. signApproval actorWallet). */}
            <div className="admin-doc-inset admin-doc-stack admin-doc-stack--tight">
              <span className="stat-label block">Signers whitelist</span>
              {filledSigners.length === 0 ? (
                <span className="body-xs ct-status-danger">
                  No signers added — add at least {form.requiredSigners} in the
                  Governance step.
                </span>
              ) : (
                <ul className="admin-doc-stack admin-doc-stack--tight">
                  {filledSigners.map((s, i) => {
                    const valid = isValidSigner(s);
                    const isMe =
                      props.adminId !== undefined && s.trim() === props.adminId;
                    return (
                      <li
                        key={`${s}-${i}`}
                        className="admin-doc-inline-row admin-doc-inline-row--between"
                      >
                        <code className="mono body-xs ct-text-muted break-all">
                          {s.trim()}
                          {isMe && (
                            <span className="ct-text-faint"> (vous)</span>
                          )}
                        </code>
                        {!valid && (
                          <span className="body-xs ct-status-danger">malformed</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {props.adminId !== undefined && !adminInWhitelist && (
                <p className="body-xs ct-status-danger pt-1">
                  Votre identifiant ({props.adminId}) n'est pas dans la whitelist —
                  vous ne pourrez pas signer cette déploiement vous-même.
                </p>
              )}
            </div>

            {!signersOk && (
              <PanelStatus
                tone="danger"
                role="status"
                message={
                  hasMalformedSigner
                    ? "Fix the malformed signer(s) in the Governance step before submitting."
                    : `Add at least ${form.requiredSigners} distinct valid signers in the Governance step before submitting.`
                }
              />
            )}

            <p className="body-xs ct-text-faint">
              Target APY range: {pct(form.targetApyLowBps)}%–{pct(form.targetApyHighBps)}%.
              Not guaranteed. Subject to market conditions.
            </p>
          </div>
        )}

        {/* Navigation */}
        {error ? (
          <PanelStatus tone="danger" role="alert" message={error} className="mt-4" />
        ) : null}

        <div className="mt-8 admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--actions">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={prevStep}
            disabled={stepIndex === 0}
          >
            Back
          </Button>

          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
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
      </Card>

      <ProjectionFooter vaultDraft={form} />
    </div>
  );
}
