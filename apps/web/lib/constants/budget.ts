export const RESOURCE_TYPES = {
  MATERIAL: 'MATERIAL',
  LABOR: 'LABOR',
  EQUIPMENT: 'EQUIPMENT',
} as const

export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES]

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  MATERIAL: 'Material',
  LABOR: 'Mano de Obra',
  EQUIPMENT: 'Equipo',
}

export const RESOURCE_TYPE_LABELS_PLURAL: Record<ResourceType, string> = {
  MATERIAL: 'Materiales',
  LABOR: 'Mano de Obra',
  EQUIPMENT: 'Equipos',
}

export const RESOURCE_TYPE_COLORS: Record<ResourceType, string> = {
  MATERIAL: 'hsl(var(--chart-1))',
  LABOR: 'hsl(var(--chart-2))',
  EQUIPMENT: 'hsl(var(--chart-3))',
}

export const RESOURCE_TYPE_ICONS: Record<ResourceType, string> = {
  MATERIAL: '🧱',
  LABOR: '👷',
  EQUIPMENT: '🚜',
}
