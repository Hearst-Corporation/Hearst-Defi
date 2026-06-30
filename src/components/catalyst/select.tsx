import * as Headless from '@headlessui/react'
import { cn } from '@/lib/cn'
import React, { forwardRef } from 'react'

export const Select = forwardRef(function Select(
  { className, multiple, ...props }: { className?: string } & Omit<Headless.SelectProps, 'as' | 'className'>,
  ref: React.ForwardedRef<HTMLSelectElement>
) {
  return (
    <span
      data-slot="control"
      className={cn([
        className,
        // Basic layout
        'group relative block w-full',
        // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
        'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-[var(--ct-surface-card)] before:shadow-[var(--ct-shadow-soft)]',
        // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
        'dark:before:hidden',
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset has-data-focus:after:ring-2 has-data-focus:after:ring-[var(--ct-accent)]',
        // Disabled state
        'has-data-disabled:opacity-[var(--ct-opacity-50)] has-data-disabled:before:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] has-data-disabled:before:shadow-none',
      ])}
    >
      <Headless.Select
        ref={ref}
        multiple={multiple}
        {...props}
        className={cn([
          // Basic layout
          'relative block w-full appearance-none rounded-lg py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
          // Horizontal padding
          multiple
            ? 'px-[calc(--spacing(3.5)-1px)] sm:px-[calc(--spacing(3)-1px)]'
            : 'pr-[calc(--spacing(10)-1px)] pl-[calc(--spacing(3.5)-1px)] sm:pr-[calc(--spacing(9)-1px)] sm:pl-[calc(--spacing(3)-1px)]',
          // Options (multi-select)
          '[&_optgroup]:font-semibold',
          // Typography
          'text-base/6 text-[var(--ct-text-strong)] placeholder:text-[var(--ct-text-faint)] sm:text-sm/6 dark:text-[var(--ct-text-strong)] dark:*:text-[var(--ct-text-strong)]',
          // Border
          'border border-[var(--ct-border)] data-hover:border-[var(--ct-border-strong)] dark:border-[var(--ct-border)] dark:data-hover:border-[var(--ct-border-strong)]',
          // Background color
          'bg-transparent dark:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] dark:*:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)]',
          // Hide default focus styles
          'focus:outline-hidden',
          // Invalid state
          'data-invalid:border-[var(--ct-status-danger-border)] data-invalid:data-hover:border-[var(--ct-status-danger-border)] dark:data-invalid:border-[var(--ct-status-danger-border)] dark:data-invalid:data-hover:border-[var(--ct-status-danger-border)]',
          // Disabled state
          'data-disabled:border-[var(--ct-border-strong)] data-disabled:opacity-100 dark:data-disabled:border-[var(--ct-border-strong)] dark:data-disabled:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)] dark:data-hover:data-disabled:border-[var(--ct-border-strong)]',
        ])}
      />
      {!multiple && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            className="size-5 stroke-[var(--ct-text-muted)] group-has-data-disabled:stroke-[var(--ct-text-muted)] sm:size-4 dark:stroke-[var(--ct-text-muted)] forced-colors:stroke-[CanvasText]"
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
          >
            <path d="M5.75 10.75L8 13L10.25 10.75" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.25 5.25L8 3L5.75 5.25" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </span>
  )
})
