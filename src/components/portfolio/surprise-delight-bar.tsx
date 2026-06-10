import { TaxDocsDrawerButton } from "@/components/portfolio/tax-docs-drawer";
import type { TaxPreview } from "@/lib/portfolio/tax";

interface SurpriseDelightBarProps {
  /** Investor DB id — used to build the /api/statements/[id]/pdf URL. */
  investorId: string | null;
  /** Tax preview backed by real YTD distributions; null when no investor. */
  taxPreview: TaxPreview | null;
}

export function SurpriseDelightBar({ investorId, taxPreview }: SurpriseDelightBarProps) {
  const pdfHref = investorId
    ? `/api/statements/${investorId}/pdf`
    : null;

  return (
    <div
      data-testid="surprise-delight-bar"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--ct-border-soft)] ct-surface-1 backdrop-blur-xl px-5 py-3 relative overflow-hidden group"
    >
      {/* Ambient subtle glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-[color-mix(in_srgb,var(--ct-accent)_5%,transparent)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <span className="body-xs font-semibold uppercase tracking-[var(--ct-tracking-wide)] ct-text-muted mr-auto relative z-10">
        Quick Actions
      </span>

      <div className="flex items-center gap-3 relative z-10">
        {/* Export PDF statement */}
        {pdfHref ? (
          <a
            href={pdfHref}
            download
            className="body-xs flex items-center gap-1.5 rounded-md border border-[var(--ct-border-soft)] ct-surface-1 px-3 py-1.5 ct-text-body transition-all hover:ct-surface-2 hover:border-[var(--ct-border-accent)] hover:ct-text-strong"
            aria-label="Export PDF statement"
          >
            <span aria-hidden className="ct-text-accent">↓</span> Export PDF statement
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="body-xs flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[var(--ct-border-soft)] ct-surface-1 px-3 py-1.5 ct-text-faint opacity-50"
          >
            <span aria-hidden>↓</span> Export PDF statement
          </button>
        )}

        {/* Preview 1099 / CRS */}
        {investorId && taxPreview ? (
          <TaxDocsDrawerButton
            userId={investorId}
            preview={taxPreview}
            className="body-xs rounded-md border border-[var(--ct-border-soft)] ct-surface-1 px-3 py-1.5 ct-text-body transition-all hover:ct-surface-2 hover:border-[var(--ct-border-accent)] hover:ct-text-strong"
          />
        ) : (
          <button
            type="button"
            disabled
            className="body-xs flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[var(--ct-border-soft)] ct-surface-1 px-3 py-1.5 ct-text-faint opacity-50"
          >
            <span aria-hidden>📄</span> Preview 1099 / CRS
          </button>
        )}

        {/* LP → LP secondary (V2 badge) */}
        <span
          className="body-xs flex items-center gap-1.5 rounded-md border border-dashed border-[var(--ct-border-soft)] px-3 py-1.5 ct-text-faint opacity-60"
          title="Available in V2"
        >
          LP→LP secondary{" "}
          <span className="inline-block rounded-sm bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] px-1 py-0.5 font-bold uppercase tracking-wide ct-text-accent text-micro">
            V2
          </span>
        </span>
      </div>
    </div>
  );
}
