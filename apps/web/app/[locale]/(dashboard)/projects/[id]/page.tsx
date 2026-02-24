import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getProject } from '@/app/actions/projects'
import { getApprovedOrBaselineBudgetTotal } from '@/app/actions/budget'
import { getRecentActivityByProject } from '@/app/actions/dashboard'
import { Link } from '@/i18n/navigation'
import { RecentActivityFeed } from '@/components/dashboard/recent-activity-feed'
import {
  ProjectPhaseBadge,
  ProjectStatusBadge,
} from '@/components/projects/project-overview-badges'
import { formatCurrency } from '@/lib/format-utils'
import {
  Calendar,
  MapPin,
  User,
  DollarSign,
  FileText,
  CheckSquare,
  Clock,
} from 'lucide-react'

type PageProps = {
  params: Promise<{ id: string }>
}

/** Formatea una fecha solo-día usando componentes UTC para no desfasarse un día en otras zonas horarias */
function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  return new Date(y, m, day).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const dynamic = 'force-dynamic'

export default async function ProjectDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()
  const t = await getTranslations('projects')

  const { id } = await params
  const [project, approvedBudgetTotal, recentActivity] = await Promise.all([
    getProject(id),
    getApprovedOrBaselineBudgetTotal(id),
    getRecentActivityByProject(org.orgId, id),
  ])
  if (!project) notFound()

  // Presupuesto: mostrar total de versión aprobada/baseline si existe; si no, el campo del proyecto
  const totalBudget =
    approvedBudgetTotal > 0
      ? approvedBudgetTotal
      : project.totalBudget
        ? typeof project.totalBudget === 'number'
          ? project.totalBudget
          : Number(project.totalBudget)
        : 0

  return (
    <div className="erp-stack">
      {/* Project Overview Cards (KPIs) */}
      <div className="erp-grid-cards">
        {/* Budget */}
        <div className="erp-card-elevated p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('budget')}</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(totalBudget)}
              </p>
            </div>
          </div>
        </div>

        {/* Phase */}
        <div className="erp-card-elevated p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-100 p-2">
              <Clock className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('phase')}</p>
              <div className="mt-1">
                <ProjectPhaseBadge phase={project.phase} />
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="erp-card-elevated p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <CheckSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('status')}</p>
              <div className="mt-1">
                <ProjectStatusBadge status={project.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Start Date */}
        <div className="erp-card-elevated p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('startDate')}</p>
              <p className="text-lg font-medium text-foreground">
                {project.startDate
                  ? formatDateOnly(new Date(project.startDate))
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <div className="erp-card-elevated p-6">
        <h2 className="erp-section-title mb-4">
          Detalles del Proyecto
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(project.clientName != null && project.clientName !== '') && (
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-sm text-muted-foreground">{t('client')}</dt>
                <dd className="text-sm font-medium text-foreground">
                  {project.clientName}
                </dd>
              </div>
            </div>
          )}
          {project.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-sm text-muted-foreground">Ubicación</dt>
                <dd className="text-sm font-medium text-foreground">
                  {project.location}
                </dd>
              </div>
            </div>
          )}
          {project.m2 && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-sm text-muted-foreground">Superficie</dt>
                <dd className="text-sm font-medium text-foreground">
                  {project.m2.toString()} m²
                </dd>
              </div>
            </div>
          )}
          {project.plannedEndDate && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-sm text-muted-foreground">{t('plannedEndDate')}</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatDateOnly(new Date(project.plannedEndDate))}
                </dd>
              </div>
            </div>
          )}
          {project.description && (
            <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-sm text-muted-foreground">Descripción</dt>
                <dd className="text-sm text-card-foreground">
                  {project.description}
                </dd>
              </div>
            </div>
          )}
        </dl>
      </div>

      {/* Quick Actions (Acceso Rápido) */}
      <div className="erp-card-elevated p-6">
        <h2 className="erp-section-title mb-4">
          Acceso Rápido
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link
            href={`/projects/${project.id}/certifications`}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center transition-colors hover:bg-muted/50"
          >
            <CheckSquare className="h-6 w-6 text-blue-600" />
            <span className="text-sm font-medium text-foreground">
              {t('certifications')}
            </span>
          </Link>
          <Link
            href={`/projects/${project.id}/change-orders`}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center transition-colors hover:bg-muted/50"
          >
            <FileText className="h-6 w-6 text-amber-600" />
            <span className="text-sm font-medium text-foreground">
              {t('changeOrders')}
            </span>
          </Link>
          <Link
            href={`/projects/${project.id}/wbs`}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center transition-colors hover:bg-muted/50"
          >
            <FileText className="h-6 w-6 text-violet-600" />
            <span className="text-sm font-medium text-foreground">
              {t('wbs')}
            </span>
          </Link>
          <Link
            href={`/projects/${project.id}/quality/rfis`}
            className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition-colors hover:bg-slate-50"
          >
            <CheckSquare className="h-6 w-6 text-red-600" />
            <span className="text-sm font-medium text-slate-700">
              RFIs
            </span>
          </Link>
          <Link
            href={`/projects/${project.id}/documents`}
            className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition-colors hover:bg-slate-50"
          >
            <FileText className="h-6 w-6 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">
              {t('documents')}
            </span>
          </Link>
          <Link
            href={`/projects/${project.id}/daily-reports`}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center transition-colors hover:bg-muted/50"
          >
            <FileText className="h-6 w-6 text-sky-600" />
            <span className="text-sm font-medium text-foreground">
              {t('dailyReports')}
            </span>
          </Link>
        </div>
      </div>

      {/* Actividad reciente */}
      <RecentActivityFeed activities={recentActivity} hideProjectName />
    </div>
  )
}
