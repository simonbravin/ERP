import { redirectToLogin } from '@/lib/i18n-redirect'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { prisma } from '@repo/database'
import { CustomReportsList } from '@/components/reports/custom-reports-list'
import { QueryBuilder } from '@/components/reports/query-builder'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { CustomReportWithCreator } from '@/lib/types/reports'

export default async function ReportsPage() {
  const session = await getSession()
  if (!session?.user?.id) return redirectToLogin()

  const org = await getOrgContext(session.user.id)
  if (!org) return redirectToLogin()

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
      id: 'expenses-by-supplier',
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
    <div className="mx-auto max-w-6xl w-full space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Reportes y Exportaciones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Reportes Predefinidos
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {predefinedReports.map((report) => (
            <Link
              key={report.id}
              href={`/reports/predefined/${report.id}`}
              className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-accent hover:shadow-md"
            >
              <div className="mb-3 text-3xl">{report.icon}</div>
              <h3 className="font-semibold text-foreground group-hover:text-accent">
                {report.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Query Builder
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Construí consultas sin SQL: elegí tabla, campos y filtros para previsualizar datos.
        </p>
        <QueryBuilder />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
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
