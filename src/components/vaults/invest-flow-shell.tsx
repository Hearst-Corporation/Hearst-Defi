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

/**
 * Invest funnel shell — pure bento (Portfolio canon).
 *
 * Vertical normal flow: header block (back link → bicolore title + inline step
 * indicator → context kicker / description) then the body. No absolute/sticky
 * positioning, so a downstream sticky CTA can never overlap the header.
 * Accent is the single green --ct-accent.
 *
 * `width` maps to a max-width container; `workspace` widens it for the dense
 * vault-detail layout. All props are preserved — only the rendering changed.
 */
export function InvestFlowShell({
  step,
  // `contextLabel` is rendered as the kicker under the title row.
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
  const centered = align === "center";

  const shellClasses = cn(
    // Grey body container (Portfolio canon): black panels sit on a zinc-900 surface.
    "invest-flow-shell mx-auto flex w-full flex-col gap-6 rounded-2xl border border-[var(--ct-border)] bg-surface-page p-5 lg:p-6 mb-8",
    width === "cap" && "product-doc-shell--cap max-w-5xl",
    width === "narrow" && "product-doc-shell--narrow max-w-2xl",
    width === "full" && "max-w-6xl",
    workspace && "invest-flow-shell--workspace max-w-6xl",
    className,
  );

  const hasTitle =
    titleLead != null || titleAccent != null || title != null;

  return (
    <div className={shellClasses}>
      <header
        className={cn(
          "invest-flow-shell__header flex flex-col gap-4 border-b border-[var(--ct-border-soft)] pb-5",
          centered && "items-center text-center",
          headerClassName,
        )}
      >
        {lead ? <div className="flex items-center">{lead}</div> : null}

        <div
          className={cn(
            "flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between",
            centered && "lg:flex-col lg:items-center",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center gap-3",
              centered && "flex-col gap-2 text-center",
            )}
          >
            {media ? <div className="shrink-0">{media}</div> : null}
            {hasTitle ? (
              <h1 className="text-2xl font-medium tracking-tight text-[var(--ct-text-strong)]">
                {titleLead != null || titleAccent != null ? (
                  <>
                    {titleLead}
                    {titleAccent ? (
                      <>
                        {titleLead ? " " : null}
                        <span className="text-[var(--ct-accent)]">{titleAccent}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  title
                )}
              </h1>
            ) : null}
          </div>

          <div className="shrink-0 lg:max-w-md lg:flex-1">
            <StepProgress active={step} />
          </div>
        </div>

        {contextLabel ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ct-text-faint)]">
            {contextLabel}
          </p>
        ) : null}

        {description ? (
          <div
            className={cn(
              "text-[13px] text-[var(--ct-text-muted)]",
              centered && "mx-auto",
            )}
          >
            {description}
          </div>
        ) : null}

        {headerBelowStepper}

        {actions ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-3",
              centered && "justify-center",
            )}
          >
            {actions}
          </div>
        ) : null}
      </header>

      <div className="invest-flow-shell__body flex flex-col gap-5">
        {children}

        {footer ? (
          <footer className="border-t border-[var(--ct-border-soft)] pt-5 text-[11px] text-[var(--ct-text-faint)]">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
