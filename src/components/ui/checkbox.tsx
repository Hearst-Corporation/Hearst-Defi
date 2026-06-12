"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface CheckboxProps {
  id?: string;
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  "aria-checked"?: boolean;
}

/** DS checkbox — sr-only native input + custom accent box (invest + onboarding). */
export function Checkbox({
  id,
  name,
  checked,
  onChange,
  children,
  className,
  labelClassName,
  "aria-checked": ariaChecked,
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn("ct-checkbox group", className)}
    >
      <span className="ct-checkbox__control">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          aria-checked={ariaChecked ?? checked}
        />
        <span
          aria-hidden
          className={cn(
            "ct-checkbox__box",
            checked && "ct-checkbox__box--checked",
          )}
        >
          {checked ? <span className="ct-checkbox__mark" /> : null}
        </span>
      </span>
      <span className={cn("ct-checkbox__label body-sm ct-text-body", labelClassName)}>
        {children}
      </span>
    </label>
  );
}
