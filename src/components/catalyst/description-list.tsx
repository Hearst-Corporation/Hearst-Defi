import { cn } from '@/lib/cn'

export function DescriptionList({ className, ...props }: React.ComponentPropsWithoutRef<'dl'>) {
  return (
    <dl
      {...props}
      className={cn(
        className,
        'grid grid-cols-1 text-base/6 sm:grid-cols-[min(50%,--spacing(80))_auto] sm:text-sm/6'
      )}
    />
  )
}

export function DescriptionTerm({ className, ...props }: React.ComponentPropsWithoutRef<'dt'>) {
  return (
    <dt
      {...props}
      className={cn(
        className,
        'col-start-1 border-t border-[var(--ct-border-soft)] pt-3 text-[var(--ct-text-faint)] first:border-none sm:border-t sm:border-[var(--ct-border-soft)] sm:py-3 dark:border-[var(--ct-border-soft)] dark:text-[var(--ct-text-muted)] sm:dark:border-[var(--ct-border-soft)]'
      )}
    />
  )
}

export function DescriptionDetails({ className, ...props }: React.ComponentPropsWithoutRef<'dd'>) {
  return (
    <dd
      {...props}
      className={cn(
        className,
        'pt-1 pb-3 text-[var(--ct-text-strong)] sm:border-t sm:border-[var(--ct-border-soft)] sm:py-3 sm:nth-2:border-none dark:text-[var(--ct-text-strong)] dark:sm:border-[var(--ct-border-soft)]'
      )}
    />
  )
}
