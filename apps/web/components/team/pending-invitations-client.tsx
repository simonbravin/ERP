'use client'

import { useState } from 'react'
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
import { formatDateShort } from '@/lib/format-utils'
import { Mail, XCircle } from 'lucide-react'
import { revokeInvitation, resendInvitationEmail } from '@/app/actions/team'
import { toast } from 'sonner'

type Invitation = Awaited<
  ReturnType<typeof import('@/app/actions/team').getPendingInvitations>
>[number]

interface PendingInvitationsClientProps {
  initialInvitations: Invitation[]
}

export function PendingInvitationsClient({
  initialInvitations,
}: PendingInvitationsClientProps) {
  const [invitations, setInvitations] = useState(initialInvitations)

  const handleRevoke = async (invitationId: string) => {
    try {
      await revokeInvitation(invitationId)
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId))
      toast.success('Invitación revocada')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error al revocar'
      )
    }
  }

  const handleResend = async (invitationId: string) => {
    try {
      const result = await resendInvitationEmail(invitationId)
      if (result.success) {
        toast.success('Invitación reenviada por correo')
      } else {
        toast.error(result.error ?? 'Error al reenviar')
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error al reenviar'
      )
    }
  }

  if (invitations.length === 0) {
    return (
      <Card className="p-8 text-center text-slate-500">
        No hay invitaciones pendientes
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Invitado por</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Expira</TableHead>
            <TableHead className="w-[100px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell>{inv.email}</TableCell>
              <TableCell>{inv.role}</TableCell>
              <TableCell>{inv.invitedBy?.fullName ?? '—'}</TableCell>
              <TableCell>{formatDateShort(inv.createdAt)}</TableCell>
              <TableCell>{formatDateShort(inv.expiresAt)}</TableCell>
              <TableCell className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResend(inv.id)}
                >
                  <Mail className="mr-1 h-4 w-4" />
                  Reenviar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(inv.id)}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Revocar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
