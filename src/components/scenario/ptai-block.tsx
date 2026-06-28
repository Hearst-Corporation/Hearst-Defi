import { Ptai } from "@/components/catalyst/ptai";
import {
  deriveScenarioAction,
  deriveScenarioImpact,
  deriveScenarioProjection,
  deriveScenarioTrigger,
} from "@/components/scenario/ptai-derive";
import type { ScenarioOutput } from "@/lib/engine/types";

interface PtaiBlockProps {
  output: ScenarioOutput;
  className?: string;
  variant?: "inset" | "flat";
}

/** Scenario-level PTAI — embedded inside DecisionPanel (parent owns the label). */
export function PtaiBlock({
  output,
  className,
  variant = "inset",
}: PtaiBlockProps) {
  return (
    <Ptai
      projection={deriveScenarioProjection(output)}
      trigger={deriveScenarioTrigger(output)}
      action={deriveScenarioAction(output)}
      impact={deriveScenarioImpact(output)}
      variant={variant}
      className={className}
    />
  );
}
