import * as Headless from '@headlessui/react'
import { cn } from '@/lib/cn'
import React, { forwardRef } from 'react'
import { TouchTarget } from './button'
import { Link } from './link'

// Catalyst variant map: KEYS are the public colour API (unchanged); VALUES tokenized to --ct-*.
// Hues without a dedicated --ct token fold onto the nearest status token (warning / info / success / unaudited).
const badgeDanger =
  'bg-[color-mix(in_srgb,var(--ct-status-danger)_15%,transparent)] text-[var(--ct-status-danger)] group-data-hover:bg-[color-mix(in_srgb,var(--ct-status-danger)_25%,transparent)]'
const badgeWarning =
  'bg-[color-mix(in_srgb,var(--ct-status-warning)_15%,transparent)] text-[var(--ct-status-warning)] group-data-hover:bg-[color-mix(in_srgb,var(--ct-status-warning)_25%,transparent)]'
const badgeSuccess =
  'bg-[color-mix(in_srgb,var(--ct-status-success)_15%,transparent)] text-[var(--ct-status-success)] group-data-hover:bg-[color-mix(in_srgb,var(--ct-status-success)_25%,transparent)]'
const badgeInfo =
  'bg-[color-mix(in_srgb,var(--ct-status-info)_15%,transparent)] text-[var(--ct-status-info)] group-data-hover:bg-[color-mix(in_srgb,var(--ct-status-info)_25%,transparent)]'
const badgeUnaudited =
  'bg-[color-mix(in_srgb,var(--ct-status-unaudited)_15%,transparent)] text-[var(--ct-status-unaudited)] group-data-hover:bg-[color-mix(in_srgb,var(--ct-status-unaudited)_25%,transparent)]'

const colors = {
  red: badgeDanger,
  orange: badgeWarning,
  amber: badgeWarning,
  yellow: badgeWarning,
  lime: badgeWarning,
  green: badgeSuccess,
  emerald: badgeSuccess,
  teal: badgeSuccess,
  cyan: badgeInfo,
  sky: badgeInfo,
  blue: badgeInfo,
  indigo: badgeInfo,
  violet: badgeUnaudited,
  purple: badgeUnaudited,
  fuchsia: badgeUnaudited,
  pink: badgeUnaudited,
  rose: badgeUnaudited,
  zinc: 'bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)] group-data-hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]',
}

type BadgeProps = { color?: keyof typeof colors }

export function Badge({ color = 'zinc', className, children, ...props }: BadgeProps & React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      className={cn(
        className,
        // On remplace le rounded-md par rounded-full et on ajoute les inset-ring pour correspondre au design demandé
        'inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-sm/5 font-medium sm:text-xs/5 inset-ring inset-ring-[var(--ct-border)] forced-colors:outline',
        colors[color]
      )}
    >
      <svg viewBox="0 0 6 6" aria-hidden="true" className={cn(
        "size-1.5",
        // Map les couleurs du point SVG en fonction de la couleur du badge
        color === 'red' && "fill-[var(--ct-status-danger)]",
        (color === 'amber' || color === 'orange' || color === 'yellow' || color === 'lime') && "fill-[var(--ct-status-warning)]",
        (color === 'green' || color === 'emerald' || color === 'teal') && "fill-[var(--ct-status-success)]",
        (color === 'blue' || color === 'sky' || color === 'cyan' || color === 'indigo') && "fill-[var(--ct-status-info)]",
        (color === 'purple' || color === 'violet' || color === 'fuchsia' || color === 'pink' || color === 'rose') && "fill-[var(--ct-status-unaudited)]",
        color === 'zinc' && "fill-[var(--ct-text-muted)]"
      )}>
        <circle r="3" cx="3" cy="3" />
      </svg>
      {children}
    </span>
  )
}

export const BadgeButton = forwardRef(function BadgeButton(
  {
    color = 'zinc',
    className,
    children,
    ...props
  }: BadgeProps & { className?: string; children: React.ReactNode } & (
      | ({ href?: never } & Omit<Headless.ButtonProps, 'as' | 'className'>)
      | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>)
    ),
  ref: React.ForwardedRef<HTMLElement>
) {
  const classes = cn(
    className,
    // Focus ring = accent token (canon Hearst), never the raw Tailwind blue.
    'group relative inline-flex rounded-md focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:[outline-color:var(--ct-accent)]'
  )

  return typeof props.href === 'string' ? (
    <Link {...props} className={classes} ref={ref as React.ForwardedRef<HTMLAnchorElement>}>
      <TouchTarget>
        <Badge color={color}>{children}</Badge>
      </TouchTarget>
    </Link>
  ) : (
    <Headless.Button {...props} className={classes} ref={ref}>
      <TouchTarget>
        <Badge color={color}>{children}</Badge>
      </TouchTarget>
    </Headless.Button>
  )
})
