/**
 * Finance barrel file — re-exports all finance domain actions for backward compatibility.
 * Implementations are split into domain-specific files:
 *   - finance-helpers.ts — Sync helpers (isEditableStatus, toNum, serializeTransaction)
 *   - finance-transactions.ts — CRUD for transactions/lines, workflow, project transactions
 *   - finance-cashflow.ts — Project and company cashflow, WBS actual costs
 *   - finance-overhead.ts — Company transactions, overhead allocations, overhead dashboard
 *   - finance-kpis.ts — Company finance dashboard, executive dashboard, filter options
 */

// Helpers (non-async, no 'use server')
export {
  isEditableStatus,
  toNum,
  serializeTransaction,
} from './finance-helpers'
export type { SerializedTransactionRow } from './finance-helpers'

// Transactions
export {
  getNextTransactionNumber,
  listFinanceTransactions,
  getFinanceTransaction,
  listProjectsForFinance,
  listPartiesForFinance,
  listCurrencies,
  listWbsNodesForProject,
  createFinanceTransaction,
  createFinanceTransactionWithLines,
  updateFinanceTransaction,
  addFinanceLine,
  updateFinanceLine,
  deleteFinanceLine,
  submitFinanceTransaction,
  approveFinanceTransaction,
  rejectFinanceTransaction,
  markFinanceTransactionPaid,
  voidFinanceTransaction,
  getProjectTransactions,
  getProjectTransaction,
  getPartiesForProject,
  getPartiesForProjectFilter,
  createPartyForTransaction,
  createProjectTransaction,
  updateProjectTransaction,
  deleteProjectTransaction,
  getTransactionAuditLogs,
} from './finance-transactions'
export type {
  ListFinanceTransactionsFilters,
  GetProjectTransactionsFilters,
} from './finance-transactions'

// Cashflow
export {
  getProjectCashflow,
  getProjectCashflowKPIs,
  getProjectCashflowSummary,
  getProjectCashflowBreakdownByWbs,
  getProjectCashflowMonthComparison,
  getWBSActualCosts,
  getWBSActualCost,
  getWBSBudgetAndConsumed,
  getCompanyCashflow,
  getCompanyCashflowDetailed,
  getCashflowMonthComparison,
} from './finance-cashflow'
export type {
  CashflowDataPoint,
  CompanyCashflowPoint,
  CashflowDataPointDetailed,
  CashflowBreakdownItem,
  CompanyCashflowDetailedResult,
  CashflowMonthComparisonResult,
  ProjectCashflowSummary,
  ProjectCashflowBreakdownByWbsItem,
  ProjectCashflowBreakdownByWbsResult,
  WBSBudgetAndConsumed,
} from './finance-cashflow'

// Overhead
export {
  createCompanyTransaction,
  allocateOverhead,
  getOverheadTransactions,
  getOverheadDashboard,
  getApprovedBudgetTotalByProject,
  getOverheadAllocatedToProject,
  getProjectOverheadBudgeted,
  getProjectOverheadConsumed,
  getProjectOverheadItems,
  deleteOverheadAllocation,
  updateOverheadAllocation,
} from './finance-overhead'
export type {
  OverheadTransactionWithAllocations,
  OverheadDashboard,
  ProjectOverheadItem,
} from './finance-overhead'

// KPIs & Dashboards
export {
  getCompanyTransactions,
  getCompanyFinanceBalance,
  getCompanyFinanceDashboard,
  getFinanceExecutiveDashboard,
  getProjectFinanceExecutiveDashboard,
  getActiveProjects,
  getAllProjects,
  getFinanceFilterOptions,
} from './finance-kpis'
export type {
  CompanyTransactionsFilters,
  CompanyFinanceDashboard,
  FinanceExecutiveDashboard,
  ProjectFinanceExecutiveDashboard,
} from './finance-kpis'

// AP/AR & Cash projection & Alerts
export {
  getCompanyAccountsPayable,
  getProjectAccountsPayable,
  getCompanyAccountsReceivable,
  getProjectAccountsReceivable,
  getCompanyCashProjection,
  getProjectCashProjection,
  getCompanyFinanceAlerts,
  getProjectFinanceAlerts,
} from './finance-ap-ar'
export type {
  AccountsPayableFilters,
  AccountsPayableItem,
  AccountsReceivableFilters,
  AccountsReceivableItem,
  CashProjectionResult,
  FinanceAlert,
} from './finance-ap-ar'
