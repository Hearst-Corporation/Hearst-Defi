import { Card } from "@/components/catalyst/card";
import { Link } from "@/components/catalyst/link";
import { ShieldCheck } from "lucide-react";

export interface ContextualProofItem {
  label: string;
  lastVerified: string | null;
  href: string;
}

export function ContextualProofPanel({ items }: { items: ContextualProofItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex items-center gap-[var(--ct-space-2)]">
        <ShieldCheck size={16} className="ct-text-muted" />
        <span className="stat-label ct-text-muted">Contextual proofs</span>
      </div>

      <div className="flex flex-col">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-between py-[var(--ct-space-3)] ${i > 0 ? 'border-t border-[var(--ct-border-soft)]' : ''}`}
          >
            <div className="flex flex-col gap-1">
              <span className="body-sm ct-text-strong font-medium">{item.label}</span>
              {item.lastVerified && (
                <span className="text-[length:var(--ct-text-nano)] ct-text-muted">
                  Verified {item.lastVerified}
                </span>
              )}
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
