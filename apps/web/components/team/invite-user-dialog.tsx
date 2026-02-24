'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { inviteUser } from '@/app/actions/team'
import { toast } from 'sonner'
import { ROLE_DESCRIPTIONS } from '@/lib/permissions'
import type { OrgRole } from '@prisma/client'

const formSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['ADMIN', 'EDITOR', 'ACCOUNTANT', 'VIEWER']),
})

type FormData = z.infer<typeof formSchema>

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      role: 'VIEWER',
    },
  })

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await inviteUser(data)
      onSuccess()
      form.reset()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error al enviar invitación'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp-form-modal w-[min(calc(100vw-2rem),56rem)] max-w-[56rem] gap-6 py-6">
        <DialogHeader>
          <DialogTitle>Invitar Usuario</DialogTitle>
          <DialogDescription>
            Envía una invitación por email para unirse a tu organización
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-6"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  className="mt-1 w-full"
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p className="mt-1 text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  La persona recibirá un enlace para unirse a la organización
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-role">Rol</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(v) => form.setValue('role', v as FormData['role'])}
                >
                  <SelectTrigger id="invite-role" className="mt-1 min-h-10 w-full [&>span]:line-clamp-2 [&>span]:text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    position="popper"
                    className="max-w-[calc(100vw-2rem)] w-[var(--radix-select-trigger-width)]"
                  >
                    {(
                      Object.entries(ROLE_DESCRIPTIONS) as [OrgRole, string][]
                    ).map(
                      ([role, desc]) =>
                        role !== 'OWNER' && (
                          <SelectItem key={role} value={role} className="whitespace-normal py-2">
                            {desc}
                          </SelectItem>
                        )
                    )}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {ROLE_DESCRIPTIONS[form.watch('role') as OrgRole]}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar Invitación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
