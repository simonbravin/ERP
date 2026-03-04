import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProject } from '@/app/actions/projects'
import { listBudgetVersions } from '@/app/actions/budget'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, FileText, DollarSign, FileCheck } from 'lucide-react'
import { Link } from '@/i18n/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectReportsPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()

  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()

  const { id: projectId } = await params
  const project = await getProject(projectId)
  if (!project) notFound()

  const versions = await listBudgetVersions(projectId)
  const firstApprovedVersion = versions?.find((v) => v.status === 'APPROVED')

  const quickReports = [
    {
      title: 'Presupuesto vs Real',
      description: 'Análisis de varianzas por partida',
      icon: BarChart3,
      href: firstApprovedVersion
        ? `/projects/${projectId}/budget/${firstApprovedVersion.id}`
        : `/projects/${projectId}/budget`,
    },
    {
      title: 'Certificaciones',
      description: 'Evolución y estado de certificaciones',
      icon: FileCheck,
      href: `/projects/${projectId}/finance/certifications`,
    },
    {
      title: 'Gastos por Proveedor',
      description: 'Análisis de compras del proyecto',
      icon: DollarSign,
      href: `/reports/predefined/gastos-por-proveedor?projectIds=${projectId}`,
    },
    {
      title: 'Materiales del Proyecto',
      description: 'Consolidado de materiales',
      icon: FileText,
      href: firstApprovedVersion
        ? `/projects/${projectId}/budget/${firstApprovedVersion.id}/materials`
        : `/projects/${projectId}/budget`,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl w-full space-y-6 p-6">
      <PageHeader
        title="Reportes del Proyecto"
        subtitle={`${project.name} • ${project.projectNumber}`}
        breadcrumbs={[
          { label: 'Proyectos', href: '/projects' },
          { label: project.name, href: `/projects/${projectId}` },
          { label: 'Reportes' },
        ]}
      />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Reportes Rápidos</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickReports.map((report) => (
            <Link key={report.title} href={report.href}>
              <Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer">
                <CardHeader>
                  <report.icon className="mb-2 h-8 w-8 text-primary" />
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reportes Personalizados</CardTitle>
          <CardDescription>
            Crea reportes personalizados usando el Query Builder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/reports">Ir al Query Builder</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
