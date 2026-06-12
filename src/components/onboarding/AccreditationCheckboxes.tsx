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

interface AccreditationFieldsProps {
  state: AccreditationAttestationState;
}

export function AccreditationAttestationFields({
  state,
}: AccreditationFieldsProps) {
  const { allChecked, attestError, toggle, isChecked } = state;

  return (
    <div className="flex flex-col gap-5">
      <fieldset
        className="border-none p-0 m-0"
        aria-label="Accreditation attestations"
      >
        <legend className="eyebrow ct-text-muted mb-4">
          Please confirm all three attestations to proceed
        </legend>

        <div className="flex flex-col gap-3">
          {ATTESTATIONS.map(({ id, label }) => {
            const checked = isChecked(id);
            return (
              <label
                key={id}
                htmlFor={`attest-${id}`}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <input
                  id={`attest-${id}`}
                  type="checkbox"
                  name={id}
                  checked={checked}
                  onChange={() => {
                    toggle(id);
                  }}
                  className="mt-0.5 w-4 h-4 shrink-0 rounded accent-[var(--ct-accent)] cursor-pointer"
                  aria-checked={checked}
                />
                <span className="body-sm ct-text-body leading-relaxed group-hover:ct-text-primary transition-colors">
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {!allChecked ? (
        <p className="body-xs ct-text-faint" aria-live="polite" role="status">
          All three attestations are required to continue.
        </p>
      ) : null}

      {attestError ? (
        <p
          className="body-xs ct-status-danger"
          aria-live="assertive"
          role="alert"
        >
          {attestError}
        </p>
      ) : null}
    </div>
  );
}

interface AccreditationCheckboxesProps {
  /** Called when all boxes are checked and user clicks Continue. */
  onContinue?: () => void;
  /** When true, omit inline Continue — render via chamber Sole instead. */
  hideContinue?: boolean;
}

export function AccreditationCheckboxes({
  onContinue,
  hideContinue = false,
}: AccreditationCheckboxesProps) {
  const state = useAccreditationAttestations(onContinue);

  return (
    <div className="flex flex-col gap-5">
      <AccreditationAttestationFields state={state} />

      {hideContinue ? null : (
        <Button
          variant="primary"
          size="lg"
          disabled={!state.allChecked || state.isPending}
          aria-disabled={!state.allChecked || state.isPending}
          onClick={state.handleContinue}
          className="w-full font-bold"
        >
          {state.isPending ? "Confirming…" : "Continue"}
        </Button>
      )}
    </div>
  );
}
