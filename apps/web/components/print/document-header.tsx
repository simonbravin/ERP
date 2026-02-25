/**
 * Reusable document header for print layout.
 * Shows org name/logo, optional legal details, project, date, folio block, and "Emitido por".
 */
type DocumentHeaderProps = {
  orgName: string
  orgLegalName?: string | null
  logoUrl?: string | null
  taxId?: string | null
  address?: string | null
  email?: string | null
  phone?: string | null
  projectName?: string | null
  projectNumber?: string | null
  date?: Date
  /** Legacy: single folio string (shows "Folio: {folio}") */
  folio?: string | null
  /** Documento/Folio block: label + value (e.g. "Versión: V-1") */
  folioLabel?: string | null
  folioValue?: string | null
  /** User name or email who issued the document */
  issuedBy?: string | null
}

export function DocumentHeader({
  orgName,
  orgLegalName,
  logoUrl,
  taxId,
  address,
  email,
  phone,
  projectName,
  projectNumber,
  date = new Date(),
  folio,
  folioLabel,
  folioValue,
  issuedBy,
}: DocumentHeaderProps) {
  const displayName = (orgLegalName || orgName).trim() || '—'
  const dateStr = date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const hasLegal = [taxId, address, email, phone].some((v) => v != null && String(v).trim() !== '')
  const showFolioBlock =
    (folioLabel != null && folioValue != null && folioLabel !== '' && folioValue !== '') ||
    (folio != null && folio !== '')

  const folioDisplay =
    folioLabel != null && folioValue != null && folioLabel !== '' && folioValue !== ''
      ? `${folioLabel}: ${folioValue}`
      : folio != null && folio !== ''
        ? `Folio: ${folio}`
        : null

  return (
    <header className="print-document-header">
      <div className="print-document-header__inner">
        <div className="print-document-header__brand">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="print-document-header__logo"
            />
          ) : null}
          <div className="print-document-header__brand-text">
            <h1 className="print-document-header__org">{displayName}</h1>
            {hasLegal && (
              <div className="print-document-header__legal">
                {taxId ? <span>RUC/CUIT: {taxId}</span> : null}
                {address ? <span>{address}</span> : null}
                {email ? <span>{email}</span> : null}
                {phone ? <span>{phone}</span> : null}
              </div>
            )}
            {projectName != null && projectName !== '' && (
              <p className="print-document-header__project">
                {projectNumber ? `${projectNumber} — ` : ''}
                {projectName}
              </p>
            )}
          </div>
        </div>
        <div className="print-document-header__meta">
          <span className="print-document-header__date">Fecha: {dateStr}</span>
          {showFolioBlock && folioDisplay && (
            <span className="print-document-header__folio">{folioDisplay}</span>
          )}
          {issuedBy != null && issuedBy !== '' && (
            <span className="print-document-header__issued-by">Emitido por: {issuedBy}</span>
          )}
        </div>
      </div>
    </header>
  )
}
