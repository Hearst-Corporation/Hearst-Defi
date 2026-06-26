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
  // `contextLabel` stays on the interface (call-sites still pass it) but is no
  // longer rendered — the context kicker sub-title was removed.
  title,
  titleLead,
  titleAccent,
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
  const shellClasses = cn(
    "invest-flow-shell product-doc-stack",
    width === "cap" && "product-doc-shell--cap",
    width === "narrow" && "product-doc-shell--narrow",
    workspace && "invest-flow-shell--workspace",
    className,
  );

  return (
    <div className={shellClasses}>
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
        titleRowEnd={
          <div className="invest-flow-shell__stepper invest-flow-shell__stepper--inline">
            <StepProgress active={step} />
          </div>
        }
        beforeRule={headerBelowStepper}
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
