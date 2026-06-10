import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export type BriefTone = "positive" | "attention" | "neutral";

export interface BriefItem {
  tone: BriefTone;
  /** One honest sentence. No forbidden words (guarantee/promise/certain/…). */
  text: string;
}

const DOT_CLASS: Record<BriefTone, string> = {
  positive: "ct-status-dot-success",
  attention: "ct-status-dot-warning",
  neutral: "ct-surface-3",
};

/**
 * Admin Brief — a short, honest "what changed / what needs attention" readout
 * derived from real deltas (AUM 30d, yield band, risk band, mining signal,
 * proof freshness, action queue). When a signal has no data the page passes a
 * neutral, truthful sentence rather than an invented one.
 */
export function AdminBrief({ items }: { items: BriefItem[] }) {
  return (
    <Card className="flex flex-col">
      <div className="dash-label relative z-10">
        <div className="flex flex-col gap-0.5">
          <span className="text-micro font-bold uppercase tracking-widest ct-text-muted">
            Admin brief
          </span>
          <p className="text-micro font-medium uppercase tracking-wide ct-text-faint mono">
            What changed · trailing 30 days
          </p>
        </div>
      </div>

      <ul className="mt-6 flex flex-col gap-3 relative z-10">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
                DOT_CLASS[item.tone],
              )}
            />
            <span className="body-sm ct-text-body">{item.text}</span>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-6 body-xs ct-text-faint italic leading-[var(--ct-leading-relaxed)] opacity-70 relative z-10">
        Derived from the latest vault snapshot, mining metrics and the action
        queue. Conditional readout — not guaranteed.
      </p>
    </Card>
  );
}
