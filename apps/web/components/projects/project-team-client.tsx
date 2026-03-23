'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { UserPlus, Trash2 } from 'lucide-react'
import {
  addProjectMember,
  removeProjectMember,
} from '@/app/actions/team'
import { toast } from 'sonner'

type ProjectMemberRow = Awaited<
  ReturnType<typeof import('@/app/actions/team').getProjectMembers>
>[number]
type OrgMemberRow = Awaited<
  ReturnType<typeof import('@/app/actions/team').getOrgMembers>
>[number]

interface ProjectTeamClientProps {
  projectId: string
  initialProjectMembers: ProjectMemberRow[]
  orgMembers: OrgMemberRow[]
  /** When false (e.g. project role VIEWER or Jefe de obra), hide add/remove actions */
  canManageTeam?: boolean
}

export function ProjectTeamClient({
  projectId,
  initialProjectMembers,
  orgMembers,
  canManageTeam = true,
}: ProjectTeamClientProps) {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const [projectMembers, setProjectMembers] = useState(initialProjectMembers)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedOrgMemberId, setSelectedOrgMemberId] = useState('')
  const [selectedRole, setSelectedRole] = useState('VIEWER')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const alreadyInProject = new Set(
    projectMembers.map((pm) => pm.orgMemberId)
  )
  const availableOrgMembers = orgMembers.filter(
    (m) => m.active && !alreadyInProject.has(m.id)
  )

  const projectRoles = useMemo(
    () =>
      [
        { value: 'MANAGER' as const, label: t('projectRoleManager') },
        { value: 'SUPERINTENDENT' as const, label: t('projectRoleSuperintendent') },
        { value: 'VIEWER' as const, label: t('projectRoleViewer') },
      ],
    [t]
  )

  const handleAdd = async () => {
    if (!selectedOrgMemberId) {
      toast.error(t('toast.selectMember'))
      return
    }
    setIsSubmitting(true)
    try {
      await addProjectMember({
        projectId,
        orgMemberId: selectedOrgMemberId,
        role: selectedRole,
      })
      const added = orgMembers.find((m) => m.id === selectedOrgMemberId)
      if (added) {
        setProjectMembers((prev) => [
          ...prev,
          {
            id: `temp-${added.id}`,
            projectId,
            orgMemberId: added.id,
            projectRole: selectedRole,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            orgMember: {
              ...added,
              user: added.user
                ? {
                    fullName: added.user.fullName,
                    email: added.user.email,
                  }
                : null,
            },
          } as ProjectMemberRow,
        ])
      }
      setAddDialogOpen(false)
      setSelectedOrgMemberId('')
      setSelectedRole('VIEWER')
      toast.success(t('toast.memberAdded'))
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t('toast.memberAddError')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async (projectMemberId: string) => {
    try {
      await removeProjectMember(projectMemberId)
      setProjectMembers((prev) =>
        prev.filter((pm) => pm.id !== projectMemberId)
      )
      toast.success(t('toast.memberRemoved'))
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t('toast.memberRemoveError')
      )
    }
  }

  const getRoleLabel = (role: string) =>
    projectRoles.find((r) => r.value === role)?.label ?? role

  return (
    <>
      <Card className="p-4">
        {canManageTeam && (
          <div className="mb-4 flex justify-end">
            <Button
              onClick={() => setAddDialogOpen(true)}
              disabled={availableOrgMembers.length === 0}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {t('projectTeamAddMember')}
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('projectTeamColName')}</TableHead>
              <TableHead>{t('projectTeamColEmail')}</TableHead>
              <TableHead>{t('projectTeamColRole')}</TableHead>
              {canManageTeam && (
                <TableHead className="w-[80px]">{tCommon('actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectMembers.map((pm) => (
              <TableRow key={pm.id}>
                <TableCell>
                  {pm.orgMember?.user?.fullName ?? '—'}
                </TableCell>
                <TableCell className="text-slate-600">
                  {pm.orgMember?.user?.email ?? '—'}
                </TableCell>
                <TableCell>{getRoleLabel(pm.projectRole)}</TableCell>
                {canManageTeam && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(pm.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {projectMembers.length === 0 && (
          <p className="py-8 text-center text-slate-500">
            {t('projectTeamEmpty')}
          </p>
        )}
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="erp-form-modal max-w-xl gap-6 py-6">
          <DialogHeader>
            <DialogTitle>{t('addMemberDialogTitle')}</DialogTitle>
            <DialogDescription>{t('addMemberDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="add-member-org">Miembro</Label>
                <Select
                  value={selectedOrgMemberId}
                  onValueChange={setSelectedOrgMemberId}
                >
                  <SelectTrigger id="add-member-org" className="mt-1 w-full">
                    <SelectValue placeholder={t('selectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrgMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.user?.fullName ?? m.user?.email ?? m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-member-role">{t('labelProjectRole')}</Label>
                <Select
                  value={selectedRole}
                  onValueChange={setSelectedRole}
                >
                  <SelectTrigger id="add-member-role" className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={isSubmitting}>
              {isSubmitting ? 'Agregando...' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
