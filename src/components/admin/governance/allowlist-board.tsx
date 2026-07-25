import { Badge } from "@/components/catalyst/badge";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import {
  BentoPanel,
  BentoHeader,
  BentoLabel,
} from "@/components/catalyst/bento";
import { fieldControlClass } from "@/components/catalyst/field-controls";
import { Select } from "@/components/catalyst/select";
import { Textarea } from "@/components/catalyst/textarea";
import { TextField } from "@/components/catalyst/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
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

/**
 * Honesty note (TOP10): `AddressAllowlist.riskScore` is `Int @default(0)` —
 * NON-nullable (prisma/schema.prisma:1031), so a stored 0 is indistinguishable
 * from "never assessed". A colored badge is an ASSESSMENT claim, so it renders
 * ONLY for a genuinely entered score (> 0); 0 renders as a grey "Not scored"
 * chip. Documented limitation: an operator who deliberately assesses an entry
 * at zero risk will also read as "Not scored" — distinguishing the two would
 * require the column to become nullable.
 */
function RiskScoreBadge({ score }: { score: number }) {
  if (score === 0) {
    return <Badge color="zinc">Not scored</Badge>;
  }
  return <Badge color={riskColor(score)}>{score}</Badge>;
}

const FIELD_COMPACT = fieldControlClass(
  "py-2 text-[length:var(--ct-text-2xs)]",
);

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
      {/* BentoHeader renders the H2 itself (canon heading, `as="h2"` default) —
          no hand-rolled duplicate heading next to it. */}
      <BentoPanel aria-labelledby="allowlist-add-heading">
        <BentoHeader id="allowlist-add-heading" title="Add entry" />
        <div className="p-5 lg:p-6">
          <form action={addAllowlistEntryAction} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <BentoLabel htmlFor="add-address">Address (0x…) *</BentoLabel>
                <TextField
                  id="add-address"
                  name="address"
                  type="text"
                  required
                  pattern="0x[0-9a-fA-F]{40}"
                  placeholder="0xABCDEF…"
                  className="mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="add-label">Label *</BentoLabel>
                <TextField
                  id="add-label"
                  name="label"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Coinbase Custody Vault"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="add-category">Category *</BentoLabel>
                <Select id="add-category" name="category" required>
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="add-riskScore">Risk score (0–100)</BentoLabel>
                <TextField
                  id="add-riskScore"
                  name="riskScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={0}
                  aria-describedby="add-riskScore-hint"
                />
                <p id="add-riskScore-hint" className="ct-metric-caption">
                  0 = not scored — the list shows a risk badge only for entries
                  with a recorded assessment.
                </p>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <BentoLabel htmlFor="add-notes">Notes (optional)</BentoLabel>
                <Textarea
                  id="add-notes"
                  name="notes"
                  rows={2}
                  maxLength={500}
                  placeholder="Context for this entry…"
                  className="resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <CockpitButton type="submit" variant="primary" shape="rect" size="lg">
                Add to allowlist
              </CockpitButton>
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
          <BentoHeader
            id="allowlist-table-heading"
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
                    // Tailwind numeric opacity — --ct-opacity-55 is a phantom
                    // token (defined in no runtime CSS), greenfield rule.
                    !entry.active && "opacity-55",
                  )}
                >
                  <TableCell className="pl-5">
                    <p className="ct-metric-value">{entry.label}</p>
                    <p className="ct-metric-caption break-all mono">
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
                    <RiskScoreBadge score={entry.riskScore} />
                  </TableCell>
                  <TableCell>
                    <form action={toggleAllowlistEntryAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={entry.active ? "true" : "false"}
                      />
                      <CockpitButton
                        type="submit"
                        variant={null}
                        shape={null}
                        size={null}
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
                      </CockpitButton>
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
                          <TextField
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
                          <TextField
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
                          <Textarea
                            id={`edit-notes-${entry.id}`}
                            name="notes"
                            rows={2}
                            maxLength={500}
                            defaultValue={entry.notes ?? ""}
                            className={cn(FIELD_COMPACT, "resize-none")}
                          />
                        </div>
                        <CockpitButton
                          type="submit"
                          variant="secondary"
                          shape="rect"
                          size="lg"
                        >
                          Save
                        </CockpitButton>
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
