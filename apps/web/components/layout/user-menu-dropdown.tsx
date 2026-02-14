'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { signOut } from 'next-auth/react'
import { usePathname } from '@/i18n/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { User, Settings, LogOut } from 'lucide-react'
import { Link } from '@/i18n/navigation'

interface UserMenuDropdownProps {
  user: { name?: string | null; email?: string | null }
}

/**
 * User menu dropdown with settings and logout
 */
export function UserMenuDropdown({ user }: UserMenuDropdownProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const locale = pathname?.match(/^\/(es|en)/)?.[1] ?? 'es'
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const displayName = user.name || user.email || 'Usuario'
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() || 'U'

  const handleSignOut = async () => {
    setShowSignOutConfirm(false)
    await signOut({ redirect: false })
    window.location.pathname = `/${locale}/login`
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <span className="text-xs font-semibold text-slate-600">{initials}</span>
          </div>
          <span className="text-sm font-medium text-slate-700">
            {displayName}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-slate-500">{user.email}</span>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/settings/profile" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('settings')}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setShowSignOutConfirm(true)}
            className="flex items-center gap-2 text-red-600 focus:bg-red-50 focus:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <AlertDialogContent className="erp-form-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar sesión</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés cerrar sesión?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleSignOut()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
