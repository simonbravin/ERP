/**
 * Canonical display for organization legal/tax identifier in print header.
 * Label is chosen by jurisdiction: Panama → RUC, Argentina → CUIT, else → ID Fiscal.
 * Value comes from OrgProfile.taxId (single field in DB).
 */

export type LegalIdDisplay = { label: string; value: string }

export type LegalIdDisplayInput = {
  taxId?: string | null
  country?: string | null
}

/**
 * Returns label + value for the legal/tax ID to show in PDF header.
 * - Panama (PA / Panama) => label "RUC"
 * - Argentina (AR / Argentina) => label "CUIT"
 * - Otherwise => label "ID Fiscal"
 * Returns null if no taxId or value is empty/whitespace.
 */
export function getLegalIdDisplay(input: LegalIdDisplayInput): LegalIdDisplay | null {
  const value = input.taxId != null ? String(input.taxId).trim() : ''
  if (value === '') return null

  const country = input.country != null ? String(input.country).trim() : ''
  const countryLower = country.toLowerCase()

  let label: string
  if (countryLower === 'pa' || countryLower === 'panama') {
    label = 'RUC'
  } else if (countryLower === 'ar' || countryLower === 'argentina') {
    label = 'CUIT'
  } else {
    label = 'ID Fiscal'
  }

  return { label, value }
}
