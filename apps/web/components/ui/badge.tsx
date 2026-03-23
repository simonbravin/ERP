import * as React from 'react'
import { cn } from '@/lib/utils'
import { BADGE_CLASSES, type StatusColor } from '@/lib/design-tokens'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic status (preferred) or legacy variance names; destructive maps to danger (shadcn compat) */
  variant?:
    | StatusColor
    | 'default'
    | 'under'
    | 'track'
    | 'over'
    | 'outline'
    | 'secondary'
    | 'destructive'
}

const SEMANTIC_MAP: Record<string, StatusColor> = {
  under: 'success',
  track: 'neutral',
  over: 'danger',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  destructive: 'danger',
  neutral: 'neutral',
  info: 'info',
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const semanticVariant = variant && variant !== 'secondary' && variant !== 'outline' ? SEMANTIC_MAP[variant] : undefined
    const useSemantic = semanticVariant && BADGE_CLASSES[semanticVariant]

    return (
      <span
        ref={ref}
        className={cn(
          'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2',
          useSemantic
            ? BADGE_CLASSES[semanticVariant]
            : variant === 'outline'
              ? 'border border-border bg-transparent text-foreground'
              : variant === 'secondary'
                ? 'border-transparent bg-secondary text-secondary-foreground'
                : 'border-transparent bg-muted text-muted-foreground',
          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = 'Badge'

export { Badge }
