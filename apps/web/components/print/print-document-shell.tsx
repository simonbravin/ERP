'use client'

import { DocumentHeader } from '@/components/print/document-header'
import { usePrintContext } from '@/components/print/print-context'
import { getLegalIdDisplay } from '@/lib/print/legal-id'
import { getHeaderMeta, type HeaderMetaParams } from '@/lib/pdf/templates/header-meta'

type PrintDocumentShellProps = {
  templateId: string
  id?: string
  query?: Record<string, string | undefined>
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

  const params: HeaderMetaParams = { id, ...query }
  const meta = getHeaderMeta(templateId, params)
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
      />
      {children}
    </>
  )
}
