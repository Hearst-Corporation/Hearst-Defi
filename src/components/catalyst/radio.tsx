import * as Headless from '@headlessui/react'
import { cn } from '@/lib/cn'

export function RadioGroup({
  className,
  ...props
}: { className?: string } & Omit<Headless.RadioGroupProps, 'as' | 'className'>) {
  return (
    <Headless.RadioGroup
      data-slot="control"
      {...props}
      className={cn(
        className,
        // Basic groups
        'space-y-3 **:data-[slot=label]:font-normal',
        // With descriptions
        'has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium'
      )}
    />
  )
}

export function RadioField({
  className,
  ...props
}: { className?: string } & Omit<Headless.FieldProps, 'as' | 'className'>) {
  return (
    <Headless.Field
      data-slot="field"
      {...props}
      className={cn(
        className,
        // Base layout
        'grid grid-cols-[1.125rem_1fr] gap-x-4 gap-y-1 sm:grid-cols-[1rem_1fr]',
        // Control layout
        '*:data-[slot=control]:col-start-1 *:data-[slot=control]:row-start-1 *:data-[slot=control]:mt-0.75 sm:*:data-[slot=control]:mt-1',
        // Label layout
        '*:data-[slot=label]:col-start-2 *:data-[slot=label]:row-start-1',
        // Description layout
        '*:data-[slot=description]:col-start-2 *:data-[slot=description]:row-start-2',
        // With description
        'has-data-[slot=description]:**:data-[slot=label]:font-medium'
      )}
    />
  )
}

const base = [
  // Basic layout
  'relative isolate flex size-4.75 shrink-0 rounded-full sm:size-4.25',
  // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
  'before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-[var(--ct-surface-card)] before:shadow-sm',
  // Background color when checked
  'group-data-checked:before:bg-(--radio-checked-bg)',
  // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
  'dark:before:hidden',
  // Background color applied to control in dark mode
  'dark:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] dark:group-data-checked:bg-(--radio-checked-bg)',
  // Border
  'border border-[var(--ct-border)] group-data-checked:border-transparent group-data-hover:group-data-checked:border-transparent group-data-hover:border-[var(--ct-border-soft)] group-data-checked:bg-(--radio-checked-border)',
  'dark:border-[var(--ct-border-strong)] dark:group-data-checked:border-[var(--ct-border-soft)] dark:group-data-hover:group-data-checked:border-[var(--ct-border-soft)] dark:group-data-hover:border-[var(--ct-border-strong)]',
  // Inner highlight shadow
  'after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_1px_color-mix(in_srgb,var(--ct-text-strong)_15%,transparent)]',
  'dark:after:-inset-px dark:after:hidden dark:after:rounded-full dark:group-data-checked:after:block',
  // Indicator color (light mode)
  '[--radio-indicator:transparent] group-data-checked:[--radio-indicator:var(--radio-checked-indicator)] group-data-hover:group-data-checked:[--radio-indicator:var(--radio-checked-indicator)] group-data-hover:[--radio-indicator:color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]',
  // Indicator color (dark mode)
  'dark:group-data-hover:group-data-checked:[--radio-indicator:var(--radio-checked-indicator)] dark:group-data-hover:[--radio-indicator:var(--ct-border-soft)]',
  // Focus ring
  'group-data-focus:outline group-data-focus:outline-2 group-data-focus:outline-offset-2 group-data-focus:[outline-color:var(--ct-accent)]',
  // Disabled state
  'group-data-disabled:opacity-50',
  'group-data-disabled:border-[var(--ct-border)] group-data-disabled:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] group-data-disabled:[--radio-checked-indicator:color-mix(in_srgb,var(--ct-text-strong)_50%,transparent)] group-data-disabled:before:bg-transparent',
  'dark:group-data-disabled:border-[var(--ct-border-strong)] dark:group-data-disabled:bg-[color-mix(in_srgb,var(--ct-text-strong)_2.5%,transparent)] dark:group-data-disabled:[--radio-checked-indicator:color-mix(in_srgb,var(--ct-text-strong)_50%,transparent)] dark:group-data-checked:group-data-disabled:after:hidden',
]

const colors = {
  'dark/zinc': [
    '[--radio-checked-bg:var(--ct-surface-card)] [--radio-checked-border:var(--ct-border)] [--radio-checked-indicator:var(--ct-text-strong)]',
    'dark:[--radio-checked-bg:var(--ct-surface-card)]',
  ],
  'dark/white': [
    '[--radio-checked-bg:var(--ct-surface-card)] [--radio-checked-border:var(--ct-border)] [--radio-checked-indicator:var(--ct-text-strong)]',
    'dark:[--radio-checked-bg:var(--ct-text-strong)] dark:[--radio-checked-border:var(--ct-border)] dark:[--radio-checked-indicator:var(--ct-bg-deep)]',
  ],
  white:
    '[--radio-checked-bg:var(--ct-text-strong)] [--radio-checked-border:var(--ct-border)] [--radio-checked-indicator:var(--ct-bg-deep)]',
  dark: '[--radio-checked-bg:var(--ct-surface-card)] [--radio-checked-border:var(--ct-border)] [--radio-checked-indicator:var(--ct-text-strong)]',
  zinc: '[--radio-checked-indicator:var(--ct-text-strong)] [--radio-checked-bg:var(--ct-surface-card)] [--radio-checked-border:var(--ct-border)]',
  red: '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--ct-status-danger)] [--radio-checked-border:var(--ct-status-danger-border)]',
  orange:
    '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--color-orange-500)] [--radio-checked-border:var(--color-orange-600)]/90',
  amber:
    '[--radio-checked-bg:var(--ct-status-warning)] [--radio-checked-border:var(--ct-status-warning-border)] [--radio-checked-indicator:var(--ct-bg-deep)]',
  yellow:
    '[--radio-checked-bg:var(--color-yellow-300)] [--radio-checked-border:var(--color-yellow-400)]/80 [--radio-checked-indicator:var(--color-yellow-950)]',
  lime: '[--radio-checked-bg:var(--color-lime-300)] [--radio-checked-border:var(--color-lime-400)]/80 [--radio-checked-indicator:var(--color-lime-950)]',
  green:
    '[--radio-checked-indicator:var(--ct-bg-deep)] [--radio-checked-bg:var(--ct-status-success)] [--radio-checked-border:var(--ct-status-success-border)]',
  emerald:
    '[--radio-checked-indicator:var(--ct-bg-deep)] [--radio-checked-bg:var(--ct-status-success)] [--radio-checked-border:var(--ct-status-success-border)]',
  teal: '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--color-teal-600)] [--radio-checked-border:var(--color-teal-700)]/90',
  cyan: '[--radio-checked-bg:var(--color-cyan-300)] [--radio-checked-border:var(--color-cyan-400)]/80 [--radio-checked-indicator:var(--color-cyan-950)]',
  sky: '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--ct-status-info)] [--radio-checked-border:var(--ct-status-info-border)]',
  blue: '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--ct-status-info)] [--radio-checked-border:var(--ct-status-info-border)]',
  indigo:
    '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--color-indigo-500)] [--radio-checked-border:var(--color-indigo-600)]/90',
  violet:
    '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--color-violet-500)] [--radio-checked-border:var(--color-violet-600)]/90',
  purple:
    '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--color-purple-500)] [--radio-checked-border:var(--color-purple-600)]/90',
  fuchsia:
    '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--color-fuchsia-500)] [--radio-checked-border:var(--color-fuchsia-600)]/90',
  pink: '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--color-pink-500)] [--radio-checked-border:var(--color-pink-600)]/90',
  rose: '[--radio-checked-indicator:var(--color-white)] [--radio-checked-bg:var(--ct-status-unaudited)] [--radio-checked-border:var(--ct-status-unaudited-border)]',
}

type Color = keyof typeof colors

export function Radio({
  color = 'dark/zinc',
  className,
  ...props
}: { color?: Color; className?: string } & Omit<Headless.RadioProps, 'as' | 'className' | 'children'>) {
  return (
    <Headless.Radio
      data-slot="control"
      {...props}
      className={cn(className, 'group inline-flex focus:outline-hidden')}
    >
      <span className={cn([base, colors[color]])}>
        <span
          className={cn(
            'size-full rounded-full border-[4.5px] border-transparent bg-(--radio-indicator) bg-clip-padding',
            // Forced colors mode
            'forced-colors:border-[Canvas] forced-colors:group-data-checked:border-[Highlight]'
          )}
        />
      </span>
    </Headless.Radio>
  )
}
