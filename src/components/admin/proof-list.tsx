"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { safeUrl } from "@/lib/safe-url";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deleteProof } from "@/app/admin/proofs/actions";

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

function truncate(str: string, head: number, tail: number): string {
  if (str.length <= head + tail + 3) return str;
  if (tail === 0) return `${str.slice(0, head)}…`;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

export function ProofList({ items }: { items: ProofItem[] }) {
  if (items.length === 0) {
    return (
      <div className="ct-empty-state">
        No proofs yet. Use the ingest CLI to publish an attestation.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ProofRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function ProofRow({ item }: { item: ProofItem }) {
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

  const hashDisplay = truncate(item.hash, 8, 4);
  const uriDisplay = truncate(item.uri, 40, 0);
  const postedByDisplay = truncate(item.postedBy, 6, 4);
  const postedAtDisplay = item.postedAt.toISOString().slice(0, 10);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs ct-text-muted">
            <Badge variant="brand">{item.proofType}</Badge>
            {item.period ? (
              <Badge variant="default">{item.period}</Badge>
            ) : null}
            <time className="mono">{postedAtDisplay}</time>
            <span className="mono ct-text-body">
              by {postedByDisplay}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs ct-text-muted">
            <span>
              <span className="ct-text-muted">hash </span>
              <span className="mono ct-text-body">
                {hashDisplay}
              </span>
            </span>
            <span>
              <span className="ct-text-muted">uri </span>
              <a
                href={safeUrl(item.uri)}
                target="_blank"
                rel="noopener noreferrer"
                className="mono ct-text-body hover:ct-text-strong underline underline-offset-2"
              >
                {uriDisplay} ↗
              </a>
            </span>
            {item.txHash ? (
              <span>
                <span className="ct-text-muted">tx </span>
                <span className="mono ct-text-body">
                  {truncate(item.txHash, 8, 4)}
                </span>
              </span>
            ) : null}
          </div>

          {item.notes ? (
            <p className="text-xs ct-text-muted italic">{item.notes}</p>
          ) : null}
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={onDelete}
          disabled={isPending}
        >
          {isPending ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </Card>
  );
}
