import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext, getVisibleProjectIds } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { CustomReportsList } from '@/components/reports/custom-reports-list'
import { QueryBuilder } from '@/components/reports/query-builder'
import { ReportsPredefinedSection } from '@/components/reports/reports-predefined-section'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { CustomReportWithCreator } from '@/lib/types/reports'

export default async function ReportsPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

  const allowedProjectIds = await getVisibleProjectIds(org)
  const projects = await prisma.project.findMany({
    where: {
      orgId: org.orgId,
      ...(Array.isArray(allowedProjectIds) && allowedProjectIds.length > 0
        ? { id: { in: allowedProjectIds } }
        : {}),
    },
    select: { id: true, name: true, projectNumber: true },
    orderBy: { name: 'asc' },
  })

  const reports = await prisma.customReport.findMany({
    where: {
      orgId: org.orgId,
      OR: [
        { isPublic: true },
        { createdByUserId: session.user.id },
      ],
    },
    include: {
      createdBy: {
        select: { fullName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const predefinedReports = [
    {
      id: 'gastos-por-proveedor',
      name: 'Gastos por Proveedor',
      description: 'Análisis de compras consolidado por proveedor',
      category: 'FINANCE',
      icon: '💰',
    },
    {
      id: 'budget-vs-actual',
      name: 'Presupuesto vs Real',
      description: 'Control de costos por proyecto',
      category: 'BUDGET',
      icon: '📊',
    },
    {
      id: 'progress-vs-cost',
      name: 'Avance vs Costo',
      description: 'Consumido vs avance de obra por proyecto',
      category: 'BUDGET',
      icon: '📈',
    },
    {
      id: 'top-materials',
      name: 'Top 10 Materiales más Caros',
      description: 'Análisis de materiales por costo total en presupuestos',
      category: 'MATERIALS',
      icon: '📦',
    },
    {
      id: 'certifications',
      name: 'Evolución de Certificaciones',
      description: 'Ingresos cobrados por proyecto (por estado)',
      category: 'FINANCE',
      icon: '📋',
    },
    {
      id: 'purchases-multi-project',
      name: 'Compras Multi-Proyecto',
      description: 'Compras a un proveedor en múltiples proyectos',
      category: 'FINANCE',
      icon: '🛒',
    },
    {
      id: 'materials-by-project',
      name: 'Materiales por Proyecto',
      description: 'Consolidado de materiales agrupados por proyecto',
      category: 'MATERIALS',
      icon: '📦',
    },
  ]

  return (
    <div className="erp-view-container space-y-6 bg-background">
      <div className="erp-header-row flex flex-wrap items-center justify-between gap-4">
        <div className="erp-section-header">
          <h1 className="erp-page-title">Reportes y Exportaciones</h1>
          <p className="erp-section-desc">
            Genera reportes personalizados y exporta datos
          </p>
        </div>

        {['ADMIN', 'OWNER'].includes(org.role) && (
          <Button asChild>
            <Link href="/reports/new">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Reporte
            </Link>
          </Button>
        )}
      </div>

      <div>
        <h2 className="erp-section-title mb-4">
          Reportes Predefinidos
        </h2>
        <ReportsPredefinedSection
          predefinedReports={predefinedReports}
          projects={projects}
        />
      </div>

      <div>
        <h2 className="erp-section-title mb-4">
          Query Builder
        </h2>
        <p className="erp-section-desc mb-4">
          Construí consultas sin SQL: elegí tabla, campos y filtros para previsualizar datos.
        </p>
        <QueryBuilder />
      </div>

      <div>
        <h2 className="erp-section-title mb-4">
          Reportes Personalizados
        </h2>
        {reports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">
              Aún no hay reportes personalizados.
            </p>
            {['ADMIN', 'OWNER'].includes(org.role) && (
              <Button asChild className="mt-4" variant="outline">
                <Link href="/reports/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Primer Reporte
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <CustomReportsList reports={reports as CustomReportWithCreator[]} />
        )}
      </div>
    </div>
  )
}
