"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  OnboardingChamber,
  OnboardingChamberSole,
} from "@/components/onboarding/onboarding-chamber";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceCard, ChoiceGroup } from "@/components/ui/choice-card";
import {
  WizardStepProgress,
  type WizardStep,
} from "@/components/ui/wizard-step-progress";
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

const META_CHIPS = [
  "3 steps",
  "About 2 minutes",
  "For qualified investors only",
] as const;

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="product-doc-stack--tight text-left">
      <h2 className="h2 m-0">{title}</h2>
      <p className="body-sm ct-text-muted m-0">{description}</p>
    </div>
  );
}

export function ApplyForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("about");
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

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
          <WizardStepProgress
            steps={STEPS}
            active={step}
            ariaLabel="Qualification progress"
            hideLabelsBelow="sm"
          />
          <div className="product-doc-stack--tight">
            <p className="eyebrow ct-text-muted m-0">
              Qualification · Step {stepIndex + 1} of {totalSteps}
            </p>
            <div className="product-doc-stack--compact">
              <h1 className="h1 m-0 text-pretty">Qualification for institutional access</h1>
              <p className="body-md ct-text-muted m-0 text-pretty ct-prose-lg">
                Three steps to assess fit for Hearst Connect&apos;s institutional
                USDC yield program. No commitment required.
              </p>
            </div>
          </div>
          <div className="product-doc-inline-row product-doc-inline-row--start">
            {META_CHIPS.map((chip) => (
              <Badge key={chip} variant="default">
                {chip}
              </Badge>
            ))}
          </div>
        </div>
      }
      body={
        <div className="product-doc-stack">
          {step === "about" && (
            <div className="product-doc-stack--relaxed">
              <StepHeading
                title="Tell us about yourself"
                description="Takes about two minutes. We'll review fit and follow up directly."
              />

              <label className="block" htmlFor="apply-email">
                <span className="ct-form-label">Email *</span>
                <input
                  id="apply-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@fund.io"
                  autoFocus
                  className="ct-input ct-input-bare"
                />
              </label>

              <div className="grid gap-(--ct-space-3) sm:grid-cols-2">
                <label className="block" htmlFor="apply-first-name">
                  <span className="ct-form-label">First name</span>
                  <input
                    id="apply-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alice"
                    className="ct-input ct-input-bare"
                  />
                </label>
                <label className="block" htmlFor="apply-last-name">
                  <span className="ct-form-label">Last name</span>
                  <input
                    id="apply-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    className="ct-input ct-input-bare"
                  />
                </label>
              </div>

              <label className="block" htmlFor="apply-phone">
                <span className="ct-form-label">Phone (optional)</span>
                <input
                  id="apply-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 00 00 00 00"
                  className="ct-input ct-input-bare"
                />
              </label>
            </div>
          )}

          {step === "platform" && (
            <div className="product-doc-stack--relaxed">
              <StepHeading
                title="About your platform"
                description="Help us understand your investor profile, assets, and existing yield posture."
              />

              <ChoiceGroup legend="What best describes your platform?">
                {PLATFORM_TYPE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={platformType === o.value}
                    onClick={() => setPlatformType(o.value)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup legend="Assets under management?">
                {AUM_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={aum === o.value}
                    onClick={() => setAum(o.value)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup legend="How are client funds currently deployed?">
                {FUNDS_USAGE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={fundsUsage === o.value}
                    onClick={() => setFundsUsage(o.value)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup legend="Do you offer yield or reward products?">
                {YIELD_STATUS_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={yieldStatus === o.value}
                    onClick={() => setYieldStatus(o.value)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}

          {step === "sizing" && (
            <div className="product-doc-stack--relaxed">
              <StepHeading
                title="Sizing & timing"
                description="Share the expected mandate and timing for a first conversation or allocation."
              />

              <ChoiceGroup legend="What type of yield product suits your clients?">
                {YIELD_TYPE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={yieldType === o.value}
                    onClick={() => setYieldType(o.value)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup legend="Vault size for a first allocation?">
                {VAULT_SIZE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={vaultSize === o.value}
                    onClick={() => setVaultSize(o.value)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup legend="What is your launch timeline?">
                {TIMELINE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={timeline === o.value}
                    onClick={() => setTimeline(o.value)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}

          {error ? (
            <p className="body-xs ct-status-danger m-0" role="alert">
              {error}
            </p>
          ) : null}
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
            <div className="product-doc-stack--actions">
              {step === "about" ? (
                <Button type="button" onClick={goNext} variant="primary" size="lg" className="w-full">
                  Continue →
                </Button>
              ) : (
                <div className="product-doc-inline-row product-doc-inline-row--actions w-full">
                  <Button
                    type="button"
                    onClick={goBack}
                    disabled={pending}
                    variant="secondary"
                    size="lg"
                    className="min-w-0 flex-1"
                  >
                    ← Back
                  </Button>
                  {step !== "sizing" ? (
                    <Button
                      type="button"
                      onClick={goNext}
                      variant="primary"
                      size="lg"
                      className="min-w-0 flex-1"
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
                      className="min-w-0 flex-1"
                    >
                      {pending ? "Submitting…" : "Submit application"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          }
        />
      }
    />
  );
}
