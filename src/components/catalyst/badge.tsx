import * as Headless from '@headlessui/react'
import { cn } from '@/lib/cn'
import React, { forwardRef } from 'react'
import { TouchTarget } from './button'
import { Link } from './link'

const colors = {
  red: 'bg-red-500/15 text-red-700 group-data-hover:bg-red-500/25 dark:bg-red-500/10 dark:text-red-400 dark:group-data-hover:bg-red-500/20',
  orange:
    'bg-orange-500/15 text-orange-700 group-data-hover:bg-orange-500/25 dark:bg-orange-500/10 dark:text-orange-400 dark:group-data-hover:bg-orange-500/20',
  amber:
    'bg-amber-400/20 text-amber-700 group-data-hover:bg-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400 dark:group-data-hover:bg-amber-400/15',
  yellow:
    'bg-yellow-400/20 text-yellow-700 group-data-hover:bg-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-300 dark:group-data-hover:bg-yellow-400/15',
  lime: 'bg-lime-400/20 text-lime-700 group-data-hover:bg-lime-400/30 dark:bg-lime-400/10 dark:text-lime-300 dark:group-data-hover:bg-lime-400/15',
  green:
    'bg-green-500/15 text-green-700 group-data-hover:bg-green-500/25 dark:bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] dark:text-[var(--ct-accent)] dark:group-data-hover:bg-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)]',
  emerald:
    'bg-emerald-500/15 text-emerald-700 group-data-hover:bg-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400 dark:group-data-hover:bg-emerald-500/20',
  teal: 'bg-teal-500/15 text-teal-700 group-data-hover:bg-teal-500/25 dark:bg-teal-500/10 dark:text-teal-300 dark:group-data-hover:bg-teal-500/20',
  cyan: 'bg-cyan-400/20 text-cyan-700 group-data-hover:bg-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300 dark:group-data-hover:bg-cyan-400/15',
  sky: 'bg-sky-500/15 text-sky-700 group-data-hover:bg-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300 dark:group-data-hover:bg-sky-500/20',
  blue: 'bg-blue-500/15 text-blue-700 group-data-hover:bg-blue-500/25 dark:text-blue-400 dark:group-data-hover:bg-blue-500/25',
  indigo:
    'bg-indigo-500/15 text-indigo-700 group-data-hover:bg-indigo-500/25 dark:text-indigo-400 dark:group-data-hover:bg-indigo-500/20',
  violet:
    'bg-violet-500/15 text-violet-700 group-data-hover:bg-violet-500/25 dark:text-violet-400 dark:group-data-hover:bg-violet-500/20',
  purple:
    'bg-purple-500/15 text-purple-700 group-data-hover:bg-purple-500/25 dark:text-purple-400 dark:group-data-hover:bg-purple-500/20',
  fuchsia:
    'bg-fuchsia-400/15 text-fuchsia-700 group-data-hover:bg-fuchsia-400/25 dark:bg-fuchsia-400/10 dark:text-fuchsia-400 dark:group-data-hover:bg-fuchsia-400/20',
  pink: 'bg-pink-400/15 text-pink-700 group-data-hover:bg-pink-400/25 dark:bg-pink-400/10 dark:text-pink-400 dark:group-data-hover:bg-pink-400/20',
  rose: 'bg-rose-400/15 text-rose-700 group-data-hover:bg-rose-400/25 dark:bg-rose-400/10 dark:text-rose-400 dark:group-data-hover:bg-rose-400/20',
  zinc: 'bg-zinc-600/10 text-zinc-700 group-data-hover:bg-zinc-600/20 dark:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] dark:text-[var(--ct-text-muted)] dark:group-data-hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]',
}

type BadgeProps = { color?: keyof typeof colors }

export function Badge({ color = 'zinc', className, children, ...props }: BadgeProps & React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      className={cn(
        className,
        // On remplace le rounded-md par rounded-full et on ajoute les inset-ring pour correspondre au design demandé
        'inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-sm/5 font-medium sm:text-xs/5 inset-ring inset-ring-gray-200 dark:inset-ring-white/10 forced-colors:outline',
        colors[color]
      )}
    >
      <svg viewBox="0 0 6 6" aria-hidden="true" className={cn(
        "size-1.5",
        // Map les couleurs du point SVG en fonction de la couleur du badge
        color === 'red' && "fill-red-500 dark:fill-red-400",
        (color === 'amber' || color === 'orange' || color === 'yellow') && "fill-yellow-500 dark:fill-yellow-400",
        (color === 'green' || color === 'emerald' || color === 'lime') && "fill-green-500 dark:fill-[var(--ct-accent)]",
        (color === 'blue' || color === 'sky' || color === 'cyan') && "fill-blue-500 dark:fill-blue-400",
        color === 'indigo' && "fill-indigo-500 dark:fill-indigo-400",
        (color === 'purple' || color === 'violet' || color === 'fuchsia') && "fill-purple-500 dark:fill-purple-400",
        (color === 'pink' || color === 'rose') && "fill-pink-500 dark:fill-pink-400",
        color === 'zinc' && "fill-zinc-500 dark:fill-zinc-400"
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
  let classes = cn(
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
