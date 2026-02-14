'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { usePathname } from '@/i18n/navigation'
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

type SignOutConfirmButtonProps = {
  /** Locale para la redirección (ej. "es"). Si no se pasa, se infiere del pathname. */
  locale?: string
  className?: string
  children?: React.ReactNode
}

/**
 * Botón que muestra confirmación antes de cerrar sesión y redirige al login en el mismo origen.
 */
export function SignOutConfirmButton({
  locale: localeProp,
  className,
  children = 'Cerrar sesión',
}: SignOutConfirmButtonProps) {
  const pathname = usePathname()
  const locale = localeProp ?? pathname?.match(/^\/(es|en)/)?.[1] ?? 'es'
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    setOpen(false)
    await signOut({ redirect: false })
    window.location.pathname = `/${locale}/login`
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
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
