'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Link } from '@/i18n/navigation'
import { Building2, Users, Shield, AlertTriangle, Activity, LayoutDashboard, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { SystemHealthWidget } from '@/components/debug/system-health-widget'

type Stats = {
  orgsTotal: number
  orgsActive: number
  orgsBlocked: number
  usersTotal: number
  recentOrgs: Array<{
    id: string
    name: string
    isBlocked: boolean
    subscriptionStatus: string
    createdAt: Date
    _count: { members: number; projects: number }
  }>
}

type Props = {
  stats: Stats
}

export function SuperAdminDashboardClient({ stats }: Props) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Super Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of organizations, users, and recent activity.
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full space-y-6">
        <TabsList className="!flex h-14 w-full max-w-4xl flex-row gap-4 rounded-xl border border-border bg-muted/50 p-2 shadow-sm sm:gap-6">
          <TabsTrigger
            value="dashboard"
            className="flex flex-1 items-center justify-center gap-3 rounded-lg px-8 py-3 text-base font-medium min-w-0"
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger
            value="events"
            className="flex flex-1 items-center justify-center gap-3 rounded-lg px-8 py-3 text-base font-medium min-w-0"
          >
            <Activity className="h-5 w-5 shrink-0" />
            <span>Event Monitor</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total organizations</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{stats.orgsTotal}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active (not blocked)</CardTitle>
                <Shield className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{stats.orgsActive}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocked</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{stats.orgsBlocked}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{stats.usersTotal}</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent organizations</CardTitle>
              <p className="text-sm text-muted-foreground">
                Latest registered organizations. Open Organizations for full list and actions.
              </p>
            </CardHeader>
            <CardContent>
              {stats.recentOrgs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No organizations yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {stats.recentOrgs.map((org) => (
                    <li
                      key={org.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{org.name}</span>
                        <Badge variant={org.isBlocked ? 'danger' : 'secondary'}>
                          {org.subscriptionStatus}
                        </Badge>
                        {org.isBlocked && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            Blocked
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{org._count.members} users</span>
                        <span>{org._count.projects} projects</span>
                        <span>
                          {formatDistanceToNow(new Date(org.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                        <Button asChild variant="outline" size="sm" className="shrink-0">
                          <Link href={`/super-admin/organizations/${org.id}`}>
                            <Eye className="mr-1.5 h-4 w-4" />
                            Ver
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            Últimos eventos del bus (útil para depuración). Los eventos se disparan al crear/actualizar/eliminar entidades.
          </p>
          <SystemHealthWidget embedded />
        </TabsContent>
      </Tabs>
    </div>
  )
}
