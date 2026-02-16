'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  updateUserModules,
  toggleUserStatus,
  resetUserPassword,
} from '@/app/actions/super-admin'
import {
  ArrowLeft,
  Save,
  Building2,
  Mail,
  Calendar,
  Shield,
  Key,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link } from '@/i18n/navigation'

const AVAILABLE_MODULES = [
  { key: 'DASHBOARD', label: 'Dashboard', description: 'Vista general del sistema' },
  { key: 'PROJECTS', label: 'Proyectos', description: 'Gestión de proyectos' },
  { key: 'BUDGET', label: 'Presupuesto', description: 'Presupuestos y APU' },
  { key: 'SCHEDULE', label: 'Cronograma', description: 'Cronograma Gantt' },
  { key: 'MATERIALS', label: 'Materiales', description: 'Materiales consolidados' },
  { key: 'FINANCE', label: 'Finanzas', description: 'Finanzas y transacciones' },
  { key: 'CERTIFICATIONS', label: 'Certificaciones', description: 'Certificaciones de obra' },
  { key: 'INVENTORY', label: 'Inventario', description: 'Inventario' },
  { key: 'REPORTS', label: 'Reportes', description: 'Reportes y analytics' },
  { key: 'TEAM', label: 'Equipo', description: 'Gestión de equipo' },
  { key: 'SETTINGS', label: 'Configuración', description: 'Configuración' },
  { key: 'DOCUMENTS', label: 'Documentos', description: 'Documentos' },
]

interface UserEditClientProps {
  user: {
    id: string
    fullName: string | null
    email: string
    createdAt: string
    orgMembers: Array<{
      id: string
      role: string
      isActive: boolean
      customPermissions: Record<string, string[]> | null
      organization: {
        id: string
        name: string
        legalName: string | null
        isBlocked: boolean
      }
    }>
  }
}

function getDefaultModulesByRole(role: string): string[] {
  const defaults: Record<string, string[]> = {
    OWNER: ['DASHBOARD', 'PROJECTS', 'BUDGET', 'SCHEDULE', 'MATERIALS', 'FINANCE', 'CERTIFICATIONS', 'INVENTORY', 'REPORTS', 'TEAM', 'SETTINGS', 'DOCUMENTS'],
    ADMIN: ['DASHBOARD', 'PROJECTS', 'BUDGET', 'SCHEDULE', 'MATERIALS', 'FINANCE', 'CERTIFICATIONS', 'INVENTORY', 'REPORTS', 'TEAM', 'SETTINGS', 'DOCUMENTS'],
    EDITOR: ['DASHBOARD', 'PROJECTS', 'BUDGET', 'SCHEDULE', 'MATERIALS', 'CERTIFICATIONS', 'INVENTORY', 'REPORTS'],
    ACCOUNTANT: ['DASHBOARD', 'FINANCE', 'REPORTS'],
    VIEWER: ['DASHBOARD', 'PROJECTS', 'REPORTS'],
  }
  return defaults[role] ?? []
}

export function UserEditClient({ user }: UserEditClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [orgModules, setOrgModules] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {}
    user.orgMembers.forEach((member) => {
      if (member.customPermissions && typeof member.customPermissions === 'object') {
        initial[member.organization.id] = Object.keys(member.customPermissions)
      } else {
        initial[member.organization.id] = getDefaultModulesByRole(member.role)
      }
    })
    return initial
  })

  const [orgActiveStatus, setOrgActiveStatus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    user.orgMembers.forEach((member) => {
      initial[member.organization.id] = member.isActive
    })
    return initial
  })

  function handleModuleToggle(orgId: string, moduleKey: string) {
    setOrgModules((prev) => {
      const current = prev[orgId] || []
      const updated = current.includes(moduleKey)
        ? current.filter((m) => m !== moduleKey)
        : [...current, moduleKey]
      return { ...prev, [orgId]: updated }
    })
  }

  function handleSaveModules(orgId: string) {
    const modules = orgModules[orgId] || []
    startTransition(async () => {
      try {
        const result = await updateUserModules(user.id, orgId, modules)
        if (result.success) {
          toast.success('Módulos actualizados correctamente')
          router.refresh()
        } else {
          toast.error(result.error ?? 'Error al actualizar módulos')
        }
      } catch {
        toast.error('Error al actualizar módulos')
      }
    })
  }

  function handleToggleActive(orgId: string) {
    const newStatus = !orgActiveStatus[orgId]
    startTransition(async () => {
      try {
        const result = await toggleUserStatus(user.id, orgId, newStatus)
        if (result.success) {
          setOrgActiveStatus((prev) => ({ ...prev, [orgId]: newStatus }))
          toast.success(newStatus ? 'Usuario activado' : 'Usuario desactivado')
          router.refresh()
        } else {
          toast.error(result.error ?? 'Error al cambiar estado')
        }
      } catch {
        toast.error('Error al cambiar estado')
      }
    })
  }

  function handleResetPassword() {
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }
    startTransition(async () => {
      try {
        const result = await resetUserPassword(user.id, newPassword)
        if (result.success) {
          toast.success('Contraseña reseteada correctamente')
          setShowResetPassword(false)
          setNewPassword('')
          setConfirmPassword('')
          router.refresh()
        } else {
          toast.error(result.error ?? 'Error al resetear contraseña')
        }
      } catch {
        toast.error('Error al resetear contraseña')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/super-admin/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a usuarios
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {user.fullName ?? 'Sin nombre'}
            </h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        <Button onClick={() => setShowResetPassword(true)} variant="outline">
          <Key className="mr-2 h-4 w-4" />
          Resetear contraseña
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Creado</p>
                <p className="font-medium">
                  {format(new Date(user.createdAt), 'dd MMM yyyy', { locale: es })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Organizaciones</p>
                <p className="font-medium">{user.orgMembers.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {user.orgMembers.map((member) => (
        <Card key={member.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {member.organization.name}
                  {member.organization.isBlocked && (
                    <Badge variant="destructive">Bloqueada</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {member.organization.legalName ?? 'Sin razón social'}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${member.id}`} className="text-sm">
                    {orgActiveStatus[member.organization.id] ? 'Activo' : 'Inactivo'}
                  </Label>
                  <Switch
                    id={`active-${member.id}`}
                    checked={orgActiveStatus[member.organization.id]}
                    onCheckedChange={() => handleToggleActive(member.organization.id)}
                    disabled={isPending}
                  />
                </div>
                <Badge variant="outline">
                  <Shield className="mr-1 h-3 w-3" />
                  {member.role}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-3 text-sm font-semibold">Módulos habilitados</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {AVAILABLE_MODULES.map((module) => {
                  const isEnabled = (orgModules[member.organization.id] ?? []).includes(module.key)
                  return (
                    <div
                      key={module.key}
                      className="flex items-start space-x-3 rounded-lg border p-3"
                    >
                      <Checkbox
                        id={`${member.id}-${module.key}`}
                        checked={isEnabled}
                        onCheckedChange={() => handleModuleToggle(member.organization.id, module.key)}
                        disabled={isPending}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={`${member.id}-${module.key}`}
                          className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {module.label}
                        </label>
                        <p className="text-xs text-slate-500">{module.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <Separator />
            <div className="flex justify-end">
              <Button
                onClick={() => handleSaveModules(member.organization.id)}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar módulos
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent className="erp-form-modal max-w-xl gap-6 py-6">
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
            <DialogDescription className="text-foreground/80">
              Ingresá una nueva contraseña para {user.fullName ?? user.email}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium text-foreground">
                Nueva contraseña
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ingresá la nueva contraseña"
                className="mt-1 w-full min-w-0"
                autoComplete="new-password"
              />
              <p className="text-sm text-muted-foreground">
                Mínimo 8 caracteres
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Reingresar contraseña
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Reingresá la contraseña"
                className="mt-1 w-full min-w-0"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowResetPassword(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={isPending || !newPassword || !confirmPassword}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reseteando…
                </>
              ) : (
                'Resetear contraseña'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
