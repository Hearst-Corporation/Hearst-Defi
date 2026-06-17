"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  simulateTypeformSubmission,
  type OnboardingTestResult,
} from "./actions";

/** The 7 qualification questions, mirroring the Typeform form. */
const QUESTIONS: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    name: "platformType",
    label: "Q1 — What best describes your platform?",
    options: [
      { value: "crypto", label: "Crypto-native / DeFi" },
      { value: "exchange", label: "Crypto exchange / OTC desk" },
      { value: "wealth", label: "Wealth manager / family office" },
      { value: "custody", label: "Custodian / infrastructure" },
    ],
  },
  {
    name: "aum",
    label: "Q2 — Assets under management?",
    options: [
      { value: "lt_10m", label: "< $10M" },
      { value: "10_50m", label: "$10M – $50M" },
      { value: "50_250m", label: "$50M – $250M" },
      { value: "250m_plus", label: "$250M+" },
      { value: "unsure", label: "Not sure / prefer not to say" },
    ],
  },
  {
    name: "fundsUsage",
    label: "Q3 — How are client funds currently deployed?",
    options: [
      { value: "idle", label: "Mostly sitting unused / idle" },
      { value: "mix", label: "A mix of both" },
      { value: "earning", label: "Mostly earning yield already" },
    ],
  },
  {
    name: "yieldStatus",
    label: "Q4 — Do you offer yield or reward products?",
    options: [
      { value: "live", label: "Yes, we're live" },
      { value: "in_progress", label: "In progress / building" },
      { value: "not_yet", label: "Not yet" },
    ],
  },
  {
    name: "yieldType",
    label: "Q5 — What type of yield product suits your clients?",
    options: [
      { value: "low_risk", label: "Low-risk / capital preservation" },
      { value: "balanced", label: "Balanced risk / return" },
      { value: "growth", label: "Growth / higher return" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    name: "vaultSize",
    label: "Q6 — Vault size for a first allocation?",
    options: [
      { value: "100_500k", label: "$100K – $500K" },
      { value: "500k_1m", label: "$500K – $1M" },
      { value: "1_5m", label: "$1M – $5M" },
      { value: "5m_plus", label: "$5M+" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    name: "timeline",
    label: "Q7 — What is your launch timeline?",
    options: [
      { value: "asap", label: "ASAP" },
      { value: "1_3m", label: "1 – 3 months" },
      { value: "3_6m", label: "3 – 6 months" },
      { value: "exploring", label: "Just exploring" },
    ],
  },
];

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<OnboardingTestResult | null>(null);

  function onSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await simulateTypeformSubmission(formData);
      setResult(res);
    });
  }

  return (
    <div className="admin-doc-stack admin-doc-stack--actions">
      <form action={onSubmit} className="admin-doc-stack admin-doc-stack--actions" aria-label="Onboarding simulator">
        {/* Contact */}
        <div className="admin-doc-form-grid-2">
          <label className="block body-xs" htmlFor="ob-email">
            <span className="ct-form-label">Email (required)</span>
            <input id="ob-email" name="email" type="email" required placeholder="lp@fund.io" className="ct-input" />
          </label>
          <label className="block body-xs" htmlFor="ob-phone">
            <span className="ct-form-label">Phone (optional)</span>
            <input id="ob-phone" name="phone" type="text" placeholder="+33 6 00 00 00 00" className="ct-input" />
          </label>
          <label className="block body-xs" htmlFor="ob-firstName">
            <span className="ct-form-label">First name</span>
            <input id="ob-firstName" name="firstName" type="text" placeholder="Alice" className="ct-input" />
          </label>
          <label className="block body-xs" htmlFor="ob-lastName">
            <span className="ct-form-label">Last name</span>
            <input id="ob-lastName" name="lastName" type="text" placeholder="Dupont" className="ct-input" />
          </label>
          <label className="block body-xs" htmlFor="ob-website">
            <span className="ct-form-label">Website (optional)</span>
            <input id="ob-website" name="website" type="text" placeholder="https://fund.io" className="ct-input" />
          </label>
        </div>

        {/* 7 questions */}
        <div className="admin-doc-form-grid-2">
          {QUESTIONS.map((q) => (
            <label key={q.name} className="block body-xs" htmlFor={`ob-${q.name}`}>
              <span className="ct-form-label">{q.label}</span>
              <select id={`ob-${q.name}`} name={q.name} defaultValue="" className="ct-input">
                <option value="">Skip question</option>
                {q.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {/* Side-effects toggles */}
        <div className="admin-doc-inline-row flex-wrap gap-[var(--ct-space-4)]">
          <label className="inline-flex items-center body-xs gap-[var(--ct-space-2)]">
            <input type="checkbox" name="syncHubspot" defaultChecked />
            <span>Create HubSpot contact</span>
          </label>
          <label className="inline-flex items-center body-xs gap-[var(--ct-space-2)]">
            <input type="checkbox" name="sendEmail" />
            <span>Send welcome email</span>
          </label>
        </div>

        <div className="admin-doc-inline-row">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Submitting…" : "Submit onboarding"}
          </Button>
        </div>
      </form>

      {/* Result */}
      {result && (
        <div className="admin-doc-stack admin-doc-stack--actions">
          <div className="admin-doc-inline-row flex-wrap gap-[var(--ct-space-2)]">
            {result.ok ? (
              <Badge variant="success">{result.created ? "Account created" : "Account ready"}</Badge>
            ) : (
              <Badge variant="danger">Failed</Badge>
            )}
            {result.calibrated && <Badge variant="accent">Assistant configured</Badge>}
            {result.emailSent && <Badge variant="brand">Welcome email scheduled</Badge>}
            {result.hubspotSynced && <Badge variant="success">HubSpot synced</Badge>}
          </div>

          {result.error && <p className="body-sm ct-status-danger">{result.error}</p>}

          <ol className="admin-doc-stack body-sm ct-text-body" style={{ listStyle: "decimal inside" }}>
            {result.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>

          {result.userId && (
            <p className="body-xs ct-text-muted">
              User id: <span className="mono">{result.userId}</span>
            </p>
          )}

          {result.hubspotContactId && (
            <a
              href={`https://app-eu1.hubspot.com/contacts/147776713/record/0-1/${result.hubspotContactId}`}
              target="_blank"
              rel="noreferrer"
              className="body-sm ct-text-primary underline underline-offset-2"
            >
              → Open contact in HubSpot
            </a>
          )}
        </div>
      )}
    </div>
  );
}
