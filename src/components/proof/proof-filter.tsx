"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  parseFilter,
  type FilterValue,
} from "@/components/proof/proof-filter-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const OPTIONS: ReadonlyArray<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "mining_attestation", label: "Mining" },
  { value: "custody", label: "Custody" },
  { value: "audit", label: "Audit" },
  { value: "methodology", label: "Methodology" },
];

const URL_OUT: Record<FilterValue, string | null> = {
  all: null,
  mining_attestation: "mining",
  custody: "custody",
  audit: "audit",
  methodology: "methodology",
};

export function ProofFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = parseFilter(searchParams.get("type"));

  function select(value: FilterValue) {
    const params = new URLSearchParams(searchParams.toString());
    const out = URL_OUT[value];
    if (out === null) params.delete("type");
    else params.set("type", out);
    const qs = params.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => router.replace(href, { scroll: false }));
  }

  return (
    <nav aria-label="Proof type filter" className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => {
        const isActive = current === opt.value;
        return (
          <Button
            key={opt.value}
            type="button"
            variant={isActive ? "primary" : "secondary"}
            size="sm"
            disabled={isPending}
            onClick={() => select(opt.value)}
            aria-pressed={isActive}
            className={cn(
              "px-3.5",
              !isActive && "border-[var(--ct-border-strong)] bg-transparent ct-text-body hover:ct-text-primary",
            )}
          >
            {opt.label}
          </Button>
        );
      })}
    </nav>
  );
}
