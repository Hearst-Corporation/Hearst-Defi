'use client'

import { cn } from '@/lib/cn'
import type React from 'react'
import { createContext, useContext, useState } from 'react'
import { Link } from './link'

const TableContext = createContext<{ bleed: boolean; dense: boolean; grid: boolean; striped: boolean }>({
  bleed: false,
  dense: false,
  grid: false,
  striped: false,
})

export function Table({
  bleed = false,
  dense = false,
  grid = false,
  striped = false,
  className,
  children,
  ...props
}: { bleed?: boolean; dense?: boolean; grid?: boolean; striped?: boolean } & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <TableContext.Provider value={{ bleed, dense, grid, striped } as React.ContextType<typeof TableContext>}>
      {/* Canon table surface (Mission #059): a self-contained, full-width
          scroll surface — no negative-margin bleed (it pulled the table past
          the card and broke symmetry), no responsive horizontal padding dance.
          min-w-0 lets the table shrink and scroll LOCALLY inside its card
          instead of forcing a global horizontal scrollbar. The edge gutter is
          owned by the cells below. */}
      <div className="flow-root min-w-0">
        <div {...props} className={cn(className, 'min-w-0 overflow-x-auto whitespace-nowrap')}>
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full text-left text-sm/6 text-[var(--ct-text-strong)] dark:text-[var(--ct-text-strong)]">{children}</table>
          </div>
        </div>
      </div>
    </TableContext.Provider>
  )
}

export function TableHead({ className, ...props }: React.ComponentPropsWithoutRef<'thead'>) {
  return <thead {...props} className={cn(className, 'text-[var(--ct-text-faint)] dark:text-[var(--ct-text-muted)]')} />
}

export function TableBody(props: React.ComponentPropsWithoutRef<'tbody'>) {
  return <tbody {...props} />
}

const TableRowContext = createContext<{ href?: string; target?: string; title?: string }>({
  href: undefined,
  target: undefined,
  title: undefined,
})

export function TableRow({
  href,
  target,
  title,
  className,
  ...props
}: { href?: string; target?: string; title?: string } & React.ComponentPropsWithoutRef<'tr'>) {
  const { striped } = useContext(TableContext)

  return (
    <TableRowContext.Provider value={{ href, target, title } as React.ContextType<typeof TableRowContext>}>
      <tr
        {...props}
        className={cn(
          className,
          href &&
            'has-[[data-row-link][data-focus]]:outline-2 has-[[data-row-link][data-focus]]:-outline-offset-2 has-[[data-row-link][data-focus]]:[outline-color:var(--ct-accent)] dark:focus-within:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)]',
          striped && 'even:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)] dark:even:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)]',
          href && striped && 'hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)]',
          href && !striped && 'hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)]'
        )}
      />
    </TableRowContext.Provider>
  )
}

export function TableHeader({ className, ...props }: React.ComponentPropsWithoutRef<'th'>) {
  const { grid } = useContext(TableContext)

  return (
    <th
      {...props}
      className={cn(
        className,
        // Canon symmetric gutter (Mission #059): every cell is px-4; the first
        // and last cells get a 20px edge gutter (pl-5/pr-5) so the first column
        // lines up with the card header text and the last column breathes the
        // same amount on the right. The old destructive edge override (an
        // undefined --gutter var then a 4px sm override) is removed — it glued
        // the edge columns to the frame and broke left/right symmetry.
        'border-b border-b-[var(--ct-border)] px-4 py-2 font-medium first:pl-5 last:pr-5 dark:border-b-[var(--ct-border)]',
        grid && 'border-l border-l-[var(--ct-border-soft)] first:border-l-0 dark:border-l-[var(--ct-border-soft)]'
      )}
    />
  )
}

export function TableCell({ className, children, ...props }: React.ComponentPropsWithoutRef<'td'>) {
  const { dense, grid, striped } = useContext(TableContext)
  const { href, target, title } = useContext(TableRowContext)
  const [cellRef, setCellRef] = useState<HTMLElement | null>(null)

  return (
    <td
      ref={href ? setCellRef : undefined}
      {...props}
      className={cn(
        className,
        // Canon symmetric gutter (Mission #059) — mirrors TableHeader: px-4
        // everywhere, first:pl-5 / last:pr-5 edge gutter, no destructive 4px
        // edge override.
        'relative px-4 first:pl-5 last:pr-5',
        !striped && 'border-b border-[var(--ct-border-soft)] dark:border-[var(--ct-border-soft)]',
        grid && 'border-l border-l-[var(--ct-border-soft)] first:border-l-0 dark:border-l-[var(--ct-border-soft)]',
        dense ? 'py-2.5' : 'py-4'
      )}
    >
      {href && (
        <Link
          data-row-link
          href={href}
          target={target}
          aria-label={title}
          tabIndex={cellRef?.previousElementSibling === null ? 0 : -1}
          className="absolute inset-0 focus:outline-hidden"
        />
      )}
      {children}
    </td>
  )
}
