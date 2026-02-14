'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { usePathname } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
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

type UserMenuProps = {
  userName: string
}

export function UserMenu({ userName }: UserMenuProps) {
  const pathname = usePathname()
  const locale = pathname?.match(/^\/(es|en)/)?.[1] ?? 'es'
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const handleSignOut = async () => {
    setShowSignOutConfirm(false)
    await signOut({ redirect: false })
    window.location.pathname = `/${locale}/login`
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{userName}</span>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowSignOutConfirm(true)}
        >
          Sign out
        </Button>
      </div>

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
