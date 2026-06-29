"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { cockpitButtonVariants } from "@/components/catalyst/cockpit-button";
import { cn } from "@/lib/cn";
import {
  constructionDraftToVaultForm,
  encodeVaultFormPrefill,
} from "@/lib/agentic/swarm/live/to-vault-form";
import { ConstructionReport } from "@/components/admin/product-workspace/construction-report";
import type {
  ChartArtifact,
  ProductConstructionDraft,
} from "@/lib/agentic/swarm/live/types";

/**
 * Product Construction panel — the visible output of the six live-read swarms.
 *
 * The admin triggers the pipeline for the current objective; it fetches real
 * market/Telegram data, computes a seeded Monte-Carlo, and returns a numeric,
 * charted, written DRAFT. This panel renders the artefacts richly: a projection
 * fan (p5/p50/p95), the blended-yield allocation, the headline range, the audit
 * trail, and the long-form write-up. Read-only — nothing is created or deployed.
 */

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-xs text-[var(--ct-text-secondary)]">
        <span>{label}</span>
        <span className="font-mono text-[var(--ct-text-strong)]">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[var(--ct-accent)]"
      />
    </label>
  );
}

export function ProductConstructionPanel({
  objective,
}: {
  objective: string | null;
}) {
  const [draft, setDraft] = useState<ProductConstructionDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  // Animate the report's progressive reveal only right after a fresh run.
  const [animateReport, setAnimateReport] = useState(false);

  // ── Monte-Carlo calibration ────────────────────────────────────────────────
  const [preset, setPreset] = useState<"conservative" | "base" | "aggressive">(
    "base",
  );
  // Per-field overrides (percent units in the UI; converted to fractions below).
  const [driftPct, setDriftPct] = useState(10);
  const [volPct, setVolPct] = useState(60);
  const [horizonMonths, setHorizonMonths] = useState(12);
  const [miningWeightPct, setMiningWeightPct] = useState(60);

  const run = useCallback(async () => {
    if (!objective) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-construction/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          preset,
          assumptions: {
            horizonMonths,
            btc: { annualDrift: driftPct / 100, annualVol: volPct / 100 },
            yield: { miningWeight: miningWeightPct / 100 },
          },
        }),
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
  }, [objective, preset, driftPct, volPct, horizonMonths, miningWeightPct]);

  // Download the current report as a PDF. POSTs the draft to the render route,
  // which returns an application/pdf blob. Read-only — renders the existing
  // draft, persists nothing new.
  const downloadPdf = useCallback(async () => {
    if (!draft) return;
    setPdfLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-construction/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `PDF HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${draft.vault.ticker}-construction-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF request failed");
    } finally {
      setPdfLoading(false);
    }
  }, [draft]);

  if (!objective) {
    return (
      <p className="body-sm ct-text-muted">
        Provide an objective to run the construction swarms.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Monte-Carlo calibration — tune the scenario regime before running. Every
          value is clamped server-side; the headline always stays a range. */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--ct-border)] bg-surface-card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="ct-bento-label">Monte-Carlo calibration</span>
          <div className="flex items-center gap-1">
            {(["conservative", "base", "aggressive"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  preset === p
                    ? "border-[var(--ct-accent)] text-[var(--ct-accent)]"
                    : "border-[var(--ct-border)] text-[var(--ct-text-muted)]",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Slider
            label="BTC drift"
            value={driftPct}
            min={-50}
            max={100}
            unit="%/yr"
            onChange={setDriftPct}
          />
          <Slider
            label="BTC vol"
            value={volPct}
            min={10}
            max={150}
            unit="%/yr"
            onChange={setVolPct}
          />
          <Slider
            label="Horizon"
            value={horizonMonths}
            min={1}
            max={60}
            unit="mo"
            onChange={setHorizonMonths}
          />
          <Slider
            label="Mining weight"
            value={miningWeightPct}
            min={0}
            max={100}
            unit="%"
            onChange={setMiningWeightPct}
          />
        </div>
        <p className="text-xs text-[var(--ct-text-tertiary)]">
          A preset seeds drift / vol / mining-weight; the sliders override on top.
          Bounds are enforced server-side. Same inputs ⇒ same seeded fan.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void run()}
          disabled={loading}
        >
          {loading ? "Running swarms…" : "Run construction swarms"}
        </Button>
        <span className="text-xs text-[var(--ct-text-tertiary)]">
          live_read · fetches BTC + hashprice + Telegram + DeFi, computes a seeded
          Monte-Carlo · no write, no send, no deploy
        </span>
        {error ? (
          <span className="text-xs text-[var(--ct-status-danger)]">{error}</span>
        ) : null}
      </div>

      {draft ? (
        <div className="flex flex-col gap-5">
          {/* Actions — wizard hand-off (no DB write) + PDF export of the report. */}
          <div className="flex flex-wrap items-center gap-3">
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void downloadPdf()}
              disabled={pdfLoading}
            >
              {pdfLoading ? "Building PDF…" : "Download PDF"}
            </Button>
            <span className="text-xs text-[var(--ct-text-tertiary)]">
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
              className="text-xs text-[var(--ct-text-muted)] underline-offset-2 hover:underline"
            >
              {showRaw ? "Hide" : "Show"} raw construction JSON
            </button>
            {showRaw ? (
              <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-[var(--ct-border)] bg-surface-page p-3 font-mono text-xs text-[var(--ct-text-muted)]">
                {JSON.stringify(draft, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
