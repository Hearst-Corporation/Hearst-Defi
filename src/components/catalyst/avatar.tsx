import * as Headless from '@headlessui/react'
import { cn } from '@/lib/cn'
import React, { forwardRef } from 'react'
import { TouchTarget } from './button'
import { Link } from './link'

type AvatarProps = {
  src?: string | null
  square?: boolean
  initials?: string
  alt?: string
  className?: string
}

export function Avatar({
  src = null,
  square = false,
  initials,
  alt = '',
  className,
  ...props
}: AvatarProps & React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      data-slot="avatar"
      {...props}
      className={cn(
        className,
        // Basic layout
        'inline-flex items-center justify-center shrink-0 align-middle [--avatar-radius:20%]',
        // Outlines from the requested design
        'ring-2 ring-white outline -outline-offset-1 outline-black/5 dark:ring-gray-900 dark:outline-white/10',
        // Border radius
        square ? 'rounded-(--avatar-radius)' : 'rounded-full',
        // If no src, apply the background for initials
        !src && 'bg-gray-500 dark:bg-gray-800'
      )}
    >
      {initials && (
        <span className={cn(
          "font-medium text-white",
          // Adapt text size based on container size heuristics (Tailwind Arbitrary values not easily readable, but we map common sizes)
          className?.includes('size-6') ? "text-xs" :
          className?.includes('size-8') ? "text-sm" :
          className?.includes('size-12') ? "text-lg" :
          className?.includes('size-14') ? "text-xl" :
          "" // default for size-10 is standard text size
        )}>
          {initials}
        </span>
      )}
      {src && <img className={cn(
        "size-full object-cover",
        square ? 'rounded-(--avatar-radius)' : 'rounded-full'
      )} src={src} alt={alt} />}
    </span>
  )
}

/**
 * AvatarGroup — A new Catalyst component to render overlapping avatars
 * Usage:
 * <AvatarGroup size="md">
 *   <Avatar src="..." />
 *   <Avatar src="..." />
 * </AvatarGroup>
 */
export function AvatarGroup({
  children,
  className,
  size = 'md',
}: {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <div
      className={cn(
        'isolate flex overflow-hidden',
        size === 'sm' && '-space-x-1 *:size-6',
        size === 'md' && '-space-x-2 *:size-8',
        size === 'lg' && '-space-x-2 *:size-10',
        className
      )}
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child
        // Inject z-index based on position (first element on top: z-30, then 20, 10, 0)
        const zIndex = 30 - index * 10
        const childElement = child as React.ReactElement<{ className?: string }>
        return React.cloneElement(childElement, {
          className: cn(`relative z-[${Math.max(0, zIndex)}] inline-block`, childElement.props.className),
        })
      })}
    </div>
  )
}

export const AvatarButton = forwardRef(function AvatarButton(
  {
    src,
    square = false,
    initials,
    alt,
    className,
    ...props
  }: AvatarProps &
    (
      | ({ href?: never } & Omit<Headless.ButtonProps, 'as' | 'className'>)
      | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>)
    ),
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  let classes = cn(
    className,
    square ? 'rounded-[20%]' : 'rounded-full',
    'relative inline-grid focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:[outline-color:var(--ct-accent)]'
  )

  return typeof props.href === 'string' ? (
    <Link {...props} className={classes} ref={ref as React.ForwardedRef<HTMLAnchorElement>}>
      <TouchTarget>
        <Avatar src={src} square={square} initials={initials} alt={alt} />
      </TouchTarget>
    </Link>
  ) : (
    <Headless.Button {...props} className={classes} ref={ref}>
      <TouchTarget>
        <Avatar src={src} square={square} initials={initials} alt={alt} />
      </TouchTarget>
    </Headless.Button>
  )
})
