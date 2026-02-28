import type { DocumentTemplate } from '@/lib/pdf/document-template'
import { computoTemplate } from './computo.template'
import { transactionsTemplate } from './transactions.template'
import { certificationTemplate } from './certification.template'
import { budgetTemplate } from './budget.template'
import { materialsTemplate } from './materials.template'
import { scheduleTemplate } from './schedule.template'
import { cashflowTemplate } from './cashflow.template'
import { financeDashboardTemplate } from './finance-dashboard.template'
import { projectDashboardTemplate } from './project-dashboard.template'
import { purchasesBySupplierTemplate } from './purchases-by-supplier.template'
import { purchaseOrderTemplate } from './purchase-order.template'

export const documentTemplates = {
  computo: computoTemplate,
  transactions: transactionsTemplate,
  certification: certificationTemplate,
  budget: budgetTemplate,
  materials: materialsTemplate,
  schedule: scheduleTemplate,
  cashflow: cashflowTemplate,
  'finance-dashboard': financeDashboardTemplate,
  'project-dashboard': projectDashboardTemplate,
  'purchases-by-supplier': purchasesBySupplierTemplate,
  'purchase-order': purchaseOrderTemplate,
} as const

export type DocumentTemplateId = keyof typeof documentTemplates

/**
 * Returns the document template for the given id.
 * @throws Error if the template is not registered (e.g. "Unknown document template: xyz")
 */
export function getDocumentTemplate(id: string): DocumentTemplate {
  const template = documentTemplates[id as DocumentTemplateId]
  if (!template) {
    throw new Error(`Unknown document template: ${id}`)
  }
  return template
}
