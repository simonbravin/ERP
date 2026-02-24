import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@repo/database'

/**
 * GET /api/projects/[id]/my-role
 * Returns the current user's project role for this project, or null if not a member.
 * Used by project sidebar to filter nav items by permission.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const session = await getSession()
    if (!session?.user?.id || !session.user.orgMemberId) {
      return NextResponse.json({ projectRole: null })
    }

    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_orgMemberId: {
          projectId,
          orgMemberId: session.user.orgMemberId,
        },
        active: true,
      },
      select: { projectRole: true },
    })

    return NextResponse.json({
      projectRole: member?.projectRole ?? null,
    })
  } catch {
    return NextResponse.json({ projectRole: null }, { status: 500 })
  }
}
