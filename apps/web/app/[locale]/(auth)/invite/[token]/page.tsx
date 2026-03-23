import { prisma } from '@repo/database'
import { AcceptInvitationClient } from '@/components/team/accept-invitation-client'
import { notFound } from 'next/navigation'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function AcceptInvitationPage({ params }: PageProps) {
  const { token } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      invitedBy: { select: { fullName: true } },
    },
  })

  if (!invitation || invitation.status !== 'PENDING') {
    return notFound()
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Invitación Expirada
          </CardTitle>
          <CardDescription>
            Esta invitación ya no es válida. Por favor, solicita una nueva
            invitación al administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <AcceptInvitationClient
      invitation={{
        email: invitation.email,
        role: invitation.role,
        organization: { name: invitation.organization.name },
        invitedBy: { fullName: invitation.invitedBy.fullName },
      }}
      token={token}
    />
  )
}
