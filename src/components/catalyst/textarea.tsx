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
        'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
        // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
        'dark:before:hidden',
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-[var(--ct-accent)]',
        // Disabled state
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
      ])}
    >
      <Headless.Textarea
        ref={ref}
        {...props}
        className={cn([
          // Basic layout
          'relative block h-full w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
          // Typography
          'text-base/6 text-zinc-950 placeholder:text-[var(--ct-text-faint)] sm:text-sm/6 dark:text-white',
          // Border
          'border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-[var(--ct-border)] dark:data-hover:border-[var(--ct-border-strong)]',
          // Background color
          'bg-transparent dark:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)]',
          // Hide default focus styles
          'focus:outline-hidden',
          // Invalid state
          'data-invalid:border-red-500 data-invalid:data-hover:border-red-500 dark:data-invalid:border-red-600 dark:data-invalid:data-hover:border-red-600',
          // Disabled state
          'disabled:border-zinc-950/20 dark:disabled:border-[var(--ct-border-strong)] dark:disabled:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)] dark:data-hover:disabled:border-[var(--ct-border-strong)]',
          // Resizable
          resizable ? 'resize-y' : 'resize-none',
        ])}
      />
    </span>
  )
})
