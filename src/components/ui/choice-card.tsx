import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ChoiceCardProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

/** Single-select option card for qualification / onboarding flows. */
export function ChoiceCard({ label, selected, onClick }: ChoiceCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn("ct-choice-card ct-focus-ring", selected && "ct-choice-card--selected")}
    >
      <span
        aria-hidden="true"
        className={cn(
          "ct-choice-card__dot",
          selected && "ct-choice-card__dot--selected",
        )}
      />
      <span
        className={cn(
          "ct-choice-card__label",
          selected && "ct-choice-card__label--selected",
        )}
      >
        {label}
      </span>
    </button>
  );
}

interface ChoiceGroupProps {
  legend: string;
  children: ReactNode;
}

/** Fieldset wrapper — legend uses canonical form label styling. */
export function ChoiceGroup({ legend, children }: ChoiceGroupProps) {
  return (
    <fieldset className="ct-choice-group">
      <legend className="ct-form-label">{legend}</legend>
      <div className="ct-choice-group__options">{children}</div>
    </fieldset>
  );
}
