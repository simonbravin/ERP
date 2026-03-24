import { notFound } from 'next/navigation'
import { getOrganizationDetails } from '@/app/actions/super-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/navigation'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function SuperAdminOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const org = await getOrganizationDetails(orgId)
  if (!org) notFound()
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/super-admin/organizations"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Organizations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {org.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{org.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/super-admin/organizations/${orgId}/billing`}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Billing detail
          </Link>
          {org.isBlocked && (
            <Badge variant="destructive">Blocked</Badge>
          )}
          <Badge variant="outline">{org.subscriptionPlan ?? org.subscriptionStatus}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription & limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Plan:</span>{' '}
              {org.subscriptionPlan ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Max projects:</span> {org.maxProjects}
            </p>
            <p>
              <span className="text-muted-foreground">Max users:</span> {org.maxUsers}
            </p>
            <p>
              <span className="text-muted-foreground">Max storage (GB):</span> {org.maxStorageGB}
            </p>
            {org.blockedReason && (
              <p>
                <span className="text-muted-foreground">Block reason:</span>{' '}
                {org.blockedReason}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Members ({org.members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {org.members.slice(0, 10).map((m) => (
                <li key={m.id} className="flex justify-between text-sm">
                  <span>{m.user.fullName}</span>
                  <span className="text-muted-foreground">{m.user.email}</span>
                  <Badge variant="outline">{m.role}</Badge>
                </li>
              ))}
              {org.members.length > 10 && (
                <li className="text-muted-foreground text-sm">
                  +{org.members.length - 10} more
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects ({org.projects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {org.projects.slice(0, 10).map((p) => (
              <li key={p.id} className="flex justify-between text-sm">
                <span>{p.name}</span>
                <span className="text-muted-foreground">{p.projectNumber}</span>
                <Badge variant="outline">{p.status}</Badge>
              </li>
            ))}
            {org.projects.length > 10 && (
              <li className="text-muted-foreground text-sm">
                +{org.projects.length - 10} more
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Created {formatDistanceToNow(new Date(org.createdAt), { addSuffix: true, locale: es })}
      </p>
    </div>
  )
}
