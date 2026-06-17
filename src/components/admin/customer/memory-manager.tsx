"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptySurface } from "@/components/ui/empty-surface";
import {
  addMemory,
  toggleMemory,
  removeMemory,
} from "@/app/admin/customers/[id]/actions";
import type { AgentMemory } from "@prisma/client";

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

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
    <div className="admin-doc-stack admin-doc-stack--actions">
      <form action={onAdd} className="admin-doc-inline-row flex-wrap gap-2" aria-label="Add memory">
        <input type="hidden" name="userId" value={userId} />
        <input
          name="content"
          type="text"
          required
          maxLength={280}
          placeholder="Durable fact about this customer…"
          className="ct-input grow"
        />
        <select name="kind" defaultValue="fact" className="ct-input" aria-label="Kind">
          <option value="fact">fact</option>
          <option value="preference">preference</option>
          <option value="goal">goal</option>
          <option value="constraint">constraint</option>
        </select>
        <Button type="submit" variant="secondary" disabled={isPending}>
          Add
        </Button>
      </form>

      {memory.length === 0 ? (
        <EmptySurface
          variant="widget"
          message="No memory yet."
          detail="Facts appear here as the customer talks to the agent, or add one manually."
          className="min-h-24"
        />
      ) : (
        <ul className="admin-doc-stack">
          {memory.map((m) => (
            <li
              key={m.id}
              className="admin-doc-row-spread border-b border-(--ct-border-soft) pb-2 last:border-0"
            >
              <div className="min-w-0">
                <div className="admin-doc-inline-row">
                  <Badge variant={m.active ? "success" : "default"}>{m.kind}</Badge>
                  <span className="body-xs ct-text-faint mono">{m.source}</span>
                  <span className="body-xs ct-text-faint">{fmtDate(m.updatedAt)}</span>
                </div>
                <p className={m.active ? "body-sm ct-text-body" : "body-sm ct-text-faint line-through"}>
                  {m.content}
                </p>
              </div>
              <div className="admin-doc-inline-row shrink-0">
                <button
                  type="button"
                  disabled={isPending}
                  className="body-xs ct-text-muted hover:ct-text-strong"
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
                  className="body-xs ct-status-danger hover:underline"
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
