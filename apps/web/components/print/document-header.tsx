/**
 * Reusable document header for print layout.
 * Shows org name/logo and optional project/date/folio.
 */
type DocumentHeaderProps = {
  orgName: string
  orgLegalName?: string | null
  logoUrl?: string | null
  projectName?: string | null
  projectNumber?: string | null
  date?: Date
  folio?: string | null
}

export function DocumentHeader({
  orgName,
  orgLegalName,
  logoUrl,
  projectName,
  projectNumber,
  date = new Date(),
  folio,
}: DocumentHeaderProps) {
  const displayName = (orgLegalName || orgName).trim() || '—'
  const dateStr = date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

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
          <div>
            <h1 className="print-document-header__org">{displayName}</h1>
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
          {folio != null && folio !== '' && (
            <span className="print-document-header__folio">Folio: {folio}</span>
          )}
        </div>
      </div>
    </header>
  )
}
