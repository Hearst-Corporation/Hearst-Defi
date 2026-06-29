"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { cockpitButtonVariants } from "@/components/catalyst/cockpit-button";
import { cn } from "@/lib/cn";
import {
  constructionDraftToVaultForm,
  encodeVaultFormPrefill,
} from "@/lib/agentic/swarm/live/to-vault-form";
import { ConstructionReport } from "@/components/admin/product-workspace/construction-report";
import type { ProductConstructionDraft } from "@/lib/agentic/swarm/live/types";

/**
 * Product Construction panel — the visible output of the six live-read swarms.
 *
 * The admin triggers the pipeline for the current objective; it fetches real
 * market/Telegram data, computes a seeded Monte-Carlo, and returns a numeric,
 * charted, written DRAFT. This panel renders the artefacts richly: a projection
 * fan (p5/p50/p95), the blended-yield allocation, the headline range, the audit
 * trail, and the long-form write-up. Read-only — nothing is created or deployed.
 */

export function ProductConstructionPanel({
  objective,
}: {
  objective: string | null;
}) {
  const [draft, setDraft] = useState<ProductConstructionDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  // Animate the report's progressive reveal only right after a fresh run.
  const [animateReport, setAnimateReport] = useState(false);
  // Auto-run guard: kick the swarms exactly once when the workspace opens with
  // an objective. A manual re-run goes through `run` directly.
  const autoRanRef = useRef(false);

  const run = useCallback(async () => {
    if (!objective) return;
    setLoading(true);
    setError(null);
    try {
      // No preset to pick — the swarms run on the CONFIGURED base regime. The
      // server resolves + clamps the assumptions; the headline stays a range.
      const res = await fetch("/api/admin/product-construction/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, preset: "base" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setDraft((await res.json()) as ProductConstructionDraft);
      setAnimateReport(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
    } finally {
      setLoading(false);
    }
  }, [objective]);

  // Auto-run the swarms once the workspace opens with an objective — no button,
  // no preset selection. The admin sees the report write itself.
  useEffect(() => {
    if (autoRanRef.current) return;
    if (!objective) return;
    autoRanRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [objective, run]);

  // Open the print view in a new tab. The run already persisted the report to
  // the admin's draft, so the print page loads it server-side and the admin uses
  // the browser's Print → Save as PDF (works in every runtime, no PDF lib).
  const downloadPdf = useCallback(() => {
    if (!draft) return;
    window.open("/admin/product-workspace/report/print", "_blank", "noopener");
  }, [draft]);

  if (!objective) {
    return (
      <p className="body-sm ct-text-muted">
        Provide an objective to run the construction swarms.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-(--ct-space-5)">
      {/* Auto-run status — the swarms run on their own as soon as the workspace
          opens; there is no preset to pick. A re-run link covers a transient
          fetch failure or a manual refresh. */}
      <div className="flex flex-wrap items-center gap-(--ct-space-3) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card px-(--ct-space-4) py-(--ct-space-3)">
        {loading ? (
          <span className="flex items-center gap-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-secondary">
            <span
              aria-hidden
              className="h-(--ct-space-1_5) w-(--ct-space-1_5) rounded-(--ct-radius-full) bg-[var(--ct-accent)] animate-pulse"
            />
            Running the construction swarms — Telegram · BTC · hashprice ·
            Monte-Carlo…
          </span>
        ) : draft ? (
          <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            Report generated from live data ·{" "}
            <button
              type="button"
              onClick={() => void run()}
              className="underline-offset-2 hover:underline ct-text-muted"
            >
              re-run
            </button>
          </span>
        ) : (
          <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            live_read · fetches BTC + hashprice + Telegram + DeFi, computes a
            seeded Monte-Carlo · no write, no send, no deploy
          </span>
        )}
        {error ? (
          <span className="text-[length:var(--ct-text-xs)] ct-status-danger">
            {error} ·{" "}
            <button
              type="button"
              onClick={() => void run()}
              className="underline-offset-2 hover:underline"
            >
              retry
            </button>
          </span>
        ) : null}
      </div>

      {draft ? (
        <div className="flex flex-col gap-(--ct-space-5)">
          {/* Actions — wizard hand-off (no DB write) + PDF export of the report. */}
          <div className="flex flex-wrap items-center gap-(--ct-space-3)">
            <Link
              href={`/admin/vaults/new?prefill=${encodeURIComponent(
                encodeVaultFormPrefill(constructionDraftToVaultForm(draft)),
              )}`}
              className={cn(
                cockpitButtonVariants({ variant: "primary", size: "sm" }),
                "self-start",
              )}
            >
              Open in vault wizard (pre-filled)
            </Link>
            <Button variant="secondary" size="sm" onClick={() => downloadPdf()}>
              Open print view (PDF)
            </Button>
            <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              Wizard hand-off carries ticker / APY range / allocations · no record
              created · the report below is written into the page and persisted to
              your draft.
            </span>
          </div>

          {/* The report — written directly into the workspace body, navigable. */}
          <ConstructionReport draft={draft} animate={animateReport} />

          {/* Raw drawer */}
          <div>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-[length:var(--ct-text-xs)] ct-text-muted underline-offset-2 hover:underline"
            >
              {showRaw ? "Hide" : "Show"} raw construction JSON
            </button>
            {showRaw ? (
              <pre className="mt-(--ct-space-2) max-h-96 overflow-auto rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-page p-(--ct-space-3) mono text-[length:var(--ct-text-xs)] ct-text-muted">
                {JSON.stringify(draft, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
