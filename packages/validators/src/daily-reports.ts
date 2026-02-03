import { z } from 'zod'

export const DAILY_REPORT_STATUS = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED'] as const
export type DailyReportStatus = (typeof DAILY_REPORT_STATUS)[number]

export const WEATHER_CONDITION = ['SUNNY', 'CLOUDY', 'RAINY', 'SNOWY', 'WINDY'] as const
export type WeatherCondition = (typeof WEATHER_CONDITION)[number]

export const laborEntrySchema = z.object({
  speciality: z.string().min(1, 'Especialidad requerida'),
  quantity: z.coerce.number().int().min(1, 'Cantidad mínima 1'),
  hours: z.coerce.number().min(0).max(24, 'Horas entre 0 y 24'),
  costPerHour: z.coerce.number().min(0).optional(),
})
export type LaborEntryInput = z.infer<typeof laborEntrySchema>

export const createDailyReportSchema = z.object({
  projectId: z.string().uuid(),
  reportDate: z
    .date()
    .max(new Date(new Date().setHours(23, 59, 59, 999)), 'No puedes reportar fechas futuras'),
  summary: z
    .string()
    .transform((s) => (s ?? '').trim())
    .pipe(z.string().min(5, 'Mínimo 5 caracteres').max(200, 'Máximo 200 caracteres')),
  workAccomplished: z.string().max(10000).optional().nullable(),
  weather: z.enum(WEATHER_CONDITION).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
  safetyIncidents: z.string().max(2000).optional().nullable(),
  laborEntries: z.array(laborEntrySchema).default([]),
  wbsNodeId: z.string().uuid().optional().nullable(),
  wbsNodeIds: z.array(z.string().uuid()).optional().default([]),
})
export type CreateDailyReportInput = z.infer<typeof createDailyReportSchema>

export const updateDailyReportSchema = z.object({
  reportDate: z
    .date()
    .max(new Date(new Date().setHours(23, 59, 59, 999)), 'No puedes reportar fechas futuras')
    .optional(),
  summary: z.string().min(5).max(200).optional(),
  workAccomplished: z.string().max(10000).optional().nullable(),
  weather: z.enum(WEATHER_CONDITION).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
  safetyIncidents: z.string().max(2000).optional().nullable(),
  laborEntries: z.array(laborEntrySchema).optional(),
  wbsNodeId: z.string().uuid().optional().nullable(),
  wbsNodeIds: z.array(z.string().uuid()).optional(),
})
export type UpdateDailyReportInput = z.infer<typeof updateDailyReportSchema>
