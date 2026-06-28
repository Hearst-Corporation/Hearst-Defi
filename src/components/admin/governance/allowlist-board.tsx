import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import {
  BentoPanel,
  BentoHeader,
  BentoLabel,
  BENTO_SECONDARY_BTN,
} from "@/components/catalyst/bento";
import { CATALYST_ACCENT_BTN } from "@/lib/ui/catalyst-accent";
import {
  addAllowlistEntryAction,
  toggleAllowlistEntryAction,
  updateAllowlistEntryAction,
} from "@/app/admin/governance/allowlist/actions";
import type { AllowlistCategory } from "@/lib/governance/allowlist";
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

// One green (--ct-accent via Catalyst dark "green"). Other categories use
// distinct non-green hues to differentiate. Risk badges map onto Catalyst colors.
const CATEGORY_COLOR: Record<
  AllowlistCategory,
  "green" | "sky" | "amber" | "zinc"
> = {
  custody: "green",
  counterparty: "sky",
  operations: "amber",
  internal: "zinc",
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

function riskColor(score: number): "green" | "amber" | "red" {
  if (score <= 25) return "green";
  if (score <= 60) return "amber";
  return "red";
}

// Portfolio-canon field chrome: dark sub-surface, hairline border, accent focus.
const FIELD =
  "w-full rounded-lg border border-[var(--ct-border)] bg-surface-inset px-3 py-2.5 text-[length:var(--ct-text-sm)] text-[var(--ct-text-strong)] placeholder:text-[var(--ct-text-faint)] transition-colors focus:border-[var(--ct-border-accent)] focus:outline-none";
const FIELD_COMPACT =
  "w-full rounded-lg border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] px-3 py-2 text-[length:var(--ct-text-2xs)] text-[var(--ct-text-strong)] placeholder:text-[var(--ct-text-faint)] transition-colors focus:border-[var(--ct-border-accent)] focus:outline-none";

export function AllowlistBoard({ entries }: { entries: AllowlistEntryRow[] }) {
  return (
    <>
      {/* ── Routing reference ─────────────────────────────────────────────── */}
      <BentoPanel aria-label="Anchorage quorum routing">
        <BentoHeader title="Anchorage quorum routing" />
        <div className="p-5 lg:p-6">
          <p className="body-sm leading-relaxed text-[var(--ct-text-body)]">
            Addresses on this list use the{" "}
            <span className="font-semibold text-[var(--ct-text-strong)]">fast path</span> (2/3 sigs · 0h
            timelock · no board notification). Unknown addresses route through the{" "}
            <span className="font-semibold text-[var(--ct-text-strong)]">medium path</span> (&lt;$100k → 3/5
            · 12h) or{" "}
            <span className="font-semibold text-[var(--ct-text-strong)]">sensitive path</span> (≥$100k → 4/5
            · 24h · board). Emergency shutdowns always require 5/5 regardless of allowlist.
          </p>
        </div>
      </BentoPanel>

      {/* ── Add entry ─────────────────────────────────────────────────────── */}
      <BentoPanel aria-labelledby="allowlist-add-heading">
        <h2 id="allowlist-add-heading" className="sr-only">
          Add entry
        </h2>
        <BentoHeader title="Add entry" />
        <div className="p-5 lg:p-6">
          <form action={addAllowlistEntryAction} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <BentoLabel htmlFor="add-address">Address (0x…) *</BentoLabel>
                <input
                  id="add-address"
                  name="address"
                  type="text"
                  required
                  pattern="0x[0-9a-fA-F]{40}"
                  placeholder="0xABCDEF…"
                  className={cn(FIELD, "font-mono")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="add-label">Label *</BentoLabel>
                <input
                  id="add-label"
                  name="label"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Coinbase Custody Vault"
                  className={FIELD}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="add-category">Category *</BentoLabel>
                <select id="add-category" name="category" required className={FIELD}>
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="add-riskScore">Risk score (0–100)</BentoLabel>
                <input
                  id="add-riskScore"
                  name="riskScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={0}
                  className={FIELD}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <BentoLabel htmlFor="add-notes">Notes (optional)</BentoLabel>
                <textarea
                  id="add-notes"
                  name="notes"
                  rows={2}
                  maxLength={500}
                  placeholder="Context for this entry…"
                  className={cn(FIELD, "resize-none")}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" className={CATALYST_ACCENT_BTN}>
                Add to allowlist
              </Button>
            </div>
          </form>
        </div>
      </BentoPanel>

      {/* ── Entries table ─────────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <BentoPanel aria-label="Allowlist entries">
          <BentoHeader title="Allowlist entries" />
          <div className="p-5 lg:p-6">
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-8 text-center">
              <p className="ct-metric-value">No addresses on the allowlist yet.</p>
              <p className="ct-metric-caption">
                Add the first trusted address using the form above.
              </p>
            </div>
          </div>
        </BentoPanel>
      ) : (
        <BentoPanel aria-labelledby="allowlist-table-heading">
          <h2 id="allowlist-table-heading" className="sr-only">
            Allowlist entries
          </h2>
          <BentoHeader
            title={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
          />
          <Table
            dense
            className="max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
            aria-label="Address allowlist"
          >
            <TableHead>
              <TableRow>
                <TableHeader className="ct-bento-label pl-5">
                  Label / Address
                </TableHeader>
                <TableHeader className="ct-bento-label hidden md:table-cell">
                  Category
                </TableHeader>
                <TableHeader className="ct-bento-label hidden lg:table-cell">
                  Risk score
                </TableHeader>
                <TableHeader className="ct-bento-label">Status</TableHeader>
                <TableHeader className="ct-bento-label pr-5">Edit</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={cn(
                    "border-transparent align-top transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]",
                    !entry.active && "opacity-55",
                  )}
                >
                  <TableCell className="pl-5">
                    <p className="ct-metric-value">{entry.label}</p>
                    <p className="ct-metric-caption break-all font-mono">
                      {entry.address}
                    </p>
                    {entry.notes ? (
                      <p className="ct-metric-caption mt-1 italic">{entry.notes}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge color={CATEGORY_COLOR[entry.category]}>
                      {CATEGORY_LABELS[entry.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge color={riskColor(entry.riskScore)}>{entry.riskScore}</Badge>
                  </TableCell>
                  <TableCell>
                    <form action={toggleAllowlistEntryAction}>
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
                        className={cn(
                          "inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-[length:var(--ct-text-nano)] font-semibold transition-colors",
                          entry.active
                            ? "border-[var(--ct-status-success-border)] bg-[var(--ct-status-success-soft)] text-[var(--ct-accent)] hover:bg-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)]"
                            : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)] hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]",
                        )}
                      >
                        {entry.active ? "Active" : "Inactive"}
                      </button>
                    </form>
                  </TableCell>
                  <TableCell className="pr-5">
                    <details className="group">
                      <summary className="ct-metric-caption cursor-pointer select-none list-none transition-colors hover:text-[var(--ct-text-strong)]">
                        <span className="group-open:hidden">Edit ▾</span>
                        <span className="hidden group-open:inline">Close ▴</span>
                      </summary>
                      <form
                        action={updateAllowlistEntryAction}
                        className="mt-3 flex flex-col gap-3 rounded-lg border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] p-3"
                      >
                        <input type="hidden" name="id" value={entry.id} />
                        <div className="flex flex-col gap-1.5">
                          <BentoLabel htmlFor={`edit-label-${entry.id}`}>
                            Label
                          </BentoLabel>
                          <input
                            id={`edit-label-${entry.id}`}
                            name="label"
                            type="text"
                            defaultValue={entry.label}
                            maxLength={200}
                            className={FIELD_COMPACT}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <BentoLabel htmlFor={`edit-risk-${entry.id}`}>
                            Risk score
                          </BentoLabel>
                          <input
                            id={`edit-risk-${entry.id}`}
                            name="riskScore"
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={entry.riskScore}
                            className={FIELD_COMPACT}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <BentoLabel htmlFor={`edit-notes-${entry.id}`}>
                            Notes
                          </BentoLabel>
                          <textarea
                            id={`edit-notes-${entry.id}`}
                            name="notes"
                            rows={2}
                            maxLength={500}
                            defaultValue={entry.notes ?? ""}
                            className={cn(FIELD_COMPACT, "resize-none")}
                          />
                        </div>
                        <button type="submit" className={BENTO_SECONDARY_BTN}>
                          Save
                        </button>
                      </form>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </BentoPanel>
      )}
    </>
  );
}
