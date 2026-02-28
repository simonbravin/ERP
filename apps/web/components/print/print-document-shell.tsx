'use client'

import { DocumentHeader } from '@/components/print/document-header'
import { usePrintContext } from '@/components/print/print-context'
import { getLegalIdDisplay } from '@/lib/print/legal-id'
import { getHeaderMeta, type HeaderMetaParams } from '@/lib/pdf/templates/header-meta'

type PrintDocumentShellProps = {
  templateId: string
  id?: string
  /** Query params from URL (e.g. searchParams). Used for header meta and PDF options (showEmitidoPor, showFullCompanyData). */
  query?: Record<string, string | string[] | undefined>
  project?: { name: string; projectNumber?: string | null }
  children: React.ReactNode
}

export function PrintDocumentShell({
  templateId,
  id,
  query = {},
  project,
  children,
}: PrintDocumentShellProps) {
  const { org, orgProfile, user, logoUrl } = usePrintContext()

  const flatQuery = query
    ? Object.fromEntries(
        Object.entries(query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
      )
    : {}
  const params: HeaderMetaParams = { id, ...flatQuery }
  const meta = getHeaderMeta(templateId, params)
  const showEmitidoPor = flatQuery.showEmitidoPor !== '0' && flatQuery.showEmitidoPor !== 'false'
  const showFullCompanyData = flatQuery.showFullCompanyData !== '0' && flatQuery.showFullCompanyData !== 'false'
  const legalIdDisplay = getLegalIdDisplay({
    taxId: orgProfile?.taxId ?? null,
    country: orgProfile?.country ?? null,
  })

  const issuedBy =
    user?.fullName?.trim() || user?.email?.trim()
      ? (user.fullName?.trim() || user.email || undefined)
      : undefined

  return (
    <>
      <DocumentHeader
        orgName={org.orgName ?? 'Organización'}
        orgLegalName={orgProfile?.legalName ?? undefined}
        logoUrl={logoUrl}
        legalIdDisplay={legalIdDisplay}
        address={orgProfile?.address ?? undefined}
        email={orgProfile?.email ?? undefined}
        phone={orgProfile?.phone ?? undefined}
        projectName={project?.name}
        projectNumber={project?.projectNumber}
        date={new Date()}
        folioLabel={meta.folioLabel}
        folioValue={meta.folioValue}
        issuedBy={issuedBy}
        showEmitidoPor={showEmitidoPor}
        showFullCompanyData={showFullCompanyData}
      />
      {children}
    </>
  )
}
