"use client";

import { useId } from "react";
import { useForbiddenWords, type ForbiddenMatch } from "@/lib/hooks/use-forbidden-words";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface BaseProps {
  value: string;
  onChange: (value: string) => void;
  /** Optional extra className forwarded to the input / textarea element. */
  className?: string;
  /** Forwarded to the underlying element. */
  placeholder?: string;
  /** Forwarded to the underlying element (textarea only). */
  rows?: number;
  /** Whether the underlying element is a textarea. Defaults to `false`. */
  multiline?: boolean;
  /** aria-label for the element. */
  "aria-label"?: string;
  /** id forwarded to input — auto-generated if not provided. */
  id?: string;
  /** maxLength forwarded to input. */
  maxLength?: number;
}

// ---------------------------------------------------------------------------
// Internal: squiggle underline chip list
// ---------------------------------------------------------------------------

function ForbiddenWordList({ matches }: { matches: ForbiddenMatch[] }) {
  if (matches.length === 0) return null;

  return (
    <ul
      role="alert"
      aria-live="polite"
      className="admin-doc-inline-row admin-doc-inline-row--dense mt-1"
    >
      {matches.map((m) => (
        <li
          key={`${m.word}-${m.index}`}
          className="ct-forbidden-chip"
        >
          {/* squiggle decoration */}
          <span
            aria-hidden="true"
            className="ct-squiggle"
          />
          <span>{m.word}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// ForbiddenWordsInput — wraps <input> or <textarea>
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for a plain `<input>` or `<textarea>` that adds
 * live forbidden-word detection with a red squiggle underline (rendered as
 * a chip list below the field).
 *
 * Usage:
 * ```tsx
 * <ForbiddenWordsInput
 *   value={form.name}
 *   onChange={(v) => set("name", v)}
 *   className="ct-input w-full"
 * />
 * ```
 */
export function ForbiddenWordsInput({
  value,
  onChange,
  className,
  placeholder,
  rows,
  multiline = false,
  "aria-label": ariaLabel,
  id: idProp,
  maxLength,
}: BaseProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const matches = useForbiddenWords(value);
  const hasViolations = matches.length > 0;

  const sharedProps = {
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    placeholder,
    maxLength,
    "aria-label": ariaLabel,
    "aria-invalid": hasViolations || undefined,
    "aria-describedby": hasViolations ? `${id}-forbidden` : undefined,
    className: cn(
      className,
      hasViolations &&
        "ring-1 ring-(--ct-status-danger) focus:ring-(--ct-status-danger)",
    ),
  };

  return (
    <div className="relative w-full">
      {multiline ? (
        <textarea {...sharedProps} rows={rows ?? 3} />
      ) : (
        <input {...sharedProps} />
      )}

      {hasViolations && (
        <div id={`${id}-forbidden`}>
          <ForbiddenWordList matches={matches} />
        </div>
      )}
    </div>
  );
}
