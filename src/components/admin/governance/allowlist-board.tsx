import { Badge } from "@/components/catalyst/badge";
import {
  BentoPanel,
  BentoHeader,
  BentoLabel,
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/ui/bento";
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

// One green: #A7FB90. Category + risk badges map onto Catalyst Badge colors.
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
  "w-full rounded-lg border border-white/10 bg-surface-inset px-3 py-2.5 text-[13px] text-white placeholder:text-zinc-600 transition-colors focus:border-[#A7FB90]/40 focus:outline-none";
const FIELD_COMPACT =
  "w-full rounded-lg border border-white/10 bg-[#0F1316] px-3 py-2 text-[12px] text-white placeholder:text-zinc-600 transition-colors focus:border-[#A7FB90]/40 focus:outline-none";

export function AllowlistBoard({ entries }: { entries: AllowlistEntryRow[] }) {
  return (
    <>
      {/* ── Routing reference ─────────────────────────────────────────────── */}
      <BentoPanel aria-label="Anchorage quorum routing">
        <BentoHeader title="Anchorage quorum routing" />
        <div className="p-5 lg:p-6">
          <p className="text-[13px] leading-relaxed text-zinc-400">
            Addresses on this list use the{" "}
            <span className="font-semibold text-white">fast path</span> (2/3 sigs · 0h
            timelock · no board notification). Unknown addresses route through the{" "}
            <span className="font-semibold text-white">medium path</span> (&lt;$100k → 3/5
            · 12h) or{" "}
            <span className="font-semibold text-white">sensitive path</span> (≥$100k → 4/5
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
              <button type="submit" className={BENTO_PRIMARY_BTN}>
                Add to allowlist
              </button>
            </div>
          </form>
        </div>
      </BentoPanel>

      {/* ── Entries table ─────────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <BentoPanel aria-label="Allowlist entries">
          <BentoHeader title="Allowlist entries" />
          <div className="p-5 lg:p-6">
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface-inset p-8 text-center">
              <p className="text-[13px] font-medium text-zinc-300">
                No addresses on the allowlist yet.
              </p>
              <p className="text-[12px] text-zinc-500">
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
          <div className="overflow-x-auto">
            <table
              className="min-w-184 w-full table-fixed text-sm"
              aria-label="Address allowlist"
            >
              <thead>
                <tr className="border-b border-white/5">
                  <th
                    scope="col"
                    className="w-[38%] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500"
                  >
                    Label / Address
                  </th>
                  <th
                    scope="col"
                    className="hidden w-[18%] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 md:table-cell"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="hidden w-[14%] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 lg:table-cell"
                  >
                    Risk score
                  </th>
                  <th
                    scope="col"
                    className="w-[22%] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="w-[40%] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 md:w-[22%] lg:w-[8%]"
                  >
                    Edit
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      "border-b border-white/5 align-top transition-colors last:border-b-0 hover:bg-white/[0.02]",
                      !entry.active && "opacity-55",
                    )}
                  >
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-medium text-white">{entry.label}</p>
                      <p className="break-all font-mono text-[11px] text-zinc-500">
                        {entry.address}
                      </p>
                      {entry.notes ? (
                        <p className="mt-1 text-[11px] italic text-zinc-500">
                          {entry.notes}
                        </p>
                      ) : null}
                    </td>
                    <td className="hidden px-5 py-4 md:table-cell">
                      <Badge color={CATEGORY_COLOR[entry.category]}>
                        {CATEGORY_LABELS[entry.category]}
                      </Badge>
                    </td>
                    <td className="hidden px-5 py-4 lg:table-cell">
                      <Badge color={riskColor(entry.riskScore)}>{entry.riskScore}</Badge>
                    </td>
                    <td className="px-5 py-4">
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
                            "inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                            entry.active
                              ? "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90] hover:bg-[#A7FB90]/20"
                              : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10",
                          )}
                        >
                          {entry.active ? "Active" : "Inactive"}
                        </button>
                      </form>
                    </td>
                    <td className="px-5 py-4">
                      <details className="group">
                        <summary className="cursor-pointer select-none list-none text-[11px] text-zinc-400 transition-colors hover:text-white">
                          <span className="group-open:hidden">Edit ▾</span>
                          <span className="hidden group-open:inline">Close ▴</span>
                        </summary>
                        <form
                          action={updateAllowlistEntryAction}
                          className="mt-3 flex flex-col gap-3 rounded-lg border border-white/10 bg-[#0F1316] p-3"
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoPanel>
      )}
    </>
  );
}
