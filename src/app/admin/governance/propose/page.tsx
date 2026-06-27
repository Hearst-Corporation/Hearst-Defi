import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptySurface } from "@/components/ui/empty-surface";
import {
  BentoPanel,
  BentoHeader,
  BentoLabel,
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/ui/bento";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { proposeAction } from "@/lib/governance/actions";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const ACTION_TYPES = [
  "deploy",
  "pause",
  "unpause",
  "updateFees",
  "updateCaps",
  "rotateSigners",
  "sweepFees",
  "emergencyShutdown",
] as const;

// Portfolio-canon field chrome: dark sub-surface, hairline border, accent focus.
const FIELD =
  "w-full rounded-lg border border-white/10 bg-[#15191C] px-3 py-2.5 text-[13px] text-white placeholder:text-zinc-600 transition-colors focus:border-[#A7FB90]/40 focus:outline-none";

async function handlePropose(formData: FormData) {
  "use server";
  await requireAdmin();

  const vaultId = formData.get("vaultId") as string;
  const actionType = formData.get("actionType") as string;
  const calldata = (formData.get("calldata") as string) || undefined;
  const justification = formData.get("justification") as string;

  const result = await proposeAction(
    vaultId,
    actionType as Parameters<typeof proposeAction>[1],
    calldata,
    justification,
  );

  redirect(`/admin/governance/proposal/${result.id}`);
}

export default async function ProposePage() {
  const vaults = await prisma.vaultDeployment.findMany({
    where: { status: { not: "closed" } },
    orderBy: { ticker: "asc" },
    select: { id: true, ticker: true, name: true },
  });

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="New"
          titleAccent="Proposal"
          contextLabel="Governance · Proposal"
          lead={
            <Link
              href="/admin/governance"
              className="text-[#A7FB90] transition-colors hover:text-[#A7FB90]/80"
              aria-label="Back to governance"
            >
              ← Governance
            </Link>
          }
        />

        <BentoPanel aria-label="Proposal form">
          <BentoHeader title="Proposal details" />
          <div className="p-5 lg:p-6">
            <form action={handlePropose} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="vaultId">Vault *</BentoLabel>
                {vaults.length === 0 ? (
                  <EmptySurface
                    variant="inline"
                    message="No vaults available yet."
                    detail="Create a vault deployment before drafting a governance proposal."
                    ariaLabel="Governance proposals awaiting vaults"
                  >
                    <Link
                      href="/admin/vaults/new"
                      className="text-[#A7FB90] underline underline-offset-2"
                    >
                      Create a vault first.
                    </Link>
                  </EmptySurface>
                ) : (
                  <select id="vaultId" name="vaultId" required className={FIELD}>
                    <option value="">Select a vault…</option>
                    {vaults.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.ticker} — {v.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="actionType">Action type *</BentoLabel>
                <select id="actionType" name="actionType" required className={FIELD}>
                  <option value="">Select an action…</option>
                  {ACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="calldata">
                  Calldata (raw JSON — optional)
                </BentoLabel>
                <textarea
                  id="calldata"
                  name="calldata"
                  rows={4}
                  placeholder='{"newFeeBps": 250}'
                  className={cn(FIELD, "resize-y font-mono")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <BentoLabel htmlFor="justification">Justification *</BentoLabel>
                <textarea
                  id="justification"
                  name="justification"
                  rows={5}
                  required
                  minLength={80}
                  placeholder="Explain why this action is necessary, what the expected impact is, and any risk mitigations applied…"
                  className={cn(FIELD, "resize-y")}
                />
                <span className="text-[11px] text-zinc-500">Min 80 characters.</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className={BENTO_PRIMARY_BTN}
                  disabled={vaults.length === 0}
                >
                  Submit proposal
                </button>
                <Link href="/admin/governance" className={BENTO_SECONDARY_BTN}>
                  Cancel
                </Link>
              </div>

              <p className="text-[12px] text-zinc-500">
                Submitting moves the proposal directly to SIGNING state. The
                proposer&apos;s own approval is not automatically counted — sign
                explicitly in the detail view.
              </p>
            </form>
          </div>
        </BentoPanel>
      </div>
    </div>
  );
}
