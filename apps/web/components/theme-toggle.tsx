'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

interface ThemeToggleProps {
  className?: string
  /** When set, trigger shows icon + label (e.g. for sidebar) */
  label?: string
}

export function ThemeToggle({ className, label }: ThemeToggleProps = {}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled className={className}>
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size={label ? 'sm' : 'icon'}
      className={`relative ${label ? 'w-full justify-start gap-2 px-3' : ''} ${className ?? ''}`}
      onClick={toggleTheme}
      aria-label="Cambiar tema"
      aria-pressed={isDark}
    >
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform duration-75 ease-out dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform duration-75 ease-out dark:rotate-0 dark:scale-100" />
      </span>
      {label && <span className="text-sm text-sidebar-muted">{label}</span>}
    </Button>
  )
}
