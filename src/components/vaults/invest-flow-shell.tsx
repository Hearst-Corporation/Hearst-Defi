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
  const shellClasses = cn(
    "invest-flow-shell product-doc-stack",
    width === "cap" && "product-doc-shell--cap",
    width === "narrow" && "product-doc-shell--narrow",
    workspace && "invest-flow-shell--workspace",
    className,
  );

  // #region agent log
  fetch("http://127.0.0.1:7746/ingest/5c5b4e5a-0fc3-4328-87e5-3f1273cb02d8", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7fd9dc" },
    body: JSON.stringify({
      sessionId: "7fd9dc",
      location: "invest-flow-shell.tsx:render",
      message: "InvestFlowShell grammar",
      data: {
        step,
        workspace,
        hasWorkspaceClass: shellClasses.includes("invest-flow-shell--workspace"),
        contextLabel,
      },
      timestamp: Date.now(),
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion

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
