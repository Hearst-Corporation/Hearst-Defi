"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteProof } from "@/app/admin/proofs/actions";
import { OFF_CHAIN_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import { PublishOnChainButton } from "@/components/admin/publish-on-chain-button";
import { BentoPanel, BENTO_SECONDARY_BTN } from "@/components/ui/bento";
import { abbreviateAddress } from "@/lib/onchain";
import { safeUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import { EmptySurface } from "@/components/ui/empty-surface";

interface ProofItem {
  id: string;
  proofType: string;
  period: string | null;
  hash: string;
  uri: string;
  postedAt: Date;
  postedBy: string;
  notes?: string | null;
  txHash?: string | null;
}

function truncateUri(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
}

/** Tinted bento chip — proof type / period tag. */
function ProofChip({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        accent
          ? "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]"
          : "border-white/10 bg-white/5 text-zinc-400",
      )}
    >
      {children}
    </span>
  );
}

export function ProofList({ items }: { items: ProofItem[] }) {
  if (items.length === 0) {
    return (
      <EmptySurface variant="widget" {...OFF_CHAIN_PROOFS_EMPTY} className="min-h-32" />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <AdminProofRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function AdminProofRow({ item }: { item: ProofItem }) {
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    const confirmed = window.confirm(
      "Delete this proof?\n\nThis is irreversible. The attestation will be removed from the registry.",
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteProof(item.id);
        toast.success("Proof deleted");
      } catch (e) {
        toast.error(
          `Failed to delete: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    });
  }

  const uriDisplay = truncateUri(item.uri, 40);
  const postedAtDisplay = item.postedAt.toISOString().slice(0, 10);
  const safeHref = safeUrl(item.uri);

  return (
    <BentoPanel>
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
            <ProofChip accent>{item.proofType}</ProofChip>
            {item.period ? <ProofChip>{item.period}</ProofChip> : null}
            <time className="font-mono text-zinc-500">{postedAtDisplay}</time>
            <span className="font-mono text-zinc-300">
              by {abbreviateAddress(item.postedBy)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-zinc-500">
            <span>
              <span className="text-zinc-500">hash </span>
              <span className="font-mono text-zinc-300">
                {abbreviateAddress(item.hash)}
              </span>
            </span>
            <span>
              <span className="text-zinc-500">uri </span>
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#A7FB90] underline decoration-[#A7FB90]/30 underline-offset-2 hover:decoration-[#A7FB90]"
              >
                {uriDisplay} ↗
              </a>
            </span>
            {item.txHash ? (
              <span>
                <span className="text-zinc-500">tx </span>
                <span className="font-mono text-zinc-300">
                  {abbreviateAddress(item.txHash)}
                </span>
              </span>
            ) : null}
          </div>

          {item.notes ? (
            <p className="text-[12px] italic text-zinc-500">{item.notes}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.proofType === "mining_attestation" && !item.txHash ? (
            <PublishOnChainButton proofId={item.id} />
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className={cn(
              BENTO_SECONDARY_BTN,
              "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20",
            )}
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </BentoPanel>
  );
}
