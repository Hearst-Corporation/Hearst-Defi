'use client'

import * as Headless from '@headlessui/react'
import { cn } from '@/lib/cn'
import { useState } from 'react'

export function Combobox<T>({
  options,
  displayValue,
  filter,
  anchor = 'bottom',
  className,
  placeholder,
  autoFocus,
  'aria-label': ariaLabel,
  children,
  ...props
}: {
  options: T[]
  displayValue: (value: T | null) => string | undefined
  filter?: (value: T, query: string) => boolean
  className?: string
  placeholder?: string
  autoFocus?: boolean
  'aria-label'?: string
  children: (value: NonNullable<T>) => React.ReactElement
} & Omit<Headless.ComboboxProps<T, false>, 'as' | 'multiple' | 'children'> & { anchor?: 'top' | 'bottom' }) {
  const [query, setQuery] = useState('')

  const filteredOptions =
    query === ''
      ? options
      : options.filter((option) =>
          filter ? filter(option, query) : displayValue(option)?.toLowerCase().includes(query.toLowerCase())
        )

  return (
    <Headless.Combobox {...props} multiple={false} virtual={{ options: filteredOptions }} onClose={() => setQuery('')}>
      <span
        data-slot="control"
        className={cn([
          className,
          // Basic layout
          'relative block w-full',
          // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-[var(--ct-surface-card)] before:shadow-sm',
          // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
          'dark:before:hidden',
          // Focus ring
          'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-[var(--ct-accent)]',
          // Disabled state
          'has-data-disabled:opacity-50 has-data-disabled:before:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] has-data-disabled:before:shadow-none',
          // Invalid state
          'has-data-invalid:before:shadow-[color-mix(in_srgb,var(--ct-status-danger)_10%,transparent)]',
        ])}
      >
        <Headless.ComboboxInput
          autoFocus={autoFocus}
          data-slot="control"
          aria-label={ariaLabel}
          displayValue={(option: T) => displayValue(option) ?? ''}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className={cn([
            className,
            // Basic layout
            'relative block w-full appearance-none rounded-lg py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
            // Horizontal padding
            'pr-[calc(--spacing(10)-1px)] pl-[calc(--spacing(3.5)-1px)] sm:pr-[calc(--spacing(9)-1px)] sm:pl-[calc(--spacing(3)-1px)]',
            // Typography
            'text-base/6 text-[var(--ct-text-strong)] placeholder:text-[var(--ct-text-faint)] sm:text-sm/6 dark:text-[var(--ct-text-strong)]',
            // Border
            'border border-[var(--ct-border)] data-hover:border-[var(--ct-border-strong)] dark:border-[var(--ct-border)] dark:data-hover:border-[var(--ct-border-strong)]',
            // Background color
            'bg-transparent dark:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)]',
            // Hide default focus styles
            'focus:outline-hidden',
            // Invalid state
            'data-invalid:border-[var(--ct-status-danger)] data-invalid:data-hover:border-[var(--ct-status-danger)] dark:data-invalid:border-[var(--ct-status-danger)] dark:data-invalid:data-hover:border-[var(--ct-status-danger)]',
            // Disabled state
            'data-disabled:border-[var(--ct-border-strong)] dark:data-disabled:border-[var(--ct-border-strong)] dark:data-disabled:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)] dark:data-hover:data-disabled:border-[var(--ct-border-strong)]',
            // System icons
            'dark:scheme-dark',
          ])}
        />
        <Headless.ComboboxButton className="group absolute inset-y-0 right-0 flex items-center px-2">
          <svg
            className="size-5 stroke-[var(--ct-text-muted)] group-data-disabled:stroke-[var(--ct-text-muted)] group-data-hover:stroke-[var(--ct-text-muted)] sm:size-4 dark:stroke-[var(--ct-text-muted)] dark:group-data-hover:stroke-[var(--ct-text-body)] forced-colors:stroke-[CanvasText]"
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
          >
            <path d="M5.75 10.75L8 13L10.25 10.75" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.25 5.25L8 3L5.75 5.25" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Headless.ComboboxButton>
      </span>
      <Headless.ComboboxOptions
        transition
        anchor={anchor}
        className={cn(
          // Anchor positioning
          '[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(4)] sm:data-[anchor~=start]:[--anchor-offset:-4px]',
          // Base styles,
          'isolate min-w-[calc(var(--input-width)+8px)] scroll-py-1 rounded-xl p-1 select-none empty:invisible',
          // Invisible border that is only visible in `forced-colors` mode for accessibility purposes
          'outline outline-transparent focus:outline-hidden',
          // Handle scrolling when menu won't fit in viewport
          'overflow-y-scroll overscroll-contain',
          // Popover background
          'bg-[color-mix(in_srgb,var(--ct-surface-card)_75%,transparent)] backdrop-blur-xl dark:bg-[color-mix(in_srgb,var(--ct-surface-card)_75%,transparent)]',
          // Shadows
          'shadow-lg ring-1 ring-[var(--ct-border)] dark:ring-[var(--ct-border)] dark:ring-inset',
          // Transitions
          'transition-opacity duration-100 ease-in data-closed:data-leave:opacity-0 data-transition:pointer-events-none'
        )}
      >
        {({ option }) => children(option)}
      </Headless.ComboboxOptions>
    </Headless.Combobox>
  )
}

export function ComboboxOption<T>({
  children,
  className,
  ...props
}: { className?: string; children?: React.ReactNode } & Omit<
  Headless.ComboboxOptionProps<'div', T>,
  'as' | 'className'
>) {
  const sharedClasses = cn(
    // Base
    'flex min-w-0 items-center',
    // Icons
    '*:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 sm:*:data-[slot=icon]:size-4',
    '*:data-[slot=icon]:text-[var(--ct-text-faint)] group-data-focus/option:*:data-[slot=icon]:text-[var(--ct-bg-deep)] dark:*:data-[slot=icon]:text-[var(--ct-text-muted)]',
    'forced-colors:*:data-[slot=icon]:text-[CanvasText] forced-colors:group-data-focus/option:*:data-[slot=icon]:text-[Canvas]',
    // Avatars
    '*:data-[slot=avatar]:-mx-0.5 *:data-[slot=avatar]:size-6 sm:*:data-[slot=avatar]:size-5'
  )

  return (
    <Headless.ComboboxOption
      {...props}
      className={cn(
        // Basic layout
        'group/option grid w-full cursor-default grid-cols-[1fr_--spacing(5)] items-baseline gap-x-2 rounded-lg py-2.5 pr-2 pl-3.5 sm:grid-cols-[1fr_--spacing(4)] sm:py-1.5 sm:pr-2 sm:pl-3',
        // Typography
        'text-base/6 text-[var(--ct-text-strong)] sm:text-sm/6 dark:text-[var(--ct-text-strong)] forced-colors:text-[CanvasText]',
        // Focus
        'outline-hidden data-focus:bg-[var(--ct-accent)] data-focus:text-[var(--ct-bg-deep)]',
        // Forced colors mode
        'forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText]',
        // Disabled
        'data-disabled:opacity-50'
      )}
    >
      <span className={cn(className, sharedClasses)}>{children}</span>
      <svg
        className="relative col-start-2 hidden size-5 self-center stroke-current group-data-selected/option:inline sm:size-4"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 8.5l3 3L12 4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Headless.ComboboxOption>
  )
}

export function ComboboxLabel({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return <span {...props} className={cn(className, 'ml-2.5 truncate first:ml-0 sm:ml-2 sm:first:ml-0')} />
}

export function ComboboxDescription({ className, children, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      className={cn(
        className,
        'flex flex-1 overflow-hidden text-[var(--ct-text-faint)] group-data-focus/option:text-[var(--ct-bg-deep)] before:w-2 before:min-w-0 before:shrink dark:text-[var(--ct-text-muted)]'
      )}
    >
      <span className="flex-1 truncate">{children}</span>
    </span>
  )
}
