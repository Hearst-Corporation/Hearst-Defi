import { Card } from "@/components/catalyst/card";
import { Link } from "@/components/catalyst/link";
import { Activity } from "lucide-react";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";

export interface ContextualProofItem {
  label: string;
  lastVerified: string | null;
  href: string;
}

function proofIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("custody") || lower.includes("bitcoin") || lower.includes("btc")) {
    return <AssetIcon variant="btc" size="sm" />;
  }
  if (lower.includes("mining") || lower.includes("settlement")) {
    return <AssetIcon variant="mining" size="sm" />;
  }
  if (lower.includes("reserve") || lower.includes("usdc") || lower.includes("operating")) {
    return <AssetIcon variant="reserve" size="sm" />;
  }
  return <Activity size={16} className="ct-text-muted" aria-hidden />;
}

export function ContextualProofPanel({ items }: { items: ContextualProofItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-4)]">
      <div className="flex items-center gap-[var(--ct-space-2)]">
        <Activity size={16} className="ct-text-muted" aria-hidden />
        <span className="ct-bento-label">Contextual proofs</span>
      </div>

      <div className="flex flex-col">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-[var(--ct-space-3)] py-[var(--ct-space-3)] ${i > 0 ? "border-t border-[var(--ct-border-soft)]" : ""}`}
          >
            <div className="flex items-start gap-[var(--ct-space-2)] min-w-0">
              <span className="mt-0.5 shrink-0">{proofIcon(item.label)}</span>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="body-sm ct-text-strong font-medium truncate">{item.label}</span>
                {item.lastVerified ? (
                  <span className="ct-metric-caption">
                    Verified {item.lastVerified}
                  </span>
                ) : null}
              </div>
            </div>
            <Link href={item.href} className="body-xs ct-link-accent shrink-0">
              View proof
            </Link>
          </div>
        ))}
      </div>
    </Card>
  );
}
