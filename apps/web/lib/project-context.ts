import { prisma } from '@repo/database'

/**
 * Returns the current user's project role for the given project, or null if not a member.
 * Use in server components and actions under /projects/[id]/...
 */
export async function getProjectMemberRole(
  projectId: string,
  orgMemberId: string
): Promise<string | null> {
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_orgMemberId: { projectId, orgMemberId },
      active: true,
    },
    select: { projectRole: true },
  })
  return member?.projectRole ?? null
}
