"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteProof } from "@/app/admin/proofs/actions";
import { OFF_CHAIN_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import { PublishOnChainButton } from "@/components/admin/publish-on-chain-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { abbreviateAddress } from "@/lib/onchain";
import { safeUrl } from "@/lib/safe-url";
import { explorerLinkClass } from "@/lib/ui/surface-classes";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
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

export function ProofList({ items }: { items: ProofItem[] }) {
  if (items.length === 0) {
    return (
      <EmptySurface variant="widget" {...OFF_CHAIN_PROOFS_EMPTY} className="min-h-32" />
    );
  }

  return (
    <div className="admin-doc-stack--actions">
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

  return (
    <Card className="p-4">
      <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start admin-doc-inline-row--loose">
        <div className="min-w-0 flex-1 admin-doc-stack--tight">
          <div className="admin-doc-inline-row text-xs ct-text-muted">
            <Badge variant="brand">{item.proofType}</Badge>
            {item.period ? (
              <Badge variant="default">{item.period}</Badge>
            ) : null}
            <time className="mono">{postedAtDisplay}</time>
            <span className="mono ct-text-body">by {abbreviateAddress(item.postedBy)}</span>
          </div>

          <div className="admin-doc-inline-row admin-doc-inline-row--spacious text-xs ct-text-muted">
            <span>
              <span className="ct-text-muted">hash </span>
              <span className="mono ct-text-body">{abbreviateAddress(item.hash)}</span>
            </span>
            <span>
              <span className="ct-text-muted">uri </span>
              <a
                href={safeUrl(item.uri)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(explorerLinkClass, "mono underline underline-offset-2")}
              >
                {uriDisplay} ↗
              </a>
            </span>
            {item.txHash ? (
              <span>
                <span className="ct-text-muted">tx </span>
                <span className="mono ct-text-body">{abbreviateAddress(item.txHash)}</span>
              </span>
            ) : null}
          </div>

          {item.notes ? (
            <p className="text-xs ct-text-muted italic">{item.notes}</p>
          ) : null}
        </div>

        <div className="admin-doc-inline-row">
          {item.proofType === "mining_attestation" && !item.txHash ? (
            <PublishOnChainButton proofId={item.id} />
          ) : null}
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
