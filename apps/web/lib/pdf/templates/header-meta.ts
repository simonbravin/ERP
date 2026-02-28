/**
 * Header meta per document template (folio label/value, optional title).
 * Pure logic — no server/DB — so it can be used from client components.
 */

export interface HeaderMetaParams {
  id?: string
  dateFrom?: string
  dateTo?: string
  from?: string
  to?: string
  partyId?: string
  [key: string]: string | undefined
}

export interface HeaderMeta {
  folioLabel?: string
  folioValue?: string
  title?: string
}

function formatDateRange(from?: string, to?: string): string | undefined {
  if (!from && !to) return undefined
  const fmt = (s: string) => {
    try {
      const d = new Date(s)
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return s
    }
  }
  const fromStr = from ? fmt(from) : '—'
  const toStr = to ? fmt(to) : '—'
  return `${fromStr} → ${toStr}`
}

/**
 * Returns folio label/value and optional title for the given template and params.
 */
export function getHeaderMeta(
  templateId: string,
  params: HeaderMetaParams
): HeaderMeta {
  const { id, dateFrom, dateTo, from, to, partyId } = params

  switch (templateId) {
    case 'computo':
    case 'budget':
    case 'materials':
      return {
        folioLabel: 'Versión',
        folioValue: id ?? undefined,
      }
    case 'certification':
      return {
        folioLabel: 'Proyecto',
        folioValue: id ?? undefined,
      }
    case 'schedule':
      return {
        folioLabel: 'Cronograma',
        folioValue: id ?? undefined,
      }
    case 'transactions':
      return {
        folioLabel: 'Período',
        folioValue: formatDateRange(dateFrom, dateTo) ?? undefined,
      }
    case 'cashflow':
      return {
        folioLabel: 'Período',
        folioValue: formatDateRange(from, to) ?? undefined,
      }
    case 'finance-dashboard':
    case 'project-dashboard':
      return {}
    case 'purchases-by-supplier':
      return partyId
        ? { folioLabel: 'Proveedor', folioValue: partyId }
        : {}
    case 'purchase-order':
      return id ? { folioLabel: 'OC', folioValue: id } : {}
    default:
      return {}
  }
}
