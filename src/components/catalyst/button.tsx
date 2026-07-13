import * as Headless from '@headlessui/react'
import { cn } from '@/lib/cn'
import React, { forwardRef } from 'react'
import { Link } from './link'

/** Canonical accent fill — prefer `color="accent"` over Tailwind green/emerald. */
const accentColor = [
  'text-[var(--ct-bg-deep)] [--btn-hover-overlay:color-mix(in_srgb,var(--ct-bg-deep)_12%,transparent)] [--btn-bg:var(--ct-accent)] [--btn-border:var(--ct-accent)]',
  '[--btn-icon:var(--ct-bg-deep)] data-active:[--btn-icon:var(--ct-bg-deep)] data-hover:[--btn-icon:var(--ct-bg-deep)]',
] as const

const styles = {
  base: [
    // Base
    'relative isolate inline-flex items-baseline justify-center gap-x-2 rounded-lg border text-base/6 font-semibold',
    // Sizing
    'px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6',
    // Focus — accent token (canon Hearst), never the raw Tailwind blue.
    'focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:[outline-color:var(--ct-accent)]',
    // Disabled
    'data-disabled:opacity-[var(--ct-opacity-50)]',
    // Icon
    '*:data-[slot=icon]:-mx-0.5 *:data-[slot=icon]:my-0.5 *:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:self-center *:data-[slot=icon]:text-(--btn-icon) sm:*:data-[slot=icon]:my-1 sm:*:data-[slot=icon]:size-4 forced-colors:[--btn-icon:ButtonText] forced-colors:data-hover:[--btn-icon:ButtonText]',
  ],
  solid: [
    // Dark-only canon: bg on control, soft border, hover via `after` overlay
    'border-[var(--ct-border-soft)] bg-(--btn-bg)',
    'before:hidden',
    'after:absolute after:-inset-px after:-z-10 after:rounded-lg',
    'after:shadow-[inset_0_1px_color-mix(in_srgb,var(--ct-text-strong)_15%,transparent)]',
    'data-active:after:bg-(--btn-hover-overlay) data-hover:after:bg-(--btn-hover-overlay)',
    'data-disabled:before:shadow-none data-disabled:after:shadow-none',
  ],
  outline: [
    'border-[var(--ct-border-strong)] text-[var(--ct-text-strong)] [--btn-bg:transparent]',
    'data-active:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] data-hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)]',
    '[--btn-icon:var(--ct-text-muted)] data-active:[--btn-icon:var(--ct-text-body)] data-hover:[--btn-icon:var(--ct-text-body)]',
  ],
  plain: [
    'border-transparent text-[var(--ct-text-strong)]',
    'data-active:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)] data-hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]',
    '[--btn-icon:var(--ct-text-muted)] data-active:[--btn-icon:var(--ct-text-body)] data-hover:[--btn-icon:var(--ct-text-body)]',
  ],
  insetRing: [
    'rounded-full border-transparent bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)] text-[var(--ct-text-strong)] shadow-none inset-ring inset-ring-[var(--ct-border-soft)] hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_20%,transparent)]',
  ],
  iconOnly: [
    'rounded-full border-transparent bg-(--btn-bg) text-[var(--ct-bg-deep)] shadow-none',
    'before:hidden after:hidden',
    '[--btn-icon:currentColor] data-active:[--btn-icon:currentColor] data-hover:[--btn-icon:currentColor]',
  ],
  colors: {
    'dark/zinc': [
      'text-[var(--ct-text-strong)] [--btn-bg:color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] [--btn-border:var(--ct-border)]/90 [--btn-hover-overlay:var(--ct-text-strong)]/5',
      '[--btn-icon:var(--ct-text-body)] data-active:[--btn-icon:var(--ct-text-body)] data-hover:[--btn-icon:var(--ct-text-body)]',
    ],
    light: [
      'text-white [--btn-bg:color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] [--btn-border:var(--ct-border)]/10 [--btn-hover-overlay:var(--ct-text-strong)]/5',
      '[--btn-icon:var(--ct-text-muted)] data-active:[--btn-icon:var(--ct-text-body)] data-hover:[--btn-icon:var(--ct-text-body)]',
    ],
    'dark/white': [
      'text-[var(--ct-bg-deep)] [--btn-bg:var(--ct-text-strong)] [--btn-border:var(--ct-border)]/90 [--btn-hover-overlay:var(--ct-bg-deep)]/5',
      '[--btn-icon:var(--ct-text-muted)] data-active:[--btn-icon:var(--ct-text-body)] data-hover:[--btn-icon:var(--ct-text-body)]',
    ],
    dark: [
      'text-[var(--ct-text-strong)] [--btn-bg:color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] [--btn-border:var(--ct-border)]/90 [--btn-hover-overlay:var(--ct-text-strong)]/5',
      '[--btn-icon:var(--ct-text-body)] data-active:[--btn-icon:var(--ct-text-body)] data-hover:[--btn-icon:var(--ct-text-body)]',
    ],
    white: [
      'text-[var(--ct-bg-deep)] [--btn-bg:var(--ct-surface-card)] [--btn-border:var(--ct-border)]/10 [--btn-hover-overlay:var(--ct-bg-deep)]/5',
      '[--btn-icon:var(--ct-text-body)] data-active:[--btn-icon:var(--ct-text-muted)] data-hover:[--btn-icon:var(--ct-text-muted)]',
    ],
    zinc: [
      'text-[var(--ct-text-strong)] [--btn-hover-overlay:var(--ct-text-strong)]/5 [--btn-bg:color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] [--btn-border:var(--ct-border)]/90',
      '[--btn-icon:var(--ct-text-body)] data-active:[--btn-icon:var(--ct-text-body)] data-hover:[--btn-icon:var(--ct-text-body)]',
    ],
    accent: [...accentColor],
    /** @deprecated Use `accent` — Tailwind green-600 clashes with `--ct-accent`. */
    green: [...accentColor],
    /** @deprecated Use `accent` — Tailwind emerald-600 clashes with `--ct-accent`. */
    emerald: [...accentColor],
    indigo: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-indigo-500)] [--btn-border:var(--color-indigo-600)]/90',
      '[--btn-icon:var(--color-indigo-300)] data-active:[--btn-icon:var(--color-indigo-200)] data-hover:[--btn-icon:var(--color-indigo-200)]',
    ],
    cyan: [
      'text-[var(--ct-bg-deep)] [--btn-bg:var(--color-cyan-300)] [--btn-border:var(--color-cyan-400)]/80 [--btn-hover-overlay:var(--color-white)]/25',
      '[--btn-icon:var(--color-cyan-500)]',
    ],
    red: [
      'text-white [--btn-hover-overlay:var(--ct-text-strong)]/10 [--btn-bg:var(--ct-status-danger)] [--btn-border:var(--ct-status-danger-border)]/90',
      '[--btn-icon:var(--ct-status-danger-soft)] data-active:[--btn-icon:var(--ct-status-danger-soft)] data-hover:[--btn-icon:var(--ct-status-danger-soft)]',
    ],
    orange: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-orange-500)] [--btn-border:var(--color-orange-600)]/90',
      '[--btn-icon:var(--color-orange-300)] data-active:[--btn-icon:var(--color-orange-200)] data-hover:[--btn-icon:var(--color-orange-200)]',
    ],
    amber: [
      'text-[var(--ct-bg-deep)] [--btn-hover-overlay:var(--ct-text-strong)]/25 [--btn-bg:var(--ct-status-warning)] [--btn-border:var(--ct-status-warning-border)]/80',
      '[--btn-icon:var(--ct-status-warning-border)]',
    ],
    yellow: [
      'text-[var(--ct-bg-deep)] [--btn-hover-overlay:var(--color-white)]/25 [--btn-bg:var(--color-yellow-300)] [--btn-border:var(--color-yellow-400)]/80',
      '[--btn-icon:var(--color-yellow-600)] data-active:[--btn-icon:var(--color-yellow-700)] data-hover:[--btn-icon:var(--color-yellow-700)]',
    ],
    lime: [
      'text-[var(--ct-bg-deep)] [--btn-hover-overlay:var(--color-white)]/25 [--btn-bg:var(--color-lime-300)] [--btn-border:var(--color-lime-400)]/80',
      '[--btn-icon:var(--color-lime-600)] data-active:[--btn-icon:var(--color-lime-700)] data-hover:[--btn-icon:var(--color-lime-700)]',
    ],
    teal: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-teal-600)] [--btn-border:var(--color-teal-700)]/90',
      '[--btn-icon:var(--color-white)]/60 data-active:[--btn-icon:var(--color-white)]/80 data-hover:[--btn-icon:var(--color-white)]/80',
    ],
    sky: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-sky-500)] [--btn-border:var(--color-sky-600)]/80',
      '[--btn-icon:var(--color-white)]/60 data-active:[--btn-icon:var(--color-white)]/80 data-hover:[--btn-icon:var(--color-white)]/80',
    ],
    blue: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-blue-600)] [--btn-border:var(--color-blue-700)]/90',
      '[--btn-icon:var(--color-blue-400)] data-active:[--btn-icon:var(--color-blue-300)] data-hover:[--btn-icon:var(--color-blue-300)]',
    ],
    violet: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-violet-500)] [--btn-border:var(--color-violet-600)]/90',
      '[--btn-icon:var(--color-violet-300)] data-active:[--btn-icon:var(--color-violet-200)] data-hover:[--btn-icon:var(--color-violet-200)]',
    ],
    purple: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-purple-500)] [--btn-border:var(--color-purple-600)]/90',
      '[--btn-icon:var(--color-purple-300)] data-active:[--btn-icon:var(--color-purple-200)] data-hover:[--btn-icon:var(--color-purple-200)]',
    ],
    fuchsia: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-fuchsia-500)] [--btn-border:var(--color-fuchsia-600)]/90',
      '[--btn-icon:var(--color-fuchsia-300)] data-active:[--btn-icon:var(--color-fuchsia-200)] data-hover:[--btn-icon:var(--color-fuchsia-200)]',
    ],
    pink: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-pink-500)] [--btn-border:var(--color-pink-600)]/90',
      '[--btn-icon:var(--color-pink-300)] data-active:[--btn-icon:var(--color-pink-200)] data-hover:[--btn-icon:var(--color-pink-200)]',
    ],
    rose: [
      'text-white [--btn-hover-overlay:var(--color-white)]/10 [--btn-bg:var(--color-rose-500)] [--btn-border:var(--color-rose-600)]/90',
      '[--btn-icon:var(--color-rose-300)] data-active:[--btn-icon:var(--color-rose-200)] data-hover:[--btn-icon:var(--color-rose-200)]',
    ],
  },
}

type ButtonProps = (
  | { color?: keyof typeof styles.colors; outline?: never; plain?: never; insetRing?: never; iconOnly?: never }
  | { color?: never; outline: true; plain?: never; insetRing?: never; iconOnly?: never }
  | { color?: never; outline?: never; plain: true; insetRing?: never; iconOnly?: never }
  | { color?: never; outline?: never; plain?: never; insetRing: true; iconOnly?: never }
  | { color?: keyof typeof styles.colors; outline?: never; plain?: never; insetRing?: never; iconOnly: true }
) & { className?: string; children: React.ReactNode } & (
    | ({ href?: never } & Omit<Headless.ButtonProps, 'as' | 'className'>)
    | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>)
  )

export const Button = forwardRef(function Button(
  { color, outline, plain, insetRing, iconOnly, className, children, ...props }: ButtonProps,
  ref: React.ForwardedRef<HTMLElement>
) {
  const classes = cn(
    className,
    // When using insetRing or iconOnly, we bypass styles.base which forces rounded-lg and hardcoded paddings
    (insetRing || iconOnly) ? '' : styles.base,
    // Add base interactivity classes for custom buttons
    (insetRing || iconOnly) ? 'relative inline-flex items-center justify-center focus:outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2' : '',
    outline 
      ? styles.outline 
      : plain 
      ? styles.plain 
      : insetRing 
      ? styles.insetRing 
      : iconOnly
      ? cn(styles.iconOnly, styles.colors[color ?? 'dark/zinc'])
      : cn(styles.solid, styles.colors[color ?? 'dark/zinc'])
  )

  return typeof props.href === 'string' ? (
    <Link {...props} className={classes} ref={ref as React.ForwardedRef<HTMLAnchorElement>}>
      <TouchTarget>{children}</TouchTarget>
    </Link>
  ) : (
    <Headless.Button {...props} className={cn(classes, 'cursor-default')} ref={ref}>
      <TouchTarget>{children}</TouchTarget>
    </Headless.Button>
  )
})

/**
 * Expand the hit area to at least 44×44px on touch devices
 */
export function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 pointer-fine:hidden"
        aria-hidden="true"
      />
      {children}
    </>
  )
}
