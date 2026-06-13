"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
  /** Si fourni, l'utilisateur doit retaper exactement cette valeur pour activer Confirmer. */
  confirmPhrase?: string;
  /** Async; si rejette, le message d'erreur s'affiche dans la modale et la modale reste ouverte. */
  onConfirm: () => Promise<void>;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CONFIRM_DIALOG_STRINGS = {
  typeToConfirmPrefix: "Tapez",
  typeToConfirmSuffix: "pour confirmer",
  cancel: "Annuler",
} as const;

export function ConfirmDialog(props: ConfirmDialogProps) {
  // Mount the dialog body only while open so transient state (typed phrase,
  // error) initialises fresh on every open without setState-in-effect.
  if (!props.open) return null;
  return <ConfirmDialogBody {...props} />;
}

function ConfirmDialogBody({
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  confirmPhrase,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const errorId = useId();

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const requiresPhrase = confirmPhrase !== undefined;
  const phraseMatches = !requiresPhrase || phrase === confirmPhrase;

  const close = useCallback(() => {
    if (isPending) return;
    onOpenChange(false);
  }, [isPending, onOpenChange]);

  // Capture the trigger, set initial focus on mount, restore focus on unmount.
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const id = window.requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        return;
      }
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
      triggerRef.current?.focus?.();
    };
  }, []);

  // Escape to close + focus trap (Tab / Shift+Tab loop).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await onConfirm();
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-[var(--ct-z-modal)]"
      role="presentation"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
        disabled={isPending}
        className="absolute inset-0 cursor-default bg-[var(--ct-bg-deep)]/70 backdrop-blur-sm disabled:cursor-not-allowed"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          "relative w-full max-w-md rounded-xl border border-[var(--ct-border-strong)]",
          "ct-surface-2 p-6 shadow-[var(--ct-shadow-elevated)] z-[var(--ct-z-base)]",
          "flex flex-col gap-4",
        )}
      >
        <h2 id={titleId} className="h2 shrink-0">
          {title}
        </h2>

        {description && (
          <div id={descId} className="body-sm ct-text-muted">
            {description}
          </div>
        )}

        {requiresPhrase && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`${titleId}-phrase`}
              className="stat-label block"
            >
              {CONFIRM_DIALOG_STRINGS.typeToConfirmPrefix}{" "}
              <span className="mono tabular ct-text-strong">
                {confirmPhrase}
              </span>{" "}
              {CONFIRM_DIALOG_STRINGS.typeToConfirmSuffix}
            </label>
            <input
              ref={inputRef}
              id={`${titleId}-phrase`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={phrase}
              disabled={isPending}
              onChange={(e) => setPhrase(e.target.value)}
              className="ct-input mono tabular"
            />
          </div>
        )}

        {error && (
          <div
            id={errorId}
            role="alert"
            className="ct-status-danger-bg ct-alert-danger"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={close}
            disabled={isPending}
          >
            {CONFIRM_DIALOG_STRINGS.cancel}
          </Button>
          <Button
            variant={confirmVariant}
            size="md"
            onClick={handleConfirm}
            disabled={isPending || !phraseMatches}
            aria-describedby={error ? errorId : undefined}
          >
            {isPending ? "…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
