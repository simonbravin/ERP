import { getSession } from '@/lib/session'
import { getOrgContext } from '@/lib/org-context'
import { redirect } from 'next/navigation'
import { prisma } from '@repo/database'
import { ProjectCreationWizard } from '@/components/projects/project-creation-wizard'

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const session = await getSession()
  const { locale } = await params
  if (!session?.user?.id) redirect(`/${locale}/login`)

  const org = await getOrgContext(session.user.id)
  if (!org) redirect(`/${locale}/login`)

  // Solo EDITOR y superior pueden crear proyectos
  if (!['EDITOR', 'ADMIN', 'OWNER'].includes(org.role)) {
    redirect(`/${locale}/projects`)
  }

  const [templates, constructionSystems] = await Promise.all([
    prisma.projectTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.constructionSystem.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Nuevo Proyecto
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Crea un nuevo proyecto seleccionando un template predefinido
        </p>
      </div>

      <ProjectCreationWizard
        templates={templates}
        constructionSystems={constructionSystems}
      />
    </div>
  )
}
