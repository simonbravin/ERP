import { getProject } from '@/app/actions/projects'
import {
  getProjectMembers,
  getOrgMembers,
} from '@/app/actions/team'
import { ProjectTeamClient } from '@/components/projects/project-team-client'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProjectMemberRole } from '@/lib/project-context'
import { canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectTeamPage({ params }: PageProps) {
  const session = await getSession()
  const locale = await getLocale()
  if (!session?.user?.id) redirect({ href: '/login', locale })

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) redirect({ href: '/login', locale })

  const { id: projectId } = await params

  const [project, projectMembers, orgMembers, projectRole] = await Promise.all([
    getProject(projectId),
    getProjectMembers(projectId),
    getOrgMembers(),
    getProjectMemberRole(projectId, orgContext.memberId),
  ])

  if (!project) redirect({ href: '/projects', locale })

  const canManageTeam =
    ['EDITOR', 'ADMIN', 'OWNER'].includes(orgContext.role) ||
    canEditProjectArea(projectRole, PROJECT_AREAS.TEAM)

  return (
    <div className="erp-stack">
      <ProjectTeamClient
        projectId={projectId}
        initialProjectMembers={projectMembers}
        orgMembers={orgMembers}
        canManageTeam={canManageTeam}
      />
    </div>
  )
}
