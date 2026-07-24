import { Stepper } from "@/components/catalyst/stepper";

export type Series1TimelineStep = {
  label: string;
  detail?: string;
  state?: "done" | "current" | "upcoming";
};

/**
 * Reserve-construction path. DS convergence: delegates to the Catalyst `Stepper`
 * primitive (the numbered vertical rail), render unchanged. `state` maps to the
 * primitive's `active` flag — only "upcoming" is the quiet node; "done"/"current"
 * are the accent (ringed) node, exactly as before.
 */
export function Series1Timeline({ steps }: { steps: Series1TimelineStep[] }) {
  return (
    <Stepper
      size="sm"
      steps={steps.map((step) => ({
        label: step.label,
        detail: step.detail,
        active: (step.state ?? "upcoming") !== "upcoming",
      }))}
    />
  );
}
