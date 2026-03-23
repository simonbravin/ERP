'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AlertCircle, Trash2 } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { OrgRole } from '@repo/database'

const ALL_PERMISSIONS: Permission[] = ['view', 'create', 'edit', 'delete', 'export', 'approve']

const PROJECT_ROLE_VALUES = ['MANAGER', 'SUPERINTENDENT', 'VIEWER'] as const

function projectRoleLabelKey(role: string): 'projectRoleManager' | 'projectRoleSuperintendent' | 'projectRoleViewer' {
  if (role === 'MANAGER') return 'projectRoleManager'
  if (role === 'SUPERINTENDENT') return 'projectRoleSuperintendent'
  return 'projectRoleViewer'
}

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
  const tTeam = useTranslations('team')
  const tProjects = useTranslations('projects')
  const tCommon = useTranslations('common')
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
  const memberCustomPermissionsKey = useMemo(
    () => JSON.stringify(member.customPermissions ?? null),
    [member.customPermissions]
  )

  // Sincronizar estado local con los datos del servidor (p. ej. al navegar). No sobrescribir justo después de guardar.
  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }
    setCustomPermissions((member.customPermissions as CustomPermissionsMap) ?? null)
  }, [member.id, member.customPermissions, memberCustomPermissionsKey])

  const effectivePermissions = getEffectivePermissions(role as OrgRole, customPermissions)

  const computeNextCustom = (
    prev: CustomPermissionsMap,
    module: Module,
    permission: Permission
  ): CustomPermissionsMap => {
    const basePerms = basePermissions[module] ?? []
    const currentEffective = getEffectivePermissions(role as OrgRole, prev)[module] ?? []
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
      if (!result || typeof result !== 'object') {
        toast.error(tCommon('toast.connectionError'))
        setCustomPermissions(prev)
        return
      }
      if (!result.success && 'error' in result) {
        toast.error(result.error)
        setCustomPermissions(prev)
        return
      }
      skipNextSyncRef.current = true
      toast.success(tTeam('toast.permissionsUpdated'))
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tTeam('toast.permissionsSaveFailed'))
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
      if (!result || typeof result !== 'object') {
        toast.error(tCommon('toast.connectionError'))
        return
      }
      if (!result.success && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(tTeam('toast.roleUpdated'))
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tTeam('toast.roleChangeFailed'))
    } finally {
      setRoleUpdating(false)
    }
  }

  const handleReset = async () => {
    setIsSubmitting(true)
    try {
      const result = await resetMemberPermissions(member.id)
      if (!result || typeof result !== 'object') {
        toast.error(tCommon('toast.connectionError'))
        return
      }
      if (!result.success && 'error' in result) {
        toast.error(result.error)
        return
      }
      setCustomPermissions(null)
      toast.success(tTeam('toast.permissionsRestored'))
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tCommon('error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestrictedChange = async (checked: boolean) => {
    if (!showRestrictedSection) return
    setRestrictedUpdating(true)
    try {
      const result = await setMemberRestrictedToProjects(member.id, checked)
      if (!result || typeof result !== 'object') {
        toast.error(tCommon('toast.connectionError'))
        return
      }
      if (!result.success && 'error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        checked ? tTeam('toast.restrictedToProjectsEnabled') : tTeam('toast.restrictedToProjectsDisabled')
      )
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tCommon('error'))
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
      toast.success(tTeam('toast.addedToProject'))
      setAddProjectId('')
      setAddRole('VIEWER')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tTeam('toast.addProjectFailed'))
    }
  }

  const handleRemoveAssignment = async (projectMemberId: string) => {
    setRemovingId(projectMemberId)
    try {
      await removeProjectMember(projectMemberId)
      toast.success(tTeam('toast.removedFromProject'))
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tTeam('toast.removeProjectFailed'))
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
              {tTeam('memberPermissions.ownerReadonlyMessage')}
            </p>
            <Button asChild variant="outline" className="mt-3">
              <Link href="/team">{tTeam('memberPermissions.backToTeam')}</Link>
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
              <SelectValue placeholder={tTeam('memberPermissions.orgRolePlaceholder')} />
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
        {tTeam('memberPermissions.baseRoleHint', { role: member.role })}
      </p>

      {showRestrictedSection && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <Checkbox
            id="restricted-to-projects"
            checked={restrictedToProjects}
            disabled={restrictedUpdating}
            onCheckedChange={(checked) => handleRestrictedChange(checked === true)}
            aria-label={tTeam('memberPermissions.restrictedAria')}
          />
          <label
            htmlFor="restricted-to-projects"
            className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {tTeam('memberPermissions.restrictedLabel')}
          </label>
          <span className="text-xs text-muted-foreground">
            {tTeam('memberPermissions.restrictedHint')}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/50">
              <TableHead className="w-[120px] py-2 text-xs font-medium">
                {tTeam('memberPermissions.colModule')}
              </TableHead>
              {ALL_PERMISSIONS.map((p) => (
                <TableHead key={p} className="w-[72px] py-2 text-center text-xs font-medium">
                  {tTeam(`permission.${p}` as 'permission.view')}
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
                    {tTeam(`module.${module}` as 'module.dashboard')}
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
                          aria-label={`${tTeam(`module.${module}` as 'module.dashboard')} — ${tTeam(`permission.${permission}` as 'permission.view')}`}
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

      <p className="text-[10px] text-muted-foreground">{tTeam('memberPermissions.customPermissionsFootnote')}</p>

      {canManageRestricted && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">{tTeam('memberPermissions.assignedProjectsTitle')}</h3>
          <p className="text-xs text-muted-foreground">{tTeam('memberPermissions.assignedProjectsDesc')}</p>
          {projectAssignments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="py-2 text-xs font-medium">
                    {tTeam('memberPermissions.colProject')}
                  </TableHead>
                  <TableHead className="py-2 text-xs font-medium">
                    {tTeam('memberPermissions.colProjectRole')}
                  </TableHead>
                  <TableHead className="w-[80px] py-2 text-right text-xs font-medium">
                    {tTeam('memberPermissions.colAction')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectAssignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="py-2 text-sm">
                      {a.projectName} ({a.projectNumber})
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      {PROJECT_ROLE_VALUES.includes(
                        a.projectRole as (typeof PROJECT_ROLE_VALUES)[number]
                      )
                        ? tProjects(projectRoleLabelKey(a.projectRole))
                        : a.projectRole}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveAssignment(a.id)}
                        disabled={removingId === a.id}
                        aria-label={tTeam('memberPermissions.removeFromProjectAria')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">{tTeam('memberPermissions.noProjectsAssigned')}</p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Select value={addProjectId} onValueChange={setAddProjectId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder={tTeam('memberPermissions.addToProjectPlaceholder')} />
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
                {PROJECT_ROLE_VALUES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {tProjects(projectRoleLabelKey(r))}
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
              {tTeam('memberPermissions.addButton')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/team">{tTeam('memberPermissions.backToTeam')}</Link>
        </Button>
        {hasCustomPermissions && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSubmitting}
          >
            {tTeam('memberPermissions.restoreBaseRole')}
          </Button>
        )}
      </div>
    </div>
  )
}
