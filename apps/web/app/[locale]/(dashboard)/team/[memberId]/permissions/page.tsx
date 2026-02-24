import { getMemberPermissions, getProjectAssignmentsForMember } from '@/app/actions/team'
import { listProjects } from '@/app/actions/projects'
import { MemberPermissionsClient } from '@/components/team/member-permissions-client'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { Card, CardContent } from '@/components/ui/card'

interface PageProps {
  params: Promise<{ memberId: string }>
}

export default async function MemberPermissionsPage({ params }: PageProps) {
  const session = await getSession()
  const locale = await getLocale()
  if (!session?.user?.id) redirect({ href: '/login', locale })

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) redirect({ href: '/login', locale })

  const { memberId } = await params

  let member
  let projectAssignments: Awaited<ReturnType<typeof getProjectAssignmentsForMember>> = []
  let allProjects: Awaited<ReturnType<typeof listProjects>> = []
  const canManageRestricted = orgContext.role === 'OWNER' || orgContext.role === 'ADMIN'
  try {
    member = await getMemberPermissions(memberId)
    if (canManageRestricted) {
      const [assignments, projects] = await Promise.all([
        getProjectAssignmentsForMember(memberId).catch(() => []),
        listProjects().catch(() => []),
      ])
      projectAssignments = assignments
      allProjects = projects
    }
  } catch {
    redirect({ href: '/team', locale })
  }

  const assignedProjectIds = new Set(projectAssignments.map((a) => a.projectId))
  const availableProjects = allProjects.filter((p) => !assignedProjectIds.has(p.id))

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="erp-section-header">
        <h1 className="erp-page-title">Permisos de tu Equipo</h1>
        <p className="erp-section-desc">
          Ajustá el rol base y los permisos por módulo para este miembro.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <MemberPermissionsClient
            member={member}
            projectAssignments={projectAssignments}
            availableProjects={availableProjects}
            canManageRestricted={canManageRestricted}
          />
        </CardContent>
      </Card>
    </div>
  )
}
