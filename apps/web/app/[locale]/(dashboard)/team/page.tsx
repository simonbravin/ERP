import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { getOrgMembers, getPendingInvitations } from '@/app/actions/team'
import { TeamMembersClient } from '@/components/team/team-members-client'
import { PendingInvitationsClient } from '@/components/team/pending-invitations-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getTranslations } from 'next-intl/server'

export default async function TeamPage() {
  const session = await getSession()
  const locale = await getLocale()
  if (!session?.user?.id) redirect({ href: '/login', locale })

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) redirect({ href: '/login', locale })

  const [members, invitations] = await Promise.all([
    getOrgMembers(),
    getPendingInvitations(),
  ])

  const t = await getTranslations('nav')
  const canInvite = ['OWNER', 'ADMIN'].includes(orgContext.role)

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="erp-section-header">
        <h1 className="erp-page-title">{t('team')}</h1>
        <p className="erp-section-desc">
          Gestiona los miembros de tu organización y sus permisos globales.
        </p>
        <p className="text-xs text-muted-foreground">
          Este es el equipo a nivel empresa. El equipo de cada proyecto se gestiona dentro del proyecto (Equipo del Proyecto). Podés asignar a un usuario solo a uno o pocos proyectos y limitar sus permisos desde aquí (por ejemplo, subcontratistas que solo ven esos proyectos).
        </p>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList>
          <TabsTrigger value="members">
            Miembros ({members.length})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Invitaciones Pendientes ({invitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <TeamMembersClient
            initialMembers={members}
            canInvite={canInvite}
            currentUserId={session.user.id}
          />
        </TabsContent>

        <TabsContent value="invitations" className="mt-4">
          <PendingInvitationsClient initialInvitations={invitations} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
