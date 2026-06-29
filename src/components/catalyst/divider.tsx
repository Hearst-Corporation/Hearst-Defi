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
        soft && 'border-[var(--ct-border-soft)] dark:border-[var(--ct-border-soft)]',
        !soft && 'border-[var(--ct-border)] dark:border-[var(--ct-border)]'
      )}
    />
  )
}
