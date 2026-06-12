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

type InvestFlowWidth = "cap" | "narrow" | "full";

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
  /** Max-width modifier — mutually exclusive cap vs narrow. Default: cap. */
  width?: InvestFlowWidth;
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
  width = "cap",
  children,
  footer,
  className,
}: InvestFlowShellProps) {
  return (
    <div
      className={cn(
        "invest-flow-shell product-doc-shell",
        width === "cap" && "product-doc-shell--cap",
        width === "narrow" && "product-doc-shell--narrow",
        className,
      )}
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
        <div className="invest-flow-shell__stepper">
          <StepProgress active={step} />
          {headerBelowStepper}
        </div>
      </ProductPageHeader>

      {children}

      {footer ? (
        <footer className="product-doc-footer-rule">{footer}</footer>
      ) : null}
    </div>
  );
}
