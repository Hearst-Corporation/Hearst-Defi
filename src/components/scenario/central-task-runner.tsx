"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { ScenarioOutput } from "@/lib/engine/types";

interface CentralTaskRunnerProps {
  runId: number;
  objective: string;
  pending: boolean;
  output: ScenarioOutput | null;
  liveBtcPrice?: { usd: number; stale: boolean };
}

function appendLine(setter: React.Dispatch<React.SetStateAction<string[]>>, line: string): void {
  setter((prev) => (prev.at(-1) === line ? prev : [...prev, line]));
}

export function CentralTaskRunner({
  runId,
  objective,
  pending,
  output,
  liveBtcPrice,
}: CentralTaskRunnerProps) {
  const [lines, setLines] = useState<string[]>(
    runId > 0
      ? [
          "[01] Initialisation du workspace central…",
          "[02] Préparation des hypothèses et bornes de risque…",
          "[03] Préparation des assets projetables (APY, drawdown, allocation)…",
        ]
      : [],
  );
  const [typed, setTyped] = useState(runId > 0 ? "" : "");
  const pendingLoggedForRun = useRef<number>(0);
  const outputLoggedForRun = useRef<number>(0);
  const initializedRunRef = useRef<number>(runId);

  const introLine = useMemo(() => {
    const cleaned = objective.trim();
    return cleaned.length > 0
      ? `Agent central > Nouvelle tâche: ${cleaned}`
      : "Agent central > Nouvelle tâche scenario.";
  }, [objective]);

  const status = useMemo(() => {
    if (runId <= 0) {
      return {
        label: "Idle",
        toneClass: "ct-status-info-bg ct-bc-soft-50",
        dotClass: "ct-status-dot-info",
      };
    }
    if (pending) {
      return {
        label: "Running",
        toneClass: "ct-status-warning-bg ct-bc-warning",
        dotClass: "ct-status-dot-warning",
      };
    }
    if (output) {
      return {
        label: "Completed",
        toneClass: "ct-status-success-bg ct-bc-success",
        dotClass: "ct-status-dot-success",
      };
    }
    return {
      label: "Queued",
      toneClass: "ct-status-info-bg ct-bc-soft-50",
      dotClass: "ct-status-dot-info",
    };
  }, [output, pending, runId]);

  const stepItems = useMemo(
    () =>
      lines.map((line, idx) => {
        const match = line.match(/^\[(\d+)\]\s*(.*)$/);
        return {
          key: `${idx}-${line}`,
          index: match?.[1] ?? String(idx + 1).padStart(2, "0"),
          text: match?.[2] ?? line,
          isActive: idx === lines.length - 1 && pending,
        };
      }),
    [lines, pending],
  );

  useEffect(() => {
    if (runId <= 0) return;
    if (initializedRunRef.current !== runId) {
      initializedRunRef.current = runId;
      pendingLoggedForRun.current = 0;
      outputLoggedForRun.current = 0;
      setLines([
        "[01] Initialisation du workspace central…",
        "[02] Préparation des hypothèses et bornes de risque…",
        "[03] Préparation des assets projetables (APY, drawdown, allocation)…",
      ]);
      setTyped("");
    }

    let i = 0;
    const typing = setInterval(() => {
      i += 1;
      setTyped(introLine.slice(0, i));
      if (i >= introLine.length) clearInterval(typing);
    }, 12);

    return () => clearInterval(typing);
  }, [introLine, runId]);

  useEffect(() => {
    if (runId <= 0 || !pending || pendingLoggedForRun.current === runId) return;
    pendingLoggedForRun.current = runId;
    appendLine(setLines, "[04] Calcul en cours: projections et stress tests…");
  }, [pending, runId]);

  useEffect(() => {
    if (runId <= 0 || !output || outputLoggedForRun.current === runId) return;
    outputLoggedForRun.current = runId;
    appendLine(
      setLines,
      `[05] Projection prête: APY ${output.apy_range.low.toFixed(1)}% -> ${output.apy_range.high.toFixed(1)}%`,
    );
    appendLine(
      setLines,
      `[06] Scores: risk=${output.risk_score.toFixed(0)} / mining=${output.mining_margin_score.toFixed(0)}`,
    );
    appendLine(setLines, "[07] Assets centraux rendus: graphique NAV + panel allocation.");
  }, [output, runId]);

  return (
    <Card
      className="scenario-lab-input-card p-0"
      hoverOverlay={false}
      data-state={pending ? "active" : undefined}
    >
      <div className="scenario-lab-input-card__header">
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--baseline w-full min-w-0">
          <div className="min-w-0">
            <p className="eyebrow ct-text-muted m-0">Central flow</p>
            <h4 className="h4 mt-0.5">Task console</h4>
          </div>
          <div className="admin-doc-inline-row admin-doc-inline-row--dense shrink-0">
            {liveBtcPrice ? (
              <span className="mono body-xs tabular-nums ct-text-muted">
                BTC ${liveBtcPrice.usd.toFixed(2)}{" "}
                {liveBtcPrice.stale ? "(stale)" : "(live)"}
              </span>
            ) : null}
            {runId > 0 ? (
              <Badge variant="default" className="mono body-xs">
                Run #{runId}
              </Badge>
            ) : null}
            <Badge
              variant="default"
              className={cn("mono body-xs transition-colors duration-150", status.toneClass)}
            >
              <span className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status.dotClass,
                    pending ? "animate-pulse" : "",
                  )}
                  aria-hidden
                />
                {status.label}
              </span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="scenario-central-flow-console">
        <div className="scenario-central-flow-terminal">
          <pre className="mono whitespace-pre-wrap body-sm ct-text-body m-0">
            {typed}
            {runId > 0 ? <span className="scenario-central-flow-caret">|</span> : null}
          </pre>
        </div>

        {stepItems.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {stepItems.map((step) => (
              <li
                key={step.key}
                data-state={step.isActive ? "pending" : "done"}
                className={cn(
                  "scenario-central-flow-line group transition-colors duration-150",
                  step.isActive ? "ct-surface-2" : "ct-surface-1",
                )}
              >
                <span
                  className={cn(
                    "mono body-xs mt-0.5 inline-flex h-5 min-w-8 items-center justify-center rounded-sm px-1.5",
                    step.isActive ? "ct-status-warning-bg ct-bc-warning animate-pulse" : "ct-pill",
                  )}
                >
                  {step.index}
                </span>
                <span
                  className={cn(
                    "body-sm leading-relaxed transition-colors duration-150",
                    step.isActive
                      ? "scenario-central-flow-pending ct-text-strong"
                      : "ct-text-body",
                  )}
                >
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="body-sm ct-text-muted m-0">Aucune execution en cours.</p>
        )}
      </div>
    </Card>
  );
}
