'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MODULES,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
  type Permission,
  type Module,
  type CustomPermissionsMap,
} from '@/lib/permissions'
import {
  updateMemberPermissions,
  resetMemberPermissions,
  updateMemberRole,
  setMemberRestrictedToProjects,
  addProjectMember,
  removeProjectMember,
} from '@/app/actions/team'
import { toast } from 'sonner'
import { AlertCircle, Trash2 } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { OrgRole } from '@prisma/client'

const PERMISSION_LABELS: Record<Permission, string> = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
  export: 'Exportar',
  approve: 'Aprobar',
}

const MODULE_LABELS: Record<Module, string> = {
  dashboard: 'Dashboard',
  projects: 'Proyectos',
  budget: 'Presupuesto',
  finance: 'Finanzas',
  certifications: 'Certificaciones',
  inventory: 'Inventario',
  quality: 'Calidad',
  documents: 'Documentos',
  reports: 'Reportes',
  suppliers: 'Proveedores y clientes',
  team: 'Equipo',
  settings: 'Configuración',
}

const ALL_PERMISSIONS: Permission[] = ['view', 'create', 'edit', 'delete', 'export', 'approve']

const PROJECT_ROLE_OPTIONS = [
  { value: 'MANAGER', label: 'Jefe de proyecto' },
  { value: 'SUPERINTENDENT', label: 'Jefe de obra' },
  { value: 'VIEWER', label: 'Solo lectura' },
] as const

interface Props {
  member: {
    id: string
    role: string
    customPermissions: unknown
    restrictedToProjects?: boolean
    user: { fullName: string; email: string }
  }
  projectAssignments?: {
    id: string
    projectId: string
    projectName: string
    projectNumber: string
    projectRole: string
  }[]
  availableProjects?: { id: string; name: string; projectNumber: string }[]
  canManageRestricted?: boolean
}

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'EDITOR', label: 'EDITOR' },
  { value: 'ACCOUNTANT', label: 'ACCOUNTANT' },
  { value: 'VIEWER', label: 'VIEWER' },
]

export function MemberPermissionsClient({
  member,
  projectAssignments = [],
  availableProjects = [],
  canManageRestricted = false,
}: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [roleUpdating, setRoleUpdating] = useState(false)
  const [restrictedUpdating, setRestrictedUpdating] = useState(false)
  const [addProjectId, setAddProjectId] = useState<string>('')
  const [addRole, setAddRole] = useState<string>('VIEWER')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const role = member.role as keyof typeof ROLE_PERMISSIONS
  const showRestrictedSection =
    canManageRestricted && (member.role === 'EDITOR' || member.role === 'VIEWER')
  const restrictedToProjects = member.restrictedToProjects ?? false
  const basePermissions = ROLE_PERMISSIONS[role] ?? {}
  const [customPermissions, setCustomPermissions] = useState<CustomPermissionsMap>(
    (member.customPermissions as CustomPermissionsMap) ?? null
  )
  const skipNextSyncRef = useRef(false)

  // Sincronizar estado local con los datos del servidor (p. ej. al navegar). No sobrescribir justo después de guardar.
  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }
    setCustomPermissions((member.customPermissions as CustomPermissionsMap) ?? null)
  }, [member.id, JSON.stringify(member.customPermissions)])

  const effectivePermissions = getEffectivePermissions(role as any, customPermissions)

  const computeNextCustom = (
    prev: CustomPermissionsMap,
    module: Module,
    permission: Permission
  ): CustomPermissionsMap => {
    const basePerms = basePermissions[module] ?? []
    const currentEffective = getEffectivePermissions(role as any, prev)[module] ?? []
    const hasNow = currentEffective.includes(permission)
    const nextEffective = hasNow
      ? currentEffective.filter((p) => p !== permission)
      : [...currentEffective, permission]
    const baseSet = new Set(basePerms)
    const nextSet = new Set(nextEffective)
    if (nextSet.size === baseSet.size && [...nextSet].every((p) => baseSet.has(p))) {
      const next = { ...(prev ?? {}) }
      if (module in next) {
        const { [module]: _, ...rest } = next
        return Object.keys(rest).length ? rest : null
      }
      return prev
    }
    return {
      ...(prev ?? {}),
      [module]: nextEffective,
    }
  }

  const handleTogglePermission = async (module: Module, permission: Permission) => {
    const prev = customPermissions
    const next = computeNextCustom(prev, module, permission)
    setCustomPermissions(next)

    setIsSubmitting(true)
    const payload =
      next && Object.keys(next).length > 0 ? (next as Record<string, string[]>) : null
    try {
      const result = await updateMemberPermissions(member.id, payload)
      if (!result.success && 'error' in result) {
        toast.error(result.error)
        setCustomPermissions(prev)
        return
      }
      skipNextSyncRef.current = true
      toast.success('Permisos actualizados')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar')
      setCustomPermissions(prev)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRoleChange = async (newRole: OrgRole) => {
    if (newRole === member.role) return
    if (member.role === 'OWNER') return
    setRoleUpdating(true)
    try {
      const result = await updateMemberRole(member.id, newRole)
      if (!result.success && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Rol actualizado')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar rol')
    } finally {
      setRoleUpdating(false)
    }
  }

  const handleReset = async () => {
    setIsSubmitting(true)
    try {
      const result = await resetMemberPermissions(member.id)
      if (!result.success && 'error' in result) {
        toast.error(result.error)
        return
      }
      setCustomPermissions(null)
      toast.success('Permisos restaurados al rol base')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestrictedChange = async (checked: boolean) => {
    if (!showRestrictedSection) return
    setRestrictedUpdating(true)
    try {
      const result = await setMemberRestrictedToProjects(member.id, checked)
      if (!result.success && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(checked ? 'Usuario restringido a proyectos asignados' : 'Restricción quitada')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setRestrictedUpdating(false)
    }
  }

  const handleAddProject = async () => {
    if (!addProjectId || !addRole) return
    try {
      await addProjectMember({
        projectId: addProjectId,
        orgMemberId: member.id,
        role: addRole,
      })
      toast.success('Agregado al proyecto')
      setAddProjectId('')
      setAddRole('VIEWER')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al agregar')
    }
  }

  const handleRemoveAssignment = async (projectMemberId: string) => {
    setRemovingId(projectMemberId)
    try {
      await removeProjectMember(projectMemberId)
      toast.success('Quitado del proyecto')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al quitar')
    } finally {
      setRemovingId(null)
    }
  }

  const hasCustomPermissions =
    customPermissions && Object.keys(customPermissions).length > 0

  if (member.role === 'OWNER') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              El OWNER tiene acceso total al sistema y no se puede modificar.
            </p>
            <Button asChild variant="outline" className="mt-3">
              <Link href="/team">Volver al equipo</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {member.user.fullName ?? '—'} — {member.user.email}
        </p>
        {member.role === 'OWNER' ? (
          <span className="rounded-md border bg-muted px-3 py-1.5 text-sm font-medium">
            OWNER
          </span>
        ) : (
          <Select
            value={member.role}
            onValueChange={(value) => handleRoleChange(value as OrgRole)}
            disabled={roleUpdating}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="erp-section-desc">
        Rol base: <strong>{member.role}</strong>. Marcá o desmarcá permisos; los cambios se guardan
        al instante.
      </p>

      {showRestrictedSection && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <Checkbox
            id="restricted-to-projects"
            checked={restrictedToProjects}
            disabled={restrictedUpdating}
            onCheckedChange={(checked) => handleRestrictedChange(checked === true)}
            aria-label="Restringido a proyectos asignados"
          />
          <label
            htmlFor="restricted-to-projects"
            className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Restringido a proyectos asignados
          </label>
          <span className="text-xs text-muted-foreground">
            Si está marcado, el usuario solo ve los proyectos en los que está asignado y no accede a Finanzas de empresa.
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/50">
              <TableHead className="w-[120px] py-2 text-xs font-medium">Módulo</TableHead>
              {ALL_PERMISSIONS.map((p) => (
                <TableHead key={p} className="w-[72px] py-2 text-center text-xs font-medium">
                  {PERMISSION_LABELS[p]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(Object.entries(MODULES) as [keyof typeof MODULES, Module][]).map(([_, module]) => {
              const effectivePerms = effectivePermissions[module] ?? []
              const customPerms = customPermissions?.[module]
              const hasCustom = customPerms !== undefined

              return (
                <TableRow key={module} className={hasCustom ? 'bg-muted/20' : ''}>
                  <TableCell className="py-1.5 text-sm font-medium">
                    {MODULE_LABELS[module]}
                    {hasCustom && (
                      <span className="ml-1 text-[10px] text-muted-foreground">*</span>
                    )}
                  </TableCell>
                  {ALL_PERMISSIONS.map((permission) => {
                    const checked = effectivePerms.includes(permission)
                    return (
                      <TableCell key={permission} className="py-1.5 text-center">
                        <Checkbox
                          checked={checked}
                          disabled={isSubmitting}
                          onCheckedChange={() => handleTogglePermission(module, permission)}
                          className="mx-auto"
                          aria-label={`${MODULE_LABELS[module]} - ${PERMISSION_LABELS[permission]}`}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        * = módulo con permisos personalizados (diferente del rol base)
      </p>

      {canManageRestricted && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Proyectos asignados</h3>
          <p className="text-xs text-muted-foreground">
            Proyectos en los que este miembro participa y su rol dentro del proyecto. Si está restringido, solo verá estos proyectos.
          </p>
          {projectAssignments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="py-2 text-xs font-medium">Proyecto</TableHead>
                  <TableHead className="py-2 text-xs font-medium">Rol</TableHead>
                  <TableHead className="w-[80px] py-2 text-right text-xs font-medium">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectAssignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="py-2 text-sm">
                      {a.projectName} ({a.projectNumber})
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      {PROJECT_ROLE_OPTIONS.find((r) => r.value === a.projectRole)?.label ?? a.projectRole}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveAssignment(a.id)}
                        disabled={removingId === a.id}
                        aria-label="Quitar del proyecto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Ningún proyecto asignado.</p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Select value={addProjectId} onValueChange={setAddProjectId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Agregar a proyecto..." />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.projectNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={addRole} onValueChange={setAddRole}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={handleAddProject}
              disabled={!addProjectId || availableProjects.length === 0}
            >
              Agregar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/team">Volver al equipo</Link>
        </Button>
        {hasCustomPermissions && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSubmitting}
          >
            Restaurar a rol base
          </Button>
        )}
      </div>
    </div>
  )
}
