"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteProof } from "@/app/admin/proofs/actions";
import { OFF_CHAIN_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import { PublishOnChainButton } from "@/components/admin/publish-on-chain-button";
import { BentoPanel } from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { abbreviateAddress } from "@/lib/onchain";
import { safeUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import { EmptySurface } from "@/components/catalyst/empty-surface";

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
  /**
   * ECDSA + allowlist verdict computed server-side (same rule as
   * proof-center/full): `true` verified · `false` failed verification ·
   * `null`/absent — no signature on the row, nothing was verified.
   */
  signatureVerified?: boolean | null;
}

function truncateUri(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
}

/**
 * Honest label for the signature verdict — exported for tests.
 * `null`/`undefined` renders an em dash: "no signature" is not "unverified",
 * and neither may ever read as "verified".
 */
export function signatureLabel(verified: boolean | null | undefined): string {
  if (verified === true) return "verified";
  if (verified === false) return "unverified";
  return "—";
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
        "ct-bento-label inline-flex items-center rounded-full border px-2.5 py-0.5",
        accent
          ? "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
          : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]",
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
          <div className="ct-metric-caption flex flex-wrap items-center gap-2">
            <ProofChip accent>{item.proofType}</ProofChip>
            {item.period ? <ProofChip>{item.period}</ProofChip> : null}
            <time className="mono text-[var(--ct-text-muted)]">
              {postedAtDisplay}
            </time>
            <span className="mono text-[var(--ct-text-secondary)]">
              by {abbreviateAddress(item.postedBy)}
            </span>
          </div>

          <div className="ct-metric-caption flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>
              <span className="text-[var(--ct-text-muted)]">hash </span>
              <span className="mono text-[var(--ct-text-secondary)]">
                {abbreviateAddress(item.hash)}
              </span>
            </span>
            <span>
              <span className="text-[var(--ct-text-muted)]">signature </span>
              <span
                className={cn(
                  "mono",
                  item.signatureVerified === true && "text-[var(--ct-accent)]",
                  item.signatureVerified === false &&
                    "text-[var(--ct-status-warning)]",
                  item.signatureVerified == null &&
                    "text-[var(--ct-text-faint)]",
                )}
                title={
                  item.signatureVerified == null
                    ? "No signature on this record — nothing to verify"
                    : item.signatureVerified
                      ? "ECDSA signature verified against the attestor allowlist"
                      : "Signature present but failed verification (bad signature, digest mismatch or signer not allowlisted)"
                }
              >
                {signatureLabel(item.signatureVerified)}
              </span>
            </span>
            <span>
              <span className="text-[var(--ct-text-muted)]">uri </span>
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-[var(--ct-accent)] underline decoration-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] underline-offset-2 hover:decoration-[var(--ct-accent)]"
              >
                {uriDisplay} ↗
              </a>
            </span>
            {item.txHash ? (
              <span>
                <span className="text-[var(--ct-text-muted)]">tx </span>
                <span className="mono text-[var(--ct-text-secondary)]">
                  {abbreviateAddress(item.txHash)}
                </span>
              </span>
            ) : null}
          </div>

          {item.notes ? (
            <p className="ct-metric-caption italic">{item.notes}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.proofType === "mining_attestation" && !item.txHash ? (
            <PublishOnChainButton proofId={item.id} />
          ) : null}
          <CockpitButton
            type="button"
            variant="secondary"
            shape="rect"
            size="lg"
            onClick={onDelete}
            disabled={isPending}
            className="border-[color-mix(in_srgb,var(--ct-status-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-danger)_10%,transparent)] text-[var(--ct-status-danger)] hover:bg-[color-mix(in_srgb,var(--ct-status-danger)_20%,transparent)]"
          >
            {isPending ? "Deleting…" : "Delete"}
          </CockpitButton>
        </div>
      </div>
    </BentoPanel>
  );
}
