import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@repo/database'
import { getDownloadUrl } from '@/lib/r2-client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/org/logo
 * Returns the current user's organization name and logo URL, if available.
 * Uses the session to infer orgId; no params required.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const orgId: string | undefined = user.orgId
    const orgName: string | undefined = user.orgName

    if (!orgId) {
      return NextResponse.json(
        { orgId: null, orgName: orgName ?? null, logoUrl: null },
        { status: 200 }
      )
    }

    const profile = await prisma.orgProfile.findUnique({
      where: { orgId },
      select: { logoStorageKey: true },
    })

    let logoUrl: string | null = null
    if (profile?.logoStorageKey) {
      const url = await getDownloadUrl(profile.logoStorageKey)
      if (url.startsWith('http') || url.startsWith('/')) {
        logoUrl = url
      }
    }

    return NextResponse.json(
      {
        orgId,
        orgName: orgName ?? null,
        logoUrl,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[api/org/logo] error', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

