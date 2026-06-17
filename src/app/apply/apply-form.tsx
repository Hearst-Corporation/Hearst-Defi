"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  OnboardingChamber,
  OnboardingChamberSole,
} from "@/components/onboarding/onboarding-chamber";
import { Button } from "@/components/ui/button";
import {
  WizardStepProgress,
  type WizardStep,
} from "@/components/ui/wizard-step-progress";
import { cn } from "@/lib/cn";
import {
  AUM_OPTIONS,
  FUNDS_USAGE_OPTIONS,
  PLATFORM_TYPE_OPTIONS,
  TIMELINE_OPTIONS,
  VAULT_SIZE_OPTIONS,
  YIELD_STATUS_OPTIONS,
  YIELD_TYPE_OPTIONS,
} from "@/lib/qualification/options";

import { ApplyAssistantPanel } from "./apply-assistant-panel";
import { submitApplication } from "./actions";

type Step = "about" | "platform" | "sizing";

const STEP_ORDER = ["about", "platform", "sizing"] as const satisfies readonly Step[];
const STEPS: readonly WizardStep<Step>[] = [
  { id: "about", label: "About you", index: 1 },
  { id: "platform", label: "Platform", index: 2 },
  { id: "sizing", label: "Sizing", index: 3 },
] as const;

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-(--ct-space-2) text-left">
      <h2 className="h2 m-0">{title}</h2>
      <p className="body-sm ct-text-body m-0">{description}</p>
    </div>
  );
}

function ChoiceCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-(--ct-space-3) rounded-(--ct-radius-xl) border px-(--ct-space-4) py-(--ct-space-4) text-left body-sm ct-transition-base ct-focus-ring",
        selected
          ? "ct-surface-1 border-(--ct-accent) ct-text-strong"
          : "ct-surface-0 border-(--ct-border-soft) ct-text-body hover:ct-surface-1 hover:border-(--ct-border) hover:ct-text-primary",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-(--ct-space-0_5) inline-flex h-4 w-4 shrink-0 rounded-full border-2",
          selected
            ? "border-(--ct-accent) bg-(--ct-accent)"
            : "border-(--ct-border-strong) bg-transparent",
        )}
      />
      <span className={selected ? "ct-text-accent" : undefined}>{label}</span>
    </button>
  );
}

export function ApplyForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("about");
  const [error, setError] = useState<string | null>(null);

  // Identity
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Answers
  const [platformType, setPlatformType] = useState("");
  const [aum, setAum] = useState("");
  const [fundsUsage, setFundsUsage] = useState("");
  const [yieldStatus, setYieldStatus] = useState("");
  const [yieldType, setYieldType] = useState("");
  const [vaultSize, setVaultSize] = useState("");
  const [timeline, setTimeline] = useState("");

  const stepIndex = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length;

  function goNext() {
    if (step === "about") {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
    }
    setError(null);
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    setError(null);
    const previous = STEP_ORDER[stepIndex - 1];
    if (previous) setStep(previous);
  }

  function handleSubmit() {
    const fd = new FormData();
    fd.set("email", email.trim());
    if (firstName.trim()) fd.set("firstName", firstName.trim());
    if (lastName.trim()) fd.set("lastName", lastName.trim());
    if (phone.trim()) fd.set("phone", phone.trim());
    if (platformType) fd.set("platformType", platformType);
    if (aum) fd.set("aum", aum);
    if (fundsUsage) fd.set("fundsUsage", fundsUsage);
    if (yieldStatus) fd.set("yieldStatus", yieldStatus);
    if (yieldType) fd.set("yieldType", yieldType);
    if (vaultSize) fd.set("vaultSize", vaultSize);
    if (timeline) fd.set("timeline", timeline);

    startTransition(async () => {
      const result = await submitApplication(fd);
      if (result.ok) {
        router.push("/apply/confirmed");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <OnboardingChamber
      testId="apply-qualification"
      aside={<ApplyAssistantPanel step={step} />}
      crown={
        <div className="product-doc-stack onboarding-shell__stepper text-left">
          <div className="product-doc-stack--tight">
            <span className="eyebrow ct-text-accent">Hearst Connect</span>
            <div className="product-doc-stack--compact">
              <h1 className="h1 m-0 text-pretty">Qualification for institutional access</h1>
              <p className="body-md ct-text-body m-0 text-pretty ct-prose-lg">
                Three steps to assess fit for Hearst Connect&apos;s institutional
                USDC yield program. No commitment required.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-(--ct-space-2) body-xs ct-text-muted">
            <span className="rounded-full border border-(--ct-border-soft) px-(--ct-space-3) py-(--ct-space-1)">
              3 steps
            </span>
            <span className="rounded-full border border-(--ct-border-soft) px-(--ct-space-3) py-(--ct-space-1)">
              About 2 minutes
            </span>
            <span className="rounded-full border border-(--ct-border-soft) px-(--ct-space-3) py-(--ct-space-1)">
              For qualified investors only
            </span>
          </div>
        </div>
      }
      body={
        <div className="flex w-full flex-col gap-(--ct-space-6)">
          <WizardStepProgress
            steps={STEPS}
            active={step}
            ariaLabel="Qualification progress"
            hideLabelsBelow="sm"
          />

          {step === "about" && (
            <div className="flex flex-col gap-(--ct-space-5)">
              <StepHeading
                title="Tell us about yourself"
                description="Takes about two minutes. We'll review fit and follow up directly."
              />

              <div className="flex flex-col gap-(--ct-space-2)">
                <label className="body-sm font-semibold ct-text-strong" htmlFor="apply-email">
                  Email *
                </label>
                <input
                  id="apply-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@fund.io"
                  autoFocus
                  className="ct-input ct-input-bare rounded-(--ct-radius-xl) px-(--ct-space-4) py-(--ct-space-4) body-sm ct-text-strong"
                />
              </div>

              <div className="grid gap-(--ct-space-3) sm:grid-cols-2">
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="body-sm font-semibold ct-text-strong" htmlFor="apply-first-name">
                    First name
                  </label>
                  <input
                    id="apply-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alice"
                    className="ct-input ct-input-bare rounded-(--ct-radius-xl) px-(--ct-space-4) py-(--ct-space-4) body-sm ct-text-strong"
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="body-sm font-semibold ct-text-strong" htmlFor="apply-last-name">
                    Last name
                  </label>
                  <input
                    id="apply-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    className="ct-input ct-input-bare rounded-(--ct-radius-xl) px-(--ct-space-4) py-(--ct-space-4) body-sm ct-text-strong"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-(--ct-space-2)">
                <label className="body-sm font-semibold ct-text-strong" htmlFor="apply-phone">
                  Phone (optional)
                </label>
                <input
                  id="apply-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 00 00 00 00"
                  className="ct-input ct-input-bare rounded-(--ct-radius-xl) px-(--ct-space-4) py-(--ct-space-4) body-sm ct-text-strong"
                />
              </div>
            </div>
          )}

          {step === "platform" && (
            <div className="flex flex-col gap-(--ct-space-6)">
              <StepHeading
                title="About your platform"
                description="Help us understand your investor profile, assets, and existing yield posture."
              />

              <div className="flex flex-col gap-(--ct-space-3)">
                <label className="body-sm font-semibold ct-text-strong">
                  What best describes your platform?
                </label>
                {PLATFORM_TYPE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={platformType === o.value}
                    onClick={() => setPlatformType(o.value)}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-(--ct-space-3)">
                <label className="body-sm font-semibold ct-text-strong">Assets under management?</label>
                {AUM_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={aum === o.value}
                    onClick={() => setAum(o.value)}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-(--ct-space-3)">
                <label className="body-sm font-semibold ct-text-strong">
                  How are client funds currently deployed?
                </label>
                {FUNDS_USAGE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={fundsUsage === o.value}
                    onClick={() => setFundsUsage(o.value)}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-(--ct-space-3)">
                <label className="body-sm font-semibold ct-text-strong">
                  Do you offer yield or reward products?
                </label>
                {YIELD_STATUS_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={yieldStatus === o.value}
                    onClick={() => setYieldStatus(o.value)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "sizing" && (
            <div className="flex flex-col gap-(--ct-space-6)">
              <StepHeading
                title="Sizing & timing"
                description="Share the expected mandate and timing for a first conversation or allocation."
              />

              <div className="flex flex-col gap-(--ct-space-3)">
                <label className="body-sm font-semibold ct-text-strong">
                  What type of yield product suits your clients?
                </label>
                {YIELD_TYPE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={yieldType === o.value}
                    onClick={() => setYieldType(o.value)}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-(--ct-space-3)">
                <label className="body-sm font-semibold ct-text-strong">
                  Vault size for a first allocation?
                </label>
                {VAULT_SIZE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={vaultSize === o.value}
                    onClick={() => setVaultSize(o.value)}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-(--ct-space-3)">
                <label className="body-sm font-semibold ct-text-strong">What is your launch timeline?</label>
                {TIMELINE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={timeline === o.value}
                    onClick={() => setTimeline(o.value)}
                  />
                ))}
              </div>
            </div>
          )}

          {error ? (
            <p className="body-xs ct-status-danger m-0" role="alert">
              {error}
            </p>
          ) : null}

          <p className="body-xs ct-text-muted m-0 text-center">
            Step {stepIndex + 1} of {totalSteps}
          </p>
        </div>
      }
      sole={
        <OnboardingChamberSole
          irContact={null}
          compliance={
            <>
              Not a guarantee of return. Past performance is not indicative of
              future results. For qualified investors only. Cayman SPV structure.
            </>
          }
          actions={
            step === "about" ? (
              <div className="flex w-full justify-end">
                <Button
                  type="button"
                  onClick={goNext}
                  variant="primary"
                  size="lg"
                >
                  Continue →
                </Button>
              </div>
            ) : (
              <div className="flex w-full items-center gap-(--ct-space-3)">
                <Button
                  type="button"
                  onClick={goBack}
                  disabled={pending}
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                >
                  ← Back
                </Button>
                {step !== "sizing" ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    variant="primary"
                    size="lg"
                    className="flex-1"
                  >
                    Continue →
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={pending}
                    variant="primary"
                    size="lg"
                    className="flex-1"
                  >
                    {pending ? "Submitting…" : "Submit application"}
                  </Button>
                )}
              </div>
            )
          }
        />
      }
    />
  );
}
