"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QUALIFICATION_FIELD_DEFINITIONS } from "@/lib/qualification/options";
import {
  simulateTypeformSubmission,
  type OnboardingTestResult,
} from "./actions";

/** The 7 qualification questions, mirroring the Typeform form. */
const QUESTIONS = QUALIFICATION_FIELD_DEFINITIONS.map((field, index) => ({
  name: field.name,
  label: `Q${index + 1} — ${field.questionLabel}`,
  options: field.options,
}));

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
        <div className="admin-doc-toggle-row">
          <label className="admin-doc-toggle body-xs">
            <input type="checkbox" name="syncHubspot" />
            <span>Create HubSpot contact</span>
          </label>
          <label className="admin-doc-toggle body-xs">
            <input type="checkbox" name="sendEmail" />
            <span>Send welcome email</span>
          </label>
        </div>

        <div className="admin-doc-inline-row">
          <Button type="submit" variant="primary" size="md" disabled={isPending}>
            {isPending ? "Submitting…" : "Submit onboarding"}
          </Button>
        </div>
      </form>

      {/* Result */}
      {result && (
        <div className="admin-doc-stack admin-doc-stack--actions">
          <div className="admin-doc-badge-row">
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

          <ol className="admin-doc-step-list body-sm ct-text-body">
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
