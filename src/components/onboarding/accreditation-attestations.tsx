"use client";

/**
 * Accreditation attestations — Rule 506(c) + Cayman PIF.
 * Used inside OnboardingChamber (CTA lives in Sole, not here).
 */

import { useState, useTransition } from "react";

import { attestAccreditation } from "@/app/actions/accreditation";
import { Checkbox } from "@/components/ui/checkbox";

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

export interface AccreditationAttestationState {
  allChecked: boolean;
  isPending: boolean;
  attestError: string | null;
  toggle: (id: AttestationId) => void;
  isChecked: (id: AttestationId) => boolean;
  handleContinue: () => void;
}

export function useAccreditationAttestations(
  onContinue?: () => void,
): AccreditationAttestationState {
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

  function isChecked(id: AttestationId) {
    return checked.has(id);
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

  return {
    allChecked,
    isPending,
    attestError,
    toggle,
    isChecked,
    handleContinue,
  };
}

export function AccreditationAttestationFields({
  state,
}: {
  state: AccreditationAttestationState;
}) {
  const { allChecked, attestError, toggle, isChecked } = state;

  return (
    <div className="product-doc-stack">
      <fieldset
        className="border-none p-0 m-0"
        aria-label="Accreditation attestations"
      >
        <legend className="eyebrow ct-text-muted mb-4">
          Please confirm all three attestations to proceed
        </legend>

        <div className="product-doc-stack--actions">
          {ATTESTATIONS.map(({ id, label }) => (
            <Checkbox
              key={id}
              id={`attest-${id}`}
              name={id}
              checked={isChecked(id)}
              onChange={() => toggle(id)}
              labelClassName="leading-relaxed"
            >
              {label}
            </Checkbox>
          ))}
        </div>
      </fieldset>

      <div className="onboarding-chamber__status" aria-live="polite">
        {!allChecked ? (
          <p className="body-xs ct-text-faint m-0" role="status">
            All three attestations are required to continue.
          </p>
        ) : (
          <p className="body-xs ct-text-faint m-0 invisible" aria-hidden>
            Ready to continue.
          </p>
        )}
      </div>

      {attestError ? (
        <p
          className="body-xs ct-status-danger m-0"
          aria-live="assertive"
          role="alert"
        >
          {attestError}
        </p>
      ) : null}
    </div>
  );
}
