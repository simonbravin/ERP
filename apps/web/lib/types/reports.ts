/**
 * Types for custom reports (CustomReport model with relations).
 */

export interface CustomReportWithCreator {
  id: string
  orgId: string
  name: string
  description: string | null
  category: string
  reportType: string
  config: unknown
  isPublic: boolean
  createdByUserId: string
  lastRunAt: Date | null
  runCount: number
  createdAt: Date
  updatedAt: Date
  createdBy: {
    fullName: string
  } | null
}
