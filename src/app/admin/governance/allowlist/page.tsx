/**
 * /admin/governance/allowlist — Manage the address allowlist used for
 * Anchorage-style quorum routing decisions.
 *
 * Each entry represents a known-trusted address (custody vault, mining
 * counterparty, etc.) that qualifies for the fast 2/3-sig / 0h-timelock path.
 * All entries outside this list are routed through the medium or sensitive paths.
 *
 * UI features:
 *   - Table of all entries with label, address, category badge, risk score, active toggle
 *   - Add new entry form
 *   - Edit label / notes / riskScore inline (separate form per row)
 *   - Deactivate / reactivate toggle (aria-pressed button)
 */

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getAllAllowlistEntries,
  addAllowlistEntry,
  updateAllowlistEntry,
  type AllowlistCategory,
} from "@/lib/governance/allowlist";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Category token mapping
// ---------------------------------------------------------------------------

const CATEGORY_VARIANT: Record<
  AllowlistCategory,
  "success" | "accent" | "warning" | "default"
> = {
  custody: "success",    // var(--ct-status-success)
  counterparty: "accent", // var(--ct-accent)
  operations: "warning",  // var(--ct-warning)
  internal: "default",    // var(--ct-info) — default soft
};

const CATEGORY_LABELS: Record<AllowlistCategory, string> = {
  custody: "Custody",
  counterparty: "Counterparty",
  operations: "Operations",
  internal: "Internal",
};

const ALL_CATEGORIES: AllowlistCategory[] = [
  "custody",
  "counterparty",
  "operations",
  "internal",
];

// ---------------------------------------------------------------------------
// Risk score badge color helper
// ---------------------------------------------------------------------------

function riskVariant(score: number): "success" | "warning" | "danger" {
  if (score <= 25) return "success";
  if (score <= 60) return "warning";
  return "danger";
}

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

async function handleAdd(formData: FormData) {
  "use server";

  const address = (formData.get("address") as string).trim();
  const label = (formData.get("label") as string).trim();
  const category = formData.get("category") as AllowlistCategory;
  const notes = (formData.get("notes") as string | null)?.trim() || undefined;
  const riskScoreRaw = formData.get("riskScore") as string;
  const riskScore = riskScoreRaw ? parseInt(riskScoreRaw, 10) : 0;

  await addAllowlistEntry({ address, label, category, notes, riskScore });
}

async function handleUpdate(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const label = (formData.get("label") as string | null)?.trim();
  const notes = (formData.get("notes") as string | null)?.trim() || undefined;
  const riskScoreRaw = formData.get("riskScore") as string | null;
  const riskScore = riskScoreRaw ? parseInt(riskScoreRaw, 10) : undefined;

  await updateAllowlistEntry({ id, ...(label ? { label } : {}), notes, riskScore });
}

async function handleToggleActive(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  const currentActive = formData.get("active") === "true";

  await updateAllowlistEntry({ id, active: !currentActive });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AllowlistPage() {
  await requireAdmin();

  const entries = await getAllAllowlistEntries();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Address Allowlist"
        lead={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/governance">← Governance</Link>
          </Button>
        }
      />

      {/* Context banner */}
      <Card>
        <div className="space-y-1">
          <p className="body-sm ct-text-strong font-semibold">Anchorage quorum routing</p>
          <p className="body-sm ct-text-muted">
            Addresses on this list use the <span className="ct-text-primary font-semibold">fast path</span> (2/3 sigs · 0h timelock · no board notification).
            Unknown addresses route through the <span className="ct-text-primary font-semibold">medium path</span> (&lt;$100k → 3/5 · 12h) or{" "}
            <span className="ct-text-primary font-semibold">sensitive path</span> (≥$100k → 4/5 · 24h · board).{" "}
            Emergency shutdowns always require 5/5 regardless of allowlist.
          </p>
        </div>
      </Card>

      {/* ── Add new entry form ─────────────────────────────────────────────── */}
      <section aria-labelledby="allowlist-add-heading">
        <h2 id="allowlist-add-heading" className="h2 mb-3">
          Add entry
        </h2>
        <Card>
          <form action={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Address */}
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="add-address"
                  className="stat-label block"
                >
                  Address (0x…) *
                </label>
                <input
                  id="add-address"
                  name="address"
                  type="text"
                  required
                  pattern="0x[0-9a-fA-F]{40}"
                  placeholder="0xABCDEF…"
                  className="w-full rounded-md border border-[var(--ct-border)] ct-surface-1 px-3 py-2 text-sm ct-text-strong mono placeholder:ct-text-muted focus:outline-none focus:border-[var(--ct-border-strong)] focus:ring-1 focus:ring-[var(--ct-accent)]"
                />
              </div>

              {/* Label */}
              <div className="space-y-1.5">
                <label
                  htmlFor="add-label"
                  className="stat-label block"
                >
                  Label *
                </label>
                <input
                  id="add-label"
                  name="label"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Coinbase Custody Vault"
                  className="w-full rounded-md border border-[var(--ct-border)] ct-surface-1 px-3 py-2 text-sm ct-text-strong placeholder:ct-text-muted focus:outline-none focus:border-[var(--ct-border-strong)] focus:ring-1 focus:ring-[var(--ct-accent)]"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label
                  htmlFor="add-category"
                  className="stat-label block"
                >
                  Category *
                </label>
                <select
                  id="add-category"
                  name="category"
                  required
                  className="w-full rounded-md border border-[var(--ct-border)] ct-surface-1 px-3 py-2 text-sm ct-text-strong focus:outline-none focus:border-[var(--ct-border-strong)] focus:ring-1 focus:ring-[var(--ct-accent)]"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Risk score */}
              <div className="space-y-1.5">
                <label
                  htmlFor="add-riskScore"
                  className="stat-label block"
                >
                  Risk score (0–100)
                </label>
                <input
                  id="add-riskScore"
                  name="riskScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={0}
                  className="w-full rounded-md border border-[var(--ct-border)] ct-surface-1 px-3 py-2 text-sm ct-text-strong placeholder:ct-text-muted focus:outline-none focus:border-[var(--ct-border-strong)] focus:ring-1 focus:ring-[var(--ct-accent)]"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="add-notes"
                  className="stat-label block"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="add-notes"
                  name="notes"
                  rows={2}
                  maxLength={500}
                  placeholder="Context for this entry…"
                  className="w-full rounded-md border border-[var(--ct-border)] ct-surface-1 px-3 py-2 text-sm ct-text-strong placeholder:ct-text-muted focus:outline-none focus:border-[var(--ct-border-strong)] focus:ring-1 focus:ring-[var(--ct-accent)] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="md">
                Add to allowlist
              </Button>
            </div>
          </form>
        </Card>
      </section>

      {/* ── Allowlist table ────────────────────────────────────────────────── */}
      <section aria-labelledby="allowlist-table-heading">
        <h2 id="allowlist-table-heading" className="h2 mb-3">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </h2>

        {entries.length === 0 ? (
          <Card>
            <p className="body-md ct-text-muted text-center py-8">
              No addresses on the allowlist yet. Add the first one above.
            </p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--ct-border)]">
            <table className="w-full text-sm" aria-label="Address allowlist">
              <thead>
                <tr className="border-b border-[var(--ct-border)] ct-surface-1">
                  <th
                    scope="col"
                    className="stat-label px-4 py-3 text-left"
                  >
                    Label / Address
                  </th>
                  <th
                    scope="col"
                    className="stat-label px-4 py-3 text-left"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="stat-label px-4 py-3 text-left"
                  >
                    Risk score
                  </th>
                  <th
                    scope="col"
                    className="stat-label px-4 py-3 text-left"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="stat-label px-4 py-3 text-left"
                  >
                    Edit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ct-border)]">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={
                      entry.active
                        ? "bg-[var(--ct-bg-deep)] hover:ct-surface-1 transition-colors"
                        : "ct-surface-1 opacity-50 hover:opacity-70 transition-opacity"
                    }
                  >
                    {/* Label + address */}
                    <td className="px-4 py-3">
                      <p className="ct-text-strong font-semibold text-sm">{entry.label}</p>
                      <p className="mono text-xs ct-text-muted mt-0.5 break-all">
                        {entry.address}
                      </p>
                      {entry.notes && (
                        <p className="text-xs ct-text-muted mt-1 italic">{entry.notes}</p>
                      )}
                    </td>

                    {/* Category badge */}
                    <td className="px-4 py-3">
                      <Badge variant={CATEGORY_VARIANT[entry.category]}>
                        {CATEGORY_LABELS[entry.category]}
                      </Badge>
                    </td>

                    {/* Risk score badge */}
                    <td className="px-4 py-3">
                      <Badge variant={riskVariant(entry.riskScore)}>
                        {entry.riskScore}
                      </Badge>
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-3">
                      <form action={handleToggleActive}>
                        <input type="hidden" name="id" value={entry.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={entry.active ? "true" : "false"}
                        />
                        <button
                          type="submit"
                          aria-pressed={entry.active}
                          aria-label={
                            entry.active
                              ? `Deactivate ${entry.label}`
                              : `Reactivate ${entry.label}`
                          }
                          className={
                            entry.active
                              ? "ct-pill text-xs font-semibold cursor-pointer hover:border-[var(--ct-status-danger-border)] hover:ct-status-danger transition-colors"
                              : "ct-pill text-xs font-semibold cursor-pointer hover:border-[var(--ct-status-success-border)] hover:ct-status-success transition-colors"
                          }
                        >
                          {entry.active ? "Active" : "Inactive"}
                        </button>
                      </form>
                    </td>

                    {/* Inline edit form */}
                    <td className="px-4 py-3">
                      <details className="group">
                        <summary className="cursor-pointer text-xs ct-text-muted hover:ct-text-primary list-none select-none">
                          <span className="group-open:hidden">Edit ▾</span>
                          <span className="hidden group-open:inline">Close ▴</span>
                        </summary>
                        <form action={handleUpdate} className="mt-3 space-y-2 min-w-64">
                          <input type="hidden" name="id" value={entry.id} />

                          <div className="space-y-1">
                            <label
                              htmlFor={`edit-label-${entry.id}`}
                              className="stat-label block"
                            >
                              Label
                            </label>
                            <input
                              id={`edit-label-${entry.id}`}
                              name="label"
                              type="text"
                              defaultValue={entry.label}
                              maxLength={200}
                              className="w-full rounded-md border border-[var(--ct-border)] ct-surface-1 px-2 py-1 text-xs ct-text-strong focus:outline-none focus:border-[var(--ct-border-strong)]"
                            />
                          </div>

                          <div className="space-y-1">
                            <label
                              htmlFor={`edit-risk-${entry.id}`}
                              className="stat-label block"
                            >
                              Risk score
                            </label>
                            <input
                              id={`edit-risk-${entry.id}`}
                              name="riskScore"
                              type="number"
                              min={0}
                              max={100}
                              defaultValue={entry.riskScore}
                              className="w-full rounded-md border border-[var(--ct-border)] ct-surface-1 px-2 py-1 text-xs ct-text-strong focus:outline-none focus:border-[var(--ct-border-strong)]"
                            />
                          </div>

                          <div className="space-y-1">
                            <label
                              htmlFor={`edit-notes-${entry.id}`}
                              className="stat-label block"
                            >
                              Notes
                            </label>
                            <textarea
                              id={`edit-notes-${entry.id}`}
                              name="notes"
                              rows={2}
                              maxLength={500}
                              defaultValue={entry.notes ?? ""}
                              className="w-full rounded-md border border-[var(--ct-border)] ct-surface-1 px-2 py-1 text-xs ct-text-strong focus:outline-none focus:border-[var(--ct-border-strong)] resize-none"
                            />
                          </div>

                          <Button type="submit" variant="secondary" size="md">
                            Save
                          </Button>
                        </form>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
