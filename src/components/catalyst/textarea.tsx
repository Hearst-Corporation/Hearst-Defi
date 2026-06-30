import * as Headless from '@headlessui/react'
import { cn } from '@/lib/cn'
import React, { forwardRef } from 'react'

export const Textarea = forwardRef(function Textarea(
  {
    className,
    resizable = true,
    ...props
  }: { className?: string; resizable?: boolean } & Omit<Headless.TextareaProps, 'as' | 'className'>,
  ref: React.ForwardedRef<HTMLTextAreaElement>
) {
  return (
    <span
      data-slot="control"
      className={cn([
        className,
        // Basic layout
        'relative block w-full',
        // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
        'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-[var(--ct-surface-card)] before:shadow-[var(--ct-shadow-soft)]',
        // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
        'dark:before:hidden',
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-[var(--ct-accent)]',
        // Disabled state
        'has-data-disabled:opacity-[var(--ct-opacity-50)] has-data-disabled:before:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] has-data-disabled:before:shadow-none',
      ])}
    >
      <Headless.Textarea
        ref={ref}
        {...props}
        className={cn([
          // Basic layout
          'relative block h-full w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
          // Typography
          'text-base/6 text-[var(--ct-text-strong)] placeholder:text-[var(--ct-text-faint)] sm:text-sm/6',
          // Border
          'border border-[var(--ct-border)] data-hover:border-[var(--ct-border-strong)]',
          // Background color
          'bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)]',
          // Hide default focus styles
          'focus:outline-hidden',
          // Invalid state
          'data-invalid:border-[var(--ct-status-danger)] data-invalid:data-hover:border-[var(--ct-status-danger)]',
          // Disabled state
          'disabled:border-[var(--ct-border-strong)] disabled:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)] data-hover:disabled:border-[var(--ct-border-strong)]',
          // Resizable
          resizable ? 'resize-y' : 'resize-none',
        ])}
      />
    </span>
  )
})
