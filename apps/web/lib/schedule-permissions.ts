import type { OrgContext } from '@/lib/org-context'
import { canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'

/**
 * Permiso para mutar cronogramas en un proyecto (crear versión, duplicar, fechas, deps, progreso, etc.).
 *
 * **SCH-A3:** No alcanza con ser `EDITOR` a nivel organización si en el proyecto el rol no puede
 * editar el área SCHEDULE. **OWNER** y **ADMIN** de org conservan bypass (operación sobre cualquier
 * proyecto de la org tras `assertProjectAccess`).
 */
export function canEditSchedule(
  org: OrgContext,
  projectRole: string | null
): boolean {
  if (org.role === 'ADMIN' || org.role === 'OWNER') {
    return true
  }
  return canEditProjectArea(projectRole, PROJECT_AREAS.SCHEDULE)
}
