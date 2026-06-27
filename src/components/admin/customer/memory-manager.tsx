"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { EmptySurface } from "@/components/ui/empty-surface";
import { BentoLabel, BENTO_SECONDARY_BTN } from "@/components/ui/bento";
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

const SELECT_INPUT =
  "bg-[#15191C] border border-white/10 focus:border-[#A7FB90]/40 text-white rounded-lg px-4 py-2.5 text-[13px] outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
// Kind chip — accent when the fact is on the prompt (active), neutral when off.
const KIND_CHIP_ACTIVE =
  "inline-flex items-center rounded-full border border-[#A7FB90]/30 bg-[#A7FB90]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A7FB90]";
const KIND_CHIP_OFF =
  "inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400";

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
              className="flex items-start justify-between gap-4 border-b border-white/5 py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={m.active ? KIND_CHIP_ACTIVE : KIND_CHIP_OFF}>
                    {m.kind}
                  </span>
                  <span className="font-mono text-[12px] text-zinc-600">{m.source}</span>
                  <span className="text-[12px] text-zinc-600 tabular-nums">
                    {fmtDate(m.updatedAt)}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-[13px] leading-snug",
                    m.active ? "text-zinc-300" : "text-zinc-600 line-through",
                  )}
                >
                  {m.content}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  className="text-[12px] text-zinc-500 transition-colors hover:text-white disabled:opacity-50"
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
                  className="text-[12px] text-red-400 transition-colors hover:underline disabled:opacity-50"
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
