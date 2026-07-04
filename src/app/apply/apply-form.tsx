"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  OnboardingChamber,
  OnboardingChamberSole,
} from "@/components/onboarding/onboarding-chamber";
import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { ChoiceCard, ChoiceGroup } from "@/components/catalyst/choice-card";
import {
  WizardStepProgress,
  type WizardStep,
} from "@/components/catalyst/wizard-step-progress";
import {
  AUM_OPTIONS,
  PLATFORM_TYPE_OPTIONS,
  TIMELINE_OPTIONS,
  VAULT_SIZE_OPTIONS,
} from "@/lib/qualification/options";

import type { IrContact } from "@/lib/ir-contact";

import { ApplyAside } from "./apply-assistant-panel";
import { submitApplication } from "./actions";

// One question per step — a true wizard. Step 1 collects contact details; the
// four persona questions (who / capacity / first allocation / timing) each get
// their own screen so no single step ever overflows the viewport.
type Step = "about" | "who" | "aum" | "allocation" | "timing";

const STEP_ORDER = [
  "about",
  "who",
  "aum",
  "allocation",
  "timing",
] as const satisfies readonly Step[];

const STEPS: readonly WizardStep<Step>[] = [
  { id: "about", label: "About you", index: 1 },
  { id: "who", label: "Profile", index: 2 },
  { id: "aum", label: "Capacity", index: 3 },
  { id: "allocation", label: "Allocation", index: 4 },
  { id: "timing", label: "Timing", index: 5 },
] as const;

const META_CHIPS = [
  "5 quick steps",
  "Under a minute",
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

export function ApplyForm({ irContact }: { irContact: IrContact | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("about");
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Four persona questions: platformType (who) + aum (capacity)
  // + vaultSize (intended first allocation) + timeline (next step).
  const [platformType, setPlatformType] = useState("");
  // Free-text detail revealed when the "Other" platform option is selected.
  const [platformTypeOther, setPlatformTypeOther] = useState("");
  const [aum, setAum] = useState("");
  const [vaultSize, setVaultSize] = useState("");
  const [timeline, setTimeline] = useState("");

  const stepIndex = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;

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

  function selectPlatformType(value: string) {
    setPlatformType(value);
    // Drop any free-text detail when leaving "Other" so no orphan text is sent.
    if (value !== "other") setPlatformTypeOther("");
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
    if (platformType === "other" && platformTypeOther.trim())
      fd.set("platformTypeOther", platformTypeOther.trim());
    if (aum) fd.set("aum", aum);
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
      aside={irContact ? <ApplyAside irContact={irContact} /> : undefined}
      crown={
        <div className="product-doc-stack onboarding-shell__stepper text-left">
          <WizardStepProgress
            steps={STEPS}
            active={step}
            ariaLabel="Qualification progress"
            hideLabelsBelow="sm"
          />
          <div className="product-doc-stack--compact">
            <h1 className="h1 m-0 text-pretty">Qualification for institutional access</h1>
            <p className="body-md ct-text-muted m-0 text-pretty ct-prose-lg">
              A few quick steps to assess fit for Hearst Connect&apos;s
              institutional USDC yield program. No commitment required.
            </p>
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
        <div className="product-doc-stack apply-body-fixed">
          {step === "about" && (
            <div className="product-doc-stack--relaxed">
              <StepHeading
                title="Tell us about yourself"
                description="Under a minute. We'll review fit and follow up directly."
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

          {step === "who" && (
            <div className="product-doc-stack--relaxed">
              <StepHeading
                title="Who are you?"
                description="The profile that best describes your platform."
              />
              <ChoiceGroup legend="Who are you?">
                {PLATFORM_TYPE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={platformType === o.value}
                    onClick={() => selectPlatformType(o.value)}
                    expandedContent={
                      o.value === "other" ? (
                        <input
                          id="apply-platform-other"
                          type="text"
                          value={platformTypeOther}
                          onChange={(e) => setPlatformTypeOther(e.target.value)}
                          placeholder="Tell us about your platform"
                          className="ct-input ct-input-bare"
                          aria-label="Tell us about your platform"
                          autoFocus
                        />
                      ) : undefined
                    }
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}

          {step === "aum" && (
            <div className="product-doc-stack--relaxed">
              <StepHeading
                title="Investor profile capacity"
                description="Assets under management — used only to assess fit."
              />
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
            </div>
          )}

          {step === "allocation" && (
            <div className="product-doc-stack--relaxed">
              <StepHeading
                title="Intended first allocation"
                description="A rough size for a first allocation — not a commitment."
              />
              <ChoiceGroup legend="Intended first allocation?">
                {VAULT_SIZE_OPTIONS.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={vaultSize === o.value}
                    onClick={() => setVaultSize(o.value)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}

          {step === "timing" && (
            <div className="product-doc-stack--relaxed">
              <StepHeading
                title="Timing & preferred next step"
                description="When would you like a first conversation?"
              />
              <ChoiceGroup legend="Timing for a first conversation?">
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

          {/* Permanent error slot — the line stays reserved whether or not an
             error is present so the box never grows/shrinks when validation
             fails. Only the text (and the alert role) toggle. */}
          <div className="apply-error-slot" aria-live="polite">
            {error ? (
              <p className="body-xs ct-status-danger m-0" role="alert">
                {error}
              </p>
            ) : null}
          </div>
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
              {isFirstStep ? (
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
                  {isLastStep ? (
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
                  ) : (
                    <Button
                      type="button"
                      onClick={goNext}
                      variant="primary"
                      size="lg"
                      className="min-w-0 flex-1"
                    >
                      Continue →
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
