"use client";

/**
 * Catalyst AccordionCard — canonical collapsible module surface.
 *
 * The DS had no disclosure primitive; Vault Details needs progressively-revealed
 * sections. It renders the canonical `.ct-glass-panel` graphite surface (the same
 * surface `Card` builds on) with a PADDED header and a FULL-BLEED body — so a
 * section component that already owns its `p-5` slots in without double padding,
 * exactly like the `<section>` shells it replaces. It owns the open/close
 * contract so call sites stop hand-rolling `<details>`:
 *  - smooth height motion via a `grid-template-rows: 0fr → 1fr` transition (no
 *    max-height guessing), timed on `--ct-dur-base` / `--ct-ease`;
 *  - a11y: header is a real `<button>` with `aria-expanded` + `aria-controls`,
 *    body is a region labelled by the header, `inert` while collapsed (kept in the
 *    DOM so the open animation can measure it);
 *  - `collapsible={false}` renders a STATIC always-open card (same chrome, no
 *    chevron) — the "hero" variant, so an always-open Position Overview and the
 *    collapsible sections share one visual language;
 *  - `persistKey` remembers open state across visits (localStorage, hydration-safe).
 *
 * Body content is full-bleed: pass a section component that owns its padding, or
 * wrap ad-hoc content in your own padded element. Token-only, dark-mode only.
 */

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface AccordionCardProps {
  /** Section heading. */
  title: string;
  /** Optional one-line description under the title. */
  subtitle?: string;
  /** Numeric prefix rendered before the title (e.g. `1` → "1. Position Overview"). */
  index?: number;
  /** Open on first render. Ignored (forced open) when `collapsible` is false. */
  defaultOpen?: boolean;
  /** false = static hero card, always open, no toggle affordance. Default true. */
  collapsible?: boolean;
  /** localStorage key — persists open state across visits when provided. */
  persistKey?: string;
  /** Trailing header slot (badge, vault selector, actions) — right-aligned. */
  headerTrailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AccordionCard({
  title,
  subtitle,
  index,
  defaultOpen = false,
  collapsible = true,
  persistKey,
  headerTrailing,
  children,
  className,
}: AccordionCardProps) {
  const reactId = useId();
  const bodyId = `${reactId}-body`;
  const headerId = `${reactId}-header`;

  const [open, setOpen] = useState<boolean>(() => {
    if (!collapsible) return true;
    if (!persistKey || typeof window === "undefined") return defaultOpen;
    try {
      const stored = window.localStorage.getItem(`ct-accordion:${persistKey}`);
      if (stored === "1") return true;
      if (stored === "0") return false;
    } catch {
      /* localStorage unavailable — keep defaultOpen */
    }
    return defaultOpen;
  });

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (persistKey) {
        try {
          window.localStorage.setItem(`ct-accordion:${persistKey}`, next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  const heading = (
    <div className="flex min-w-0 flex-col gap-1 text-left">
      <span className="h3 ct-text-strong truncate">
        {index !== undefined ? `${index}. ${title}` : title}
      </span>
      {subtitle ? (
        <span className="ct-metric-caption truncate">{subtitle}</span>
      ) : null}
    </div>
  );

  const trailing =
    headerTrailing || collapsible ? (
      <div className="flex flex-shrink-0 items-center gap-3">
        {headerTrailing}
        {collapsible ? (
          <ChevronDown
            aria-hidden="true"
            className="ct-text-muted"
            style={{
              width: 18,
              height: 18,
              transition: "transform var(--ct-dur-base) var(--ct-ease)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        ) : null}
      </div>
    ) : null;

  const body = (
    <div
      id={bodyId}
      role="region"
      aria-labelledby={headerId}
      className="border-t border-[var(--ct-border-soft)]"
    >
      {children}
    </div>
  );

  return (
    <div className={cn("ct-glass-panel relative overflow-hidden", className)}>
      {collapsible ? (
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
          className="ct-focus-ring flex w-full items-center justify-between gap-3 p-5 text-left"
        >
          {heading}
          {trailing}
        </button>
      ) : (
        <div id={headerId} className="flex w-full items-center justify-between gap-3 p-5">
          {heading}
          {trailing}
        </div>
      )}

      {collapsible ? (
        <div
          className="grid"
          style={{
            gridTemplateRows: open ? "1fr" : "0fr",
            transition: "grid-template-rows var(--ct-dur-base) var(--ct-ease)",
          }}
        >
          <div className="overflow-hidden" style={{ minHeight: 0 }}>
            <div inert={!open ? true : undefined}>{body}</div>
          </div>
        </div>
      ) : (
        body
      )}
    </div>
  );
}
