import { cn } from '@/lib/cn'
import { Link } from './link'

export function Text({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) {
  return (
    <p
      data-slot="text"
      {...props}
      className={cn(className, 'text-base/6 text-[var(--ct-text-faint)] sm:text-sm/6 dark:text-[var(--ct-text-muted)]')}
    />
  )
}

export function TextLink({ className, ...props }: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        className,
        'text-[var(--ct-text-strong)] underline decoration-[color-mix(in_srgb,var(--ct-text-strong)_50%,transparent)] data-hover:decoration-[var(--ct-text-strong)] dark:text-[var(--ct-text-strong)] dark:decoration-[color-mix(in_srgb,var(--ct-text-strong)_50%,transparent)] dark:data-hover:decoration-[var(--ct-text-strong)]'
      )}
    />
  )
}

export function Strong({ className, ...props }: React.ComponentPropsWithoutRef<'strong'>) {
  return <strong {...props} className={cn(className, 'font-medium text-[var(--ct-text-strong)] dark:text-[var(--ct-text-strong)]')} />
}

export function Code({ className, ...props }: React.ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      {...props}
      className={cn(
        className,
        'rounded-sm border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)] px-0.5 text-sm font-medium text-[var(--ct-text-strong)] sm:text-[0.8125rem] dark:border-[var(--ct-border-strong)] dark:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] dark:text-[var(--ct-text-strong)]'
      )}
    />
  )
}
