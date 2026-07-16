import { cn } from "@/lib/cn";

/** Shared control chrome for Input / Select / Textarea — token-only, dark-only. */
export const fieldControlClassName =
  "w-full rounded-lg border border-[var(--ct-border)] bg-surface-inset px-3 py-2.5 text-[length:var(--ct-text-sm)] text-[var(--ct-text-strong)] placeholder:text-[var(--ct-text-faint)] transition-colors focus:border-[var(--ct-border-accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-[var(--ct-opacity-50)] data-invalid:border-[var(--ct-status-danger)]";

export function fieldControlClass(...extra: Array<string | false | null | undefined>) {
  return cn(fieldControlClassName, ...extra);
}
