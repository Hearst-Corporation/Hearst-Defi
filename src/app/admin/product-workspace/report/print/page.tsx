/**
 * Construction report — print view.
 *
 * A clean, print-optimized HTML rendering of the admin's last persisted
 * construction report (from VaultDraft). The workspace's "Download PDF" button
 * opens this page; the admin uses the browser's Print → Save as PDF. This avoids
 * the @react-pdf/renderer Turbopack-dev limitation and works in every runtime.
 *
 * Read-only: it reads the stored report and renders it. No write, no action.
 */
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadConstructionReport } from "@/lib/product-workspace/construction-report-store";
import { Markdown } from "@/components/admin/markdown";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Construction report — print" };

function pct(n: number, d = 1): string {
  return `${(n * 100).toFixed(d)}%`;
}

/**
 * `StoredConstructionReport` coerces missing/corrupt numeric fields to `0`
 * defensively at the store layer (so a partial blob still loads) — that `0`
 * is indistinguishable from a real zero business value. Render "—" instead
 * of a fabricated zero for any field that is exactly 0, matching the
 * "—" no-data convention used across /admin (customers, vaults, outreach).
 */
function numOrDash(n: number, format: (n: number) => string): string {
  return n === 0 ? "—" : format(n);
}

export default async function ConstructionReportPrintPage() {
  const admin = await requireAdmin();
  const report = await loadConstructionReport(admin.userId);

  if (!report) {
    return (
      <main className="mx-auto max-w-3xl p-(--ct-space-10) text-[length:var(--ct-text-sm)] ct-text-muted">
        No construction report found. Run a construction in the Product Workspace
        first, then open this page to print it.
      </main>
    );
  }

  return (
    // Print/PDF surface (white paper) — ink colours are an intentional print
    // palette (analogous to src/lib/pdf/pdf-palette.ts); dark-mode --ct-* tokens
    // are invisible on white. Spacing + type are fully tokenized.
    <main className="report-print mx-auto max-w-3xl bg-white p-(--ct-space-10) text-[#11160f]">
      {/* Print affordance — hidden when printing. */}
      <div className="no-print mb-(--ct-space-6) flex flex-wrap items-center justify-between gap-(--ct-space-2)">
        <span className="text-[length:var(--ct-text-xs)] text-[#6b7363]">
          Construction report · read-only draft · not guaranteed
        </span>
        <PrintButton />
      </div>

      <header className="mb-(--ct-space-6)">
        <h1 className="text-[length:var(--ct-text-2xl)] font-bold">
          {report.vaultLabel || "—"}
        </h1>
        <p className="text-[length:var(--ct-text-sm)] text-[#3a3f36]">{report.objective}</p>
      </header>

      <section className="mb-(--ct-space-6)">
        <h2 className="mb-(--ct-space-2) border-b border-[#d8ddd2] pb-(--ct-space-1) text-[length:var(--ct-text-base)] font-bold">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-x-(--ct-space-8) gap-y-(--ct-space-1) text-[length:var(--ct-text-sm)] sm:grid-cols-4">
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Headline APY</dt>
            <dd className="mono font-bold">
              {report.headlineLow === 0 && report.headlineHigh === 0
                ? "—"
                : `${pct(report.headlineLow)}–${pct(report.headlineHigh)}`}
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Vault</dt>
            <dd className="mono font-bold">{report.vaultTicker || "—"}</dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">
              P(below floor)
            </dt>
            <dd className="mono font-bold">
              {numOrDash(report.probBelowFloorPct, (n) => `${n}%`)}
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Machines</dt>
            <dd className="mono font-bold">
              {numOrDash(report.machineCount, (n) => `${n}`)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-(--ct-space-6)">
        <h2 className="mb-(--ct-space-2) border-b border-[#d8ddd2] pb-(--ct-space-1) text-[length:var(--ct-text-base)] font-bold">
          Market inputs
        </h2>
        <dl className="grid grid-cols-2 gap-x-(--ct-space-8) gap-y-(--ct-space-1) text-[length:var(--ct-text-sm)] sm:grid-cols-3">
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">BTC spot</dt>
            <dd className="mono font-bold">
              {numOrDash(
                report.btcUsd,
                (n) => `$${Math.round(n).toLocaleString("en-US")}`,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Hashprice</dt>
            <dd className="mono font-bold">
              {numOrDash(report.hashpriceUsdPerThDay, (n) => `$${n.toFixed(3)}/TH`)}
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Seed</dt>
            <dd className="mono font-bold">{numOrDash(report.seed, (n) => `${n}`)}</dd>
          </div>
        </dl>
      </section>

      <section className="report-prose mb-(--ct-space-6)">
        <h2 className="mb-(--ct-space-2) border-b border-[#d8ddd2] pb-(--ct-space-1) text-[length:var(--ct-text-base)] font-bold">
          Write-up
        </h2>
        <Markdown content={report.prose} />
      </section>

      <footer className="mt-(--ct-space-10) border-t border-[#d8ddd2] pt-(--ct-space-3) text-[length:var(--ct-text-deci)] text-[#6b7363]">
        Hearst Connect · construction report · {report.updatedAtIso} · projection
        conditional on the stated assumptions — not guaranteed. No product is
        created, sent, or deployed by this report.
      </footer>
    </main>
  );
}
