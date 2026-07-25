import { cn } from "@/lib/cn";
import type { InvestStepId } from "@/lib/vaults/invest-routes";
import type { ReactNode } from "react";

import { InvestStepProgress } from "./invest-step-progress";

type InvestFlowWidth = "cap" | "narrow" | "full";

export function InvestFlowShell({
  step,
  titleLead,
  titleAccent,
  contextLabel = "Subscription",
  description,
  lead,
  headerBelowStepper,
  width = "cap",
  children,
}: {
  step: InvestStepId;
  titleLead?: string;
  titleAccent?: string;
  contextLabel?: string;
  description?: ReactNode;
  lead?: ReactNode;
  headerBelowStepper?: ReactNode;
  width?: InvestFlowWidth;
  children: ReactNode;
}) {
  const shellClasses = cn(
    "mx-auto mb-8 flex w-full flex-col gap-6 rounded-2xl border border-border bg-surface-page p-5 lg:p-6",
    width === "cap" && "max-w-5xl",
    width === "narrow" && "max-w-2xl",
    width === "full" && "max-w-6xl",
  );

  const hasTitle = titleLead != null || titleAccent != null;

  return (
    <div className={shellClasses}>
      {lead ? <div>{lead}</div> : null}
      <header className="flex flex-col gap-4 border-b border-border-subtle pb-5">
        <InvestStepProgress active={step} />
        {hasTitle ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
              {contextLabel}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {titleLead}{" "}
              {titleAccent ? (
                <span className="text-accent">{titleAccent}</span>
              ) : null}
            </h1>
            {description ? <div className="text-sm text-muted">{description}</div> : null}
            {headerBelowStepper ? (
              <div className="text-xs uppercase tracking-wider text-faint">
                {headerBelowStepper}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
