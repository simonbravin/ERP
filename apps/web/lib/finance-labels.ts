/**
 * Shared labels for finance UI (transaction types, statuses, document types).
 * Single source of truth for Spanish display labels; use i18n where locale varies.
 */

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: 'Factura',
  RECEIPT: 'Recibo',
  CREDIT_NOTE: 'Nota de crédito',
  DEBIT_NOTE: 'Nota de débito',
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Enviado',
  APPROVED: 'Aprobado',
  PAID: 'Pagado',
  VOIDED: 'Anulado',
}

export const TYPE_LABELS: Record<string, string> = {
  EXPENSE: 'Gasto',
  INCOME: 'Ingreso',
  PURCHASE: 'Compra',
  SALE: 'Venta',
  OVERHEAD: 'Overhead',
}
