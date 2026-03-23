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
import { useTranslations } from 'next-intl'
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
  const tTeam = useTranslations('team')
  const [invitations, setInvitations] = useState(initialInvitations)

  const handleRevoke = async (invitationId: string) => {
    try {
      await revokeInvitation(invitationId)
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId))
      toast.success(tTeam('toast.invitationRevoked'))
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : tTeam('toast.invitationRevokeError')
      )
    }
  }

  const handleResend = async (invitationId: string) => {
    try {
      const result = await resendInvitationEmail(invitationId)
      if (result.success) {
        toast.success(tTeam('toast.invitationResent'))
      } else {
        toast.error(result.error ?? tTeam('toast.invitationResendError'))
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : tTeam('toast.invitationResendError')
      )
    }
  }

  if (invitations.length === 0) {
    return (
      <Card className="p-8 text-center text-slate-500">
        {tTeam('pendingInvitationsEmpty')}
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tTeam('pendingInvitations.colEmail')}</TableHead>
            <TableHead>{tTeam('pendingInvitations.colRole')}</TableHead>
            <TableHead>{tTeam('pendingInvitations.colInvitedBy')}</TableHead>
            <TableHead>{tTeam('pendingInvitations.colDate')}</TableHead>
            <TableHead>{tTeam('pendingInvitations.colExpires')}</TableHead>
            <TableHead className="w-[100px]">{tTeam('pendingInvitations.colActions')}</TableHead>
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
                  {tTeam('pendingInvitations.resend')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(inv.id)}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  {tTeam('pendingInvitations.revoke')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
