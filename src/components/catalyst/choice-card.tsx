import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ChoiceCardProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  /**
   * Optional content revealed inside the card once it is selected (e.g. an
   * "Other" free-text input). When present and selected, the card renders as a
   * container (an input cannot live inside a <button>) with the label row on
   * top and this content directly below — same box, no separate field.
   */
  expandedContent?: ReactNode;
}

/** Single-select option card for qualification / onboarding flows. */
export function ChoiceCard({
  label,
  selected,
  onClick,
  expandedContent,
}: ChoiceCardProps) {
  const dot = (
    <span
      aria-hidden="true"
      className={cn(
        "ct-choice-card__dot",
        selected && "ct-choice-card__dot--selected",
      )}
    />
  );
  const labelEl = (
    <span
      className={cn(
        "ct-choice-card__label",
        selected && "ct-choice-card__label--selected",
      )}
    >
      {label}
    </span>
  );

  // Selected + has revealable content → container card holding label + content.
  if (expandedContent && selected) {
    return (
      <div className="ct-choice-card ct-choice-card--selected ct-choice-card--expanded">
        {/* Trigger kept for radio semantics but visually hidden once selected —
            only the revealed field shows, so the box becomes just the input. */}
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={label}
          onClick={onClick}
          className="sr-only"
        >
          {label}
        </button>
        {expandedContent}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn("ct-choice-card ct-focus-ring", selected && "ct-choice-card--selected")}
    >
      {dot}
      {labelEl}
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
