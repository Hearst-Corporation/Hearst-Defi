// Admin · Audit log read surface.
// Server Component — gated by admin layout (session.role).
// Filterable via plain GET <form>; no client JS required.

import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { BentoPageShell, BentoPanel, BentoHeader, BentoLabel, BENTO_SECONDARY_BTN } from "@/components/ui/bento";
import { getAdminAuditLog } from "@/lib/admin/audit";
import { AdminTable } from "@/components/admin/admin-table-layout";
import { buildAuditKpiStrip } from "@/lib/admin/audit-kpi-strip";
import { cn } from "@/lib/cn";
import { truncateWallet } from "@/lib/wallet-display";
import { formatAdminAuditTimestamp } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit Log — Hearst Connect",
};

/** Destructive / high-attention actions get a colored dot; routine events stay muted. */
function actionIsAlert(action: string): boolean {
  return (
    action.includes("pause") ||
    action.includes("reject") ||
    action.includes("delete")
  );
}

function AuditActionLabel({ action }: { action: string }) {
  const alert = actionIsAlert(action);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          alert ? "bg-rose-400" : "bg-white/20",
        )}
      />
      <span
        className={cn(
          "truncate font-mono text-[12px]",
          alert ? "font-medium text-rose-300" : "text-zinc-500",
        )}
      >
        {action}
      </span>
    </span>
  );
}

function DiffBlock({ label, value, muted }: { label: string; value: unknown; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="ct-bento-label">{label}</p>
      <pre
        className={cn(
          "ct-bento-code-block",
          muted && "ct-bento-code-block--muted",
        )}
      >
        {value === null ? "null" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    entityType?: string;
    actor?: string;
    action?: string;
  }>;
}) {
  const { entityType, actor, action } = await searchParams;

  const entries = await getAdminAuditLog({
    entityType: entityType?.trim() || undefined,
    actorWallet: actor?.trim() || undefined,
    action: action?.trim() || undefined,
  });

  const hasFilters =
    Boolean(entityType?.trim()) ||
    Boolean(actor?.trim()) ||
    Boolean(action?.trim());

  const kpiStrip = buildAuditKpiStrip(entries);

  return (
    <BentoPageShell>
      <AdminPageHeader
        titleLead="Audit"
        titleAccent="Log"
        contextLabel="Compliance"
      />

      {kpiStrip.length > 0 && <AdminKpiStripPanel kpis={kpiStrip} />}

      {/* Filter bar — plain GET form, zero client JS */}
      <BentoPanel aria-label="Filters">
        <BentoHeader title="Filter audit log" />
        <form method="get" className="flex flex-wrap items-end gap-3 p-5">
          <fieldset className="contents">
            <legend className="sr-only">Filter audit log</legend>

            <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <BentoLabel>Entity type</BentoLabel>
              <input
                name="entityType"
                defaultValue={entityType ?? ""}
                placeholder="e.g. VaultDeployment"
                className="ct-bento-input"
              />
            </label>

            <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <BentoLabel>Actor wallet</BentoLabel>
              <input
                name="actor"
                defaultValue={actor ?? ""}
                placeholder="0x…"
                className="ct-bento-input font-mono"
              />
            </label>

            <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <BentoLabel>Action</BentoLabel>
              <input
                name="action"
                defaultValue={action ?? ""}
                placeholder="e.g. vault.approve"
                className="ct-bento-input"
              />
            </label>

              <button type="submit" className={BENTO_SECONDARY_BTN}>
                Filter
              </button>

              {hasFilters && (
                <Link
                  href="/admin/audit"
                  className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors hover:text-white"
                >
                  Clear
                </Link>
              )}
            </fieldset>
          </form>
        </BentoPanel>

        {/* Results */}
        <section className="flex flex-col gap-4" aria-label="Audit entries">
          <h2 className="text-[13px] font-semibold tracking-tight text-white">
            {hasFilters ? "Filtered results" : "Recent events"}{" "}
            <span className="text-zinc-500 tabular-nums">({entries.length})</span>
          </h2>

          {entries.length === 0 ? (
            <BentoPanel className="items-center justify-center px-5 py-12 text-center">
              <p className="text-[13px] text-zinc-400">
                {hasFilters
                  ? "No admin activity matches the current filter."
                  : "No admin activity recorded yet."}
              </p>
              {hasFilters ? (
                <p className="mt-1.5 max-w-sm text-[12px] text-zinc-600">
                  Adjust the criteria above or clear all filters to see the full
                  log.
                </p>
              ) : null}
            </BentoPanel>
          ) : (
            <AdminTable
              data={entries}
              headers={[
                "When",
                "Actor",
                "Action",
                <span key="entity" className="hidden lg:inline">Entity</span>,
                "Details",
              ]}
              colWidths={[
                "w-[18%]",
                "w-[18%]",
                "w-[18%]",
                "hidden w-[18%] lg:table-cell",
                "w-[46%] lg:w-[28%]",
              ]}
              renderRow={(entry) => (
                <>
                  {/* When */}
                  <td className="px-5 py-3 align-top font-mono text-[12px] text-zinc-500">
                    {formatAdminAuditTimestamp(entry.occurredAt)}
                  </td>

                  {/* Actor */}
                  <td className="px-5 py-3 align-top">
                    <div className="flex flex-col gap-1">
                      <span
                        className="font-mono text-[12px] text-zinc-300"
                        title={entry.actorWallet}
                      >
                        {truncateWallet(entry.actorWallet)}
                      </span>
                      {entry.ip ? (
                        <span className="text-[12px] text-zinc-500">{entry.ip}</span>
                      ) : null}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-5 py-3 align-top">
                    <AuditActionLabel action={entry.action} />
                  </td>

                  {/* Entity */}
                  <td className="hidden px-5 py-3 align-top lg:table-cell">
                    <div className="flex flex-col gap-1">
                      <span className="text-[12px] font-medium text-white">
                        {entry.entityType}
                      </span>
                      <span className="font-mono text-[12px] text-zinc-500">
                        {entry.entityId}
                      </span>
                    </div>
                  </td>

                  {/* Details — before/after diff in a native <details> */}
                  <td className="px-5 py-3 align-top">
                    <details className="group flex flex-col gap-1.5">
                      <summary className="cursor-pointer select-none list-none text-[12px] text-zinc-500 hover:text-zinc-300">
                        <span className="group-open:hidden">Show diff</span>
                        <span className="hidden group-open:inline">
                          Hide diff
                        </span>
                      </summary>
                      <DiffBlock label="Before" value={entry.before} muted />
                      <DiffBlock label="After" value={entry.after} />
                      {entry.userAgent ? (
                        <p className="truncate text-[12px] text-zinc-500">
                          UA: {entry.userAgent}
                        </p>
                      ) : null}
                    </details>
                  </td>
                </>
              )}
            />
          )}

          <div className="flex flex-col gap-1 border-t p-4 ct-bento-divider">
            <p className="ct-bento-label">Audit retention</p>
            <p className="text-[12px] ct-text-muted">
              Showing up to 200 entries per query. Entries written by{" "}
              <code className="font-mono text-zinc-300">recordAdminAudit()</code>{" "}
              are append-only; export directly from the database for formal
              compliance reporting.
            </p>
          </div>
        </section>
    </BentoPageShell>
  );
}
