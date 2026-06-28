import { cn } from '@/lib/cn'

export function Divider({
  soft = false,
  className,
  ...props
}: { soft?: boolean } & React.ComponentPropsWithoutRef<'hr'>) {
  return (
    <hr
      role="presentation"
      {...props}
      className={cn(
        className,
        'w-full border-t',
        soft && 'border-zinc-950/5 dark:border-[var(--ct-border-soft)]',
        !soft && 'border-zinc-950/10 dark:border-[var(--ct-border)]'
      )}
    />
  )
}
