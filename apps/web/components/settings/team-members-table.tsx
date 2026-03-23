'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ExportDialog } from '@/components/export/export-dialog'
import { updateMemberRole, deactivateMember, activateMember, resendInvitation } from '@/app/actions/team'
import { exportTeamToExcel } from '@/app/actions/export'
import { toast } from 'sonner'
import { MoreVertical, Shield, ShieldCheck, ShieldAlert, Mail, FileDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { OrgRole } from '@repo/database'

interface Member {
  id: string
  role: string
  active: boolean
  createdAt: Date
  user: {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
    lastLoginAt: Date | null
  } | null
}

interface TeamMembersTableProps {
  members: Member[]
  currentUserId: string
  canManage: boolean
}

export function TeamMembersTable({ members, currentUserId, canManage }: TeamMembersTableProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)

  const exportColumns = [
    { field: 'fullName', label: t('member'), defaultVisible: true },
    { field: 'email', label: t('email') ?? 'Email', defaultVisible: true },
    { field: 'role', label: t('role') ?? 'Rol', defaultVisible: true },
    { field: 'status', label: t('status') ?? 'Estado', defaultVisible: true },
    { field: 'lastLoginAt', label: t('lastActive'), defaultVisible: true },
  ]

  async function handleExport(format: 'excel' | 'pdf', selectedColumns: string[]) {
    if (format !== 'excel') {
      return { success: false, error: 'Solo exportación Excel disponible para equipo' }
    }
    return await exportTeamToExcel(selectedColumns)
  }

  const roleColors: Record<string, string> = {
    OWNER: 'bg-purple-100 text-purple-800',
    ADMIN: 'bg-red-100 text-red-800',
    EDITOR: 'bg-blue-100 text-blue-800',
    ACCOUNTANT: 'bg-green-100 text-green-800',
    VIEWER: 'bg-muted text-foreground',
  }

  const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    OWNER: ShieldAlert,
    ADMIN: ShieldCheck,
    EDITOR: Shield,
    ACCOUNTANT: Shield,
    VIEWER: Shield,
  }

  async function handleChangeRole(memberId: string, newRole: OrgRole) {
    setLoadingId(memberId)
    try {
      const result = await updateMemberRole(memberId, newRole)

      if (result.success === true) {
        toast.success(t('roleUpdateSuccess'))
        router.refresh()
      } else {
        toast.error(result.error || t('roleUpdateError'))
      }
    } catch {
      toast.error(t('roleUpdateError'))
    } finally {
      setLoadingId(null)
    }
  }

  async function handleToggleActive(memberId: string, currentlyActive: boolean) {
    setLoadingId(memberId)
    try {
      const result = currentlyActive
        ? await deactivateMember(memberId)
        : await activateMember(memberId)

      if (result.success === true) {
        toast.success(
          currentlyActive ? t('memberDeactivated') : t('memberActivated')
        )
        router.refresh()
      } else {
        toast.error(result.error || t('toggleActiveError'))
      }
    } catch {
      toast.error(t('toggleActiveError'))
    } finally {
      setLoadingId(null)
    }
  }

  async function handleResendInvitation(memberId: string) {
    setLoadingId(memberId)
    try {
      const result = await resendInvitation(memberId)

      if (result.success) {
        toast.success(t('invitationResent'))
      } else {
        toast.error(result.error || t('resendInvitationError'))
      }
    } catch {
      toast.error(t('resendInvitationError'))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{t('teamMembers') ?? 'Miembros del Equipo'}</h2>
        <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
          <FileDown className="mr-2 h-4 w-4" />
          {tCommon('export')}
        </Button>
      </div>
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('member')}</TableHead>
            <TableHead>{t('role')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead>{t('lastActive')}</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const Icon = roleIcons[member.role]
            const isCurrentUser = member.user?.id === currentUserId
            const isPending = !member.user

            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.user?.avatarUrl || undefined} />
                      <AvatarFallback>
                        {member.user?.fullName?.charAt(0)?.toUpperCase() ||
                          member.user?.email?.charAt(0)?.toUpperCase() ||
                          '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-slate-900">
                        {member.user?.fullName || member.user?.email || t('pendingUser')}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-slate-500">
                            ({t('you')})
                          </span>
                        )}
                      </p>
                      {member.user && (
                        <p className="text-sm text-slate-500">
                          {member.user.email}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge className={roleColors[member.role]}>
                    {Icon && <Icon className="mr-1 h-3 w-3" />}
                    {t(`role_${member.role.toLowerCase()}`)}
                  </Badge>
                </TableCell>

                <TableCell>
                  {isPending ? (
                    <Badge
                      variant="outline"
                      className="border-orange-200 bg-orange-50 text-orange-800"
                    >
                      {t('invitationPending')}
                    </Badge>
                  ) : member.active ? (
                    <Badge
                      variant="outline"
                      className="border-green-200 bg-green-50 text-green-800"
                    >
                      {t('active')}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-border bg-muted text-muted-foreground"
                    >
                      {t('inactive')}
                    </Badge>
                  )}
                </TableCell>

                <TableCell>
                  {member.user?.lastLoginAt ? (
                    <span className="text-sm text-slate-500">
                      {formatDistanceToNow(new Date(member.user.lastLoginAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">
                      {t('neverLoggedIn')}
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  {canManage && !isCurrentUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loadingId === member.id}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t('actions')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {member.role !== 'OWNER' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.id, 'ADMIN')}
                              disabled={member.role === 'ADMIN'}
                            >
                              {t('makeAdmin')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.id, 'EDITOR')}
                              disabled={member.role === 'EDITOR'}
                            >
                              {t('makeEditor')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleChangeRole(member.id, 'ACCOUNTANT')
                              }
                              disabled={member.role === 'ACCOUNTANT'}
                            >
                              {t('makeAccountant')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.id, 'VIEWER')}
                              disabled={member.role === 'VIEWER'}
                            >
                              {t('makeViewer')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}

                        {isPending && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleResendInvitation(member.id)}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              {t('resendInvitation')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}

                        {member.role !== 'OWNER' && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggleActive(member.id, member.active)
                            }
                            className={!member.active ? '' : 'text-red-600'}
                          >
                            {member.active ? t('deactivate') : t('activate')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
    </div>

    <ExportDialog
      open={showExportDialog}
      onOpenChange={setShowExportDialog}
      title={t('teamMembers')}
      columns={exportColumns}
      onExport={handleExport}
    />
    </>
  )
}
