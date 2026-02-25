/**
 * Contract for PDF document templates.
 * All PDFs are defined via this interface; the PDF engine has no document-specific logic.
 */

export type DocumentTemplates =
  | 'computo'
  | 'transactions'
  | 'certification'
  | 'gantt'

/** Session context passed to validateAccess (API provides userId + orgId from JWT + org member). */
export interface DocumentTemplateSession {
  userId: string
  orgId: string
}

export interface DocumentTemplate {
  id: DocumentTemplates

  buildPrintUrl(params: {
    baseUrl: string
    locale: string
    id?: string
    query?: Record<string, string>
  }): string

  getFileName(params: { id?: string }): string

  validateAccess(params: {
    session: DocumentTemplateSession
    id?: string
  }): Promise<void>
}
