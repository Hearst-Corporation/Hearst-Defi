"use client";

/**
 * TaxDocsDrawer — 1099/CRS YTD tax preview drawer for LPs.
 *
 * Preview only — final tax documents are issued annually (2027 Q1).
 * Three tabs: 1099-INT · 1099-B · CRS.
 * Download buttons are disabled (available 2027 Q1).
 *
 * CLAUDE.md non-negotiables:
 *  #2  Every metric has a provenance badge ("estimated" / "manual").
 *  #5  Forbidden words absent from all labels.
 * Disclaimer mandatory: "Preview only — final tax docs issued annually.
 *   Not tax advice. Not guaranteed."
 */

import { useState } from "react";
import { FileText, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/ui/button";
import type {
  TaxPreview,
  Form1099Int,
  Form1099B,
  CrsPreview,
} from "@/lib/portfolio/tax";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaxDocsDrawerProps {
  /** The LP user ID — used to key the preview data. */
  userId: string;
  /** Pre-fetched TaxPreview from the server query (passed by the Server Component parent). */
  preview: TaxPreview;
}

type TaxTab = "1099-INT" | "1099-B" | "CRS";

const TAX_TABS: TaxTab[] = ["1099-INT", "1099-B", "CRS"];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(amount: number): string {
  return usdFmt.format(amount);
}

// ---------------------------------------------------------------------------
// Tab content sub-components
// ---------------------------------------------------------------------------

function Tab1099Int({ data }: { data: Form1099Int }) {
  return (
    <section aria-label="1099-INT preview" className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm ct-text-muted">
          Tax year {data.taxYear} · YTD as of {data.ytdCutDate}
        </p>
        <ProvenanceBadge kind="estimated" />
      </div>

      <div className="rounded-lg border border-(--ct-border) ct-surface-1 divide-y divide-(--ct-border)">
        <TaxRow
          label="Box 1 — Interest income YTD"
          value={formatUsd(data.interestIncomeUsd)}
          highlight
        />
        <TaxRow
          label="Box 4 — Federal tax withheld"
          value={formatUsd(data.federalTaxWithheldUsd)}
        />
        <TaxRow
          label="Payer"
          value="Hearst Capital SPV Ltd."
        />
        <TaxRow
          label="Form type"
          value="1099-INT (preview)"
        />
      </div>

      <p className="body-xs ct-text-muted italic">
        Interest income from mining-backed structured yield distributions.
        Classified under IRC §61. Accredited investors providing W-9/W-8BEN
        have 0% federal withholding.
      </p>
    </section>
  );
}

function Tab1099B({ data }: { data: Form1099B }) {
  const netGain =
    data.shortTermGainLossUsd + data.longTermGainLossUsd;

  return (
    <section aria-label="1099-B preview" className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm ct-text-muted">
          Tax year {data.taxYear} · Unrealised (no disposition)
        </p>
        <ProvenanceBadge kind="estimated" />
      </div>

      <div className="rounded-lg border border-(--ct-border) ct-surface-1 divide-y divide-(--ct-border)">
        <TaxRow
          label="Box 1d — Proceeds"
          value={formatUsd(data.proceedsUsd)}
        />
        <TaxRow
          label="Box 1e — Cost basis (principal)"
          value={formatUsd(data.costBasisUsd)}
          highlight
        />
        <TaxRow
          label="Box 1c — Short-term gain / (loss)"
          value={formatUsd(data.shortTermGainLossUsd)}
          signed
        />
        <TaxRow
          label="Box 1c — Long-term gain / (loss)"
          value={formatUsd(data.longTermGainLossUsd)}
          signed
        />
        <TaxRow
          label="Net gain / (loss)"
          value={formatUsd(netGain)}
          signed
          highlight
        />
      </div>

      <p className="body-xs ct-text-muted italic">
        No disposition has occurred during the soft lock-up period. Proceeds
        are $0 until redemption. Gains are notional YTD accruals only.
      </p>
    </section>
  );
}

function TabCrs({ data }: { data: CrsPreview }) {
  return (
    <section aria-label="CRS preview" className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm ct-text-muted">
          Reporting year {data.reportingYear} · OECD CRS Annex I §VIII(D)
        </p>
        <ProvenanceBadge kind="manual" />
      </div>

      <div className="rounded-lg border border-(--ct-border) ct-surface-1 divide-y divide-(--ct-border)">
        <TaxRow
          label="Residence country"
          value={data.residenceCountry}
        />
        <TaxRow
          label="Account balance (period end)"
          value={formatUsd(data.accountBalanceUsd)}
          highlight
        />
        <TaxRow
          label="Gross interest income"
          value={formatUsd(data.grossInterestUsd)}
        />
        <TaxRow
          label="Gross dividends"
          value={formatUsd(data.grossDividendsUsd)}
        />
        <TaxRow
          label="Other income (mining distributions)"
          value={formatUsd(data.otherIncomeUsd)}
        />
      </div>

      <p className="body-xs ct-text-muted italic">
        CRS reporting applies to non-US LP accounts. Data is shared with the
        relevant tax authority in the LP&apos;s country of residence under OECD
        Common Reporting Standard obligations.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TaxRow helper
// ---------------------------------------------------------------------------

function TaxRow({
  label,
  value,
  highlight = false,
  signed = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  signed?: boolean;
}) {
  const isNegative = signed && value.startsWith("-");

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3 text-sm",
        highlight && "ct-surface-2",
      )}
    >
      <span className="ct-text-muted">{label}</span>
      <span
        className={cn(
          "tabular-nums font-medium",
          highlight && "ct-text-strong",
          signed && !isNegative && "ct-status-success",
          isNegative && "ct-status-danger",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TaxDocsDrawer({ userId: _userId, preview }: TaxDocsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TaxTab>("1099-INT");

  return (
    <>
      {/* Trigger — disabled until real tax data is available (V1: fabricated data only).
           External callers (openDrawer) are the sole other entry point; in V1 no
           external trigger surfaces this component, so disabling here is sufficient. */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Available 2027 Q1"
        className={cn(
          "inline-flex items-center gap-2 rounded-full",
          "border border-(--ct-border-soft) ct-surface-0",
          "px-4 py-2 text-sm ct-text-muted",
          "opacity-50 cursor-not-allowed",
          "focus-visible:outline-none focus-visible:shadow-(--ct-shadow-focus-ring)",
        )}
        aria-label="Tax documents preview — available 2027 Q1"
        data-testid="tax-docs-trigger"
      >
        <FileText aria-hidden size={14} strokeWidth={2} />
        Tax Docs Preview
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-(--ct-z-overlay) ct-overlay-backdrop backdrop-blur-sm"
          aria-hidden
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tax Documents Preview"
        data-testid="tax-docs-drawer"
        className={cn(
          "fixed inset-y-0 right-0 z-(--ct-z-modal)",
          "w-full max-w-lg",
          "flex flex-col",
          "bg-(--ct-bg-deep) border-l border-(--ct-border)",
          "shadow-(--ct-shadow-elevated)",
          "transition-transform duration-(--ct-dur-slow)",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-(--ct-border) px-6 py-5">
          <div>
            <h2 className="h2">
              Tax Documents
            </h2>
            <p className="mt-0.5 text-xs ct-text-muted">
              Tax year {preview.form1099Int.taxYear} · Preview
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close tax documents drawer"
            className={cn(
              "rounded-md p-2",
              "ct-text-muted hover:ct-text-strong",
              "hover:ct-surface-1",
              "transition-colors duration-(--ct-dur-base)",
              "focus-visible:outline-none focus-visible:shadow-(--ct-shadow-focus-ring)",
            )}
          >
            <X aria-hidden size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Disclaimer — mandatory per CLAUDE.md */}
        <div className="border-b border-(--ct-border) ct-status-warning-bg px-6 py-3">
          <p
            className="text-xs ct-status-warning leading-relaxed"
            data-testid="tax-disclaimer"
          >
            Preview only — final tax docs issued annually. Not tax advice. Not guaranteed.
          </p>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Tax form tabs"
          className="flex gap-1 border-b border-(--ct-border) px-6 pt-4 pb-0"
        >
          {TAX_TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`tax-panel-${tab}`}
              id={`tax-tab-${tab}`}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-t-(--ct-radius-md) px-4 py-2.5 text-sm font-medium",
                "transition-colors duration-(--ct-dur-base)",
                "focus-visible:outline-none focus-visible:shadow-(--ct-shadow-focus-ring)",
                activeTab === tab
                  ? "border-b-2 border-(--ct-accent) ct-text-accent"
                  : "ct-text-muted hover:ct-text-primary hover:ct-surface-1",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5"
          id={`tax-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tax-tab-${activeTab}`}
        >
          {activeTab === "1099-INT" && (
            <Tab1099Int data={preview.form1099Int} />
          )}
          {activeTab === "1099-B" && (
            <Tab1099B data={preview.form1099B} />
          )}
          {activeTab === "CRS" && (
            <TabCrs data={preview.crs} />
          )}
        </div>

        {/* Footer — download buttons disabled (V1 preview) */}
        <div className="flex items-center justify-between gap-3 border-t border-(--ct-border) px-6 py-4">
          <p className="text-xs ct-text-muted">
            Final docs available 2027 Q1
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled
            aria-disabled
            title="Download will be available 2027 Q1"
            data-testid="tax-download-btn"
          >
            Download (Available 2027 Q1)
          </Button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Convenience: open-state hook for external triggers
// ---------------------------------------------------------------------------

/**
 * Props for a standalone trigger that opens the drawer from outside.
 * Used by the surprise-delight-bar or portfolio nav.
 */
export interface TaxDocsDrawerButtonProps {
  userId: string;
  preview: TaxPreview;
  /** Optional extra className on the trigger button. */
  className?: string;
}

/**
 * Standalone trigger button that renders TaxDocsDrawer inline.
 * Drop this into the surprise-delight-bar or portfolio nav.
 */
export function TaxDocsDrawerButton({
  userId,
  preview,
  className,
}: TaxDocsDrawerButtonProps) {
  return (
    <div data-testid="tax-docs-drawer-button" className={className}>
      <TaxDocsDrawer userId={userId} preview={preview} />
    </div>
  );
}
