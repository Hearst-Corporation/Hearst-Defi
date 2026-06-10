"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Ptai } from "@/components/ui/ptai";
import { cn } from "@/lib/cn";
import type { DashboardRecentEvent } from "@/lib/data/dashboard";

interface ActivityFeedProps {
  events: DashboardRecentEvent[];
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Activity Feed — last 5 rebalance / distribution / risk events. Each row
 * opens a PTAI modal (Projection / Trigger / Action / Impact). The
 * `triggerText` already follows the PTAI convention in DB rows
 * (see `src/lib/data/dashboard.ts`); we split the strings into the four
 * PTAI slots without inventing copy.
 */
export function ActivityFeed({ events }: ActivityFeedProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <div className="dash-label relative z-10">
          <span className="text-micro font-bold uppercase tracking-widest ct-text-muted">Activity feed</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="body-sm ct-text-muted italic">No recent events yet.</p>
        </div>
      </Card>
    );
  }

  const open = events.find((e) => e.id === openId) ?? null;

  return (
    <Card className="h-full flex flex-col">
      <div className="dash-label relative z-10">
        <span className="text-micro font-bold uppercase tracking-widest ct-text-muted">Activity feed</span>
      </div>
      
      <ul className="flex flex-col mt-6 relative z-10">
        {events.map((e, i) => (
          <li
            key={e.id}
            className={cn(
              "py-3",
              i !== 0 && "border-t border-[var(--ct-border-soft)]/50",
            )}
          >
            <button
              type="button"
              onClick={() => setOpenId(e.id)}
              className={cn(
                "flex w-full flex-col items-start gap-1 text-left",
                "rounded-sm",
                "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
                "hover:ct-surface-1 transition-colors px-2 -mx-2",
              )}
              aria-label={`Open details for ${e.ruleId}`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-2 w-full">
                <span className="mono text-[length:var(--ct-text-micro)] uppercase tracking-[var(--ct-tracking-wide)] ct-text-strong">
                  {e.ruleId}
                </span>
                <span className="mono text-[length:var(--ct-text-micro)] ct-text-faint tabular">
                  {dateFmt.format(e.takenAt)}
                </span>
              </span>
              <span className="body-sm ct-text-body">{e.triggerText}</span>
            </button>
          </li>
        ))}
      </ul>

      <Modal
        isOpen={open !== null}
        onClose={() => setOpenId(null)}
        title={open ? open.ruleId : ""}
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <p className="body-xs ct-text-faint tabular">
              {dateFmt.format(open.takenAt)}
            </p>
            <Ptai
              projection={`Recent ${open.ruleId} event captured by the engine.`}
              trigger={open.triggerText}
              action={open.actionText}
              impact={open.impactText}
            />
            <p className="body-xs ct-text-faint italic leading-[var(--ct-leading-relaxed)]">
              Conditional projection — not guaranteed. Methodology v1.0.
            </p>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
