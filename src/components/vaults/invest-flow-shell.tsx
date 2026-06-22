import { ProductPageHeader } from "@/components/connect/product-page-header";
import { StepProgress } from "@/components/vaults/step-progress";
import { cn } from "@/lib/cn";
import type { InvestStepId } from "@/lib/vaults/invest-routes";
import type { ReactNode } from "react";

type InvestFlowWidth = "cap" | "narrow" | "full";

interface InvestFlowShellProps {
  step: InvestStepId;
  /** Canon: portion blanche du titre. */
  titleLead?: string;
  /** Canon: portion accent vert du titre (bicolore). */
  titleAccent?: string;
  /** Canon: kicker court uppercase (défaut « Investment Flow »). */
  contextLabel?: string;
  /** Legacy single-string title. */
  title?: string;
  description?: ReactNode;
  lead?: ReactNode;
  media?: ReactNode;
  actions?: ReactNode;
  headerBelowStepper?: ReactNode;
  align?: "start" | "center";
  headerClassName?: string;
  /** Max-width modifier — mutually exclusive cap vs narrow. Default: cap. */
  width?: InvestFlowWidth;
  /** Viewport-fit workspace mode — header fixed, body scrolls internally. */
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
        "invest-flow-shell",
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
        className={headerClassName}
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
