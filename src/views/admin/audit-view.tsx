import Link from "next/link";

import type { AdminAuditEntry } from "@/lib/admin/audit";
import { buildAuditKpiStrip } from "@/lib/admin/audit-kpi-strip";
import { cn } from "@/lib/cn";
import { truncateWallet } from "@/lib/wallet-display";
import { formatAdminAuditTimestamp } from "@/lib/vaults/product-display";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Kpi,
  KpiGrid,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

function actionIsAlert(action: string): boolean {
  return (
    action.includes("pause") ||
    action.includes("reject") ||
    action.includes("delete")
  );
}

function AuditActionLabel({ action }: { action: string }) {
  return (
    <Badge variant={actionIsAlert(action) ? "danger" : "outline"}>
      <span className="font-mono text-xs">{action}</span>
    </Badge>
  );
}

function DiffBlock({
  label,
  value,
  muted,
}: {
  label: string;
  value: unknown;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
        {label}
      </p>
      <pre
        className={cn(
          "overflow-x-auto rounded-lg border border-border-subtle p-3 font-mono text-xs leading-relaxed",
          muted ? "bg-surface-inset text-muted" : "bg-surface-raised text-foreground",
        )}
      >
        {value === null ? "null" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AdminAuditView({
  entries,
  filters,
}: {
  entries: AdminAuditEntry[];
  filters: {
    entityType?: string;
    actor?: string;
    action?: string;
  };
}) {
  const { entityType, actor, action } = filters;
  const hasFilters = Boolean(
    entityType?.trim() || actor?.trim() || action?.trim(),
  );
  const kpiStrip = buildAuditKpiStrip(entries);

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description="Append-only admin activity — filter by entity, actor, or action."
      />

      <Section title="Filter audit log">
        <Panel>
          <form method="get" className="flex flex-wrap items-end gap-3 p-5">
            <fieldset className="contents">
              <legend className="sr-only">Filter audit log</legend>

              <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
                <Label htmlFor="audit-entity">Entity type</Label>
                <Input
                  id="audit-entity"
                  name="entityType"
                  defaultValue={entityType ?? ""}
                  placeholder="e.g. VaultDeployment"
                />
              </div>

              <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
                <Label htmlFor="audit-actor">Actor wallet</Label>
                <Input
                  id="audit-actor"
                  name="actor"
                  defaultValue={actor ?? ""}
                  placeholder="0x…"
                  className="font-mono"
                />
              </div>

              <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
                <Label htmlFor="audit-action">Action</Label>
                <Input
                  id="audit-action"
                  name="action"
                  defaultValue={action ?? ""}
                  placeholder="e.g. vault.approve"
                />
              </div>

              <Button type="submit" variant="secondary">
                Filter
              </Button>

              {hasFilters ? (
                <Link href="/admin/audit">
                  <Button type="button" variant="ghost">
                    Clear
                  </Button>
                </Link>
              ) : null}
            </fieldset>
          </form>
        </Panel>
      </Section>

      {kpiStrip.length > 0 ? (
        <KpiGrid>
          {kpiStrip.map((kpi) => (
            <Panel key={kpi.label}>
              <div className="p-5">
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance="manual"
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section
        title={hasFilters ? "Filtered results" : "Recent events"}
        description={
          hasFilters
            ? "Entries matching the current filter"
            : "Latest admin activity (up to 200 per query)"
        }
      >
        <Panel
          title={`${entries.length} ${entries.length === 1 ? "event" : "events"}`}
        >
          {entries.length === 0 ? (
            <EmptyState
              title={
                hasFilters
                  ? "No admin activity matches the current filter"
                  : "No admin activity recorded yet"
              }
              description={
                hasFilters
                  ? "Adjust the criteria above or clear all filters."
                  : "Admin actions are written append-only by recordAdminAudit()."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden lg:table-cell">Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="align-top font-mono text-xs text-muted">
                      {formatAdminAuditTimestamp(entry.occurredAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className="font-mono text-xs text-foreground"
                          title={entry.actorWallet}
                        >
                          {truncateWallet(entry.actorWallet)}
                        </span>
                        {entry.ip ? (
                          <span className="text-xs text-muted">{entry.ip}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <AuditActionLabel action={entry.action} />
                    </TableCell>
                    <TableCell className="hidden align-top lg:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">
                          {entry.entityType}
                        </span>
                        <span className="font-mono text-xs text-muted">
                          {entry.entityId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      <details className="group flex flex-col gap-1.5">
                        <summary className="cursor-pointer select-none text-xs text-muted hover:text-foreground">
                          <span className="group-open:hidden">Show diff</span>
                          <span className="hidden group-open:inline">
                            Hide diff
                          </span>
                        </summary>
                        <DiffBlock label="Before" value={entry.before} muted />
                        <DiffBlock label="After" value={entry.after} />
                        {entry.userAgent ? (
                          <p
                            className="truncate text-xs text-faint"
                            title={entry.userAgent}
                          >
                            UA: {entry.userAgent}
                          </p>
                        ) : null}
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="border-t border-border-subtle p-5 text-xs leading-relaxed text-muted">
            <p className="font-semibold uppercase tracking-[0.14em] text-subtle">
              Audit retention
            </p>
            <p className="mt-1">
              Showing up to 200 entries per query. Entries written by{" "}
              <code className="font-mono text-foreground">
                recordAdminAudit()
              </code>{" "}
              are append-only — export directly from the database for formal
              compliance reporting.
            </p>
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
