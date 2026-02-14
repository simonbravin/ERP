import { auth } from '@/lib/auth'
import { redirect } from '@/i18n/navigation'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { getUserDetails } from '@/app/actions/super-admin'
import { UserEditClient } from '@/components/super-admin/user-edit-client'

export default async function SuperAdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; userId: string }>
}) {
  const session = await auth()
  const locale = await getLocale()
  if (!session?.user?.isSuperAdmin) {
    return redirect({ href: '/unauthorized', locale })
  }
  const { userId } = await params
  const result = await getUserDetails(userId)
  if (!result.success || !result.user) {
    notFound()
  }
  return (
    <div className="p-6">
      <UserEditClient user={result.user} />
    </div>
  )
}
