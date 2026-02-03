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
  MATERIAL: 'hsl(217 91% 60%)', // blue-500
  LABOR: 'hsl(142 76% 36%)', // green-600
  EQUIPMENT: 'hsl(25 95% 53%)', // orange-500
}

export const RESOURCE_TYPE_ICONS: Record<ResourceType, string> = {
  MATERIAL: '🧱',
  LABOR: '👷',
  EQUIPMENT: '🚜',
}
