import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { getLocale } from 'next-intl/server'
import { prisma } from '@repo/database'

export default async function ProjectFinancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  const locale = await getLocale()

  if (!session?.user?.id) {
    redirect(`/${locale}/login`)
  }

  const orgContext = await getOrgContext(session.user.id)
  if (!orgContext) {
    redirect(`/${locale}/login`)
  }

  const { id: projectId } = await params

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: orgContext.orgId },
    select: { id: true, name: true, projectNumber: true },
  })
  
  if (!project) {
    notFound()
  }
  
  const t = await getTranslations('nav')
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('finance')}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {project.name}
        </p>
      </div>
      
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">
          Resumen de finanzas del proyecto
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <a 
            href={`/projects/${projectId}/finance/transactions`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Ver transacciones →
          </a>
          <a 
            href={`/projects/${projectId}/finance/accounts-payable`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Cuentas por pagar →
          </a>
          <a 
            href={`/projects/${projectId}/finance/accounts-receivable`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Cuentas por cobrar →
          </a>
          <a 
            href={`/projects/${projectId}/finance/cashflow`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Flujo de caja →
          </a>
          <a 
            href={`/projects/${projectId}/finance/cash-projection`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Proyección de caja →
          </a>
          <a 
            href={`/projects/${projectId}/certifications`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Ver certificaciones →
          </a>
        </div>
      </div>
    </div>
  )
}
