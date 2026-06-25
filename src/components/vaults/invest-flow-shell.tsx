import { ProductPageHeader } from "@/components/connect/product-page-header";
import { StepProgress } from "@/components/vaults/step-progress";
import { cn } from "@/lib/cn";
import type { InvestStepId } from "@/lib/vaults/invest-routes";
import type { ReactNode } from "react";

type InvestFlowWidth = "cap" | "narrow" | "full";

interface InvestFlowShellProps {
  step: InvestStepId;
  titleLead?: string;
  titleAccent?: string;
  contextLabel?: string;
  title?: string;
  description?: ReactNode;
  lead?: ReactNode;
  media?: ReactNode;
  actions?: ReactNode;
  headerBelowStepper?: ReactNode;
  align?: "start" | "center";
  headerClassName?: string;
  width?: InvestFlowWidth;
  workspace?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function InvestFlowShell({
  step,
  title,
  titleLead,
  titleAccent,
  contextLabel = "Investment Flow",
  description,
  lead,
  media,
  actions,
  headerBelowStepper,
  align = "start",
  headerClassName,
  width = "cap",
  workspace = false,
  children,
  footer,
  className,
}: InvestFlowShellProps) {
  return (
    <div
      className={cn(
        "invest-flow-shell product-doc-stack",
        width === "cap" && "product-doc-shell--cap",
        width === "narrow" && "product-doc-shell--narrow",
        workspace && "invest-flow-shell--workspace",
        className,
      )}
    >
      <ProductPageHeader
        lead={lead}
        media={media}
        titleLead={titleLead}
        titleAccent={titleAccent}
        title={title}
        description={description}
        actions={actions}
        align={align}
        className={cn(headerClassName, "mb-0")}
        beforeRule={
          <div className="invest-flow-shell__stepper">
            <div className="invest-flow-shell__stepper-row">
              {contextLabel ? (
                <p className="page-canon-kicker">{contextLabel}</p>
              ) : null}
              <StepProgress active={step} />
            </div>
            {headerBelowStepper}
          </div>
        }
      />

      <div className="invest-flow-shell__body">
        {children}

        {footer ? (
          <footer className="doc-page-disclaimer">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
