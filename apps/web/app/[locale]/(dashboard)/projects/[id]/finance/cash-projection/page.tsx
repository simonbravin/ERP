import { redirect } from '@/i18n/navigation'

interface PageProps {
  params: Promise<{ id: string; locale?: string }>
}

export default async function ProjectCashProjectionRedirectPage({ params }: PageProps) {
  const { id: projectId, locale } = await params
  redirect({
    href: `/projects/${projectId}/finance/cashflow`,
    locale: locale ?? 'es',
  })
}
