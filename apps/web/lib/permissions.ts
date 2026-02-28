import type { OrgRole } from '@prisma/client'

// Definición de módulos del sistema
export const MODULES = {
  DASHBOARD: 'dashboard',
  PROJECTS: 'projects',
  BUDGET: 'budget',
  FINANCE: 'finance',
  CERTIFICATIONS: 'certifications',
  INVENTORY: 'inventory',
  QUALITY: 'quality',
  DOCUMENTS: 'documents',
  REPORTS: 'reports',
  SUPPLIERS: 'suppliers',
  TEAM: 'team',
  SETTINGS: 'settings',
} as const

export type Module = (typeof MODULES)[keyof typeof MODULES]

// Acciones posibles
export type Permission = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'approve'

// Matriz de permisos por rol
export const ROLE_PERMISSIONS: Record<OrgRole, Partial<Record<Module, Permission[]>>> = {
  OWNER: {
    dashboard: ['view', 'export'],
    projects: ['view', 'create', 'edit', 'delete'],
    budget: ['view', 'create', 'edit', 'delete', 'approve'],
    finance: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    certifications: ['view', 'create', 'edit', 'delete', 'approve'],
    inventory: ['view', 'create', 'edit', 'delete'],
    quality: ['view', 'create', 'edit', 'delete'],
    documents: ['view', 'create', 'edit', 'delete'],
    reports: ['view', 'create', 'edit', 'delete', 'export'],
    suppliers: ['view', 'create', 'edit', 'delete'],
    team: ['view', 'create', 'edit', 'delete'],
    settings: ['view', 'edit'],
  },
  ADMIN: {
    dashboard: ['view', 'export'],
    projects: ['view', 'create', 'edit', 'delete'],
    budget: ['view', 'create', 'edit', 'approve'],
    finance: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    certifications: ['view', 'create', 'edit', 'approve'],
    inventory: ['view', 'create', 'edit', 'delete'],
    quality: ['view', 'create', 'edit', 'delete'],
    documents: ['view', 'create', 'edit', 'delete'],
    reports: ['view', 'create', 'edit', 'export'],
    suppliers: ['view', 'create', 'edit', 'delete'],
    team: ['view', 'create', 'edit'],
    settings: ['view', 'edit'],
  },
  EDITOR: {
    dashboard: ['view'],
    projects: ['view', 'create', 'edit'],
    budget: ['view', 'create', 'edit'],
    finance: ['view', 'create', 'edit'],
    certifications: ['view', 'create', 'edit'],
    inventory: ['view', 'create', 'edit'],
    quality: ['view', 'create', 'edit'],
    documents: ['view', 'create', 'edit'],
    reports: ['view', 'export'],
    suppliers: ['view', 'create'],
    team: ['view'],
    settings: ['view'],
  },
  ACCOUNTANT: {
    dashboard: ['view', 'export'],
    projects: ['view'],
    budget: ['view', 'export'],
    finance: ['view', 'create', 'edit', 'approve', 'export'],
    certifications: ['view', 'approve', 'export'],
    inventory: ['view'],
    quality: ['view'],
    documents: ['view'],
    reports: ['view', 'export'],
    suppliers: ['view'],
    team: ['view'],
    settings: [],
  },
  VIEWER: {
    dashboard: ['view'],
    projects: ['view'],
    budget: ['view'],
    finance: ['view'],
    certifications: ['view'],
    inventory: ['view'],
    quality: ['view'],
    documents: ['view'],
    reports: ['view'],
    suppliers: ['view'],
    team: ['view'],
    settings: [],
  },
}

/** Custom permissions: module (lowercase) -> list of permissions. Overrides role base for that module. */
export type CustomPermissionsMap = Partial<Record<Module, Permission[]>> | null

const MODULE_VALUES = new Set(Object.values(MODULES)) as Set<Module>

/** Obtener permisos efectivos (rol base + custom overrides). */
export function getEffectivePermissions(
  role: OrgRole,
  customPermissions: CustomPermissionsMap
): Partial<Record<Module, Permission[]>> {
  const base = ROLE_PERMISSIONS[role] ?? {}
  if (!customPermissions || typeof customPermissions !== 'object') {
    return base
  }
  const effective: Partial<Record<Module, Permission[]>> = { ...base }
  for (const [module, permissions] of Object.entries(customPermissions)) {
    // customPermissions usa valores de MODULES como clave ('reports', 'dashboard', ...), no las claves ('REPORTS', 'DASHBOARD')
    if (MODULE_VALUES.has(module as Module) && Array.isArray(permissions)) {
      effective[module as Module] = permissions as Permission[]
    }
  }
  return effective
}

export function hasPermission(
  role: OrgRole,
  module: Module,
  permission: Permission,
  customPermissions?: CustomPermissionsMap
): boolean {
  const effective = getEffectivePermissions(role, customPermissions ?? null)
  return effective[module]?.includes(permission) ?? false
}

export function canAccess(
  role: OrgRole,
  module: Module,
  customPermissions?: CustomPermissionsMap
): boolean {
  const effective = getEffectivePermissions(role, customPermissions ?? null)
  return effective[module]?.includes('view') ?? false
}

export function getModulePermissions(
  role: OrgRole,
  module: Module,
  customPermissions?: CustomPermissionsMap
): Permission[] {
  const effective = getEffectivePermissions(role, customPermissions ?? null)
  return effective[module] ?? []
}

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  OWNER: 'Dueño - Acceso total al sistema',
  ADMIN: 'Administrador - Gestión completa excepto configuración crítica',
  EDITOR: 'Editor - Puede crear y modificar datos',
  ACCOUNTANT: 'Contador - Solo ve finanzas y puede aprobar certificaciones',
  VIEWER: 'Visualizador - Solo lectura en todo el sistema',
}
