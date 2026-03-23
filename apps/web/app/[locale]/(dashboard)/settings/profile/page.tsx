import { getSession } from '@/lib/session'
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'
import { prisma } from '@repo/database'
import { resolveAvatarUrl } from '@/app/actions/settings'
import { UserProfileForm } from '@/components/settings/user-profile-form'
export default async function ProfilePage() {
  const session = await getSession()
  const locale = await getLocale()
  if (!session?.user?.id) redirect({ href: '/login', locale })

  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id },
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      avatarUrl: true,
    },
  })

  if (!user) redirect({ href: '/login', locale })

  const displayAvatarUrl = await resolveAvatarUrl(user!.avatarUrl)

  const userData = {
    id: user!.id,
    email: user!.email,
    username: user!.username,
    fullName: user!.fullName,
    avatarUrl: displayAvatarUrl ?? user!.avatarUrl,
  }

  return (
    <div className="mx-auto max-w-4xl">
      <UserProfileForm user={userData} />
    </div>
  )
}
