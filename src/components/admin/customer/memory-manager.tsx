"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/catalyst/badge";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { BentoLabel, BENTO_SECONDARY_BTN } from "@/components/catalyst/bento";
import { cn } from "@/lib/cn";
import {
  addMemory,
  toggleMemory,
  removeMemory,
} from "@/app/admin/customers/[id]/actions";
import type { AgentMemory } from "@prisma/client";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

// Shared tokenized form control — canonical `.ct-input/.ct-select/.ct-textarea`
// (cockpit.css), token-only. Replaces a hardcoded class string that was copy-
// pasted across 5 customer forms (#A7FB90 / border-white / text-white / text-[length:var(--ct-text-xs)]).
const SELECT_INPUT = "ct-select";
// Kind chip uses the Catalyst <Badge> primitive: green = active (fact on the
// prompt), zinc = off. Replaces two local pill recipes hardcoding #A7FB90 /
// border-white / text-zinc.

/**
 * Admin curation of a customer's accumulating agent memory: facts auto-distilled
 * from conversations (source="chat-distill") plus manually added ones. Each can
 * be deactivated (kept off the prompt) or deleted; new manual facts can be added.
 */
export function MemoryManager({
  investorId,
  userId,
  memory,
}: {
  investorId: string;
  userId: string;
  memory: AgentMemory[];
}) {
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(message);
      }
    });
  }

  function onAdd(formData: FormData) {
    run(() => addMemory(investorId, formData), "Memory added");
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        action={onAdd}
        className="flex flex-wrap items-end gap-3"
        aria-label="Add memory"
      >
        <input type="hidden" name="userId" value={userId} />
        <div className="flex grow flex-col gap-2">
          <BentoLabel htmlFor="memory-content">Durable fact</BentoLabel>
          <input
            id="memory-content"
            name="content"
            type="text"
            required
            maxLength={280}
            placeholder="Durable fact about this customer…"
            className={cn(SELECT_INPUT, "w-full")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <BentoLabel htmlFor="memory-kind">Kind</BentoLabel>
          <select
            id="memory-kind"
            name="kind"
            defaultValue="fact"
            className={SELECT_INPUT}
            aria-label="Kind"
          >
            <option value="fact">fact</option>
            <option value="preference">preference</option>
            <option value="goal">goal</option>
            <option value="constraint">constraint</option>
          </select>
        </div>
        <button type="submit" className={BENTO_SECONDARY_BTN} disabled={isPending}>
          Add
        </button>
      </form>

      {memory.length === 0 ? (
        <EmptySurface
          variant="widget"
          message="No memory yet."
          detail="Facts appear here as the customer talks to the agent, or add one manually."
          className="min-h-24"
        />
      ) : (
        <ul className="flex flex-col">
          {memory.map((m) => (
            <li
              key={m.id}
              className="flex items-start justify-between gap-4 border-b border-[var(--ct-border-soft)] py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={m.active ? "green" : "zinc"} className="uppercase">
                    {m.kind}
                  </Badge>
                  <span className="ct-metric-caption font-mono">{m.source}</span>
                  <span className="ct-metric-caption tabular-nums">
                    {fmtDate(m.updatedAt)}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-[length:var(--ct-text-xs)] leading-snug",
                    m.active
                      ? "text-[var(--ct-text-body)]"
                      : "text-[var(--ct-text-faint)] line-through",
                  )}
                >
                  {m.content}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)] disabled:opacity-[var(--ct-opacity-50)]"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", m.id);
                    fd.set("active", String(!m.active));
                    run(() => toggleMemory(investorId, fd), m.active ? "Deactivated" : "Activated");
                  }}
                >
                  {m.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  className="text-[length:var(--ct-text-2xs)] text-[var(--ct-status-danger)] transition-colors hover:underline disabled:opacity-[var(--ct-opacity-50)]"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", m.id);
                    run(() => removeMemory(investorId, fd), "Deleted");
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
