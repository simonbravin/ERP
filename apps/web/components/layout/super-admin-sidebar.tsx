'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
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
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  LogOut,
  Shield,
} from 'lucide-react'

const nav = [
  { name: 'Dashboard', href: '/super-admin', icon: LayoutDashboard },
  { name: 'Organizations', href: '/super-admin/organizations', icon: Building2 },
  { name: 'Users', href: '/super-admin/users', icon: Users },
  { name: 'Audit logs', href: '/super-admin/logs', icon: FileText },
]

interface SuperAdminSidebarProps {
  userName?: string | null
}

export function SuperAdminSidebar({ userName }: SuperAdminSidebarProps) {
  const pathname = usePathname()
  const pathWithoutLocale = pathname?.replace(/^\/(es|en)/, '') ?? ''
  const locale = pathname?.match(/^\/(es|en)/)?.[1] ?? 'es'
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const handleSignOut = async () => {
    setShowSignOutConfirm(false)
    await signOut({ redirect: false })
    window.location.pathname = `/${locale}/super-admin`
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-amber-900/50 bg-slate-950">
      <div className="flex h-14 items-center gap-2 border-b border-amber-900/50 px-4">
        <Shield className="h-6 w-6 text-amber-500" aria-hidden />
        <span className="font-semibold text-amber-100">Super Admin</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const isActive =
            item.href === '/super-admin'
              ? pathWithoutLocale === '/super-admin'
              : pathWithoutLocale.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-amber-500/20 text-amber-200'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-amber-900/50 p-3">
        {userName && (
          <p className="truncate px-2 text-xs text-slate-500" title={userName}>
            {userName}
          </p>
        )}
        <button
          type="button"
          onClick={() => setShowSignOutConfirm(true)}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sign out
        </button>
      </div>

      <AlertDialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <AlertDialogContent className="erp-form-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar sesión</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés cerrar sesión en el portal Super Admin?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleSignOut()
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
