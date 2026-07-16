"use client";

/**
 * Accreditation attestations — Rule 506(c) + Cayman PIF.
 * Used inside OnboardingChamber (CTA lives in Sole, not here).
 */

import { useState, useTransition } from "react";

import { attestAccreditation } from "@/app/actions/accreditation";
import { Checkbox } from "@/components/catalyst/choice-checkbox";

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
      "I understand this is a BTC-accumulation mining note that accumulates Bitcoin over a 24-month term and delivers BTC at maturity — it makes no periodic cash distribution and carries no fixed APY. Estimated return ranges (8–15%, expressed in accumulated BTC) are estimates based on stated assumptions and are not a commitment of future returns.",
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
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
        <fieldset
          className="border-none p-0 m-0"
          aria-label="Accreditation attestations"
        >
          <legend className="ct-bento-label float-left w-full p-5 border-b border-[var(--ct-border-soft)] leading-none">
            Please confirm all three attestations to proceed
          </legend>

          <div className="flex flex-col px-5">
            {ATTESTATIONS.map(({ id, label }) => (
              <Checkbox
                key={id}
                id={`attest-${id}`}
                name={id}
                checked={isChecked(id)}
                onChange={() => toggle(id)}
                className="items-start gap-3 py-4 border-b border-[var(--ct-border-soft)] last:border-b-0"
                labelClassName="body-sm leading-relaxed ct-text-primary"
              >
                {label}
              </Checkbox>
            ))}
          </div>
        </fieldset>
      </div>

      <div aria-live="polite">
        {!allChecked ? (
          <p
            className="ct-bento-label m-0 flex items-center gap-2"
            role="status"
          >
            <span
              aria-hidden
              className="size-1 rounded-full bg-[var(--ct-text-muted)]"
            />
            All three attestations are required to continue.
          </p>
        ) : (
          <p
            className="ct-bento-label ct-text-accent m-0 flex items-center gap-2 invisible"
            aria-hidden
          >
            <span
              aria-hidden
              className="size-1 rounded-full bg-[var(--ct-accent)]"
            />
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
