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
      className="flex flex-wrap items-center gap-3 rounded-(--ct-radius-xl) border border-white/10 bg-white/5 backdrop-blur-xl px-5 py-3 relative overflow-hidden group"
    >
      {/* Ambient subtle glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-(--ct-accent)/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <span className="body-xs font-semibold uppercase tracking-(--ct-tracking-wide) text-(--ct-text-muted) mr-auto relative z-10">
        Quick Actions
      </span>

      <div className="flex items-center gap-3 relative z-10">
        {/* Export PDF statement */}
        {pdfHref ? (
          <a
            href={pdfHref}
            download
            className="body-xs flex items-center gap-1.5 rounded-(--ct-radius-md) border border-white/10 bg-white/5 px-3 py-1.5 text-(--ct-text-body) transition-all hover:bg-white/10 hover:border-(--ct-accent)/50 hover:text-(--ct-text-strong)"
            aria-label="Export PDF statement"
          >
            <span aria-hidden className="text-(--ct-accent)">↓</span> Export PDF statement
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="body-xs flex cursor-not-allowed items-center gap-1.5 rounded-(--ct-radius-md) border border-white/5 bg-white/5 px-3 py-1.5 text-(--ct-text-faint) opacity-50"
          >
            <span aria-hidden>↓</span> Export PDF statement
          </button>
        )}

        {/* Preview 1099 / CRS */}
        {investorId && taxPreview ? (
          <TaxDocsDrawerButton
            userId={investorId}
            preview={taxPreview}
            className="body-xs rounded-(--ct-radius-md) border border-white/10 bg-white/5 px-3 py-1.5 text-(--ct-text-body) transition-all hover:bg-white/10 hover:border-(--ct-accent)/50 hover:text-(--ct-text-strong)"
          />
        ) : (
          <button
            type="button"
            disabled
            className="body-xs flex cursor-not-allowed items-center gap-1.5 rounded-(--ct-radius-md) border border-white/5 bg-white/5 px-3 py-1.5 text-(--ct-text-faint) opacity-50"
          >
            <span aria-hidden>📄</span> Preview 1099 / CRS
          </button>
        )}

        {/* LP → LP secondary (V2 badge) */}
        <span
          className="body-xs flex items-center gap-1.5 rounded-(--ct-radius-md) border border-dashed border-white/10 px-3 py-1.5 text-(--ct-text-faint) opacity-60"
          title="Available in V2"
        >
          LP→LP secondary{" "}
          <span className="inline-block rounded-(--ct-radius-sm) bg-(--ct-accent)/10 px-1 py-0.5 font-bold uppercase tracking-wide text-(--ct-accent) text-micro">
            V2
          </span>
        </span>
      </div>
    </div>
  );
}
