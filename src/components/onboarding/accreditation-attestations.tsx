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
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <fieldset
          className="border-none p-0 m-0"
          aria-label="Accreditation attestations"
        >
          <legend className="float-left w-full p-5 border-b border-white/5 text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
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
                className="items-start gap-3 py-4 border-b border-white/5 last:border-b-0"
                labelClassName="text-[13px] leading-relaxed text-zinc-200"
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
            className="m-0 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-zinc-500"
            role="status"
          >
            <span aria-hidden className="size-1 rounded-full bg-zinc-500" />
            All three attestations are required to continue.
          </p>
        ) : (
          <p
            className="m-0 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-[#A7FB90] invisible"
            aria-hidden
          >
            <span aria-hidden className="size-1 rounded-full bg-[#A7FB90]" />
            Ready to continue.
          </p>
        )}
      </div>

      {attestError ? (
        <p
          className="m-0 text-[12px] text-red-400"
          aria-live="assertive"
          role="alert"
        >
          {attestError}
        </p>
      ) : null}
    </div>
  );
}
