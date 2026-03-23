'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { acceptInvitation } from '@/app/actions/team'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Building2, Mail, Shield } from 'lucide-react'

const formSchema = z
  .object({
    fullName: z.string().min(2, 'Mínimo 2 caracteres'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof formSchema>

interface AcceptInvitationClientProps {
  invitation: {
    email: string
    role: string
    organization: { name: string }
    invitedBy: { fullName: string }
  }
  token: string
}

export function AcceptInvitationClient({
  invitation,
  token,
}: AcceptInvitationClientProps) {
  const tTeam = useTranslations('team')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      password: '',
      confirmPassword: '',
    },
  })

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      await acceptInvitation(token, {
        fullName: data.fullName,
        password: data.password,
      })
      toast.success(tTeam('toast.welcomeRedirect'))
      router.push('/login')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : tTeam('toast.invitationAcceptError')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Invitación a {invitation.organization.name}
        </CardTitle>
        <CardDescription>
          {invitation.invitedBy.fullName} te ha invitado a unirte
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Mail className="h-4 w-4" />
          <span>Email: {invitation.email}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Shield className="h-4 w-4" />
          <span>Rol: {invitation.role}</span>
        </div>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4 pt-4"
        >
          <div>
            <Label htmlFor="fullName">Nombre Completo</Label>
            <Input
              id="fullName"
              className="mt-1"
              {...form.register('fullName')}
            />
            {form.formState.errors.fullName && (
              <p className="mt-1 text-sm text-destructive">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              className="mt-1"
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="mt-1 text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              className="mt-1"
              {...form.register('confirmPassword')}
            />
            {form.formState.errors.confirmPassword && (
              <p className="mt-1 text-sm text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Procesando...' : 'Aceptar Invitación'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
