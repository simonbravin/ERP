/**
 * Design System Tokens
 * Single source of truth for all design decisions.
 * Primary definitions are in globals.css (HSL variables).
 */

export const spacing = {
  xxs: '0.125rem', // 2px
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '3rem', // 48px
  '3xl': '4rem', // 64px,

  // WBS indentation
  indent: {
    1: '1.25rem', // 20px
    2: '2.5rem', // 40px
    3: '3.75rem', // 60px
  },
} as const

export const colors = {
  brand: {
    navy: 'hsl(var(--navy))',
    accent: 'hsl(var(--brand-accent))',
    accentSoft: 'hsl(var(--brand-accent-soft))',
    accentDark: 'hsl(var(--brand-accent-dark))',
    // Legacy compatibility while old consumers are migrated.
    orange: 'hsl(var(--orange))',
  },
  status: {
    success: 'hsl(var(--status-success))',
    warning: 'hsl(var(--status-warning))',
    danger: 'hsl(var(--status-danger))',
    neutral: 'hsl(var(--status-neutral))',
    info: 'hsl(var(--status-info))',
  },
} as const

export const typography = {
  fontFamily: {
    sans: 'var(--font-inter)',
    mono: 'var(--font-roboto-mono)',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
} as const

// Type exports
export type Spacing = keyof typeof spacing
export type StatusColor = keyof typeof colors.status
export type FontSize = keyof typeof typography.fontSize

/** @deprecated Use StatusColor instead */
export type StatusVariant = StatusColor

/** WBS variance status -> semantic status mapping */
export const VARIANCE_TO_STATUS: Record<string, StatusColor> = {
  under: 'success',
  on_track: 'neutral',
  over: 'danger',
}

/** Badge variant class names (matches globals.css .badge-*) */
export const BADGE_CLASSES: Record<StatusColor, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  neutral: 'badge-neutral',
  info: 'badge-info',
}
