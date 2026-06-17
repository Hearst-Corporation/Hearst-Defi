"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

function parseAssumption(line: string): { key: string | null; value: string } {
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) return { key: null, value: line };
  const key = line.slice(0, eqIdx).trim().replace(/_/g, " ");
  const value = line.slice(eqIdx + 1).trim();
  return { key, value };
}

interface AssumptionsListProps {
  assumptions: string[];
}

export function AssumptionsList({ assumptions }: AssumptionsListProps) {
  const [expanded, setExpanded] = useState(false);
  const THRESHOLD = 5;
  const shouldTruncate = assumptions.length > THRESHOLD;
  const visible =
    shouldTruncate && !expanded ? assumptions.slice(0, THRESHOLD) : assumptions;

  return (
    <div>
      <ul className="admin-doc-stack--tight">
        {visible.map((line, i) => {
          const { key, value } = parseAssumption(line);
          return (
            <li key={i} className="admin-doc-inline-row admin-doc-inline-row--start body-sm flex-nowrap">
              <span
                className="mt-0.5 shrink-0 ct-text-micro-size ct-text-strong"
                aria-hidden
              >
                ▸
              </span>
              <div className="admin-doc-stack admin-doc-stack--tight flex-1 min-w-0">
                {key !== null ? (
                  <span>
                    <span className="font-semibold capitalize ct-text-body">
                      {key}
                    </span>
                    <span className="ct-text-muted">: </span>
                    <span className="mono ct-text-body">{value}</span>
                  </span>
                ) : (
                  <span className="ct-text-body">{value}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {shouldTruncate ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((x) => !x)}
          className="mt-[var(--ct-space-3)] ct-text-strong hover:ct-text-strong"
        >
          {expanded
            ? "Show less"
            : `Show ${assumptions.length - THRESHOLD} more`}
        </Button>
      ) : null}
    </div>
  );
}
