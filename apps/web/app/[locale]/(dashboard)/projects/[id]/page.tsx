import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { hasMinimumRole } from '@/lib/rbac'
import { getProject } from '@/app/actions/projects'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { ProjectPhaseBadge } from '@/components/projects/project-phase-badge'
import { formatCurrency } from '@/lib/format-utils'
import {
  Calendar,
  MapPin,
  User,
  Pencil,
  DollarSign,
  FileText,
  CheckSquare,
  Clock,
} from 'lucide-react'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session?.user?.id) return notFound()
  const org = await getOrgContext(session.user.id)
  if (!org) return notFound()
  const t = await getTranslations('projects')

  const { id } = await params
  const project = await getProject(id)
  if (!project) notFound()

  const canEdit = hasMinimumRole(org.role, 'EDITOR')

  // Calculate budget (handle Decimal type)
  const totalBudget = project.totalBudget
    ? typeof project.totalBudget === 'number'
      ? project.totalBudget
      : Number(project.totalBudget)
    : 0

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {project.projectNumber}
          </p>
        </div>

        {canEdit && (
          <Button asChild variant="outline">
            <Link href={`/projects/${project.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('edit')}
            </Link>
          </Button>
        )}
      </div>

      {/* Project Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Budget */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('budget')}</p>
              <p className="text-xl font-semibold text-slate-900">
                {formatCurrency(totalBudget)}
              </p>
            </div>
          </div>
        </div>

        {/* Phase */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-100 p-2">
              <Clock className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('phase')}</p>
              <div className="mt-1">
                <ProjectPhaseBadge phase={project.phase} />
              </div>
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('client')}</p>
              <p className="text-lg font-medium text-slate-900 truncate">
                {project.clientName || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Start Date */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('startDate')}</p>
              <p className="text-lg font-medium text-slate-900">
                {project.startDate
                  ? new Date(project.startDate).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Detalles del Proyecto
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {project.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <dt className="text-sm text-slate-500">Ubicación</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {project.location}
                </dd>
              </div>
            </div>
          )}
          {project.m2 && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <dt className="text-sm text-slate-500">Superficie</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {project.m2.toString()} m²
                </dd>
              </div>
            </div>
          )}
          {project.plannedEndDate && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <dt className="text-sm text-slate-500">{t('plannedEndDate')}</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {new Date(project.plannedEndDate).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            </div>
          )}
          {project.description && (
            <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-3">
              <FileText className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <dt className="text-sm text-slate-500">Descripción</dt>
                <dd className="text-sm text-slate-700">
                  {project.description}
                </dd>
              </div>
            </div>
          )}
        </dl>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Acceso Rápido
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link
            href={`/projects/${project.id}/budget`}
            className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition-colors hover:bg-slate-50"
          >
            <DollarSign className="h-6 w-6 text-emerald-600" />
            <span className="text-sm font-medium text-slate-700">
              {t('budget')}
            </span>
          </Link>
          <Link
            href={`/projects/${project.id}/certifications`}
            className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition-colors hover:bg-slate-50"
          >
            <CheckSquare className="h-6 w-6 text-blue-600" />
            <span className="text-sm font-medium text-slate-700">
              {t('certifications')}
            </span>
          </Link>
          <Link
            href={`/projects/${project.id}/change-orders`}
            className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition-colors hover:bg-slate-50"
          >
            <FileText className="h-6 w-6 text-amber-600" />
            <span className="text-sm font-medium text-slate-700">
              {t('changeOrders')}
            </span>
          </Link>
          <Link
            href={`/projects/${project.id}/wbs`}
            className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition-colors hover:bg-slate-50"
          >
            <FileText className="h-6 w-6 text-violet-600" />
            <span className="text-sm font-medium text-slate-700">
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
            className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition-colors hover:bg-slate-50"
          >
            <FileText className="h-6 w-6 text-sky-600" />
            <span className="text-sm font-medium text-slate-700">
              {t('dailyReports')}
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
