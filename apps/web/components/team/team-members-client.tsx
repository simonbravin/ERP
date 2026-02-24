'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserPlus, MoreVertical, Power, Shield } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { InviteUserDialog } from './invite-user-dialog'
import { updateMemberRole, toggleMemberStatus } from '@/app/actions/team'
import { toast } from 'sonner'
import { ROLE_DESCRIPTIONS } from '@/lib/permissions'
import type { OrgRole } from '@prisma/client'

type Member = Awaited<ReturnType<typeof import('@/app/actions/team').getOrgMembers>>[number]

interface TeamMembersClientProps {
  initialMembers: Member[]
  canInvite: boolean
  currentUserId?: string
}

export function TeamMembersClient({ initialMembers, canInvite, currentUserId }: TeamMembersClientProps) {
  const [members, setMembers] = useState(initialMembers)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)

  const handleRoleChange = async (memberId: string, newRole: OrgRole) => {
    const res = await updateMemberRole(memberId, newRole)
    if (!res.success) {
      toast.error(res.error ?? 'Error al actualizar rol')
      return
    }
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    )
    toast.success('Rol actualizado')
  }

  const handleToggleStatus = async (memberId: string) => {
    const res = await toggleMemberStatus(memberId)
    if (!res?.success) {
      toast.error(res?.error ?? 'Error al actualizar')
      return
    }
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, active: !m.active } : m))
    )
    toast.success('Estado actualizado')
  }

  const getRoleBadgeVariant = (
    role: string
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (role) {
      case 'OWNER':
        return 'default'
      case 'ADMIN':
        return 'secondary'
      case 'ACCOUNTANT':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  return (
    <>
      <Card className="p-4">
        {canInvite && (
          <div className="mb-4">
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invitar Usuario
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              {canInvite && <TableHead>Permisos</TableHead>}
              <TableHead className="w-[80px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.user?.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {member.user?.fullName?.charAt(0).toUpperCase() ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {member.user?.fullName ?? '—'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-slate-600">
                  {member.user?.email ?? '—'}
                </TableCell>
                <TableCell>
                  {member.role === 'OWNER' ? (
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role}
                    </Badge>
                  ) : (
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleRoleChange(member.id, value as OrgRole)
                      }
                      disabled={!canInvite || member.userId === currentUserId}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.entries(ROLE_DESCRIPTIONS) as [OrgRole, string][]
                        ).map(
                          ([role, desc]) =>
                            role !== 'OWNER' && (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            )
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={member.active ? 'default' : 'secondary'}>
                    {member.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                {canInvite && (
                  <TableCell>
                    {member.role !== 'OWNER' ? (
                      member.userId === currentUserId ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Link
                          href={`/team/${member.id}/permissions`}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-accent hover:text-accent-foreground"
                        >
                          <Shield className="h-4 w-4" />
                          Permisos
                        </Link>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {member.role !== 'OWNER' && canInvite && member.userId !== currentUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(member.id)}
                        >
                          <Power className="mr-2 h-4 w-4" />
                          {member.active ? 'Desactivar' : 'Reactivar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <InviteUserDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onSuccess={() => {
          setIsInviteDialogOpen(false)
          toast.success('Invitación enviada')
        }}
      />
    </>
  )
}
