import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import {
  addAllowlistEntryAction,
  toggleAllowlistEntryAction,
  updateAllowlistEntryAction,
} from "@/app/admin/governance/allowlist/actions";
import type { AllowlistCategory } from "@/lib/governance/allowlist";
import { adminFormField, adminFormFieldCompact } from "@/lib/ui/form-classes";
import { cn } from "@/lib/cn";

export interface AllowlistEntryRow {
  id: string;
  label: string;
  address: string;
  category: AllowlistCategory;
  riskScore: number;
  active: boolean;
  notes: string | null;
}

const CATEGORY_VARIANT: Record<
  AllowlistCategory,
  "success" | "accent" | "warning" | "default"
> = {
  custody: "success",
  counterparty: "accent",
  operations: "warning",
  internal: "default",
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

function riskVariant(score: number): "success" | "warning" | "danger" {
  if (score <= 25) return "success";
  if (score <= 60) return "warning";
  return "danger";
}

export function AllowlistBoard({ entries }: { entries: AllowlistEntryRow[] }) {
  return (
    <>
      <Card>
        <DashboardPanelHeader title="Anchorage quorum routing" tone="quiet" titleLevel="section" className="gov-section-header" />
        <p className="body-sm ct-text-muted">
          Addresses on this list use the <span className="font-semibold ct-text-primary">fast path</span> (2/3 sigs · 0h timelock · no board notification).
          Unknown addresses route through the <span className="font-semibold ct-text-primary">medium path</span> (&lt;$100k → 3/5 · 12h) or{" "}
          <span className="font-semibold ct-text-primary">sensitive path</span> (≥$100k → 4/5 · 24h · board).
          Emergency shutdowns always require 5/5 regardless of allowlist.
        </p>
      </Card>

      <section aria-labelledby="allowlist-add-heading">
        <Card>
          <h2 id="allowlist-add-heading" className="sr-only">
            Add entry
          </h2>
          <DashboardPanelHeader title="Add entry" tone="quiet" titleLevel="section" className="gov-section-header" />
          <form action={addAllowlistEntryAction} className="admin-doc-stack admin-doc-stack--relaxed">
            <div className="admin-doc-form-grid-2">
              <div className="admin-doc-stack admin-doc-stack--dense sm:col-span-2">
                <label htmlFor="add-address" className="stat-label block">
                  Address (0x…) *
                </label>
                <input
                  id="add-address"
                  name="address"
                  type="text"
                  required
                  pattern="0x[0-9a-fA-F]{40}"
                  placeholder="0xABCDEF…"
                  className={cn(adminFormField, "mono")}
                />
              </div>
              <div className="admin-doc-stack admin-doc-stack--dense">
                <label htmlFor="add-label" className="stat-label block">
                  Label *
                </label>
                <input
                  id="add-label"
                  name="label"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Coinbase Custody Vault"
                  className={adminFormField}
                />
              </div>
              <div className="admin-doc-stack admin-doc-stack--dense">
                <label htmlFor="add-category" className="stat-label block">
                  Category *
                </label>
                <select id="add-category" name="category" required className={adminFormField}>
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-doc-stack admin-doc-stack--dense">
                <label htmlFor="add-riskScore" className="stat-label block">
                  Risk score (0–100)
                </label>
                <input
                  id="add-riskScore"
                  name="riskScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={0}
                  className={adminFormField}
                />
              </div>
              <div className="admin-doc-stack admin-doc-stack--dense sm:col-span-2">
                <label htmlFor="add-notes" className="stat-label block">
                  Notes (optional)
                </label>
                <textarea
                  id="add-notes"
                  name="notes"
                  rows={2}
                  maxLength={500}
                  placeholder="Context for this entry…"
                  className={cn(adminFormField, "resize-none")}
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

      <section aria-labelledby="allowlist-table-heading">
        {entries.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No addresses on the allowlist yet."
            detail="Add the first trusted address using the form above."
            className="min-h-32"
          />
        ) : (
          <>
            <h2 id="allowlist-table-heading" className="sr-only">
              Allowlist entries
            </h2>
            <Card className="overflow-hidden" hoverOverlay={false}>
              <DashboardPanelHeader
                title={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
                tone="quiet"
                titleLevel="section"
                className="gov-section-header"
              />
              <div className="gov-allowlist-table-scroll overflow-x-auto">
                <table className="min-w-184 w-full table-fixed body-sm" aria-label="Address allowlist">
                  <thead>
                    <tr className="gov-allowlist-thead-row">
                      <th scope="col" className="w-[38%] stat-label ct-table-header text-left">Label / Address</th>
                      <th scope="col" className="hidden w-[18%] stat-label ct-table-header text-left md:table-cell">Category</th>
                      <th scope="col" className="hidden w-[14%] stat-label ct-table-header text-left lg:table-cell">Risk score</th>
                      <th scope="col" className="w-[22%] stat-label ct-table-header text-left">Status</th>
                      <th scope="col" className="w-[40%] stat-label ct-table-header text-left md:w-[22%] lg:w-[8%]">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="gov-allowlist-tbody">
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={cn(
                          entry.active ? "ct-text-body" : "gov-allowlist-row--inactive",
                        )}
                      >
                        <td className="ct-table-cell">
                          <p className="body-sm ct-text-strong">{entry.label}</p>
                          <p className="gov-allowlist-address mono break-all body-xs ct-text-muted">{entry.address}</p>
                          {entry.notes ? (
                            <p className="gov-allowlist-notes body-xs italic ct-text-muted">{entry.notes}</p>
                          ) : null}
                        </td>
                        <td className="hidden ct-table-cell md:table-cell">
                          <Badge variant={CATEGORY_VARIANT[entry.category]}>
                            {CATEGORY_LABELS[entry.category]}
                          </Badge>
                        </td>
                        <td className="hidden ct-table-cell lg:table-cell">
                          <Badge variant={riskVariant(entry.riskScore)}>{entry.riskScore}</Badge>
                        </td>
                        <td className="ct-table-cell">
                          <form action={toggleAllowlistEntryAction}>
                            <input type="hidden" name="id" value={entry.id} />
                            <input type="hidden" name="active" value={entry.active ? "true" : "false"} />
                            <button
                              type="submit"
                              aria-pressed={entry.active}
                              aria-label={
                                entry.active
                                  ? `Deactivate ${entry.label}`
                                  : `Reactivate ${entry.label}`
                              }
                              className={cn(
                                "ct-pill gov-allowlist-toggle cursor-pointer body-xs font-semibold transition-colors",
                                entry.active
                                  ? "gov-allowlist-toggle--active"
                                  : "gov-allowlist-toggle--inactive",
                              )}
                            >
                              {entry.active ? "Active" : "Inactive"}
                            </button>
                          </form>
                        </td>
                        <td className="ct-table-cell">
                          <details className="group">
                            <summary className="gov-allowlist-edit-summary cursor-pointer list-none body-xs ct-text-muted select-none">
                              <span className="group-open:hidden">Edit ▾</span>
                              <span className="hidden group-open:inline">Close ▴</span>
                            </summary>
                            <form action={updateAllowlistEntryAction} className="gov-allowlist-edit-form admin-doc-stack admin-doc-stack--tight">
                              <input type="hidden" name="id" value={entry.id} />
                              <div className="admin-doc-stack admin-doc-stack--compact">
                                <label htmlFor={`edit-label-${entry.id}`} className="stat-label block">
                                  Label
                                </label>
                                <input
                                  id={`edit-label-${entry.id}`}
                                  name="label"
                                  type="text"
                                  defaultValue={entry.label}
                                  maxLength={200}
                                  className={adminFormFieldCompact}
                                />
                              </div>
                              <div className="admin-doc-stack admin-doc-stack--compact">
                                <label htmlFor={`edit-risk-${entry.id}`} className="stat-label block">
                                  Risk score
                                </label>
                                <input
                                  id={`edit-risk-${entry.id}`}
                                  name="riskScore"
                                  type="number"
                                  min={0}
                                  max={100}
                                  defaultValue={entry.riskScore}
                                  className={adminFormFieldCompact}
                                />
                              </div>
                              <div className="admin-doc-stack admin-doc-stack--compact">
                                <label htmlFor={`edit-notes-${entry.id}`} className="stat-label block">
                                  Notes
                                </label>
                                <textarea
                                  id={`edit-notes-${entry.id}`}
                                  name="notes"
                                  rows={2}
                                  maxLength={500}
                                  defaultValue={entry.notes ?? ""}
                                  className={cn(adminFormFieldCompact, "resize-none")}
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
            </Card>
          </>
        )}
      </section>
    </>
  );
}
