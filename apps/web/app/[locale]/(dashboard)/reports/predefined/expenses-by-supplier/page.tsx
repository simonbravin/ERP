import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ projectId?: string; projectIds?: string }>
}

/** Redirect legacy URL to canonical Spanish route, preserving query params. */
export default async function ExpensesBySupplierPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const resolved = await searchParams
  const query = new URLSearchParams()
  if (resolved.projectId) query.set('projectIds', resolved.projectId)
  if (resolved.projectIds) query.set('projectIds', resolved.projectIds)
  const qs = query.toString()
  redirect(`/${locale}/reports/predefined/gastos-por-proveedor${qs ? `?${qs}` : ''}`)
}
