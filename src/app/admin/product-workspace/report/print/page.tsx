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

export default async function ConstructionReportPrintPage() {
  const admin = await requireAdmin();
  const report = await loadConstructionReport(admin.userId);

  if (!report) {
    return (
      <main className="mx-auto max-w-3xl p-10 text-sm text-[var(--ct-text-muted)]">
        No construction report found. Run a construction in the Product Workspace
        first, then open this page to print it.
      </main>
    );
  }

  return (
    <main className="report-print mx-auto max-w-3xl bg-white p-10 text-[#11160f]">
      {/* Print affordance — hidden when printing. */}
      <div className="no-print mb-6 flex items-center justify-between">
        <span className="text-xs text-[#6b7363]">
          Construction report · read-only draft · not guaranteed
        </span>
        <PrintButton />
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">{report.vaultLabel}</h1>
        <p className="text-sm text-[#3a3f36]">{report.objective}</p>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 border-b border-[#d8ddd2] pb-1 text-base font-bold">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Headline APY</dt>
            <dd className="font-mono font-bold">
              {pct(report.headlineLow)}–{pct(report.headlineHigh)}
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Vault</dt>
            <dd className="font-mono font-bold">{report.vaultTicker}</dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">
              P(below floor)
            </dt>
            <dd className="font-mono font-bold">{report.probBelowFloorPct}%</dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Machines</dt>
            <dd className="font-mono font-bold">{report.machineCount}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 border-b border-[#d8ddd2] pb-1 text-base font-bold">
          Market inputs
        </h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">BTC spot</dt>
            <dd className="font-mono font-bold">
              ${Math.round(report.btcUsd).toLocaleString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Hashprice</dt>
            <dd className="font-mono font-bold">
              ${report.hashpriceUsdPerThDay.toFixed(3)}/TH
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--ct-text-deci)] uppercase text-[#6b7363]">Seed</dt>
            <dd className="font-mono font-bold">{report.seed}</dd>
          </div>
        </dl>
      </section>

      <section className="report-prose mb-6">
        <h2 className="mb-2 border-b border-[#d8ddd2] pb-1 text-base font-bold">
          Write-up
        </h2>
        <Markdown content={report.prose} />
      </section>

      <footer className="mt-10 border-t border-[#d8ddd2] pt-3 text-[length:var(--ct-text-deci)] text-[#6b7363]">
        Hearst Connect · construction report · {report.updatedAtIso} · projection
        conditional on the stated assumptions — not guaranteed. No product is
        created, sent, or deployed by this report.
      </footer>
    </main>
  );
}
