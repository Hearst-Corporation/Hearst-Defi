"use client";

/**
 * AccreditationCheckboxes — Rule 506(c) + Cayman PIF attestation.
 *
 * Three checkboxes. "Continue" CTA is disabled until all three are checked.
 * On Continue: calls attestAccreditation() server action first, then onContinue.
 * If the server action fails, the error is shown and onContinue is NOT called.
 * A11y: each checkbox has an associated <label>; error state announced via aria-live.
 * Cockpit tokens only — no hex, no magic px.
 */

import { useState, useTransition } from "react";

import { attestAccreditation } from "@/app/actions/accreditation";
import { Button } from "@/components/ui/button";

const ATTESTATIONS = [
  {
    id: "rule-506c",
    label:
      "I am an Accredited Investor as defined under SEC Rule 506(c) — individual net worth exceeding $1M (excluding primary residence) or annual income exceeding $200k ($300k jointly) in each of the two most recent years.",
  },
  {
    id: "cayman-pif",
    label:
      "I acknowledge this offering is made through a Cayman Islands Private Investment Fund (PIF) and is not registered under any securities act. Participation is restricted to eligible investors under applicable law.",
  },
  {
    id: "not-guaranteed",
    label:
      "I understand that projected APY ranges (8–15%) are target estimates based on stated assumptions and are not a commitment of future returns.",
  },
] as const;

type AttestationId = (typeof ATTESTATIONS)[number]["id"];

interface AccreditationCheckboxesProps {
  /** Called when all boxes are checked and user clicks Continue. */
  onContinue?: () => void;
}

export function AccreditationCheckboxes({
  onContinue,
}: AccreditationCheckboxesProps) {
  const [checked, setChecked] = useState<Set<AttestationId>>(new Set());
  const [attestError, setAttestError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allChecked = checked.size === ATTESTATIONS.length;

  function toggle(id: AttestationId) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleContinue() {
    if (!allChecked) return;
    setAttestError(null);
    startTransition(async () => {
      const result = await attestAccreditation();
      if (!result.ok) {
        setAttestError(result.error);
        return;
      }
      onContinue?.();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--ct-space-5)]">
      <fieldset
        className="border-none p-0 m-0"
        aria-label="Accreditation attestations"
      >
        <legend className="eyebrow ct-text-muted mb-[var(--ct-space-4)]">
          Please confirm all three attestations to proceed
        </legend>

        <div className="flex flex-col gap-[var(--ct-space-3)]">
          {ATTESTATIONS.map(({ id, label }) => {
            const isChecked = checked.has(id);
            return (
              <label
                key={id}
                htmlFor={`attest-${id}`}
                className="flex items-start gap-[var(--ct-space-3)] cursor-pointer group"
              >
                <input
                  id={`attest-${id}`}
                  type="checkbox"
                  name={id}
                  checked={isChecked}
                  onChange={() => { toggle(id); }}
                  className="mt-0.5 w-4 h-4 shrink-0 rounded accent-[var(--ct-accent)] cursor-pointer"
                  aria-checked={isChecked}
                />
                <span className="body-sm ct-text-body leading-relaxed group-hover:ct-text-primary transition-colors">
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Inline hint when not all checked */}
      {!allChecked && (
        <p
          className="body-xs ct-text-faint"
          aria-live="polite"
          role="status"
        >
          All three attestations are required to continue.
        </p>
      )}

      {/* Server action error — shown only on failure */}
      {attestError && (
        <p
          className="body-xs ct-status-danger"
          aria-live="assertive"
          role="alert"
        >
          {attestError}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        disabled={!allChecked || isPending}
        aria-disabled={!allChecked || isPending}
        onClick={handleContinue}
        className="w-full font-bold"
      >
        {isPending ? "Confirming…" : "Continue"}
      </Button>
    </div>
  );
}
