import { ProductPageHeader } from "@/components/connect/product-page-header";
import { StepProgress } from "@/components/vaults/step-progress";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type InvestStepId = "select" | "product" | "deposit" | "confirmed";

const STEP_EYEBROW: Record<InvestStepId, string> = {
  select: "Invest · Step 1 of 4",
  product: "Invest · Step 2 of 4",
  deposit: "Invest · Step 3 of 4",
  confirmed: "Invest · Step 4 of 4",
};

interface InvestFlowShellProps {
  step: InvestStepId;
  title: string;
  description?: ReactNode;
  lead?: ReactNode;
  media?: ReactNode;
  actions?: ReactNode;
  headerBelowStepper?: ReactNode;
  align?: "start" | "center";
  headerClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function InvestFlowShell({
  step,
  title,
  description,
  lead,
  media,
  actions,
  headerBelowStepper,
  align = "start",
  headerClassName,
  children,
  footer,
  className,
}: InvestFlowShellProps) {
  return (
    <div
      className={cn("invest-flow-shell space-y-8 pb-8", className)}
    >
      <ProductPageHeader
        lead={lead}
        media={media}
        eyebrow={STEP_EYEBROW[step]}
        title={title}
        description={description}
        actions={actions}
        align={align}
        className={headerClassName}
      >
        <div className="flex flex-col gap-4 pt-2">
          <StepProgress active={step} />
          {headerBelowStepper}
        </div>
      </ProductPageHeader>

      {children}

      {footer ? (
        <footer className="space-y-4 border-t ct-bc-soft pt-6">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
